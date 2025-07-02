const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const ProjectScanner = require('./project-scanner');
const GitHubScraper = require('./github-scraper');
const CookieImporter = require('./cookie-importer');
const { generateVoteExplanation, generateVoteDecision } = require('./openai-helper');

class HackClubVotingApp {
    constructor() {
        this.mainWindow = null;
        this.projectScanner = null;
        this.githubScraper = null;
        this.cookieImporter = null;
        this.isDebug = process.argv.includes('--debug');
        this.scanInterval = null;
        this.voteCount = 0; // Track vote count
        this.isRunning = false; // Track if auto-voting is running
        this.handlersSetup = false; // Prevent duplicate IPC handlers
    }

    async createWindow() {
        // Haupt-Browser-Fenster erstellen
        this.mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js'),
                webSecurity: false, // Für Cross-Origin Requests zu GitHub
                allowRunningInsecureContent: true,
                experimentalFeatures: true,
                plugins: true,
                webgl: true,
                webaudio: true
            },
            show: true // Debug-Modus: Fenster immer sichtbar
        });

        // Developer Tools öffnen (Debug-Modus)
        if (this.isDebug) {
            this.mainWindow.webContents.openDevTools();
        }

        // Session konfigurieren für Cookie-Persistenz
        await this.setupSession();

        // Request-Handler für erweiterte Browser-Kompatibilität
        this.setupRequestHandlers();

        // Direkt zur Voting-Seite navigieren (spart eine Navigation)
        await this.loadVotingSite();

        // Projekt-Scanner und GitHub-Scraper initialisieren
        this.initializeComponents();

        // Cookie-Import sofort beim Start durchführen
        await this.performImmediateCookieImport();

        // Auto-voting starten
        this.startAutoVoting();

        // Setup IPC handlers
        this.setupEventHandlers();

        console.log('🤖 HackClub Auto Voting Bot Started');
    }

    async setupSession() {
        // Session für Cookie-Persistenz konfigurieren
        const ses = session.defaultSession;
        
        // User-Agent setzen um als normaler Chrome-Browser zu erscheinen (wichtig für Slack-Login)
        const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        ses.setUserAgent(chromeUserAgent);
        
        // Auch für das Hauptfenster setzen
        this.mainWindow.webContents.setUserAgent(chromeUserAgent);
    }

    setupRequestHandlers() {
        const ses = session.defaultSession;
        
        // Request-Handler für bessere Browser-Simulation
        ses.webRequest.onBeforeSendHeaders((details, callback) => {
            // Standard-Browser-Header hinzufügen
            details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
            details.requestHeaders['Accept-Language'] = 'de-DE,de;q=0.9,en;q=0.8';
            details.requestHeaders['Accept-Encoding'] = 'gzip, deflate, br';
            details.requestHeaders['Cache-Control'] = 'max-age=0';
            details.requestHeaders['Sec-Fetch-Dest'] = 'document';
            details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
            details.requestHeaders['Sec-Fetch-Site'] = 'none';
            details.requestHeaders['Sec-Fetch-User'] = '?1';
            details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
            
            callback({ requestHeaders: details.requestHeaders });
        });
    }

    async loadVotingSite() {
        try {
            await this.mainWindow.loadURL('https://summer.hackclub.com/votes/new');
            
        } catch (error) {
            console.error('❌ Error loading Voting-Site:', error);
        }
    }

    async loadHackClubSite() {
        try {
            await this.mainWindow.loadURL('https://summer.hackclub.com');
        } catch (error) {
            console.error('❌ Error loading HackClub Site:', error);
        }
    }

    initializeComponents() {
        this.projectScanner = new ProjectScanner(this.mainWindow);
        this.githubScraper = new GitHubScraper();
        this.cookieImporter = new CookieImporter();

        console.log('🧩 Components initialized');
    }

    async performImmediateCookieImport() {
        try {
            const fs = require('fs');
            const path = require('path');
            const cookieFile = path.join(process.cwd(), 'import-cookies.txt');
            
            // Sofort prüfen, ob Cookie-Datei existiert und importieren
            if (fs.existsSync(cookieFile)) {
                const importSuccess = await this.cookieImporter.checkAndImportFromFile(cookieFile);
                
                if (importSuccess) {
                    console.log('✅ Cookies imported successfully');
                    return;
                }
            }
            
            // Falls keine Datei existiert oder Import fehlschlug, Setup anbieten
            await this.offerCookieImport();
            
        } catch (error) {
            console.error('❌ Error during Cookie-Import:', error);
            // Fallback zu normalem Setup
            await this.offerCookieImport();
        }
    }

    async offerCookieImport() {
        try {
            const fs = require('fs');
            const path = require('path');
            const cookieFile = path.join(process.cwd(), 'import-cookies.txt');
            
            // Prüfen, ob bereits erfolgreich importierte Cookies vorhanden sind
            if (fs.existsSync(cookieFile)) {
                const content = fs.readFileSync(cookieFile, 'utf8');
                if (content.includes('ERFOLGREICH IMPORTIERT')) {
                    console.log('\n🍪 Already imported cookies found');
                    console.log('💡 Use existing cookie configuration');
                    console.log('📝 To add new cookies, edit: import-cookies.txt');
                    
                    // Trotzdem prüfen, ob neue Cookies hinzugefügt wurden (sofort)
                    this.cookieImporter.simpleCookieImport();
                    return;
                }
            }
            
            console.log('\n🍪 COOKIE IMPORT OPTIONS:');
            console.log('═'.repeat(50));
            console.log('Do you want to import cookies from another browser?');
            console.log('This allows you to take over already logged in sessions.');
            console.log('');
            
            // Browser finden
            const browsers = await this.cookieImporter.findAvailableBrowsers();
            
            if (browsers.length > 0) {
                console.log('✅ Found browsers with cookies:');
                browsers.forEach((browser, index) => {
                    console.log(`   ${index + 1}. ${browser.name}`);
                });
            }
            
            console.log('\n📝 EASY COOKIE-IMPORT:');
            console.log('1. Open your browser');
            console.log('2. Go to https://summer.hackclub.com');
            console.log('3. Log in with Slack');
            console.log('4. Copy your cookies here');
            
            // Starte einfachen Cookie-Import sofort
            this.cookieImporter.simpleCookieImport();
            
        } catch (error) {
            console.error('❌ Error during Cookie-Import-Setup:', error);
        }
    }

    startAutoVoting() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('🚀 Auto-voting started');
        
        // Sofortiger erster Scan
        this.performScan();
        
        // Regelmäßige Scans alle 5 Minuten
        this.scanInterval = setInterval(() => {
            if (this.isRunning) {
                this.performScan();
            }
        }, 5 * 60 * 1000);
    }

    stopAutoVoting() {
        this.isRunning = false;
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        console.log('⏹️ Auto-voting stopped');
    }

    async performScan() {
        if (!this.isRunning) return;

        try {
            // Projekte scannen
            const projects = await this.projectScanner.scanProjects();
            
            if (projects.length < 2) {
                console.log('⚠️ Not enough projects found for voting');
                return;
            }

            // If at least two projects, generate explanation and fill voting form
            if (projects.length >= 2) {
                // Get actual project details from the voting form to match with OpenAI's decision
                const voteProjects = await this.projectScanner.getVoteProjectDetails();
                
                // Filter out the 'tie' option for now, we only need the two projects
                const formProject1 = voteProjects.find(p => p.id !== 'tie');
                const formProject2 = voteProjects.find(p => p.id !== 'tie' && p.id !== formProject1.id);

                if (formProject1 && formProject2) {
                    // Map project titles from the voting form to their full project data (including repo URL)
                    const projectMap = new Map();
                    for (const p of projects) {
                        projectMap.set(p.title, p);
                    }

                    const fullProject1 = projectMap.get(formProject1.title);
                    const fullProject2 = projectMap.get(formProject2.title);

                    let readmeContent1 = '';
                    let readmeContent2 = '';

                    if (fullProject1) {
                        readmeContent1 = await this.processProject(fullProject1);
                    }
                    if (fullProject2) {
                        readmeContent2 = await this.processProject(fullProject2);
                    }

                    const voteDecision = await generateVoteDecision({
                        project1: formProject1.title,
                        project2: formProject2.title,
                        readme1: readmeContent1,
                        readme2: readmeContent2
                    });
                    
                    let winnerIdToSelect = null;
                    let winnerName = '';
                    switch (voteDecision.winner) {
                        case 'project1':
                            winnerIdToSelect = formProject1.id;
                            winnerName = formProject1.title;
                            break;
                        case 'project2':
                            winnerIdToSelect = formProject2.id;
                            winnerName = formProject2.title;
                            break;
                        case 'tie':
                            winnerIdToSelect = voteProjects.find(p => p.id === 'tie').id;
                            winnerName = 'TIE';
                            break;
                        default:
                            console.warn('⚠️ OpenAI returned an unknown winner: ', voteDecision.winner);
                            break;
                    }

                    if (winnerIdToSelect) {
                        this.voteCount++;
                        console.log(`🗳️ Vote no. ${this.voteCount} | Voted for: ${winnerName}`);
                        
                        await this.projectScanner.fillVotingForm({
                            winnerId: winnerIdToSelect,
                            explanation: voteDecision.explanation,
                            dryRun: false // Changed to false to enable actual submission
                        });

                        // After successful submission, wait for page reload and then re-scan
                        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds for reload
                        await this.performScan(); // Repeat the scan
                    } else {
                        console.log('⚠️ Could not determine a winner to select.');
                    }
                } else {
                    console.log('⚠️ Not enough project details found in voting form for automated decision.');
                }
            }
            
        } catch (error) {
            console.error('❌ Scan error:', error.message);
        }
    }

    async processProject(project) {
        try {
            if (!project.repositoryUrl) {
                return '';
            }

            const readmeContent = await this.githubScraper.getReadmeContent(project.repositoryUrl);
            return readmeContent || '';

        } catch (error) {
            return '';
        }
    }

    setupEventHandlers() {
        if (this.handlersSetup) {
            return; // Handlers already setup
        }
        
        // IPC-Handler für verschiedene Events einrichten
        ipcMain.handle('get-projects', async () => {
            try {
                return await this.projectScanner.scanProjects();
            } catch (error) {
                console.error('❌ Error getting projects:', error);
                return [];
            }
        });

        ipcMain.handle('get-readme', async (event, repoUrl) => {
            try {
                return await this.githubScraper.getReadme(repoUrl);
            } catch (error) {
                console.error('❌ Error getting README:', error);
                return null;
            }
        });

        ipcMain.on('log', (event, message) => {
            console.log('🖥️ Renderer:', message);
        });

        ipcMain.handle('get-app-info', () => {
            return {
                isDebug: this.isDebug,
                isRunning: this.isRunning,
                voteCount: this.voteCount
            };
        });
        
        this.handlersSetup = true; // Mark handlers as setup
    }
}

// App Event Handlers
app.whenReady().then(async () => {
    const votingApp = new HackClubVotingApp();
    await votingApp.createWindow();
    votingApp.setupEventHandlers();

    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await votingApp.createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Uncaught Exception Handler
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
}); 
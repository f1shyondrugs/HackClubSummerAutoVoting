/**
 * ProjectScanner - Scannt die HackClub Summer Voting Seite nach Projekten
 * und extrahiert Repository-Links aus den REPOSITORY-Buttons
 */
class ProjectScanner {
    constructor(browserWindow) {
        this.browserWindow = browserWindow;
        this.votingUrl = 'https://summer.hackclub.com/votes/new';
    }

    /**
     * Hauptmethode zum Scannen aller Projekte
     * @returns {Array} Array von Projekt-Objekten mit Titel und Repository-URL
     */
    async scanProjects() {
        try {
            // Sicherstellen, dass wir auf der Voting-Seite sind (Retry-Logik)
            const maxRetries = 3;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                const currentUrlCheck = this.browserWindow.webContents.getURL();
                if (currentUrlCheck.includes('/votes/new')) {
                    break; // Wir sind auf der richtigen Seite
                }

                try {
                    await this.navigateToVotingPage();
                } catch (navErr) {
                    // Silent error handling
                }

                // Kleine Wartezeit, damit Seite laden kann
                await new Promise(res => setTimeout(res, 4000));
            }

            // Finaler Check
            if (!this.browserWindow.webContents.getURL().includes('/votes/new')) {
                return [];
            }
            
            // Prüfen ob wir auf der richtigen Seite sind
            const currentUrl = this.browserWindow.webContents.getURL();
            if (!currentUrl.includes('/votes/new')) {
                await this.navigateToVotingPage();
            }
            
            // Warten bis Seite vollständig geladen
            await this.waitForPageLoad();
            
            // Projekte extrahieren
            const projects = await this.extractProjects();
            
            return projects;
            
        } catch (error) {
            return [];
        }
    }

    /**
     * Navigiert zur HackClub Voting Seite
     */
    async navigateToVotingPage() {
        await this.browserWindow.loadURL(this.votingUrl);
    }

    /**
     * Wartet bis die Seite vollständig geladen ist
     */
    async waitForPageLoad() {
        return new Promise((resolve) => {
            // Prüfen ob wir bereits auf der Voting-Seite sind
            const currentUrl = this.browserWindow.webContents.getURL();
            if (currentUrl.includes('/votes/new')) {
                // Bereits auf richtiger Seite, kürzere Wartezeit
                setTimeout(resolve, 3000); // 3 Sekunden für dynamische Inhalte
            } else {
                // Neue Navigation, längere Wartezeit
                setTimeout(resolve, 8000); // 8 Sekunden für vollständige Seitenladung
            }
        });
    }

    /**
     * Extrahiert alle Projekte von der Seite
     * @returns {Array} Array von Projekt-Objekten
     */
    async extractProjects() {
        return await this.browserWindow.webContents.executeJavaScript(`
            (function() {
                const projects = [];
                const projectDivs = document.querySelectorAll('[data-project-index]');
                console.log('🔍 Searching for projects with data-project-index: ' + projectDivs.length);
                projectDivs.forEach(function(div, idx) {
                    const repoLink = div.querySelector('a[href*="github.com"]');
                    if (repoLink) {
                        const titleEl = div.querySelector('h1, h2, h3, .text-xl, .text-3xl');
                        const titleText = titleEl ? titleEl.textContent.trim() : ('Project ' + idx);
                        console.log('✅ Project found: ' + titleText + ' -> ' + repoLink.href);
                        projects.push({
                            title: titleText,
                            repositoryUrl: repoLink.href,
                            scannedAt: new Date().toISOString(),
                            method: 'data_project_index_simple'
                        });
                    } else {
                        console.log('⚠️ No GitHub link in project ' + idx);
                    }
                });
                console.log('📊 Total ' + projects.length + ' projects extracted');
                return projects;
            })();
        `);
    }

    /**
     * Klickt auf alle REPOSITORY-Buttons (für zukünftige Funktionen)
     * @returns {Array} Array der geklickten URLs
     */
    async clickAllRepositoryButtons() {
        return await this.browserWindow.webContents.executeJavaScript(`
            (function() {
                const clickedUrls = [];
                
                // Alle REPOSITORY-Buttons finden
                const repositoryButtons = Array.from(document.querySelectorAll('a, button'))
                    .filter(el => {
                        const text = el.textContent.trim().toUpperCase();
                        return text.includes('REPOSITORY') && !text.includes('DEMO');
                    });
                
                console.log('🖱️  Klicke auf ' + repositoryButtons.length + ' REPOSITORY-Buttons...');
                
                repositoryButtons.forEach((button, index) => {
                    try {
                        const url = button.href || button.getAttribute('href');
                        if (url) {
                            clickedUrls.push(url);
                            console.log((index + 1) + '. Geklickt: ' + url);
                            
                            // Button klicken (öffnet in neuem Tab/Fenster)
                            button.click();
                        }
                    } catch (error) {
                        console.error('❌ Fehler beim Klicken auf Button ' + (index + 1) + ':', error);
                    }
                });
                
                return clickedUrls;
            })();
        `);
    }

    async fillVotingForm({ winnerId = null, explanation = "", dryRun = true }) {
        return await this.browserWindow.webContents.executeJavaScript(`
            (function() {
                const form = document.querySelector('form[action="/votes"]');
                if (!form) {
                    return false;
                }
                // Select the winner radio button if winnerId is provided
                if (${winnerId ? 'true' : 'false'}) {
                    const radio = form.querySelector('input[type="radio"][name="vote[winning_project_id]"][value="${winnerId}"]');
                    if (radio) {
                        // Also click the label/button for the radio input to trigger UI updates
                        const label = radio.closest('label');
                        if (label) {
                            label.click();
                        } else {
                            radio.checked = true;
                            radio.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                }
                // Fill the explanation textarea
                const textarea = form.querySelector('textarea[name="vote[explanation]"]');
                if (textarea) {
                    textarea.value = "${explanation.replace(/"/g, '\"')}";
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }

                if (!${dryRun}) {
                    const submitButton = form.querySelector('input[type="submit"], button[type="submit"]');
                    if (submitButton) {
                        submitButton.click();
                        return true; // Indicate successful submission
                    } else {
                        return false;
                    }
                } else {
                    return true; // Indicate success for dry run
                }
            })();
        `);
    }

    /**
     * Extracts project IDs and titles from the voting form's radio buttons.
     * @returns {Array} An array of objects like { id: '123', title: 'Project Name' } or { id: 'tie', title: 'Tie' }.
     */
    async getVoteProjectDetails() {
        return await this.browserWindow.webContents.executeJavaScript(`
            (function() {
                const projectRadios = document.querySelectorAll('input[type="radio"][name="vote[winning_project_id]"]');
                const projects = [];
                projectRadios.forEach(radio => {
                    const value = radio.value;
                    let title = '';
                    if (value === 'tie') {
                        title = 'Tie';
                    } else {
                        const labelDiv = radio.closest('label').querySelector('div > span');
                        title = labelDiv ? labelDiv.textContent.trim() : 'Unknown Project';
                    }
                    projects.push({
                        id: value,
                        title: title
                    });
                });
                return projects;
            })();
        `);
    }
}

module.exports = ProjectScanner; 
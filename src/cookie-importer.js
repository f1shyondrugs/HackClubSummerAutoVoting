const fs = require('fs');
const path = require('path');
const { session } = require('electron');
class CookieImporter {
    constructor() {
        this.supportedBrowsers = {
            chrome: {
                name: 'Google Chrome',
                paths: [
                    path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'Default', 'Cookies'),
                    path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cookies')
                ]
            },
            edge: {
                name: 'Microsoft Edge',
                paths: [
                    path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cookies'),
                    path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cookies')
                ]
            },
            firefox: {
                name: 'Mozilla Firefox',
                paths: [
                    path.join(process.env.APPDATA, 'Mozilla', 'Firefox', 'Profiles'),
                    path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles')
                ]
            }
        };
    }
    async findAvailableBrowsers() {
        const available = [];
        for (const [key, browser] of Object.entries(this.supportedBrowsers)) {
            for (const cookiePath of browser.paths) {
                try {
                    if (fs.existsSync(cookiePath)) {
                        available.push({
                            key,
                            name: browser.name,
                            path: cookiePath
                        });
                        break;
                    }
                } catch (error) {
                }
            }
        }
        console.log(`🔍 ${available.length} browsers with cookies found:`);
        available.forEach(browser => {
            console.log(`   - ${browser.name}: ${browser.path}`);
        });
        return available;
    }
    async manualCookieImport() {
        console.log('\n📋 COOKIE IMPORT INSTRUCTIONS:');
        console.log('═'.repeat(50));
        console.log('1. Open your browser (Chrome/Edge/Firefox)');
        console.log('2. Go to https://summer.hackclub.com');
        console.log('3. Log in with Slack');
        console.log('4. Open the Developer Tools (F12)');
        console.log('5. Go to the "Application" tab');
        console.log('6. Click on "Cookies" → "https://summer.hackclub.com"');
        console.log('7. Copy the important cookie values');
        console.log('8. Paste them below');
        console.log('═'.repeat(50));
        return this.promptForCookies();
    }
    async simpleCookieImport() {
        console.log('\n🚀 SIMPLE COOKIE IMPORT:');
        console.log('═'.repeat(50));
        console.log('1. Open a new tab in your browser');
        console.log('2. Visit: https://summer.hackclub.com');
        console.log('3. Log in completely');
        console.log('4. Copy and run this URL:');
        console.log('');
        console.log('javascript:(function(){');
        console.log('  const cookies = document.cookie.split(\";\");');
        console.log('  const important = cookies.filter(c => ');
        console.log('    c.includes(\"session\") || c.includes(\"auth\") || ');
        console.log('    c.includes(\"user\"));');
        console.log('  alert(\"Cookies: \" + important.join(\"; \"));');
        console.log('})();');
        console.log('');
        console.log('5. Copy the displayed cookies and enter them here');
        console.log('═'.repeat(50));
        return this.promptForCookieString();
    }
    async promptForCookieString() {
        return new Promise((resolve) => {
            console.log('\n📝 Enter your cookies (Format: name1=value1; name2=value2):');
            console.log('💡 Tip: Leave this field empty and press Enter to skip automatic import');
            const cookieFile = path.join(process.cwd(), 'import-cookies.txt');
            if (!fs.existsSync(cookieFile)) {
                console.log(`\n📄 Cookie import file created: ${cookieFile}`);
                console.log('1. Open the file import-cookies.txt');
                console.log('2. Paste your cookies (one per line: name=value)');
                console.log('3. Save the file');
                console.log('4. The program will check the cookies every 5 seconds automatically');
                const template = `# HackClub Cookie Import
# Paste your cookies here (one per line)
# Format: cookieName=cookieValue
# Example:
# user_id=your_user_id_here

# Remove these comments and add real cookies:
`;
                fs.writeFileSync(cookieFile, template);
            } else {
                console.log(`\n📄 Cookie import file found: ${cookieFile}`);
                console.log('💡 Using existing cookie file');
                console.log('🔄 Checking for changes every 5 seconds...');
            }
            this.checkAndImportFromFile(cookieFile).then((success) => {
                if (success) {
                    resolve(true);
                    return;
                }
                const checkInterval = setInterval(() => {
                    this.checkAndImportFromFile(cookieFile).then((success) => {
                        if (success) {
                            clearInterval(checkInterval);
                            resolve(true);
                        }
                    });
                }, 5000);
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.log('⏰ Cookie import timeout reached');
                    resolve(false);
                }, 300000);
            });
        });
    }
    async checkAndImportFromFile(cookieFile) {
        try {
            if (!fs.existsSync(cookieFile)) return false;
            const content = fs.readFileSync(cookieFile, 'utf8');
            if (content.includes('ERFOLGREICH IMPORTIERT')) {
                const newCookieLines = content.split('\n').filter(line => {
                    return line.trim() && 
                           !line.startsWith('#') && 
                           line.includes('=') &&
                           !line.includes('✅ Import erfolgreich');
                });
                if (newCookieLines.length === 0) {
                    return false;
                }
                console.log(`\n🔄 ${newCookieLines.length} new cookies found in existing file...`);
            }
            const lines = content.split('\n').filter(line => 
                line.trim() && !line.startsWith('#') && line.includes('=')
            );
            if (lines.length === 0) return false;
            console.log(`\n📥 Importing ${lines.length} cookies...`);
            const cookies = [];
            for (const line of lines) {
                const [name, ...valueParts] = line.split('=');
                const value = valueParts.join('=');
                if (name && value) {
                    cookies.push({
                        name: name.trim(),
                        value: value.trim(),
                        domain: '.hackclub.com',
                        url: 'https://summer.hackclub.com'
                    });
                }
            }
            const ses = session.defaultSession;
            for (const cookie of cookies) {
                await ses.cookies.set({
                    url: cookie.url,
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    secure: true,
                    httpOnly: false
                });
                console.log(`✅ Cookie set: ${cookie.name}`);
            }
            const successMessage = `# HackClub Cookie Import - ERFOLGREICH IMPORTIERT
# Last update: ${new Date().toLocaleString('en-US')}
# These cookies were successfully imported into Electron.
# You can keep this file for future imports.

# If you want to add new cookies, add them below:
# Format: cookieName=cookieValue

${content}

# ✅ Import successfully completed at ${new Date().toLocaleString('en-US')}
`;
            fs.writeFileSync(cookieFile, successMessage);
            console.log('🎉 Cookies imported successfully!');
            console.log('💾 Cookie file updated with success status');
            console.log('🔄 The Electron window should now be logged in');
            return true;
        } catch (error) {
            console.error('❌ Error during cookie import:', error.message);
            return false;
        }
    }
    async exportCurrentCookies() {
        try {
            const ses = session.defaultSession;
            const cookies = await ses.cookies.get({ domain: '.hackclub.com' });
            const exportData = {
                timestamp: new Date().toISOString(),
                cookies: cookies.map(cookie => ({
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path
                }))
            };
            const exportFile = path.join(process.cwd(), 'hackclub-cookies-backup.json');
            fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
            console.log(`💾 Cookies exported to: ${exportFile}`);
            return exportFile;
        } catch (error) {
            console.error('❌ Error during cookie export:', error);
            return null;
        }
    }
}
module.exports = CookieImporter; 
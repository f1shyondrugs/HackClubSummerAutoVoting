const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script für sichere IPC-Kommunikation
 * Stellt APIs für den Renderer-Process zur Verfügung
 */

// API für HackClub Voting App im Renderer-Context verfügbar machen
contextBridge.exposeInMainWorld('hackclubAPI', {
    // Projekte von der Voting-Seite abrufen
    getProjects: () => ipcRenderer.invoke('get-projects'),
    
    // README von GitHub Repository abrufen
    getReadme: (repoUrl) => ipcRenderer.invoke('get-readme', repoUrl),
    
    // Debug-Logging an Main Process senden
    log: (message) => ipcRenderer.send('log', message),
    
    // App-Informationen abrufen
    getAppInfo: () => ipcRenderer.invoke('get-app-info')
});

// Zusätzliche Utilities für DOM-Manipulation
contextBridge.exposeInMainWorld('domUtils', {
    // Element-Suche mit verschiedenen Strategien
    findElement: (selector) => {
        return document.querySelector(selector);
    },
    
    findElementByText: (tagName, text) => {
        const elements = Array.from(document.getElementsByTagName(tagName));
        return elements.find(el => el.textContent.trim().includes(text));
    },
    
    // Button-Klick-Simulation
    clickButton: (button) => {
        if (button) {
            button.click();
            return true;
        }
        return false;
    },
    
    // URL-Extraktion aus Links
    extractUrl: (linkElement) => {
        return linkElement ? linkElement.href : null;
    },
    
    // Warten auf DOM-Änderungen
    waitForElement: (selector, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }
            
            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} nicht gefunden nach ${timeout}ms`));
            }, timeout);
        });
    }
});

// Debug-Informationen in der Konsole ausgeben
console.log('🔧 HackClub Voting App Preload geladen');
console.log('🌐 APIs verfügbar:', Object.keys(window.hackclubAPI || {}));
console.log('🛠️  DOM Utils verfügbar:', Object.keys(window.domUtils || {})); 
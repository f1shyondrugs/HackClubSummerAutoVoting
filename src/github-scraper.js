const axios = require('axios');

/**
 * GitHubScraper - Lädt README-Dateien von GitHub-Repositories herunter
 * Unterstützt verschiedene README-Formate und Repository-Strukturen
 */
class GitHubScraper {
    constructor() {
        this.baseApiUrl = 'https://api.github.com';
        this.rawBaseUrl = 'https://raw.githubusercontent.com';
        
        // HTTP-Client mit Standardkonfiguration
        this.httpClient = axios.create({
            timeout: 10000, // 10 Sekunden Timeout
            headers: {
                'User-Agent': 'HackClub-Voting-App/1.0.0',
                'Accept': 'application/vnd.github.v3+json'
            }
        });
    }

    /**
     * Hauptmethode zum Abrufen der README eines GitHub-Repositories
     * @param {string} repositoryUrl - Die GitHub Repository URL
     * @returns {string|null} README-Inhalt als Text oder null bei Fehler
     */
    async getReadme(repositoryUrl) {
        try {
            // Repository-Informationen aus URL extrahieren
            const repoInfo = this.parseRepositoryUrl(repositoryUrl);
            if (!repoInfo) {
                throw new Error('Ungültige GitHub-URL');
            }
            
            // README mit verschiedenen Methoden versuchen
            const readme = await this.fetchReadmeWithFallback(repoInfo);
            
            if (readme) {
                return readme;
            } else {
                return null;
            }
            
        } catch (error) {
            return null;
        }
    }

    /**
     * Alias for getReadme method (for compatibility)
     * @param {string} repositoryUrl - Die GitHub Repository URL
     * @returns {string|null} README-Inhalt als Text oder null bei Fehler
     */
    async getReadmeContent(repositoryUrl) {
        return await this.getReadme(repositoryUrl);
    }

    /**
     * Parst eine GitHub-Repository-URL und extrahiert Owner und Repository-Name
     * @param {string} url - GitHub Repository URL
     * @returns {Object|null} {owner, repo, branch} oder null bei ungültiger URL
     */
    parseRepositoryUrl(url) {
        try {
            // Verschiedene GitHub-URL-Formate unterstützen
            const patterns = [
                // https://github.com/owner/repo
                /github\.com\/([^\/]+)\/([^\/]+)(?:\/|$)/,
                // https://github.com/owner/repo/tree/branch
                /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)/,
                // https://github.com/owner/repo/blob/branch/...
                /github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)/
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) {
                    return {
                        owner: match[1],
                        repo: match[2].replace(/\.git$/, ''), // .git Suffix entfernen
                        branch: match[3] || 'main' // Standard Branch
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('❌ Fehler beim Parsen der Repository-URL:', error);
            return null;
        }
    }

    /**
     * Versucht README mit verschiedenen Fallback-Methoden zu laden
     * @param {Object} repoInfo - Repository-Informationen {owner, repo, branch}
     * @returns {string|null} README-Inhalt oder null
     */
    async fetchReadmeWithFallback(repoInfo) {
        const methods = [
            () => this.fetchReadmeViaApi(repoInfo),
            () => this.fetchReadmeViaRaw(repoInfo, 'main'),
            () => this.fetchReadmeViaRaw(repoInfo, 'master'),
            () => this.fetchReadmeViaRaw(repoInfo, repoInfo.branch),
            () => this.fetchReadmeViaRaw(repoInfo, 'develop')
        ];

        for (const method of methods) {
            try {
                const readme = await method();
                if (readme) {
                    return readme;
                }
            } catch (error) {
                // Fehler ignorieren und nächste Methode versuchen
                continue;
            }
        }

        return null;
    }

    /**
     * Lädt README über die GitHub API
     * @param {Object} repoInfo - Repository-Informationen
     * @returns {string|null} README-Inhalt oder null
     */
    async fetchReadmeViaApi(repoInfo) {
        try {
            const url = `${this.baseApiUrl}/repos/${repoInfo.owner}/${repoInfo.repo}/readme`;
            
            const response = await this.httpClient.get(url);
            
            if (response.data && response.data.content) {
                // Base64-kodierter Inhalt dekodieren
                const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
                return content;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Lädt README direkt von der Raw-GitHub-URL
     * @param {Object} repoInfo - Repository-Informationen
     * @param {string} branch - Branch-Name
     * @returns {string|null} README-Inhalt oder null
     */
    async fetchReadmeViaRaw(repoInfo, branch) {
        const readmeFiles = [
            'README.md',
            'readme.md',
            'README.MD',
            'README.txt',
            'README.rst',
            'README'
        ];

        for (const filename of readmeFiles) {
            try {
                const url = `${this.rawBaseUrl}/${repoInfo.owner}/${repoInfo.repo}/${branch}/${filename}`;
                
                const response = await this.httpClient.get(url);
                
                if (response.data && typeof response.data === 'string') {
                    return response.data;
                }
            } catch (error) {
                // Datei nicht gefunden, nächste versuchen
                continue;
            }
        }

        return null;
    }

    /**
     * Bereinigt und formatiert README-Inhalt für bessere Lesbarkeit
     * @param {string} content - Raw README-Inhalt
     * @returns {string} Bereinigter Inhalt
     */
    cleanReadmeContent(content) {
        if (!content) return '';

        try {
            // Übermäßige Leerzeilen entfernen
            let cleaned = content.replace(/\n{3,}/g, '\n\n');
            
            // HTML-Tags entfernen (falls vorhanden)
            cleaned = cleaned.replace(/<[^>]*>/g, '');
            
            // Markdown-Links vereinfachen [Text](URL) -> Text (URL)
            cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
            
            // Übermäßige Hashtags reduzieren
            cleaned = cleaned.replace(/#{4,}/g, '###');
            
            return cleaned.trim();
        } catch (error) {
            console.error('❌ Fehler beim Bereinigen des README-Inhalts:', error);
            return content;
        }
    }

    /**
     * Extrahiert Repository-Statistiken (für zukünftige Features)
     * @param {Object} repoInfo - Repository-Informationen
     * @returns {Object|null} Repository-Statistiken
     */
    async getRepositoryStats(repoInfo) {
        try {
            const url = `${this.baseApiUrl}/repos/${repoInfo.owner}/${repoInfo.repo}`;
            const response = await this.httpClient.get(url);
            
            if (response.data) {
                return {
                    stars: response.data.stargazers_count,
                    forks: response.data.forks_count,
                    language: response.data.language,
                    size: response.data.size,
                    lastUpdated: response.data.updated_at,
                    description: response.data.description
                };
            }
            
            return null;
        } catch (error) {
            console.log(`⚠️  Konnte Repository-Statistiken nicht laden: ${error.message}`);
            return null;
        }
    }

    /**
     * Testet die Verbindung zu GitHub
     * @returns {boolean} true wenn Verbindung erfolgreich
     */
    async testConnection() {
        try {
            const response = await this.httpClient.get(`${this.baseApiUrl}/rate_limit`);
            console.log('✅ GitHub-Verbindung erfolgreich getestet');
            console.log(`📊 API Rate Limit: ${response.data.rate.remaining}/${response.data.rate.limit}`);
            return true;
        } catch (error) {
            console.error('❌ GitHub-Verbindung fehlgeschlagen:', error.message);
            return false;
        }
    }
}

module.exports = GitHubScraper; 
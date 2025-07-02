# HackClub Summer Auto-Voting Bot

## Overview

This Electron application automates the process of scanning HackClub Summer projects, extracting GitHub repository links, downloading README files, and intelligently voting on them using the OpenAI (ChatGPT) API. It's designed to streamline the voting process for HackClub Summer participants and judges.

## Features

-   **Automated Project Scanning**: Automatically navigates to the HackClub Summer voting page and identifies new projects.
-   **GitHub Integration**: Extracts GitHub repository links from scanned projects and fetches their `README.md` content.
-   **AI-Powered Voting**: Utilizes the OpenAI API to generate a vote decision (Project 1, Project 2, or Tie) and a detailed explanation based on the project READMEs.
-   **Automated Vote Submission**: Automatically fills and submits the voting form on the HackClub platform.
-   **Cookie Persistence**: Maintains your login session across application restarts by importing and persisting cookies.
-   **Clean Terminal Output**: Provides concise and clear logs, focusing on essential information like vote numbers and results.
-   **Modular Design**: Structured codebase for easy maintenance and future extensions.

## Getting Started

### Prerequisites

*   Node.js (LTS version recommended)
*   npm (Node Package Manager)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/YOUR_GITHUB_USERNAME/HackClubSummerAutoVoting.git
    cd HackClubSummerAutoVoting
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

### 1. OpenAI API Key (`config.json`)

To enable the AI-powered voting, you need an OpenAI API key.

1.  **Create `config.json`**: Duplicate `config.example.json` and rename it to `config.json`.
    ```bash
    cp config.example.json config.json
    ```
2.  **Add your OpenAI API Key**: Open `config.json` and replace `"YOUR_OPENAI_API_KEY"` with your actual OpenAI API key.
    ```json
    {
      "openai_api_key": "YOUR_OPENAI_API_KEY"
    }
    ```
    **Note**: `config.json` is ignored by Git to protect your API key.

### 2. Import Cookies (`import-cookies.txt`)

To log in to the HackClub Summer website, the application requires your browser cookies.

1.  **Create `import-cookies.txt`**: If it doesn't exist, the application will create an empty `import-cookies.txt` file in the project root.
2.  **Obtain Cookies**:
    *   Open your browser (Chrome/Edge/Firefox) and go to `https://summer.hackclub.com`.
    *   Log in with Slack.
    *   Open Developer Tools (F12 or Cmd+Option+I/Ctrl+Shift+I).
    *   Go to the "Application" tab -> "Cookies" -> `https://summer.hackclub.com`.
    *   Copy the relevant cookie values (e.g., `_journey_session`, `ahoy_visit`, `ahoy_visitor`, `fs_lua`, `fs_uid`).
    *   Alternatively, you can run the following JavaScript in your browser's console on the HackClub site to get the necessary cookies:
        ```javascript
        javascript:(function(){
          const cookies = document.cookie.split(";");
          const important = cookies.filter(c =>
            c.includes("session") || c.includes("auth") ||
            c.includes("user"));
          alert("Cookies: " + important.join("; "));
        })();
        ```
3.  **Paste Cookies**: Paste the copied cookies into `import-cookies.txt`, one `name=value` pair per line.
    ```
    _journey_session=your_session_value
    ahoy_visit=your_ahoy_visit_value
    ahoy_visitor=your_ahoy_visitor_value
    fs_lua=your_fs_lua_value
    fs_uid=your_fs_uid_value
    ```
    The application will automatically detect and import these cookies on startup and monitor the file for changes.

## Usage

To run the application:

```bash
npm run dev
```

The Electron window will open and automatically start the voting process. You will see concise output in your terminal indicating the bot's progress, for example:

```
🤖 HackClub Auto Voting Bot Started
✅ Cookies imported successfully
🚀 Auto-voting started
🗳️ Vote no. 1 | Voted for: Project Skill-icons
```

The bot will continuously scan for new projects, generate votes, and submit them.

## Troubleshooting

*   **"Unsupported Browser" Error**: Ensure your `import-cookies.txt` file contains valid and up-to-date cookies. The application sets a specific User-Agent to mimic a standard Chrome browser.
*   **"0 projects found" / "Script failed to execute"**: This might indicate issues with the project scanning logic due to changes in the HackClub website's DOM. Check the console for more specific errors.
*   **`TypeError: Configuration is not a constructor`**: This typically means the `openai` package is not correctly installed or an older version is being loaded. Try running `npm cache clean --force` followed by `rm -Recurse -Force node_modules, package-lock.json; npm install` (for PowerShell) or `rm -rf node_modules package-lock.json && npm install` (for bash/cmd) and then `npm run dev`.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details. 
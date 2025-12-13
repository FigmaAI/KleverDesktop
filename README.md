<div align="center">
  <img src="src/assets/logo.png" alt="Klever Desktop Logo" width="200" height="200">

  # Klever Desktop

  **AI-Powered UI/UX Auto Research for Android & Web**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
  [![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://www.python.org/)

  [Download](#-download) • [Quick Start](#-quick-start) • [For Developers](#-for-developers) • [Documentation](CLAUDE.md)

</div>

---

## Overview

**Klever Desktop** is a powerful cross-platform application that democratizes UI automation. By wrapping the [AppAgent](https://github.com/FigmaAI/appagent) engine in a modern Electron interface, it allows anyone to create, schedule, and monitor AI-driven automaton tasks for Android apps and websites.

Whether you're a QA engineer, developer, or enthusiast, Klever Desktop enables you to run complex automation workflows using local LLMs (Ollama) or cloud providers, all without writing a single line of code.

### ✨ Key Features

- **🧠 Local-First AI**: Run completely offline using Ollama (Llama 3.2 Vision, Qwen 2.5-VL) for privacy and zero cost.
- **🤖 Multi-Platform Support**: Seamlessly automate Android devices (via ADB) and web browsers (via Playwright).
- **🔌 Multi-Provider Ready**: Mix and match models from OpenAI, Anthropic, OpenRouter, Grok, and more.
- **📅 Task Scheduling**: Plan tasks to run automatically at specific times.
- **💻 Universal Terminal**: Integrated terminal for real-time monitoring of all backend processes and logs.
- **📊 Auto-Generated Reports**: Get detailed Markdown reports with screenshots and action traces after every run.
- **🎨 Modern UI**: A beautiful, dark-mode-first interface built with React 18, shadcn/ui, and Framer Motion.

---

## 📥 Download

### Latest Release

Get the latest version from our [Releases page](https://github.com/FigmaAI/KleverDesktop/releases):

| Platform | File | Note |
|----------|------|------|
| **macOS** | `Klever.Desktop-{version}-universal.dmg` | Universal binary (Apple Silicon + Intel) |
| **Windows** | `klever-desktop-{version} Setup.exe` | smartScreen warning expected (unsigned) |

### Installation Guide

#### macOS
1. Open the downloaded `.dmg` file.
2. Drag **Klever Desktop** to your Applications folder.
3. Launch the app. It is notarized by Apple, so Gatekeeper will verify it safely.

#### Windows
1. Run the `.exe` installer.
2. **SmartScreen Warning**: If Windows prevents startup:
   - Click **"More info"**
   - Click **"Run anyway"**
3. The app will install and launch automatically.

---

## 🚀 Quick Start

### 1. Initial Setup
On first launch, the **Setup Wizard** will guide you:
- **Environment**: Checks for Python 3.11+, Playwright, and ADB.
- **AI Model**: Connect to a local Ollama instance (recommended) or enter API keys for cloud models.
- **Verification**: Runs a 30-second integration test to ensure all systems are go.

### 2. Create a Project
- Click **"New Project"**.
- Select **Android** (requires USB debugging) or **Web** (requires a target URL).
- Give it a name (e.g., "Daily Login Check") and create.

### 3. Run Your First Task
- Inside your project, click **"New Task"**.
- Describe your goal in plain English:
  > "Go to settings, search for 'Dark Mode', and enable it."
- Click **"Start Task"**.
- Watch the **Live Preview** and **Terminal** as the AI executes your instructions.

---

## 🛠 For Developers

Want to contribute or build from source? Here is how to get started.

### Prerequisites
- **Node.js** 18+
- **Git**
- **Python** 3.11+ (Optional, app manages its own runtime)

### Setup & Run
```bash
# Clone the repo
git clone https://github.com/FigmaAI/KleverDesktop.git
cd KleverDesktop

# Install dependencies
npm install

# Run development server (Hot Reload enabled)
npm run start
```

### Useful Commands
- `npm run typecheck`: Run TypeScript validation.
- `npm run lint:fix`: Fix code style issues automatically.
- `npm run package`: Build the app package locally.
- `npm run make`: Generate platform-specific installers.

### Tech Stack
| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18 • TypeScript 5 • shadcn/ui • Tailwind CSS • Framer Motion |
| **Desktop** | Electron 33 • Vite 5 • Electron Forge 7 |
| **Backend** | Python 3.11+ • AppAgent • Playwright |
| **AI Integration** | LiteLLM • Ollama • OpenAI • Anthropic |

### Project Structure
```
KleverDesktop/
├── src/              # Renderer Process (UI)
│   ├── components/   # 70+ React components (UI & Logic)
│   ├── pages/        # Main route views (Setup, Scheduled, Settings)
│   ├── hooks/        # Custom hooks (Projet, Terminal, AI)
│   └── App.tsx       # Main routing logic
├── main/             # Main Process (Electron)
│   ├── handlers/     # 16+ IPC modules (OS integration, Python management)
│   └── preload.ts    # Context Bridge exposure
├── appagent/         # Python Backend
│   ├── scripts/      # Automation logic & controllers
│   └── run.py        # Main entry point for Python tasks
└── forge.config.js   # Build configuration
```

### Contributing
We welcome contributions! Please follow the conventional commits specification (`feat:`, `fix:`, `chore:`) and ensure all linting passes before submitting a PR.
See [CLAUDE.md](CLAUDE.md) for a deep dive into the architecture and IPC patterns.

---

## 📄 License & Privacy

- **License**: MIT - Open source and free to use. See [LICENSE](LICENSE).
- **Privacy**: We respect your data. See [PRIVACY.md](PRIVACY.md).

---

<div align="center">

**Made with ❤️ by the [FigmaAI](https://github.com/FigmaAI) team**

[⬆ Back to Top](#klever-desktop)

</div>

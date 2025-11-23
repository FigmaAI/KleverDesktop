<div align="center">
  <img src="src/assets/logo.png" alt="Klever Desktop Logo" width="200" height="200">

  # Klever Desktop

  **AI-Powered UI Automation for Android & Web**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
  [![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://www.python.org/)

  [Download](#-download--install) • [Quick Start](#-quick-start) • [For Developers](#%EF%B8%8F-for-developers) • [Documentation](CLAUDE.md)

</div>

---

## 🌟 Overview

**Klever Desktop** is a cross-platform desktop application that brings AI-powered automation to Android apps and web applications. Built on Electron and powered by local AI models (Ollama) or cloud APIs, it provides an intuitive interface for automated UI testing and exploration.

### ✨ Key Features

- 🤖 **Local-First AI** - Run completely offline using Ollama (no API costs, no data sharing)
- 🎯 **Multi-Platform** - Automate Android devices (ADB) and web browsers (Playwright)
- 📊 **Real-Time Insights** - Live logs, screenshots, and system monitoring
- 📝 **Auto Reports** - Generated markdown reports with screenshots and action history
- 🎨 **Modern UI** - Built with React, shadcn/ui, and Tailwind CSS
- 🔧 **Developer-Friendly** - Full TypeScript support, modular architecture

---

## 📥 Download & Install

### Download from GitHub Releases

**Get the latest version from our [Releases page](https://github.com/FigmaAI/KleverDesktop/releases):**

<div align="center">

| Platform | File | Note |
|----------|------|------|
| **macOS** | `Klever.Desktop.dmg` | Universal build that supports both Intel and Apple Silicon Mac |
| **Windows** | `Klever.Desktop-2.0.0.Setup.exe` | No certification yet |

</div>

### Installation Guide

#### macOS Installation

1. **Download** the `.dmg` file from [Releases](https://github.com/FigmaAI/KleverDesktop/releases)
2. **Open** the DMG file
3. **Drag** Klever Desktop to your Applications folder
4. **Launch** the app from your Applications folder
   - The app is **signed with Developer ID and notarized by Apple**, so it should open without issues
   - On first launch, you may see a confirmation dialog asking if you want to open the app
   - Click **"Open"** to proceed

> **Note**: All macOS builds are signed with Developer ID and notarized by Apple for security. Gatekeeper will verify the app automatically.

#### Windows Installation

1. **Download** `klever-desktop-{version} Setup.exe` from [Releases](https://github.com/FigmaAI/KleverDesktop/releases)
2. **Run** the Setup executable
3. **SmartScreen Warning**: If you see "Windows protected your PC":
   - Click **"More info"**
   - Click **"Run anyway"**
4. Follow the installation wizard
5. Launch **Klever Desktop** from your Start Menu

> **Note**: We don't currently sign Windows builds with an EV certificate, so SmartScreen warnings are expected.

---

## 🚀 Quick Start

### 1. First Launch - Setup Wizard

When you launch Klever Desktop for the first time, a setup wizard will guide you through configuration:

#### **Platform Tools Check**

The app automatically verifies required tools:
- ✅ Python 3.11+ (downloaded automatically to `~/.klever-desktop/`)
- ✅ Playwright (auto-installed for web automation)
- ✅ ADB (install [Android Studio](https://developer.android.com/studio) for Android automation)

#### **Model Configuration**

Choose your AI provider:

**Option A: Local Model (Recommended)**
1. Install [Ollama](https://ollama.com/download)
2. Pull a model: `ollama pull qwen3-vl:4b` (16GB RAM) or `qwen2.5-vl:7b` (24GB+ RAM)
3. Enable "Local Model" in setup wizard
4. Test connection

**Option B: Cloud API**
1. Enable "API Model" in setup wizard
2. Enter your API endpoint and key (OpenAI, OpenRouter, etc.)
3. Test connection

> You can enable both! The app will use API when both are enabled.

#### **Integration Test**

Run a quick test to verify everything works. Click "Run Integration Test" and wait ~30 seconds.

### 2. Create Your First Project

1. Click **"New Project"**
2. Choose platform:
   - **Android**: Select your device (enable USB debugging first)
   - **Web**: Enter target URL
3. Click **"Create Project"**

### 3. Run a Task

1. Open your project
2. Click **"New Task"**
3. Enter a clear description (e.g., "Navigate to login page and enter test credentials")
4. Click **"Start Task"**
5. Monitor real-time logs and screenshots
6. View the generated report when complete

### Tips for Success

**Write Clear Task Descriptions:**
- ✅ "Find search button, enter 'laptop', verify results appear"
- ❌ "Test the app" (too vague)

**Troubleshooting:**
- **Task fails**: Verify device/URL is accessible, check ADB connection (`adb devices`)
- **Wrong AI decisions**: Be more specific, reduce temperature in settings
- **Slow performance**: Use local models, reduce max rounds in settings

---

## 🖥️ System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **OS** | macOS 10.15+, Windows 10+, Linux (Ubuntu 20.04+) | Latest stable version |
| **RAM** | 8GB | 16GB+ (for local AI) |
| **Storage** | 5GB free space | SSD with 10GB+ |
| **CPU** | 4+ cores | Modern multi-core processor |

**Additional Requirements:**
- **Android Automation**: [Android Studio](https://developer.android.com/studio) (for ADB), USB debugging enabled
- **Web Automation**: No additional requirements (Playwright auto-installs Chromium)

---

## 🛠️ For Developers

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- **Python** 3.11+ (optional for development, app downloads automatically)

### Setup

```bash
# Clone repository
git clone https://github.com/FigmaAI/KleverDesktop.git
cd KleverDesktop

# Install dependencies
npm install

# Start development server
npm run start
```

The app launches with hot reload enabled! 🎉

### Development Commands

```bash
npm run start          # Electron + Vite dev server with hot reload
npm run dev            # Vite dev server only (browser testing)
npm run typecheck      # TypeScript type checking
npm run lint           # ESLint check
npm run lint:fix       # Auto-fix linting errors
```

### Build Commands

```bash
npm run package        # Package app (unsigned) → out/klever-desktop-{platform}/
npm run make           # Create distributable (DMG/Setup.exe) → out/make/
npm run publish        # Build and publish to GitHub Releases
```

### Python Management

```bash
npm run python:build   # Download Python 3.11 to ~/.klever-desktop/
npm run python:verify  # Verify all required files before packaging
npm run appagent:fetch # Update appagent code from GitHub
```

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18 • TypeScript 5 • shadcn/ui • Tailwind CSS • Framer Motion |
| **Desktop** | Electron 33 • Vite 5 • Electron Forge 7 |
| **Backend** | Python 3.11+ • AppAgent |
| **Automation** | ADB (Android) • Playwright (Web) |
| **AI** | Ollama (local) • OpenAI API • OpenRouter |

### Architecture

Three-layer Electron architecture:
- **Renderer** (`src/`): React UI with shadcn/ui components
- **Main** (`main/`): IPC handlers, window management, Python subprocess control
- **Backend** (`appagent/`): Python automation scripts

Communication: `React UI` ↔️ `IPC (preload.ts)` ↔️ `Handlers (main/handlers/)` ↔️ `Python (appagent/)`

> For detailed architecture, see [CLAUDE.md](CLAUDE.md)

### Project Structure

```
KleverDesktop/
├── src/              # React frontend (renderer)
│   ├── components/   # shadcn/ui components
│   ├── pages/        # SetupWizard, ProjectList, ProjectDetail, Settings
│   ├── hooks/        # Custom React hooks
│   └── types/        # TypeScript definitions
├── main/             # Electron main process
│   ├── handlers/     # IPC handlers (task, project, model, config, etc.)
│   └── utils/        # Config, storage, Python runtime management
├── appagent/         # Python automation backend
│   └── scripts/      # self_explorer.py, and_controller.py, web_controller.py
├── scripts/          # Build utilities (build-python.js, verify-bundle.js)
├── forge.config.js   # Electron Forge configuration
└── vite.config.ts    # Vite configuration
```

### Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes following our code style (ESLint enforced)
4. **Test** in both dev and production builds
5. **Commit** with [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, etc.
6. **Push** and open a Pull Request

**Important for IPC changes:**
When adding IPC handlers, update all three files:
1. `main/handlers/*.ts` - Handler implementation
2. `main/preload.ts` - Context bridge exposure
3. `src/types/electron.d.ts` - TypeScript definitions

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines.

### Configuration

**User Data** (`~/.klever-desktop/` on macOS/Linux, `%APPDATA%\klever-desktop\` on Windows):
- `projects.json` - Project and task data
- `config.yaml` - Runtime configuration (model, platform settings)
- `python/` - Downloaded Python runtime

**Runtime Config** (`appagent/config.yaml`):
- Model settings (local/API, endpoints, keys)
- Platform settings (ADB, Playwright)
- Agent parameters (max rounds, reflection, etc.)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

Built with:
- **[AppAgent](https://github.com/FigmaAI/appagent)** - Python automation engine
- **[Ollama](https://ollama.com/)** - Local AI models
- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop framework
- **[React](https://react.dev/)** & **[TypeScript](https://www.typescriptlang.org/)** - Frontend
- **[shadcn/ui](https://ui.shadcn.com/)** - UI components
- **[Playwright](https://playwright.dev/)** - Web automation
- **[Vite](https://vitejs.dev/)** - Build tool

---

<div align="center">

**Made with ❤️ by the [FigmaAI](https://github.com/FigmaAI) team**

⭐ Star us on GitHub if you find this useful!

[⬆ Back to Top](#klever-desktop)

</div>

<div align="center">
  <img src="src/assets/logo.png" alt="Klever Desktop Logo" width="200" height="200">

  # Klever Desktop

  **AI-Powered UI Automation for Android & Web**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
  [![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://www.python.org/)

  [Download](#-download) • [Quick Start](#-quick-start) • [For Developers](#-for-developers) • [Documentation](CLAUDE.md)

</div>

---

## Overview

**Klever Desktop** is a cross-platform desktop application that brings AI-powered automation to Android apps and web applications. Built on Electron and powered by local AI models (Ollama) or cloud APIs, it provides an intuitive interface for automated UI testing and exploration.

### Key Features

- **Local-First AI** - Run completely offline using Ollama (no API costs, no data sharing)
- **Multi-Platform** - Automate Android devices (ADB) and web browsers (Playwright)
- **Multi-Provider AI** - Support for Ollama, OpenAI, Anthropic, OpenRouter, Grok, and more
- **Real-Time Monitoring** - Live logs, screenshots, and execution progress
- **Auto-Generated Reports** - Markdown reports with screenshots and action history
- **Modern UI** - Built with React 18, shadcn/ui, and Tailwind CSS
- **Developer-Friendly** - Full TypeScript support, modular architecture, comprehensive docs

---

## Download

### Latest Release

Download the latest version from our [Releases page](https://github.com/FigmaAI/KleverDesktop/releases):

| Platform | File | Note |
|----------|------|------|
| **macOS** | `Klever.Desktop-{version}-arm64.dmg` | Universal binary (Intel + Apple Silicon) |
| **Windows** | `klever-desktop-{version} Setup.exe` | No certification yet (SmartScreen warning) |

### Installation

#### macOS

1. Download the `.dmg` file from [Releases](https://github.com/FigmaAI/KleverDesktop/releases)
2. Open the DMG file
3. Drag **Klever Desktop** to your Applications folder
4. Launch from Applications
   - The app is **signed with Developer ID and notarized by Apple**
   - On first launch, you may see a confirmation dialog
   - Click **"Open"** to proceed

> **Note**: All macOS builds are signed and notarized for security. Gatekeeper will verify the app automatically.

#### Windows

1. Download `klever-desktop-{version} Setup.exe` from [Releases](https://github.com/FigmaAI/KleverDesktop/releases)
2. Run the Setup executable
3. **SmartScreen Warning**: If you see "Windows protected your PC":
   - Click **"More info"**
   - Click **"Run anyway"**
4. Follow the installation wizard
5. Launch from Start Menu

> **Note**: We don't currently sign Windows builds with an EV certificate, so SmartScreen warnings are expected.

---

## Quick Start

### 1. First Launch - Setup Wizard

When you launch Klever Desktop for the first time, a setup wizard will guide you through configuration:

#### Environment Setup

The app automatically verifies and installs required tools:
- Python 3.11+ (downloaded automatically to `~/.klever-desktop/`)
- Playwright (auto-installed for web automation)
- ADB (install [Android Studio](https://developer.android.com/studio) for Android automation)

#### Model Configuration

Choose your AI provider:

**Option A: Local Model (Recommended)**
1. Install [Ollama](https://ollama.com/download)
2. Pull a vision model:
   ```bash
   ollama pull llama3.2-vision  # Fastest, 16GB RAM
   # or
   ollama pull qwen2.5-vl:7b    # Best quality, 24GB+ RAM
   ```
3. Enable in setup wizard
4. Test connection

**Option B: Cloud API**
1. Enable "API Model" in setup wizard
2. Select provider (OpenAI, Anthropic, OpenRouter, etc.)
3. Enter your API key
4. Test connection

> You can configure multiple providers! Switch between them in Settings.

#### Integration Test

Run a quick test (~30 seconds) to verify everything works:
- Creates a test web automation
- Verifies Python, Playwright, and AI model
- Shows real-time execution logs

### 2. Create Your First Project

1. Click **"New Project"**
2. Choose platform:
   - **Android**: Select your device (enable USB debugging first)
   - **Web**: Enter target URL (e.g., `https://example.com`)
3. Enter project name
4. Click **"Create Project"**

### 3. Create and Run a Task

1. Open your project
2. Click **"New Task"**
3. Enter task details:
   - **Name**: Short description (e.g., "Login test")
   - **Goal**: Clear objective (e.g., "Navigate to login page, enter credentials, and verify success")
   - **Model** (optional): Override project model
   - **Language** (optional): Output language (English, Korean, Japanese)
4. Click **"Start Task"**
5. Monitor execution:
   - Real-time logs in terminal
   - Screenshots as they're captured
   - Progress updates
6. View generated report when complete

### Tips for Success

**Write Clear Task Goals:**
- **Good**: "Find the search button, enter 'laptop', click search, and verify results appear"
- **Bad**: "Test the app" (too vague)
- **Good**: "Navigate to settings, toggle dark mode, and verify UI changes"
- **Bad**: "Check settings" (unclear objective)

**Troubleshooting:**
- **Task fails**: Verify device/URL is accessible, check model connection
- **Wrong AI decisions**: Be more specific in task goal, adjust temperature (Settings → Execution)
- **Slow performance**: Use local models, reduce max rounds in Settings
- **ADB issues**: Run `adb devices` to verify connection

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **OS** | macOS 10.15+, Windows 10+, Linux (Ubuntu 20.04+) | Latest stable version |
| **RAM** | 8GB | 16GB+ (for local AI) |
| **Storage** | 5GB free space | SSD with 10GB+ |
| **CPU** | 4+ cores | Modern multi-core processor |

**Additional Requirements:**
- **Android Automation**: [Android Studio](https://developer.android.com/studio) (for ADB), USB debugging enabled
- **Web Automation**: No additional requirements (Playwright auto-installs Chromium)
- **Local AI**: [Ollama](https://ollama.com/download) + vision model (llama3.2-vision or qwen2.5-vl)

---

## For Developers

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))
- **Python** 3.11+ (optional for dev - app downloads automatically)

### Setup

```bash
# Clone repository
git clone https://github.com/FigmaAI/KleverDesktop.git
cd KleverDesktop

# Install dependencies
npm install

# Start development server with hot reload
npm run start
```

The app launches with hot reload enabled!

### Development Commands

```bash
npm run start          # Electron + Vite dev server with hot reload
npm run dev            # Vite dev server only (browser testing)
npm run typecheck      # TypeScript type checking
npm run lint           # ESLint validation
npm run lint:fix       # Auto-fix linting errors
```

### Build Commands

```bash
npm run package        # Package app (unsigned)
npm run make           # Create distributable (DMG/Setup.exe)
npm run publish        # Build and publish to GitHub Releases
```

### Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18 • TypeScript 5 • shadcn/ui • Tailwind CSS • Framer Motion |
| **Desktop** | Electron 33 • Vite 5 • Electron Forge 7 |
| **Backend** | Python 3.11+ • AppAgent |
| **Automation** | ADB (Android) • Playwright (Web) |
| **AI** | Ollama • LiteLLM • OpenAI • Anthropic • OpenRouter |

### Architecture

Three-layer Electron architecture:
- **Renderer** (`src/`): React UI with 73+ components, 6 custom hooks
- **Main** (`main/`): 12 IPC handler modules, 70+ IPC methods
- **Backend** (`appagent/`): Python automation scripts

Communication flow:
```
React UI ↔️ IPC (preload.ts) ↔️ Handlers (main/handlers/) ↔️ Python (appagent/)
```

> For detailed architecture, development workflow, and best practices, see [CLAUDE.md](CLAUDE.md)

### Project Structure

```
KleverDesktop/
├── src/              # React frontend (renderer)
│   ├── components/   # 73+ UI components (30+ shadcn/ui)
│   ├── pages/        # 5 main pages (Setup, Projects, Settings)
│   ├── hooks/        # 6 custom React hooks
│   └── types/        # TypeScript definitions
├── main/             # Electron main process
│   ├── handlers/     # 12 IPC handler modules (2,195 lines)
│   ├── utils/        # Utility modules (5,158 lines)
│   └── types/        # Main process types
├── appagent/         # Python automation backend
│   └── scripts/      # 12 Python scripts (automation, controllers, AI)
├── build/            # Build assets (icons, entitlements)
├── scripts/          # Build utilities
├── .github/          # CI/CD workflows
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

**Development Checklist:**
- [ ] Run `npm run typecheck` before committing
- [ ] Run `npm run lint:fix` for formatting
- [ ] Test in both dev and production builds
- [ ] Update TypeScript types when adding IPC handlers
- [ ] Add JSDoc comments for complex functions
- [ ] Update CLAUDE.md if architecture changes

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines, IPC patterns, and best practices.

### Configuration

**User Data** (`~/.klever-desktop/` on macOS/Linux, `%APPDATA%\klever-desktop\` on Windows):
- `config.json` - Application configuration (models, execution, platform settings)
- `projects.json` - Project and task database
- `python/` - Downloaded Python runtime
- `python-env/` - Python virtual environment

**Runtime Config:**
- Model settings (providers, API keys, endpoints)
- Execution settings (tokens, temperature, rounds)
- Platform settings (ADB, Playwright, browser config)
- Image optimization settings

---

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive developer guide
  - Complete architecture overview
  - IPC communication patterns
  - Step-by-step development workflow
  - Build and distribution guide
  - Troubleshooting and best practices

- **[PRIVACY.md](PRIVACY.md)** - Privacy policy

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with:
- **[AppAgent](https://github.com/FigmaAI/appagent)** - Python automation engine
- **[Ollama](https://ollama.com/)** - Local AI models
- **[LiteLLM](https://docs.litellm.ai/)** - Multi-provider AI abstraction
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
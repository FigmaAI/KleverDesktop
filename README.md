<div align="center">
  <img src="src/assets/logo.png" alt="Klever Desktop" width="128" height="128">

  # Klever Desktop

  AI-powered UI automation for Android and Web

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
  [![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://www.python.org/)

</div>

---

## What is Klever Desktop?

Klever Desktop is a cross-platform application that enables AI-driven UI automation without writing code. Describe what you want to do in plain language, and watch the AI execute it.

**Supported Platforms:**
- **Android** - Via USB debugging (ADB)
- **Web** - Via Playwright (Chromium, Firefox, WebKit)

**AI Providers:**
- **Local** - Ollama (Llama 3.2 Vision, Qwen 2.5-VL)
- **Cloud** - OpenAI, Anthropic, OpenRouter, Grok

---

## Download

Get the latest release from [GitHub Releases](https://github.com/FigmaAI/KleverDesktop/releases):

| Platform | File |
|----------|------|
| macOS | `Klever.Desktop-{version}-universal.dmg` |
| Windows | `klever-desktop-{version} Setup.exe` |

### Installation

**macOS:**
1. Open the `.dmg` file
2. Drag to Applications
3. Launch (notarized by Apple)

**Windows:**
1. Run the installer
2. If SmartScreen blocks: Click "More info" → "Run anyway"

---

## Quick Start

### 1. Setup
On first launch, the Setup Wizard will:
- Install Python 3.11+ runtime
- Install Playwright browsers
- Connect to your AI provider

### 2. Create Project
- Click "New Project"
- Choose Android or Web
- Name your project

### 3. Run Task
- Add a new task
- Describe your goal:
  > "Open settings and enable dark mode"
- Click Start

---

## For Developers

### Prerequisites
- Node.js 18+
- Git

### Setup

```bash
git clone https://github.com/FigmaAI/KleverDesktop.git
cd KleverDesktop
npm install
npm run start
```

### Commands

```bash
npm run start        # Dev server with hot reload
npm run typecheck    # TypeScript check
npm run lint:fix     # Fix linting errors
npm run package      # Build package
npm run make         # Create installers
```

### Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Desktop | Electron 33, Vite 5, Electron Forge |
| Backend | Python 3.11+, Playwright, ADB |
| AI | LiteLLM, Ollama, OpenAI, Anthropic |

### Project Structure

```
main/           # Electron main process
src/            # React renderer
core/           # Python shared code
engines/        # Automation engines
```

See [CLAUDE.md](CLAUDE.md) for development details.

---

## License

MIT - See [LICENSE](LICENSE)

---

<div align="center">

**[FigmaAI](https://github.com/FigmaAI)**

</div>

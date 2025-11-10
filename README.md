# Klever Desktop

Local UI Grounding Desktop App - AI-powered UI automation for Android & Web using Ollama.

## Overview

Klever Desktop is an Electron-based desktop application that enables automated UI exploration and testing using local AI models (via Ollama) or remote APIs. It extracts the Self-Explorer functionality from the AppAgent project and provides a user-friendly interface for managing automation projects.

## Features

- **Environment Setup Wizard**: Automatic detection and setup of Python, Ollama, ADB, and Playwright
- **Multi-Platform Support**: Automate both Android apps (via ADB) and Web apps (via Playwright)
- **Local AI Models**: Use Ollama for completely local, free operation (no API costs)
- **Project Management**: Create, manage, and monitor multiple automation projects
- **Real-time Monitoring**: Live logs, screenshots, and system resource monitoring
- **Markdown Reports**: Automatically generated reports with screenshots and action history

## Tech Stack

- **Frontend**: Electron + React 18 + TypeScript + MUI Joy (Material-UI)
- **Backend**: Python (AppAgent submodule)
- **AI Models**: Ollama (qwen3-vl:4b recommended for 16GB RAM)
- **Automation**: ADB (Android), Playwright (Web)

## Project Structure

```
KleverDesktop/
├── electron/                   # Electron app
│   ├── main.js                # Main process (IPC handlers)
│   ├── preload.js             # IPC bridge
│   ├── package.json
│   ├── webpack.config.js
│   └── src/
│       ├── components/
│       │   ├── App.tsx        # Main app component
│       │   ├── steps/         # Setup wizard steps
│       │   ├── project/       # Project management
│       │   └── settings/      # Settings panel
│       ├── services/          # Business logic (future)
│       └── index.tsx          # React entry point
├── appagent/                  # Python backend (git submodule)
│   ├── scripts/
│   │   ├── self_explorer.py  # Main automation logic
│   │   ├── and_controller.py # Android controller
│   │   ├── web_controller.py # Web controller
│   │   └── model.py          # AI model integration
│   ├── config.yaml           # Configuration
│   └── requirements.txt      # Python dependencies
├── scripts/                   # Build scripts (macOS, Windows)
└── PLANNING.md               # Detailed planning document
```

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** (for development)
- **Ollama** (for local AI models) - [Download](https://ollama.com/download)
- **ADB** (for Android automation) - [Setup Guide](https://developer.android.com/studio/command-line/adb)
- **Playwright** (for web automation) - Installed via Python packages

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/FigmaAI/KleverDesktop.git
cd KleverDesktop
```

### 2. Initialize submodules

```bash
git submodule update --init --recursive
```

### 3. Install Python dependencies

```bash
cd appagent
python -m pip install -r requirements.txt
playwright install chromium
cd ..
```

### 4. Install Ollama and download model

```bash
# Install Ollama from https://ollama.com/download

# Pull recommended model (for 16GB RAM)
ollama pull qwen3-vl:4b

# Or for 24GB+ RAM
ollama pull qwen2.5-vl:7b
```

### 5. Install Electron app dependencies

```bash
cd electron
npm install
cd ..
```

## Development

### Run in development mode

```bash
cd electron
npm run dev
```

This will start:
- Webpack dev server on `http://localhost:3000`
- Electron app with hot reload

### Build for production

```bash
cd electron
npm run build
npm run package
```

Built apps will be in `electron/dist/`.

## Usage

### 1. Setup Wizard

On first launch, the Setup Wizard will guide you through:

- **Step 1**: Platform tools check (Python, packages, ADB, Playwright)
- **Step 2**: Model configuration (Ollama or API)
- **Step 3**: Final verification

### 2. Create a Project

1. Click "New Project"
2. Select platform: Android or Web
3. For Android: Select connected device
4. For Web: Enter URL
5. Enter task description

### 3. Run Automation

- Click "Start" to begin exploration
- Monitor real-time logs and screenshots
- View generated markdown reports

## Configuration

The app uses `appagent/config.yaml` for configuration. Key settings:

```yaml
MODEL: "local"  # or "api"
LOCAL_MODEL: "qwen3-vl:4b"
MAX_TOKENS: 4096
TEMPERATURE: 0.0

# Android
ANDROID_SCREENSHOT_DIR: "/sdcard"

# Web
WEB_BROWSER_TYPE: "chromium"
WEB_HEADLESS: false
WEB_VIEWPORT_WIDTH: 1280
WEB_VIEWPORT_HEIGHT: 720
```

## Supported Models

### Local (Ollama)
- `qwen3-vl:4b` - Recommended for 16GB RAM
- `qwen2.5-vl:7b` - For 24GB+ RAM
- `llava:7b` - Alternative option

### Remote API
- OpenAI GPT-4V
- OpenRouter (multiple models)
- Any OpenAI-compatible API

## Memory Requirements

- **16GB RAM**: Use `qwen3-vl:4b` with image optimization
- **24GB RAM**: Use `qwen2.5-vl:7b` or `llava:7b`
- **32GB+ RAM**: Any model, no limitations

## Roadmap

See [PLANNING.md](./PLANNING.md) for detailed development plan.

### Phase 1: Core Features ✅
- [x] Electron app structure
- [x] Setup Wizard UI
- [x] IPC communication
- [x] Basic project management

### Phase 2: In Progress
- [ ] Project creation wizard
- [ ] Project detail page with monitoring
- [ ] Settings panel with config.yaml sync

### Phase 3: Planned
- [ ] Real-time screenshot preview
- [ ] System resource monitoring
- [ ] Markdown report viewer
- [ ] Project export/import

### Phase 4: Future
- [ ] macOS/Windows packaging
- [ ] Auto-update mechanism
- [ ] Plugin system
- [ ] Cloud sync (optional)

## Contributing

Contributions are welcome! Please read our contributing guidelines (coming soon).

## License

MIT License - see LICENSE file for details.

## Credits

- Based on [AppAgent](https://github.com/FigmaAI/appagent)
- UI inspired by [klever-v3](https://github.com/FigmaAI/klever-v3)
- Built with [MUI Joy](https://mui.com/joy-ui/getting-started/)

## Support

- Issues: [GitHub Issues](https://github.com/FigmaAI/KleverDesktop/issues)
- Documentation: See [PLANNING.md](./PLANNING.md)

---

**Note**: This project is in active development. Some features may be incomplete or unstable.

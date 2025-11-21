<div align="center">
  <img src="src/assets/logo.png" alt="Klever Desktop Logo" width="200" height="200">

  # Klever Desktop

  **AI-Powered UI Automation for Android & Web**

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron)](https://www.electronjs.org/)
  [![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
  [![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://www.python.org/)

  [Getting Started](#-for-users-getting-started) • [For Developers](#%EF%B8%8F-for-developers-contributing--customization) • [Documentation](CLAUDE.md)

</div>

---

## 🌟 Overview

**Klever Desktop** is a powerful, cross-platform desktop application that brings AI-powered automation to your fingertips. Built on Electron, it enables automated UI exploration and testing for both Android apps and web applications using cutting-edge local AI models (via Ollama) or cloud-based APIs.

Whether you're a QA engineer automating test scenarios, a developer exploring UI behavior, or a researcher studying app interactions, Klever Desktop provides an intuitive interface to create, manage, and monitor automation projects with real-time feedback.

### ✨ Key Features

- 🤖 **Local-First AI**: Run completely offline using Ollama - no API costs, no data sharing
- 🎯 **Multi-Platform**: Seamlessly automate Android devices (ADB) and web browsers (Playwright)
- 📊 **Real-Time Insights**: Live logs, screenshots, and system monitoring as automation runs
- 📝 **Comprehensive Reports**: Auto-generated markdown reports with screenshots and action history
- 🎨 **Modern UI**: Beautiful, responsive interface built with MUI Joy and Framer Motion
- 🔧 **Developer-Friendly**: Full TypeScript support, modular architecture, extensible design

---

## 📥 For Users: Getting Started

This section is for users who want to **use** Klever Desktop for UI automation.

### Step 1: Download & Install

#### Option A: Download from App Stores (Recommended)

Download Klever Desktop directly from your platform's official app store:

<div align="center">

**macOS (App Store)**

<a href="https://apps.apple.com/us/app/klever-instance-ut/id6754501208">
  <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" width="200"/>
</a>

**Windows (Microsoft Store)**

<a href="https://apps.microsoft.com/detail/xp8brb9spkfrsw?referrer=appbadge&mode=direct">
  <img src="https://get.microsoft.com/images/en-us%20dark.svg" alt="Get it from Microsoft" width="200"/>
</a>

</div>

**Installation is automatic** - just click the badge above for your platform and follow the store's installation process.

#### Option B: Build from Source

If pre-built binaries are not available, see the [For Developers](#%EF%B8%8F-for-developers-contributing--customization) section below.

---

### Step 2: First Launch - Setup Wizard

When you launch Klever Desktop for the first time, you'll be greeted with a guided setup wizard:

#### 🔧 **Step 0: Platform Tools Check**

The app will automatically detect and verify required tools:

- ✅ **Python 3.11+**: Bundled Python runtime (no installation needed)
- ✅ **Python Environment**: Pre-installed packages and dependencies
- ✅ **ADB**: For Android automation (requires Android Studio)
- ✅ **Playwright**: For web automation (auto-installed)

**What you need to do:**
- For **Android automation**: Install [Android Studio](https://developer.android.com/studio) and enable USB debugging on your device
- For **Web automation**: No additional setup required (Playwright auto-installs)

Click **Continue** once all checks pass.

#### 🧠 **Step 1: Model Configuration**

Choose your AI model provider:

**Option A: Local Models (Recommended for Privacy)**

1. Install [Ollama](https://ollama.com/download) on your computer
2. In the Setup Wizard, select **"Enable Local Model"**
3. Default settings are:
   - Base URL: `http://localhost:11434/v1/chat/completions`
   - Model: `qwen3-vl:4b` (recommended for 16GB RAM)
4. Click **"Test Connection"** to verify Ollama is running
5. Pull your desired model:
   ```bash
   # For 16GB RAM
   ollama pull qwen3-vl:4b

   # For 24GB+ RAM
   ollama pull qwen2.5-vl:7b
   ```

**Option B: Cloud API (OpenAI, OpenRouter, etc.)**

1. Select **"Enable API Model"**
2. Enter your API details:
   - **Base URL**: e.g., `https://api.openai.com/v1/chat/completions`
   - **API Key**: Your API key (will be masked)
   - **Model**: e.g., `gpt-4o-mini` (auto-fetched from API)
3. Click **"Test Connection"** to verify

**You can enable both local and API models simultaneously!** The app will prefer API when both are enabled.

Click **Continue** after testing your model connection.

#### ✅ **Step 2: Integration Test**

Run a quick integration test to verify everything works:

1. Click **"Run Integration Test"**
2. Watch real-time output in the terminal
3. Wait for the test to complete (usually 30-60 seconds)
4. If successful, you'll see ✅ **"Integration test completed successfully!"**

Click **Finish Setup** to enter the main application!

---

### Step 3: Creating Your First Project

Now that setup is complete, let's create your first automation project:

1. **Navigate to Projects Page**
   - You'll see the main dashboard with a "New Project" button

2. **Click "New Project"**

3. **Fill in Project Details:**

   **For Android Automation:**
   - **Name**: e.g., "My Android App Test"
   - **Platform**: Select "Android"
   - **Device**: Choose your connected Android device from the dropdown
     - Make sure USB debugging is enabled and device is connected via ADB
     - Run `adb devices` in terminal to verify device is detected

   **For Web Automation:**
   - **Name**: e.g., "My Website Test"
   - **Platform**: Select "Web"
   - **URL**: Enter the target website URL (e.g., `https://example.com`)

4. **Click "Create Project"**

Your project is now created! You'll see it in your project list.

---

### Step 4: Adding and Running Tasks

Tasks are specific automation goals within a project. Let's create and run one:

#### Creating a Task

1. **Open Your Project**
   - Click on your project card from the project list

2. **Click "New Task"** button

3. **Enter Task Details:**
   - **Name**: e.g., "Login Flow Test"
   - **Description**: Describe what you want the AI to do
     - Example: "Navigate to login page, enter credentials, and verify successful login"
     - Be specific! The AI will follow your instructions

4. **Click "Create Task"**

#### Running a Task

1. **Find Your Task** in the task list

2. **Click "Start Task"** button

3. **Monitor Real-Time Progress:**
   - **Terminal Output**: See what the AI is doing step-by-step
   - **Screenshots**: View captured screenshots as the AI explores
   - **System Stats**: Monitor CPU, memory usage

4. **Wait for Completion** or click **"Stop Task"** to cancel

5. **View Results:**
   - Click **"View Report"** to see a detailed markdown report
   - Report includes:
     - Action history with timestamps
     - Screenshots at each step
     - Success/failure status
     - AI reasoning and decisions

---

### Step 5: Managing Settings

You can customize Klever Desktop's behavior in the Settings page:

#### Accessing Settings

1. Click the **Settings** icon in the navigation bar (⚙️)

#### Available Settings

**🧠 Model Settings:**
- Switch between local and API models
- Change model parameters (temperature, max tokens)
- Update API keys and base URLs

**📱 Platform Settings:**

*Android Settings:*
- Screenshot directory path
- Device-specific configurations

*Web Settings:*
- Browser type (Chromium, Firefox, WebKit)
- Headless mode (run without visible browser)
- Viewport size (width x height)

**🤖 Agent Settings:**
- **Max Rounds**: Maximum exploration steps (default: 20)
- **Enable Reflection**: AI self-evaluation after each action
- **Confidence Threshold**: Minimum confidence for actions

**🖼️ Image Settings:**
- Screenshot quality and format
- Image compression settings
- Storage location

**Save Changes** when you're done!

---

### Step 6: Tips for Best Results

#### Writing Good Task Descriptions

✅ **Good Examples:**
- "Find the search button, enter 'laptop', and verify results appear"
- "Navigate to settings, enable dark mode, and confirm the theme changed"
- "Fill out the contact form with test data and submit"

❌ **Avoid Vague Descriptions:**
- "Test the app" (too broad)
- "Click stuff" (no clear goal)
- "Do everything" (unclear objective)

#### Troubleshooting

**Task fails immediately:**
- Check that your device/URL is accessible
- Verify ADB connection for Android (`adb devices`)
- Ensure the target app/website is already open

**AI makes wrong decisions:**
- Be more specific in task description
- Reduce temperature in Model Settings (makes AI more deterministic)
- Enable Reflection for self-correction

**Performance issues:**
- Use local models (Ollama) instead of API for faster response
- Reduce Max Rounds in Agent Settings
- Close other resource-intensive applications

---

## 🖥️ System Requirements

### Minimum Requirements

- **OS**: macOS 10.15+, Windows 10+, or Linux (Ubuntu 20.04+)
- **RAM**: 8GB (16GB recommended for local AI)
- **Storage**: 5GB free space
- **CPU**: Multi-core processor (4+ cores recommended)

### Recommended for Best Performance

- **RAM**: 16GB+ (for qwen3-vl:4b)
- **RAM**: 24GB+ (for qwen2.5-vl:7b or llava:7b)
- **GPU**: Optional, but improves Ollama performance
- **SSD**: For faster model loading and screenshot storage

### Platform-Specific Requirements

**For Android Automation:**
- [Android Studio](https://developer.android.com/studio) (provides ADB)
- USB debugging enabled on Android device
- Android 8.0+ (API level 26+)
- USB cable to connect device to computer

**For Web Automation:**
- Chromium browser (auto-installed via Playwright)
- Modern web browsers for testing
- Stable internet connection (for web targets)

---

## 🛠️ For Developers: Contributing & Customization

This section is for developers who want to **customize** Klever Desktop, contribute to the project, or build from source.

### Development Setup

#### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Python** 3.11+ ([Download](https://www.python.org/downloads/))
- **Git** ([Download](https://git-scm.com/))
- **Ollama** (optional, for local AI) ([Download](https://ollama.com/download))
- **Android Studio** (optional, for Android automation) ([Download](https://developer.android.com/studio))

#### Clone and Install

```bash
# 1. Clone the repository
git clone https://github.com/FigmaAI/KleverDesktop.git
cd KleverDesktop

# 2. Install Node.js dependencies
npm install

# 3. Set up bundled Python runtime (for development)
node scripts/build-python.js

# Or use system Python (create symlink for development)
mkdir -p resources/python/linux-x64/python/bin
ln -s $(which python3) resources/python/linux-x64/python/bin/python3

# 4. Install Python dependencies (if using system Python)
python3 -m pip install -r appagent/requirements.txt
python3 -m playwright install chromium

# 5. (Optional) Set up Ollama
# Install from https://ollama.com/download
ollama pull qwen3-vl:4b  # For 16GB RAM
ollama pull qwen2.5-vl:7b  # For 24GB+ RAM
```

#### Launch Development Environment

```bash
# Option 1: Full dev environment (hot reload)
npm run electron:dev

# Option 2: Run separately in two terminals
npm run dev        # Terminal 1: Vite dev server (http://localhost:5173)
npm run electron   # Terminal 2: Electron app
```

The app will launch with hot module replacement enabled! 🎉

---

### Project Structure

<details>
<summary><b>Click to expand project structure</b></summary>

```
KleverDesktop/
├── src/                          # React frontend (renderer process)
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Router configuration
│   ├── components/               # 23+ reusable UI components
│   │   ├── Layout.tsx            # Main app shell with navigation
│   │   ├── SetupStepper.tsx      # Setup wizard navigation
│   │   ├── ProjectCard.tsx       # Project list item
│   │   ├── TaskCard.tsx          # Task list item
│   │   ├── ModelSelector.tsx     # Model selection dropdown
│   │   └── ...                   # Model, platform, settings components
│   ├── pages/                    # Route pages
│   │   ├── SetupWizard.tsx       # First-time setup wizard (343 lines)
│   │   ├── ProjectList.tsx       # Project management dashboard
│   │   ├── ProjectDetail.tsx     # Project execution & monitoring
│   │   ├── ProjectCreate.tsx     # Project creation wizard
│   │   └── Settings.tsx          # App configuration
│   ├── hooks/                    # Custom React hooks
│   │   ├── usePlatformTools.tsx  # Platform tools checking logic
│   │   ├── useModelConfig.tsx    # Model configuration state
│   │   ├── useIntegrationTest.tsx# Integration test logic
│   │   └── useSettings.tsx       # Settings state management
│   ├── types/                    # TypeScript definitions
│   │   ├── electron.d.ts         # IPC method signatures (70+ methods)
│   │   ├── project.ts            # Project & Task types
│   │   └── setupWizard.ts        # Setup wizard types
│   └── assets/                   # Images and static files
│       └── logo.png              # App logo
│
├── main/                         # Electron main process
│   ├── index.ts                  # Entry point, window creation (77 lines)
│   ├── preload.ts                # IPC bridge (123 lines, 70+ methods)
│   ├── handlers/                 # IPC handlers (2,041 lines total)
│   │   ├── index.ts              # Central registration (41 lines)
│   │   ├── task.ts               # Task CRUD & execution (452 lines)
│   │   ├── installations.ts      # Environment setup (196 lines)
│   │   ├── project.ts            # Project CRUD (268 lines)
│   │   ├── model.ts              # Model testing & API (243 lines)
│   │   ├── system-checks.ts      # System verification (220 lines)
│   │   ├── integration.ts        # Integration tests (209 lines)
│   │   ├── config.ts             # Config management (131 lines)
│   │   ├── utilities.ts          # System utilities (71 lines)
│   │   ├── ollama.ts             # Ollama operations (51 lines)
│   │   └── dialogs.ts            # File/folder dialogs (31 lines)
│   └── utils/                    # Helper modules
│       ├── config-manager.ts     # YAML config management
│       ├── project-storage.ts    # JSON project storage
│       ├── python-runtime.ts     # Bundled Python runtime management
│       └── process-manager.ts    # Subprocess tracking
│
├── appagent/                     # Python automation backend (monorepo)
│   ├── scripts/
│   │   ├── self_explorer.py      # Main automation loop
│   │   ├── and_controller.py     # Android ADB controller
│   │   ├── web_controller.py     # Web Playwright controller
│   │   └── model.py              # AI model integration
│   ├── config.yaml               # Runtime configuration (auto-generated)
│   └── requirements.txt          # Python dependencies
│
├── scripts/                      # Build and utility scripts
│   ├── build-python.js           # Download & setup Python 3.11.9 runtime
│   ├── verify-bundle.js          # Verify all required files before packaging
│   └── fetch-appagent.js         # Update appagent code
│
├── vite.config.ts                # Vite build configuration
├── package.json                  # Node dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.mjs             # ESLint configuration
├── CLAUDE.md                     # Comprehensive AI assistant guide
└── README.md                     # This file
```

</details>

**Architecture Overview:**

Klever Desktop uses a three-layer Electron architecture:

1. **Main Process** (`main/`): Node.js process that manages the app lifecycle, creates windows, and handles IPC
2. **Renderer Process** (`src/`): React UI that runs in a Chromium browser window
3. **Backend Scripts** (`appagent/`): Python automation scripts that control Android/Web

Communication flows: `React UI` ↔ `IPC Bridge (preload.ts)` ↔ `IPC Handlers (main/handlers/)` ↔ `Python Scripts (appagent/)`

For detailed architecture documentation, see [CLAUDE.md](CLAUDE.md).

---

### Available Scripts

#### Development Commands

```bash
npm run start          # Electron Forge dev mode (Vite + Electron with hot reload)
npm run dev            # Vite dev server only (http://localhost:5173)
npm run electron       # Electron only (requires Vite running separately)
```

#### Build & Package Commands

```bash
npm run typecheck      # Type-check TypeScript without building
npm run package        # Package Electron app → out/klever-desktop-{platform}/
npm run make           # Create distributable packages → out/make/
npm run publish        # Publish to configured publishers
```

#### Python Bundling Commands

```bash
node scripts/build-python.js           # Download & setup Python 3.11.9 runtime
node scripts/build-python.js --force   # Force re-download even if Python exists
node scripts/verify-bundle.js          # Verify all required files before packaging
node scripts/verify-bundle.js --strict # Fail on warnings
node scripts/fetch-appagent.js         # Update appagent code from GitHub
```

#### Linting Commands

```bash
npm run lint           # Check for linting errors
npm run lint:fix       # Auto-fix linting errors
```

---

### Building & Packaging

#### Pre-build Verification

Before packaging, verify all required files are present:

```bash
node scripts/verify-bundle.js
```

This checks:
- ✅ Electron build artifacts (`.vite/build/`, `dist/`)
- ✅ appagent Python scripts
- ✅ Python runtime (optional with `--skip-python`)
- ✅ Python dependencies (ollama, playwright)

#### Package for Distribution

```bash
# 1. Verify bundle (optional but recommended)
node scripts/verify-bundle.js

# 2. Package for your platform
npm run package

# 3. Create distributable packages
npm run make
```

Output structure:
- **Packaged apps**: `out/klever-desktop-{platform}-{arch}/` (unsigned, development)
- **Distributable packages**: `out/make/`
  - **macOS**: `.pkg` (Mac App Store), `.zip`
  - **Windows**: `.appx` (Windows Store - unsigned), `.zip`
  - **Linux**: `.zip`

#### Platform-Specific Packaging

Electron Forge automatically packages for your current platform. To target specific platforms, configure `makers` in `forge.config.js`:

```javascript
makers: [
  {
    name: '@electron-forge/maker-appx',
    platforms: ['win32'],  // Windows Store
  },
  {
    name: '@electron-forge/maker-pkg',
    platforms: ['mas'],    // Mac App Store
  },
  {
    name: '@electron-forge/maker-zip',
    platforms: ['darwin', 'linux', 'win32'],
  },
]
```

Then run:
```bash
npm run make  # Creates packages for configured makers
```

---

### Tech Stack

<div align="center">

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18 • TypeScript 5 • MUI Joy • Framer Motion |
| **Desktop** | Electron 31 • Vite 5 • IPC Communication |
| **Backend** | Python 3.11+ • AppAgent (monorepo) |
| **Automation** | ADB (Android) • Playwright (Web) |
| **AI** | Ollama (local) • OpenAI API • OpenRouter |
| **Build** | Electron Forge 7 • Vite • TypeScript • ESLint |

</div>

---

### Configuration Files

#### Application Configuration

The app uses `appagent/config.yaml` for runtime configuration:

```yaml
# Model Configuration
MODEL: "local"              # "local" (Ollama) or "api" (Cloud)
LOCAL_BASE_URL: "http://localhost:11434/v1/chat/completions"
LOCAL_MODEL: "qwen3-vl:4b"
API_BASE_URL: "https://api.openai.com/v1/chat/completions"
API_KEY: "your-api-key"
API_MODEL: "gpt-4o-mini"

# Model Parameters
MAX_TOKENS: 4096
TEMPERATURE: 0.0

# Android Settings
ANDROID_SCREENSHOT_DIR: "/sdcard"

# Web Settings
WEB_BROWSER_TYPE: "chromium"
WEB_HEADLESS: false
WEB_VIEWPORT_WIDTH: 1280
WEB_VIEWPORT_HEIGHT: 720

# Agent Settings
MAX_ROUNDS: 20
ENABLE_REFLECTION: true
```

#### User Data Storage

User data is stored in platform-specific locations:

- **macOS**: `~/Library/Application Support/klever-desktop/`
- **Linux**: `~/.klever-desktop/`
- **Windows**: `%APPDATA%\klever-desktop\`

Contains:
- `projects.json` - Project and task data
- `config.yaml` - Application configuration (copied from appagent/)
- `python-env/` - Python virtual environment (legacy, no longer used)

---

### Contributing Guidelines

We welcome contributions from the community! Here's how to get started:

#### How to Contribute

1. **Fork the repository** on GitHub
2. **Create a feature branch** from `main`
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes** following our coding standards
4. **Test thoroughly** in both dev and production builds
5. **Commit your changes** with clear messages
   ```bash
   git commit -m "feat: Add amazing feature"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request** with a detailed description

#### Development Best Practices

**Code Style:**
- Follow the existing code style (enforced by ESLint)
- Use TypeScript with strict type checking
- Add JSDoc comments for complex functions
- Keep components under 300 lines

**IPC Communication:**
- When adding IPC handlers, update **all three files**:
  1. `main/handlers/*.ts` - Handler implementation
  2. `main/preload.ts` - Context bridge exposure
  3. `src/types/electron.d.ts` - TypeScript definitions
- Always return `{ success: boolean, error?: string }` from handlers

**State Management:**
- Extract complex state logic into custom hooks
- Use `useMemo` and `useCallback` for expensive operations
- Debounce API calls (500ms recommended)

**Testing:**
- Test in both development and production modes
- Verify changes work on target platforms
- Test with both local and API models

**Documentation:**
- Update `CLAUDE.md` for major features
- Add inline comments for complex logic
- Update this README if user-facing features change

#### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```bash
feat: Add markdown report generation for tasks
fix: Resolve Python path detection on Windows
docs: Update setup wizard documentation
refactor: Extract model config into custom hook
```

#### Reporting Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/FigmaAI/KleverDesktop/issues) with:

- **Clear title** summarizing the problem/suggestion
- **Description** with context and details
- **Steps to reproduce** (for bugs)
- **Expected vs actual behavior**
- **System information**: OS, Node version, Electron version, etc.
- **Screenshots** or logs if applicable

---

### Development Resources

**Essential Documentation:**
- [CLAUDE.md](CLAUDE.md) - Comprehensive development guide (for AI assistants and developers)
- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [MUI Joy Documentation](https://mui.com/joy-ui/getting-started/)
- [Vite Documentation](https://vitejs.dev/guide/)

**External Tools:**
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Playwright Documentation](https://playwright.dev/)
- [Android Debug Bridge (ADB) Documentation](https://developer.android.com/tools/adb)

**Project Specific:**
- [AppAgent Repository](https://github.com/FigmaAI/appagent) - Python automation backend
- [Issues & Discussions](https://github.com/FigmaAI/KleverDesktop/issues)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

This project is open source and free to use, modify, and distribute under the MIT License.

---

## 🙏 Acknowledgments

Klever Desktop stands on the shoulders of giants. Special thanks to:

- **[AppAgent](https://github.com/FigmaAI/appagent)** - The powerful Python automation engine that powers our backend
- **[Ollama](https://ollama.com/)** - Making local AI models accessible to everyone
- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop application framework
- **[React](https://reactjs.org/)** & **[TypeScript](https://www.typescriptlang.org/)** - Modern frontend development
- **[MUI Joy](https://mui.com/joy-ui/)** - Beautiful, accessible UI components
- **[Playwright](https://playwright.dev/)** - Reliable web automation
- **[Vite](https://vitejs.dev/)** - Lightning-fast build tool

---

<div align="center">

**Made with ❤️ by the [FigmaAI](https://github.com/FigmaAI) team**

⭐ If you find Klever Desktop useful, please consider giving it a star on GitHub! ⭐

[⬆ Back to Top](#klever-desktop)

</div>

# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Klever Desktop** is an Electron-based desktop application that enables automated UI exploration and testing using local AI models (via Ollama) or remote APIs. It provides a user-friendly interface for managing automation projects on Android (via ADB) and Web (via Playwright).

**Tech Stack:**
- **Frontend**: React 18 + TypeScript + MUI Joy UI + Framer Motion
- **Desktop**: Electron 31
- **Backend**: Python 3.11+ automation scripts (monorepo)
- **Build**: Electron Forge 7 + Vite 5 + TypeScript 5
- **AI**: Ollama (local) or OpenAI-compatible APIs

---

## Quick Start Commands

### Initial Setup
```bash
npm install                                    # Install Node dependencies
python3 -m pip install -r appagent/requirements.txt  # Install Python dependencies
python3 -m playwright install chromium         # Install Playwright browser
```

### Development
```bash
npm run start          # Electron Forge dev mode (Vite + Electron with hot reload)
npm run dev            # Vite dev server only (http://localhost:5173)
npm run electron       # Electron only (requires Vite running separately)
```

### Build & Package (Electron Forge)
```bash
npm run build:main      # Compile TypeScript main process → dist-electron/
npm run build:renderer  # Build React app → dist/
npm run build          # Build both main and renderer
npm run package        # Package app (unsigned) → out/
npm run make           # Create distributable packages (AppX, PKG, ZIP)
npm run publish        # Publish to configured publishers
```

### Python Bundling (New)
```bash
node scripts/build-python.js           # Download & setup Python 3.11.9 runtime
node scripts/verify-bundle.js          # Verify all required files before packaging
node scripts/fetch-appagent.js         # Update appagent code (optional)
```

### Linting
```bash
npm run lint           # Check for linting errors
npm run lint:fix       # Auto-fix linting errors
```

---

## Architecture

### Three-Layer Electron Architecture

#### 1. Main Process (`main/`)
**Location**: `/main/index.ts` (77 lines)

The Electron main process that:
- Creates BrowserWindow (1200x800px, min 1000x600px)
- Loads Vite dev server (localhost:5173) in dev or `dist/index.html` in production
- Registers all IPC handlers via `registerAllHandlers()` from `main/handlers/index.ts`
- Manages application lifecycle and cleanup
- Handles process cleanup on app quit via `cleanupAllProcesses()`

**Handler Architecture** - Modular organization in `main/handlers/`:
- `index.ts` (41 lines) - Central registration point for all handlers
- `task.ts` (452 lines) - CRUD operations for tasks, task execution, markdown generation
- `installations.ts` (196 lines) - Playwright browser installation (simplified)
- `project.ts` (268 lines) - CRUD operations for projects, project execution
- `model.ts` (243 lines) - Model connection testing, API model fetching
- `system-checks.ts` (220 lines) - Python, packages, Ollama, ADB, Playwright, Homebrew checks
- `integration.ts` (209 lines) - Integration test execution
- `config.ts` (131 lines) - Config load/save, setup verification
- `utilities.ts` (71 lines) - System info and shell operations
- `ollama.ts` (51 lines) - Ollama list and pull operations
- `dialogs.ts` (31 lines) - File/folder dialog handlers

**Utilities** - Helper modules in `main/utils/`:
- `config-manager.ts` - YAML config file management
- `project-storage.ts` - JSON-based project storage in `~/.klever-desktop/`
- `python-runtime.ts` - Bundled Python runtime management (simplified, no venv)
- `process-manager.ts` - Subprocess spawning and tracking
- ~~`python-manager.ts`~~ - **DEPRECATED**: Legacy venv-based approach (use python-runtime.ts instead)

#### 2. Preload Script (`main/preload.ts`)
**Location**: `/main/preload.ts` (123 lines)

Context bridge that:
- Exposes 70+ IPC methods via `contextBridge.exposeInMainWorld('electronAPI', {...})`
- Provides type-safe bridge between main and renderer processes
- Includes event listeners: `onEnvProgress`, `onProjectOutput`, `onTaskComplete`, `onTaskOutput`, etc.
- Supports file dialogs: `selectFolder`, `selectMarkdownFile`

**CRITICAL RULE**: Every IPC handler in `main/handlers/` MUST be exposed in `preload.ts`, or you'll get "not a function" errors at runtime.

#### 3. Renderer Process (`src/`)
**Location**: `/src/` (React application)

**Entry Point**: `src/main.tsx`
- React 18 with StrictMode
- CssVarsProvider for MUI Joy theming
- Mock electronAPI for browser testing (when `window.electronAPI` is undefined)
- Comprehensive mock data for all IPC handlers to support browser-based development

**Router**: `src/App.tsx`
- Dynamic routing based on setup completion status
- Checks setup status on mount via `checkSetup()` IPC handler
- Conditional routes:
  - If setup incomplete: redirects to `/setup`
  - If setup complete: renders main app with Layout

```
Setup incomplete:
  /setup → SetupWizard (first-time setup)
  /* → Navigate to /setup

Setup complete:
  / → Layout (main app shell)
    ├── /projects → ProjectList
    ├── /projects/new → ProjectCreate
    ├── /projects/:id → ProjectDetail
    └── /settings → Settings
  /* → Navigate to /projects
```

**Component Structure**:
- `src/components/` - 23+ reusable UI components (see Component Catalog below)
- `src/pages/` - Page components (SetupWizard, ProjectList, ProjectDetail, ProjectCreate, Settings)
- `src/hooks/` - Custom React hooks (usePlatformTools, useModelConfig, useIntegrationTest, useSettings)
- `src/types/` - TypeScript definitions

---

## Component Catalog

The application includes 23+ reusable components in `src/components/`:

**Setup Wizard Components**:
- `SetupStepper.tsx` - Vertical stepper navigation
- `PlatformToolsStep.tsx` - Step 0: Platform tools check
- `PlatformConfigStep.tsx` - Platform configuration step
- `ToolStatusCard.tsx` - Reusable tool status display
- `EnvironmentSetup.tsx` - Python environment setup UI
- `ModelConfigStep.tsx` - Step 1: Model configuration
- `LocalModelCard.tsx` - Ollama configuration card
- `ApiModelCard.tsx` - API model configuration card
- `IntegrationTestStep.tsx` - Step 2: Integration test

**Settings Components**:
- `ModelSelector.tsx` - Model selection dropdown
- `ModelSettingsCard.tsx` - Model settings configuration
- `PlatformSettingsCard.tsx` - Platform-specific settings
- `AgentSettingsCard.tsx` - AI agent settings
- `ImageSettingsCard.tsx` - Image processing settings
- `SystemInfoCard.tsx` - System information display

**Project & Task Components**:
- `ProjectCard.tsx` - Project list item card
- `TaskCard.tsx` - Task list item card
- `TaskCreateDialog.tsx` - Task creation dialog
- `TaskDetailDialog.tsx` - Task detail view dialog
- `TaskMarkdownDialog.tsx` - Markdown report viewer
- `TaskMetricsSummary.tsx` - Task metrics display
- `TaskStatusSummary.tsx` - Task status overview

**Layout**:
- `Layout.tsx` - Main application shell with navigation

## SetupWizard Architecture (Refactored)

The SetupWizard has been refactored from a monolithic 1,387-line component into a clean, modular structure:

### File Structure
```
src/
├── pages/
│   └── SetupWizard.tsx               # Main orchestrator (343 lines)
├── hooks/                             # Custom hooks
│   ├── usePlatformTools.tsx          # Platform tools checking logic
│   ├── useModelConfig.tsx            # Model configuration state & logic
│   ├── useIntegrationTest.tsx        # Integration test logic
│   └── useSettings.tsx               # Settings state management
├── components/                        # Reusable UI components (see Component Catalog above)
└── types/
    └── setupWizard.ts                # SetupWizard-specific types
```

### Custom Hooks Pattern

**`usePlatformTools()`** (`src/hooks/usePlatformTools.tsx`):
- State: `toolsStatus` for Python, pythonEnv, androidStudio, homebrew
- Method: `checkPlatformTools()` - Checks all tools asynchronously
- Returns: `{ toolsStatus, setToolsStatus, checkPlatformTools }`

**`useModelConfig(currentStep)`** (`src/hooks/useModelConfig.tsx`):
- State: `modelConfig`, test statuses, Ollama/API models
- Methods: `handleTestLocalConnection()`, `handleTestApiConnection()`, `fetchOllamaModels()`, `fetchApiModels()`
- Auto-fetches models when step changes
- Debounces API calls (500ms) to reduce requests

**`useIntegrationTest()`** (`src/hooks/useIntegrationTest.tsx`):
- State: Running status, completion, success, terminal output
- Methods: `handleRunIntegrationTest(modelConfig)`, `handleStopIntegrationTest()`
- Listens to IPC events for real-time output

**`useSettings()`** (`src/hooks/useSettings.tsx`):
- State: Settings data, loading status
- Methods: Load, save, and update app settings
- Syncs with `config.yaml` via IPC handlers

### Component Organization Benefits

1. **Project Consistency**: Follows standard src/components/, src/hooks/, src/types/ structure
2. **Improved Reusability**: All components can be imported from `@/components/`
3. **Better Maintainability**: Flat structure makes navigation easier
4. **Enhanced Testability**: Hooks and components testable in isolation
5. **Type Safety**: Shared types in `@/types/setupWizard` ensure consistency
6. **Scalability**: 23+ components organized by feature domain (Setup, Settings, Projects/Tasks)

---

## IPC Communication Pattern

### Three-Step Process

When adding new functionality that requires communication between renderer and main process, follow this pattern:

#### Step 1: Add Handler in `main/handlers/`
```typescript
// main/handlers/example.ts
import { ipcMain } from 'electron'

export function registerExampleHandlers(ipcMain: IpcMain) {
  ipcMain.handle('namespace:action', async (event, ...args) => {
    try {
      // Implementation
      return { success: true, data: ... }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}
```

Register in `main/handlers/index.ts`:
```typescript
import { registerExampleHandlers } from './example'

export function registerAllHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null) {
  // ... existing handlers
  registerExampleHandlers(ipcMain)
}
```

#### Step 2: Expose in `main/preload.ts`
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods
  namespaceAction: (...args) => ipcRenderer.invoke('namespace:action', ...args),
})
```

#### Step 3: Add TypeScript Types in `src/types/electron.d.ts`
```typescript
declare global {
  interface Window {
    electronAPI: {
      // ... existing methods
      namespaceAction: (...args: ArgTypes) => Promise<{ success: boolean; data?: DataType; error?: string }>
    }
  }
}
```

#### Step 4: Use in React Components
```typescript
const result = await window.electronAPI.namespaceAction(...args)
if (result.success) {
  // Handle success
} else {
  console.error(result.error)
}
```

**CRITICAL**: If you add an IPC handler but forget to expose it in preload.ts, you'll get a "not a function" error at runtime.

---

## Model Configuration

The app supports **dual model configuration** (both can be enabled simultaneously):

### Configuration Interface
```typescript
interface ModelConfig {
  enableLocal: boolean      // Use local Ollama
  enableApi: boolean        // Use remote API
  localBaseUrl: string      // Default: http://localhost:11434/v1/chat/completions
  localModel: string        // e.g., 'qwen3-vl:4b'
  apiBaseUrl: string        // e.g., 'https://api.openai.com/v1/chat/completions'
  apiKey: string            // API key (password-masked in UI)
  apiModel: string          // e.g., 'gpt-4o-mini'
}
```

### Model Providers

**Local Models (Ollama)**:
- Recommended for privacy and offline access
- Default model: `qwen3-vl:4b` (optimized for 16GB RAM)
- Models auto-fetched via `check:ollama` IPC handler
- Pull new models via `ollama:pull` handler

**API Models**:
- Intelligent provider detection from URL:
  - OpenAI: `api.openai.com`
  - OpenRouter: `openrouter.ai`
  - Anthropic: `api.anthropic.com`
  - Grok: `api.x.ai`
- Auto-fetches available models via `model:fetchApiModels`
- Autocomplete dropdown for model selection

### Dual-Mode Behavior
- When both enabled, API is preferred for requests
- Each can be tested independently via `model:testConnection` handler
- Config saved to `appagent/config.yaml` via `model:saveConfig`

---

## Python Backend (Monorepo)

**Location**: `/appagent/` (monorepo folder, no longer a git submodule)

### Key Scripts
- `scripts/self_explorer.py` - Main automation logic (UI exploration loop)
- `scripts/and_controller.py` - Android device controller via ADB
- `scripts/web_controller.py` - Web browser controller via Playwright
- `scripts/model.py` - AI model integration (Ollama/API)
- `config.yaml` - Runtime configuration (generated by SetupWizard)

### Python Runtime Management

**Architecture Change (2024-11-18)**: Migrated from complex venv-based approach to simplified bundled Python.

**Bundled Python Location**:
- Dev: `resources/python/{platform}/python/bin/python3`
- Prod: `extraResources/python/{platform}/python/bin/python3`

**Key Functions** (from `main/utils/python-runtime.ts`):
- `getPythonPath()` - Returns path to bundled Python executable
- `getAppagentPath()` - Returns path to appagent directory
- `getPythonEnv()` - Returns environment variables for Python execution
- `executePythonScript(scriptPath, args)` - Execute Python script with bundled runtime
- `spawnBundledPython(args, options)` - Low-level Python process spawning
- `checkPythonRuntime()` - Verify Python and appagent availability
- `checkPlaywrightBrowsers()` - Check if Playwright browsers are installed
- `installPlaywrightBrowsers()` - Install Playwright Chromium browser

**Installation Flow** (Simplified):
1. Python is bundled with the app (no runtime installation needed)
2. Dependencies are pre-installed in bundled Python
3. Only Playwright browsers need runtime installation via `install:playwright`

**Benefits**:
- ✅ No venv creation at runtime
- ✅ Deterministic Python environment
- ✅ Faster startup time
- ✅ No system Python fallback complexity
- ✅ Clear error messages when Python is missing

**For Development**:
```bash
# Build/download bundled Python runtime
node scripts/build-python.js

# Or use system Python (create symlink)
mkdir -p resources/python/linux-x64/python/bin
ln -s $(which python3) resources/python/linux-x64/python/bin/python3

# Install dependencies
python3 -m pip install -r appagent/requirements.txt
python3 -m playwright install chromium
```

---

## Common Development Patterns

### 1. Platform Tools Checking

The SetupWizard checks required tools in Step 0:

```typescript
interface ToolStatus {
  checking: boolean      // Currently checking
  installed: boolean     // Tool is installed
  version?: string       // Version string (if available)
  error?: string         // Error message
  installing?: boolean   // Currently installing
}
```

**Checked Tools**:
- **Python 3.11+**: via `checkPythonRuntime()` - checks bundled Python
- **Python Environment**: Bundled Python + packages + Playwright browsers
- **Android Studio**: via `checkAndroidStudio()` - looks for ADB executable
- **Homebrew** (macOS only): via `checkHomebrew()` - package manager

**Pattern**:
```typescript
const { toolsStatus, checkPlatformTools } = usePlatformTools()

useEffect(() => {
  if (currentStep === 0) {
    checkPlatformTools()
  }
}, [currentStep, checkPlatformTools])
```

### 2. Debounced API Calls

To avoid excessive API requests, use debouncing:

```typescript
useEffect(() => {
  if (modelConfig.enableApi && modelConfig.apiBaseUrl) {
    const timeoutId = window.setTimeout(() => {
      fetchApiModels()
    }, 500) // 500ms debounce

    return () => window.clearTimeout(timeoutId)
  }
}, [modelConfig.enableApi, modelConfig.apiBaseUrl, modelConfig.apiKey])
```

### 3. Config File Management

**Config Location**: `appagent/config.yaml`

**IPC Handlers**:
- `config:load` - Read YAML config, returns parsed object
- `config:save` - Write YAML config from object
- `model:saveConfig` - Save model config with validation
- `config:reset` - Delete config (forces re-setup)
- `check:setup` - Verify venv status AND config validity

**Usage**:
```typescript
// Load config
const result = await window.electronAPI.configLoad()
if (result.success) {
  setModelConfig(result.config)
}

// Save config
await window.electronAPI.saveModelConfig(modelConfig)
```

### 4. Real-Time Progress Updates

For long-running operations, use IPC event listeners:

```typescript
// In component
useEffect(() => {
  window.electronAPI.onEnvProgress((data: string) => {
    setTerminalLines(prev => [...prev, <TerminalOutput>{data}</TerminalOutput>])
  })
}, [])

// In main process (handler)
getMainWindow()?.webContents.send('env:progress', outputLine)
```

**Available Event Channels**:
- `env:progress` - Environment setup progress
- `install:progress` - Installation progress
- `ollama:pull:progress` - Ollama model download progress
- `project:output` - Project execution output
- `task:output` - Task execution output (real-time)
- `task:complete` - Task execution completion
- `integration:test:output` - Integration test output
- `integration:test:complete` - Integration test completion

### 5. Project & Task Management

**Data Storage**: `~/.klever-desktop/projects.json`

**Structure**:
```typescript
interface Project {
  id: string              // UUID
  name: string
  platform: 'android' | 'web'
  device?: string         // Android device ID or Web URL
  url?: string
  status: 'active' | 'archived'
  createdAt: string       // ISO timestamp
  updatedAt: string
  tasks: Task[]           // Nested tasks array
  workspaceDir: string    // ~/Documents/{projectName}/
}

interface Task {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  resultPath?: string     // Path to result files
  output?: string         // Execution output
  error?: string          // Error message
}
```

**IPC Handlers**:
- `project:list`, `project:create`, `project:update`, `project:delete`
- `task:create`, `task:update`, `task:delete`
- `task:start`, `task:stop` - Execute task with Python subprocess, generates markdown reports
- `task:getMarkdown` - Retrieve markdown report for completed task
- `project:start`, `project:stop` - Run project exploration
- File dialogs: `selectFolder`, `selectMarkdownFile` - Native OS file/folder selection

---

## Key Files Reference

### Main Process
- `main/index.ts` (77 lines) - Entry point, window creation, handler registration
- `main/preload.ts` (123 lines) - Context bridge with 70+ IPC methods
- `main/handlers/index.ts` (41 lines) - Central handler registration

### Handlers (2,041 lines total)
- `main/handlers/task.ts` (452 lines) - Task CRUD, execution, markdown generation
- `main/handlers/installations.ts` (324 lines) - Environment setup, installations
- `main/handlers/project.ts` (268 lines) - Project CRUD and execution
- `main/handlers/model.ts` (243 lines) - Model testing and API fetching
- `main/handlers/system-checks.ts` (220 lines) - System tool verification
- `main/handlers/integration.ts` (209 lines) - Integration test execution
- `main/handlers/config.ts` (131 lines) - Config management
- `main/handlers/utilities.ts` (71 lines) - System utilities
- `main/handlers/ollama.ts` (51 lines) - Ollama operations
- `main/handlers/dialogs.ts` (31 lines) - File/folder dialogs

### Utilities
- `main/utils/config-manager.ts` - YAML config management
- `main/utils/project-storage.ts` - JSON project storage
- `main/utils/python-manager.ts` - Python venv management
- `main/utils/process-manager.ts` - Subprocess tracking

### Renderer
- `src/main.tsx` - React entry point with mock API
- `src/App.tsx` - Router with setup-based conditional rendering
- `src/pages/SetupWizard.tsx` (343 lines) - Multi-step setup wizard
- `src/pages/` - ProjectList, ProjectDetail, ProjectCreate, Settings
- `src/hooks/` - usePlatformTools, useModelConfig, useIntegrationTest, useSettings
- `src/components/` - 23+ reusable UI components (see Component Catalog section)

### Configuration
- `package.json` - Dependencies, scripts, build config
- `vite.config.ts` - Vite build configuration with path alias (`@` → `./src`)
- `tsconfig.json`, `tsconfig.main.json`, `tsconfig.node.json` - TypeScript configs
- `eslint.config.mjs` - ESLint configuration

### Types
- `src/types/electron.d.ts` - IPC method signatures (70+ methods)
- `src/types/project.ts` - Project and Task types
- `src/types/setupWizard.ts` - SetupWizard types (ToolStatus, ModelConfig, TestStatus, StepConfig)
- `main/types/model.ts` - Model configuration types

---

## Development Notes

### Important Constants
- **Vite Dev Server**: Port 5173 (strict, no fallback)
- **Window Size**: 1200x800px (min 1000x600px)
- **API Debounce**: 500ms for model fetching
- **Progress Estimation**: ~2% per terminal line output

### Framework Specifics
- **UI Library**: MUI Joy (not Material-UI) - `@mui/joy`
- **Animations**: Framer Motion - `framer-motion`
- **Terminal**: react-terminal-ui for output display
- **Routing**: React Router v6 with BrowserRouter
- **State Management**: React Hooks (no Redux/Context)

### Electron Specifics
- **Development**: Loads from `http://localhost:5173`
- **Production**: Loads from `dist/index.html`
- **Python Subprocess**: Spawned via `spawn()`, cleaned up on app quit
- **IPC Pattern**: `ipcMain.handle()` in main, `ipcRenderer.invoke()` in renderer

### File Paths
- **User Data**: `app.getPath('userData')` → `~/.klever-desktop/` or `~/Library/Application Support/klever-desktop/`
- **Projects Storage**: `{userData}/projects.json`
- **Python Venv**: `{userData}/python-env/`
- **Workspaces**: `~/Documents/{projectName}/`
- **Config**: `appagent/config.yaml`

---

## Prerequisites

### Required
- **Node.js**: 18+ (for Electron 31 and Vite 5)
- **Python**: 3.11+ (bundled in packaged app, required for development)
- **Git**: For submodule management

### Optional (for full functionality)
- **Ollama**: For local AI models - https://ollama.com/download
- **Android Studio**: For Android device automation (provides ADB)
- **Homebrew** (macOS): Package manager for dependencies

---

## Troubleshooting

### Common Issues

**"[method] is not a function" error**:
- **Cause**: IPC handler added to `main/handlers/` but not exposed in `main/preload.ts`
- **Fix**: Add the method to `contextBridge.exposeInMainWorld()` in preload.ts

**Python subprocess not working**:
- **Cause**: Bundled Python missing or dependencies not installed
- **Fix**: Run `node scripts/build-python.js` to download Python runtime, or create symlink to system Python for development

**Homebrew check failing on non-Mac**:
- **Cause**: `check:homebrew` handler is macOS-specific
- **Expected**: On Windows/Linux, the check should auto-pass or be skipped

**Vite port already in use**:
- **Cause**: Another process using port 5173
- **Fix**: Kill the process (`lsof -ti:5173 | xargs kill -9` on Unix) or change port in `vite.config.ts`

**TypeScript errors after refactoring**:
- **Cause**: Import paths changed or types not updated
- **Fix**: Run `npm run build:main` to check main process types, and ensure all imports use the new structure

**Import errors after refactor**:
- **Cause**: Components moved to standard src/components/, src/hooks/, src/types/ structure
- **Fix**: Use path alias imports: `@/components/`, `@/hooks/`, `@/types/setupWizard`

---

## Electron Forge Build System

**Migration**: The project migrated from electron-builder to Electron Forge (v7.10.2) for official Electron tooling and better Windows/Mac App Store support.

### Configuration Files

#### forge.config.js
**Location**: `/forge.config.js` (~170 lines)

Main Electron Forge configuration with:
- **packagerConfig**: App metadata, icons, extraResources (appagent), macOS signing
- **makers**: Windows Store (AppX), Mac App Store (PKG), ZIP
- **plugins**: Vite plugin for main/preload/renderer processes
- **hooks**: Pre-package and post-make build hooks

#### Vite Configs for Electron Forge
- **vite.main.config.js**: Main process build (main/index.ts → dist-electron/index.js)
- **vite.preload.config.js**: Preload script build (main/preload.ts → dist-electron/preload.js)
- **vite.config.ts**: Renderer process build (src/ → dist/)

### Makers (Distribution Packages)

#### Windows Store (AppX) - Unsigned for Partner Center
```javascript
{
  name: '@electron-forge/maker-appx',
  config: {
    // NO devCert or certPass - creates unsigned package
    // Microsoft Partner Center will sign after upload
    packageName: 'KleverDesktop',
    publisher: 'CN=YourPublisherName', // From Partner Center
    identityName: 'YourCompany.KleverDesktop', // Reserved in Partner Center
    backgroundColor: '#FFFFFF',
    arch: 'x64', // or 'arm64'
  },
  platforms: ['win32'],
}
```

**Windows Store Build Strategy**:
1. Build unsigned AppX package: `npm run make`
2. Upload to Microsoft Partner Center
3. Partner Center applies **store-managed signing**
4. Package is signed and published to Windows Store

**Requirements**:
- Windows 10/11 with Windows SDK installed
- Partner Center account with reserved app name
- Publisher identity configured in Partner Center

#### Mac App Store (PKG)
```javascript
{
  name: '@electron-forge/maker-pkg',
  config: {
    identity: '3rd Party Mac Developer Installer: Your Name (TEAM_ID)',
    install: '/Applications',
  },
  platforms: ['mas'], // Mac App Store platform
}
```

**Requirements**:
- Apple Developer account
- Distribution certificates and provisioning profiles
- Entitlements configured (build/entitlements.mas.plist)

#### ZIP Maker (Development/Testing)
```javascript
{
  name: '@electron-forge/maker-zip',
  platforms: ['darwin', 'linux', 'win32'],
}
```

### Build Commands

**Development**:
```bash
npm run start           # Electron Forge dev mode with hot reload
```

**Packaging**:
```bash
npm run package         # Package app → out/klever-desktop-{platform}-{arch}/
npm run make            # Create distributable packages → out/make/
npm run publish         # Publish to configured publishers (GitHub, S3, etc.)
```

**Output Structure**:
```
out/
├── klever-desktop-win32-x64/          # Packaged app (Windows)
├── klever-desktop-darwin-arm64/       # Packaged app (macOS)
└── make/
    ├── appx/
    │   └── klever-desktop-2.0.0.appx  # Windows Store package (unsigned)
    ├── pkg/
    │   └── klever-desktop-2.0.0.pkg   # Mac App Store package
    └── zip/
        └── klever-desktop-*.zip       # Compressed archive
```

### Platform-Specific Notes

**Windows**:
- AppX builds require Windows 10/11 + Windows SDK
- Unsigned packages for Partner Center store-managed signing
- Custom manifest template: `build/appxmanifest.xml`

**macOS**:
- MAS builds require signing certificates
- Entitlements: `build/entitlements.mas.plist`, `build/entitlements.mas.inherit.plist`
- Sandbox enabled for App Store compliance

**Linux**:
- ZIP archives for manual distribution
- No official app store support in current config

### Migration from electron-builder

**Removed**:
- `electron-builder` package
- `build` section in package.json

**Added**:
- `@electron-forge/cli` and plugins
- `forge.config.js` configuration
- Vite config files for main/preload processes

**Maintained**:
- Existing Vite build process (via `@electron-forge/plugin-vite`)
- Python scripts bundling (appagent as extraResource)
- Development workflow (npm scripts)

---

## Build Scripts & Tools

The project includes several utility scripts for Python runtime management and build verification:

### scripts/build-python.js

Downloads and configures Python 3.11.9 embedded distribution for the target platform.

**Usage**:
```bash
node scripts/build-python.js [options]

Options:
  --platform <platform>  Target platform (darwin-x64, darwin-arm64, win32-x64, linux-x64)
  --dry-run             Preview actions without executing
  --force              Force re-download even if Python exists
```

**Features**:
- Downloads platform-specific Python 3.11.9
- Installs dependencies from `appagent/requirements.txt`
- Creates `resources/python/{platform}/python/` directory structure
- Pre-installs Playwright browsers

### scripts/verify-bundle.js

Verifies all required files are present before packaging the application.

**Usage**:
```bash
node scripts/verify-bundle.js [options]

Options:
  --platform <platform>  Target platform (default: current platform)
  --skip-python         Skip Python runtime checks (for dev builds)
  --strict             Fail on warnings
```

**Checks**:
- ✅ Electron build artifacts (dist-electron/, dist/)
- ✅ appagent Python scripts
- ✅ Python runtime (optional with --skip-python)
- ✅ Python dependencies (ollama, playwright)

**Output**:
- Color-coded results (green = pass, red = fail)
- Detailed troubleshooting tips for missing files
- Summary with pass/fail counts

### scripts/fetch-appagent.js

Updates appagent code from the original repository (useful after monorepo migration).

**Usage**:
```bash
node scripts/fetch-appagent.js [options]

Options:
  --branch <branch>  Git branch to fetch (default: main)
  --force           Overwrite existing appagent directory
  --dry-run         Preview actions without executing
```

**Features**:
- Downloads latest appagent code from GitHub
- Preserves local config.yaml
- Supports both submodule and monorepo modes
- Safe: backs up existing directory before overwriting

---

## Best Practices

### When Modifying Code

1. **Adding IPC Handlers**: Always update all three files (handler, preload, types)
2. **State Management**: Use custom hooks for complex state logic
3. **Component Size**: Keep components under 300 lines; split into smaller pieces if larger
4. **Error Handling**: Always return `{ success: boolean, error?: string }` from IPC handlers
5. **TypeScript**: Maintain strict type safety; avoid `any` types
6. **Console Logging**: Use descriptive prefixes like `[ComponentName]` for debugging

### Code Organization

1. **Handlers**: Group related IPC handlers in same file (e.g., all project operations in `project.ts`)
2. **Hooks**: Extract stateful logic into custom hooks for reusability
3. **Components**: Follow atomic design - atoms (buttons), molecules (cards), organisms (pages)
4. **Types**: Share types between main and renderer via `src/types/` and `main/types/`

### Performance

1. **Debounce**: Use debouncing for API calls and expensive operations
2. **Lazy Loading**: Consider code-splitting for large routes
3. **Memoization**: Use `useMemo` and `useCallback` for expensive computations
4. **IPC**: Minimize IPC calls; batch operations when possible

---

## Contributing

When contributing to this project:

1. **Test Both Processes**: Ensure changes work in both dev and production builds
2. **Update Types**: Keep TypeScript definitions in sync with implementations
3. **Document IPC**: Add comments to new IPC handlers explaining their purpose
4. **Follow Patterns**: Maintain consistency with existing code patterns
5. **Update CLAUDE.md**: If adding major features, update this file

---

## Additional Resources

- **Electron Docs**: https://www.electronjs.org/docs/latest
- **MUI Joy Docs**: https://mui.com/joy-ui/getting-started/
- **Vite Docs**: https://vitejs.dev/guide/
- **Ollama Docs**: https://github.com/ollama/ollama/blob/main/docs/api.md

---

## Update History

**2025-11-20**: Migration to Electron Forge build system
- **Build System**: Migrated from electron-builder to Electron Forge v7.10.2
  - Official Electron tooling for long-term stability
  - Native Windows Store (AppX) and Mac App Store (PKG) support
  - Vite integration via `@electron-forge/plugin-vite`
- **New Configuration Files**:
  - `forge.config.js` - Main Electron Forge configuration
  - `vite.main.config.js` - Main process Vite config
  - `vite.preload.config.js` - Preload script Vite config
  - `build/appxmanifest.xml` - Windows AppX manifest template
- **Windows Store Strategy**: Unsigned AppX builds for Microsoft Partner Center store-managed signing
- **Mac App Store**: PKG builds with MAS entitlements and signing certificates
- **Removed**: electron-builder dependency and package.json build section
- **Updated Scripts**: `start`, `package`, `make`, `publish` for Electron Forge workflow
- **Documentation**: Added comprehensive Electron Forge Build System section

**2025-11-19**: Documentation cleanup and improvements
- **Removed Unnecessary Files**: Deleted `PLANNING.md` and `REFACTORING_PROPOSAL.md` (outdated planning documents)
- **README Updates**:
  - Updated appagent description from "submodule" to "monorepo"
  - Updated python-manager.ts reference to python-runtime.ts
  - Corrected installations.ts line count (324 → 196 lines)
  - Improved Python setup instructions with bundled runtime options
- **Documentation Status**: All core documentation (CLAUDE.md, README.md) now up-to-date with current architecture

**2024-11-18**: Major Python bundling refactoring
- **Architecture Change**: Migrated from git submodule to monorepo structure
- **Python Runtime**: Replaced `python-manager.ts` with simplified `python-runtime.ts`
  - Removed venv creation at runtime
  - Eliminated system Python fallback
  - Bundled Python only approach
  - Reduced installations.ts from 324 → 196 lines
- **New Scripts**:
  - `scripts/build-python.js` - Download and setup Python 3.11.9 runtime
  - `scripts/verify-bundle.js` - Pre-build verification tool
  - `scripts/fetch-appagent.js` - Update appagent code mechanism
- **Migrated Handlers**: Updated task.ts, integration.ts, project.ts to use `python-runtime.ts`
- **Benefits**: Faster startup, deterministic environment, clearer error messages

**2025-11-16**: Updated documentation to reflect current codebase state
- Updated all line counts for main process files
- Added new `dialogs.ts` handler (31 lines)
- Documented handler growth: 1,616 → 2,041 total lines
- Added Component Catalog section with 23+ components organized by domain
- Documented new event channels: `task:output`, `task:complete`
- Added new IPC handlers: `task:getMarkdown`, `selectFolder`, `selectMarkdownFile`
- Updated hooks documentation to include `useSettings`
- Documented App.tsx conditional routing based on setup status
- Updated preload.ts: 60+ → 70+ IPC methods

**2025-11-14**: SetupWizard refactoring
- Reorganized to follow project structure conventions (src/hooks/, src/components/, src/types/)

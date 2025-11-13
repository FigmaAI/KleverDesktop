# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Klever Desktop** is an Electron-based desktop application that enables automated UI exploration and testing using local AI models (via Ollama) or remote APIs. It provides a user-friendly interface for managing automation projects on Android (via ADB) and Web (via Playwright).

**Tech Stack:**
- **Frontend**: React 18 + TypeScript + MUI Joy UI + Framer Motion
- **Desktop**: Electron 31
- **Backend**: Python 3.11+ automation scripts (git submodule)
- **Build**: Vite 5 + TypeScript 5
- **AI**: Ollama (local) or OpenAI-compatible APIs

---

## Quick Start Commands

### Initial Setup
```bash
npm install                                    # Install Node dependencies & init submodules
git submodule update --init --recursive        # Ensure appagent submodule is initialized
cd appagent && python -m pip install -r requirements.txt  # Install Python dependencies
```

### Development
```bash
npm run electron:dev    # Full dev environment (Vite + Electron with hot reload)
npm run dev            # Vite dev server only (http://localhost:5173)
npm run electron       # Electron only (requires Vite running separately)
```

### Build & Package
```bash
npm run build:main      # Compile TypeScript main process → dist-electron/
npm run build:renderer  # Build React app → dist/
npm run build          # Build both main and renderer
npm run package        # Package Electron app for distribution
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
**Location**: `/main/index.ts` (74 lines)

The Electron main process that:
- Creates BrowserWindow (1200x800px, min 1000x600px)
- Loads Vite dev server (localhost:5173) in dev or `dist/index.html` in production
- Registers all IPC handlers via `registerAllHandlers()` from `main/handlers/index.ts`
- Manages application lifecycle and cleanup

**Handler Architecture** - Modular organization in `main/handlers/`:
- `index.ts` (39 lines) - Central registration point for all handlers
- `system-checks.ts` (207 lines) - Python, packages, Ollama, ADB, Playwright, Homebrew checks
- `installations.ts` (324 lines) - Environment setup, package installation
- `config.ts` (121 lines) - Config load/save, setup verification
- `model.ts` (309 lines) - Model connection testing, API model fetching
- `ollama.ts` (51 lines) - Ollama list and pull operations
- `utilities.ts` (36 lines) - System info and shell operations
- `project.ts` (179 lines) - CRUD operations for projects
- `task.ts` (234 lines) - CRUD operations for tasks, task execution
- `integration.ts` (155 lines) - Integration test execution

**Utilities** - Helper modules in `main/utils/`:
- `config-manager.ts` - YAML config file management
- `project-storage.ts` - JSON-based project storage in `~/.klever-desktop/`
- `python-manager.ts` - Bundled Python runtime detection & venv management
- `process-manager.ts` - Subprocess spawning and tracking

#### 2. Preload Script (`main/preload.ts`)
**Location**: `/main/preload.ts` (116 lines)

Context bridge that:
- Exposes 60+ IPC methods via `contextBridge.exposeInMainWorld('electronAPI', {...})`
- Provides type-safe bridge between main and renderer processes
- Includes event listeners: `onEnvProgress`, `onProjectOutput`, `onTaskComplete`, etc.

**CRITICAL RULE**: Every IPC handler in `main/handlers/` MUST be exposed in `preload.ts`, or you'll get "not a function" errors at runtime.

#### 3. Renderer Process (`src/`)
**Location**: `/src/` (React application)

**Entry Point**: `src/main.tsx` (271 lines)
- React 18 with StrictMode
- CssVarsProvider for MUI Joy theming
- Mock electronAPI for browser testing (when `window.electronAPI` is undefined)

**Router**: `src/App.tsx` (73 lines)
```
/setup → SetupWizard (first-time setup)
/ → Layout (main app shell)
  ├── /projects → ProjectList
  ├── /projects/new → ProjectCreate
  ├── /projects/:id → ProjectDetail
  ├── /projects/:projectId/tasks/new → TaskCreate
  ├── /projects/:projectId/tasks/:taskId → TaskDetail
  └── /settings → Settings
```

**Component Structure**:
- `src/components/` - Shared components (Layout)
- `src/pages/` - Page components (SetupWizard, ProjectList, etc.)
- `src/types/` - TypeScript definitions

---

## SetupWizard Architecture (Refactored)

**Location**: `/src/pages/SetupWizard/`

The SetupWizard has been refactored from a monolithic 1,387-line component into a clean, modular structure:

### Directory Structure
```
SetupWizard/
├── index.tsx                          # Main orchestrator (250 lines)
├── types.ts                           # Shared TypeScript types
├── hooks/
│   ├── usePlatformTools.ts           # Platform tools checking logic
│   ├── useModelConfig.ts             # Model configuration state & logic
│   └── useIntegrationTest.ts         # Integration test logic
└── components/
    ├── SetupStepper.tsx              # Vertical stepper component
    ├── PlatformToolsStep/
    │   ├── index.tsx                 # Step 0: Platform tools check
    │   ├── ToolStatusCard.tsx        # Reusable tool status display
    │   └── EnvironmentSetup.tsx      # Python environment setup UI
    ├── ModelConfigStep/
    │   ├── index.tsx                 # Step 1: Model configuration
    │   ├── LocalModelCard.tsx        # Ollama configuration card
    │   └── ApiModelCard.tsx          # API model configuration card
    └── IntegrationTestStep/
        └── index.tsx                 # Step 2: Integration test
```

### Custom Hooks Pattern

**`usePlatformTools()`** - Manages platform tool checking:
- State: `toolsStatus` for Python, pythonEnv, androidStudio, homebrew
- Method: `checkPlatformTools()` - Checks all tools asynchronously
- Returns: `{ toolsStatus, setToolsStatus, checkPlatformTools }`

**`useModelConfig(currentStep)`** - Manages model configuration:
- State: `modelConfig`, test statuses, Ollama/API models
- Methods: `handleTestLocalConnection()`, `handleTestApiConnection()`, `fetchOllamaModels()`, `fetchApiModels()`
- Auto-fetches models when step changes
- Debounces API calls (500ms) to reduce requests

**`useIntegrationTest()`** - Manages integration test:
- State: Running status, completion, success, terminal output
- Methods: `handleRunIntegrationTest(modelConfig)`, `handleStopIntegrationTest()`
- Listens to IPC events for real-time output

### Component Separation Benefits

1. **Reduced Complexity**: Each component has a single responsibility
2. **Improved Reusability**: `ToolStatusCard` can be used for any tool check
3. **Better Testing**: Hooks and components can be tested in isolation
4. **Easier Maintenance**: Changes to one step don't affect others
5. **Type Safety**: Shared types in `types.ts` ensure consistency

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

## Python Backend (Git Submodule)

**Location**: `/appagent/` (git submodule)

### Key Scripts
- `scripts/self_explorer.py` - Main automation logic (UI exploration loop)
- `scripts/and_controller.py` - Android device controller via ADB
- `scripts/web_controller.py` - Web browser controller via Playwright
- `scripts/model.py` - AI model integration (Ollama/API)
- `config.yaml` - Runtime configuration (generated by SetupWizard)

### Virtual Environment Management

**Bundled Python**:
- Dev: `resources/python/{platform}/python/bin/python3`
- Prod: `extraResources/python/{platform}/python/bin/python3`

**Virtual Environment**:
- Location: `{app.userData}/python-env/`
- Created via `env:setup` IPC handler
- Validated via `env:check` handler
- Requirements from `appagent/requirements.txt`

**Installation Flow**:
1. Check bundled Python exists (`envCheck()`)
2. Create venv (`env:setup`)
3. Install requirements (`pip install -r requirements.txt`)
4. Install Playwright browsers (`playwright install chromium`)

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
- **Python 3.11+**: via `envCheck()` - checks bundled or system Python
- **Python Environment**: venv + packages + Playwright browsers
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
- `task:start`, `task:stop` - Execute task with Python subprocess
- `project:start`, `project:stop` - Run project exploration

---

## Key Files Reference

### Main Process
- `main/index.ts` (74 lines) - Entry point, window creation, handler registration
- `main/preload.ts` (116 lines) - Context bridge with 60+ IPC methods
- `main/handlers/index.ts` (39 lines) - Central handler registration

### Handlers (1,616 lines total)
- `main/handlers/system-checks.ts` (207 lines)
- `main/handlers/installations.ts` (324 lines)
- `main/handlers/config.ts` (121 lines)
- `main/handlers/model.ts` (309 lines)
- `main/handlers/ollama.ts` (51 lines)
- `main/handlers/utilities.ts` (36 lines)
- `main/handlers/project.ts` (179 lines)
- `main/handlers/task.ts` (234 lines)
- `main/handlers/integration.ts` (155 lines)

### Utilities
- `main/utils/config-manager.ts` - YAML config management
- `main/utils/project-storage.ts` - JSON project storage
- `main/utils/python-manager.ts` - Python venv management
- `main/utils/process-manager.ts` - Subprocess tracking

### Renderer (2,901 lines total)
- `src/main.tsx` (271 lines) - React entry point
- `src/App.tsx` (73 lines) - Router configuration
- `src/components/Layout.tsx` (69 lines) - App shell
- `src/pages/SetupWizard/` (modular structure)
- `src/pages/ProjectList.tsx`, `ProjectDetail.tsx`, etc.

### Configuration
- `package.json` (106 lines) - Dependencies, scripts, build config
- `vite.config.ts` (22 lines) - Vite build configuration
- `tsconfig.json`, `tsconfig.main.json`, `tsconfig.node.json` - TypeScript configs
- `eslint.config.mjs` - ESLint configuration

### Types
- `src/types/electron.d.ts` - IPC method signatures
- `src/types/project.ts` - Project and Task types
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
- **Cause**: appagent submodule not initialized or dependencies not installed
- **Fix**: Run `git submodule update --init --recursive && cd appagent && pip install -r requirements.txt`

**Homebrew check failing on non-Mac**:
- **Cause**: `check:homebrew` handler is macOS-specific
- **Expected**: On Windows/Linux, the check should auto-pass or be skipped

**Vite port already in use**:
- **Cause**: Another process using port 5173
- **Fix**: Kill the process (`lsof -ti:5173 | xargs kill -9` on Unix) or change port in `vite.config.ts`

**TypeScript errors after refactoring**:
- **Cause**: Import paths changed or types not updated
- **Fix**: Run `npm run build:main` to check main process types, and ensure all imports use the new structure

**SetupWizard not showing after refactor**:
- **Cause**: Export path changed from `src/pages/SetupWizard.tsx` to `src/pages/SetupWizard/index.tsx`
- **Fix**: Ensure `src/pages/index.ts` exports from correct path: `export { SetupWizard } from './SetupWizard'`

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

*Last Updated*: 2025-11-13
*Refactored*: SetupWizard modularization completed

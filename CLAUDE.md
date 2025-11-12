# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Klever Desktop is an Electron-based desktop application that enables automated UI exploration and testing using local AI models (via Ollama) or remote APIs. It provides a user-friendly interface for managing automation projects on Android (via ADB) and Web (via Playwright).

## Development Commands

### Setup
```bash
npm install                                    # Install Node dependencies
git submodule update --init --recursive        # Initialize appagent Python backend
cd appagent && python -m pip install -r requirements.txt  # Install Python dependencies
```

### Development
```bash
npm run electron:dev    # Run full dev environment (Vite + Electron with hot reload)
npm run dev            # Run Vite dev server only (http://localhost:5173)
npm run electron       # Run Electron only (requires Vite to be running)
```

### Build & Package
```bash
npm run build          # Build React app with TypeScript (outputs to dist/)
npm run package        # Package Electron app (outputs to dist-electron/)
```

### Linting
```bash
npm run lint           # Check for linting errors
npm run lint:fix       # Auto-fix linting errors
```

## Architecture

### Three-Layer Electron Architecture

1. **Main Process** (`main.js`)
   - Electron main process with IPC handlers
   - All IPC handlers use `ipcMain.handle()` pattern
   - Manages Python subprocess for automation
   - Handles system checks (Python, ADB, Playwright, Ollama)
   - Reads/writes YAML config files

2. **Preload Script** (`preload.js`)
   - Context bridge between main and renderer processes
   - Exposes IPC methods via `contextBridge.exposeInMainWorld('electronAPI', {...})`
   - **CRITICAL**: Every IPC handler in main.js MUST be exposed here

3. **Renderer Process** (`src/`)
   - React 18 + TypeScript + MUI Joy UI
   - Routes defined in `src/App.tsx`
   - Pages: SetupWizard, ProjectList, ProjectDetail, Settings
   - Types defined in `src/types/electron.d.ts`

### Python Backend

The `appagent/` directory is a **git submodule** containing the Python automation backend:
- `scripts/self_explorer.py` - Main automation logic
- `scripts/and_controller.py` - Android (ADB) controller
- `scripts/web_controller.py` - Web (Playwright) controller
- `scripts/model.py` - AI model integration (Ollama/API)
- `config.yaml` - Runtime configuration

## IPC Communication Pattern

When adding new functionality that requires communication between renderer and main process:

1. **Add handler in `main.js`**:
   ```javascript
   ipcMain.handle('namespace:action', async (event, ...args) => {
     // Implementation
     return { success: true, data: ... };
   });
   ```

2. **Expose in `preload.js`**:
   ```javascript
   contextBridge.exposeInMainWorld('electronAPI', {
     namespaceAction: (...args) => ipcRenderer.invoke('namespace:action', ...args),
   });
   ```

3. **Add TypeScript types in `src/types/electron.d.ts`**:
   ```typescript
   declare global {
     interface Window {
       electronAPI: {
         namespaceAction: (...args) => Promise<ReturnType>;
       }
     }
   }
   ```

4. **Use in React components**:
   ```typescript
   const result = await window.electronAPI.namespaceAction(...args);
   ```

**CRITICAL**: If you add an IPC handler to main.js but forget to expose it in preload.js, you'll get a "not a function" error at runtime.

## Model Configuration

The app supports dual model configuration (not exclusive):

- **enableLocal**: Use local Ollama models (recommended: qwen3-vl:4b for 16GB RAM)
- **enableApi**: Use remote API (OpenAI, OpenRouter, Anthropic, Grok)
- Both can be enabled simultaneously; API is preferred when both are active

Model config interface:
```typescript
interface ModelConfig {
  enableLocal: boolean;
  enableApi: boolean;
  apiBaseUrl: string;
  apiKey: string;
  apiModel: string;      // Auto-fetched via provider detection
  localBaseUrl: string;
  localModel: string;
}
```

API model selection features intelligent provider detection:
- Parses URL to detect OpenAI, OpenRouter, Anthropic, Grok
- Auto-fetches available models from provider
- Provides autocomplete dropdown in UI

## Key Files

- `main.js` (741 lines) - All IPC handlers and main process logic
- `preload.js` - Context bridge (must mirror main.js handlers)
- `src/pages/SetupWizard.tsx` - Multi-step setup wizard with platform tools checking
- `src/types/electron.d.ts` - TypeScript definitions for IPC methods
- `vite.config.ts` - Build configuration (alias: `@` → `./src`)
- `appagent/config.yaml` - Python backend configuration

## Common Patterns

### Platform Tools Checking
The SetupWizard implements real-time status checking for:
- Python 3.11+ (`check:python`)
- Python packages (`check:packages`, `install:packages`)
- Homebrew (macOS only) (`check:homebrew`)
- ADB for Android (`check:androidStudio`)
- Playwright for Web (`check:playwright`, `install:playwright`)

Each check follows the pattern:
```typescript
const [toolsStatus, setToolsStatus] = useState({
  python: { checking: boolean, installed: boolean, installing: boolean },
  // ... other tools
});
```

### Debounced API Calls
API model fetching uses debouncing to avoid excessive requests:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    fetchApiModels();
  }, 500);
  return () => clearTimeout(timer);
}, [apiBaseUrl, apiKey]);
```

### Config File Management
Configuration is stored in `appagent/config.yaml` and managed via IPC:
- `config:load` - Read YAML config
- `config:save` - Write YAML config
- `model:saveConfig` - Save model configuration with validation

## Development Notes

- Vite dev server runs on port 5173 (strict)
- Electron loads from localhost in development, from `dist/index.html` in production
- Python subprocess is spawned for automation tasks and cleaned up on window close
- MUI Joy is the UI component library (not Material-UI)
- Framer Motion is used for animations
- Route structure: SetupWizard on first run, then Layout with nested routes

## Prerequisites

- Node.js 18+
- Python 3.11+
- Ollama (for local models) - https://ollama.com/download
- ADB (for Android automation)
- Git (for submodules)

## Troubleshooting

**"fetchApiModels is not a function" or similar IPC errors**: Check that the handler exists in all three places (main.js, preload.js, electron.d.ts).

**Python subprocess not working**: Verify appagent submodule is initialized and dependencies are installed.

**Homebrew check failing**: The `check:homebrew` handler is macOS-specific and will fail on other platforms.

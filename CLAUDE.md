# CLAUDE.md

Comprehensive development guide for Klever Desktop - AI-powered UI automation tool.

## Table of Contents

- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Development Workflow](#development-workflow)
- [Build & Distribution](#build--distribution)
- [Key Concepts](#key-concepts)
- [Documentation](#documentation)

---

## Quick Start

### Prerequisites
- **Node.js** 18+
- **Python** 3.11+ (bundled in production)
- **macOS/Windows/Linux**

### Setup
```bash
# Install dependencies
npm install

# Build Python runtime (optional for dev)
npm run python:build

# Start development
npm run start
```

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
npm run package        # Package app (unsigned)
npm run make           # Create distributable (DMG/Setup.exe)
npm run publish        # Build and publish to GitHub Releases
```

---

## Tech Stack

### Frontend
- **React 18** - UI framework with hooks
- **TypeScript 5** - Type-safe JavaScript
- **shadcn/ui** - Component library built on Radix UI
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **React Router 6** - Client-side routing (HashRouter)

### Desktop
- **Electron 33** - Desktop application framework
- **Electron Forge 7** - Build and distribution tooling
- **Vite 5** - Fast build tool and dev server

### Backend
- **Python 3.11+** - Automation scripts (bundled)
- **Playwright** - Web browser automation
- **ADB** - Android device automation

### AI
- **Ollama** - Local AI models (recommended: qwen3-vl:4b)
- **OpenAI-compatible APIs** - Remote AI providers

---

## Architecture

### Three-Layer Electron Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Renderer Process                       │
│  React App (src/) - UI Components & Business Logic      │
│  - Uses contextBridge API via window.electronAPI        │
└─────────────────────────────────────────────────────────┘
                           ↕ IPC
┌─────────────────────────────────────────────────────────┐
│                    Preload Script                        │
│  main/preload.ts - Context Bridge (70+ IPC methods)     │
│  - Exposes safe API to renderer                         │
└─────────────────────────────────────────────────────────┘
                           ↕ IPC
┌─────────────────────────────────────────────────────────┐
│                    Main Process                          │
│  main/index.ts - Window management & IPC handlers       │
│  main/handlers/ - Business logic (2000+ lines)          │
│  - Python subprocess management                          │
│  - File system operations                                │
│  - System integrations                                   │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
KleverDesktop/
├── main/                      # Main process (Electron)
│   ├── index.ts              # Entry point (77 lines)
│   ├── preload.ts            # Context bridge (123 lines)
│   ├── handlers/             # IPC handlers (2000+ lines)
│   │   ├── index.ts         # Handler registration
│   │   ├── task.ts          # Task CRUD & execution (452 lines)
│   │   ├── project.ts       # Project CRUD & execution (268 lines)
│   │   ├── model.ts         # Model config & testing (243 lines)
│   │   ├── system-checks.ts # System verification (220 lines)
│   │   ├── integration.ts   # Integration tests (209 lines)
│   │   ├── installations.ts # Playwright setup (196 lines)
│   │   ├── config.ts        # Config management (131 lines)
│   │   ├── utilities.ts     # System utilities (71 lines)
│   │   ├── ollama.ts        # Ollama operations (51 lines)
│   │   └── dialogs.ts       # File/folder dialogs (31 lines)
│   ├── utils/                # Utility modules
│   │   ├── config-manager.ts
│   │   ├── project-storage.ts
│   │   ├── python-runtime.ts
│   │   └── process-manager.ts
│   └── types/                # Main process types
│
├── src/                       # Renderer process (React)
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Router & layout
│   ├── components/           # Reusable UI components (23+)
│   ├── hooks/                # Custom React hooks
│   ├── pages/                # Page components
│   ├── types/                # TypeScript types
│   └── lib/                  # Utilities & helpers
│
├── appagent/                  # Python automation scripts (monorepo)
│   ├── scripts/
│   │   ├── self_explorer.py  # Main automation loop
│   │   ├── and_controller.py # Android controller (ADB)
│   │   ├── web_controller.py # Web controller (Playwright)
│   │   └── model.py          # AI model integration
│   ├── requirements.txt
│   └── config.yaml           # Runtime config (generated)
│
├── build/                     # Build assets
│   ├── icon.icns             # macOS icon
│   ├── icon.ico              # Windows icon
│   └── entitlements.mac.plist # macOS entitlements
│
├── scripts/                   # Build & utility scripts
│   ├── build-python.js       # Legacy Python build script (not used)
│   ├── verify-bundle.js      # Pre-build verification
│   └── fetch-appagent.js     # Update appagent code
│
├── .github/workflows/         # CI/CD
│   └── build.yml             # GitHub Releases automation
│
├── forge.config.js           # Electron Forge config
├── vite.config.ts            # Vite config (renderer)
├── vite.main.config.js       # Vite config (main)
├── vite.preload.config.js    # Vite config (preload)
├── package.json
└── tsconfig.json
```

---

## Development Workflow

### 1. IPC Communication Pattern

Every feature that requires main process access follows this pattern:

#### Step 1: Add Handler in `main/handlers/`

```typescript
// main/handlers/example.ts
import { ipcMain } from 'electron'

export function registerExampleHandlers(ipcMain: IpcMain) {
  ipcMain.handle('example:action', async (event, arg) => {
    try {
      // Implementation
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}
```

Register in `main/handlers/index.ts`:
```typescript
import { registerExampleHandlers } from './example'

export function registerAllHandlers(ipcMain, getMainWindow) {
  registerExampleHandlers(ipcMain)
  // ... other handlers
}
```

#### Step 2: Expose in `main/preload.ts`

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods
  exampleAction: (arg) => ipcRenderer.invoke('example:action', arg),
})
```

#### Step 3: Add TypeScript Types in `src/types/electron.d.ts`

```typescript
declare global {
  interface Window {
    electronAPI: {
      // ... existing methods
      exampleAction: (arg: ArgType) => Promise<{ success: boolean; data?: DataType; error?: string }>
    }
  }
}
```

#### Step 4: Use in React Components

```typescript
const result = await window.electronAPI.exampleAction(arg)
if (result.success) {
  // Handle success
} else {
  console.error(result.error)
}
```

**CRITICAL**: If you add an IPC handler but forget to expose it in preload.ts, you'll get a "not a function" error at runtime.

### 2. Component Development

Use shadcn/ui components for consistency:

```typescript
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleClick}>Click Me</Button>
      </CardContent>
    </Card>
  )
}
```

### 3. State Management

Use React hooks for state management:

```typescript
// Custom hook example (src/hooks/useModelConfig.tsx)
export function useModelConfig() {
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null)
  const [loading, setLoading] = useState(false)

  const loadConfig = async () => {
    setLoading(true)
    const result = await window.electronAPI.configLoad()
    if (result.success) {
      setModelConfig(result.config)
    }
    setLoading(false)
  }

  return { modelConfig, loading, loadConfig }
}
```

### 4. Python Integration

Python scripts are bundled and executed via subprocess:

```typescript
// main/utils/python-runtime.ts
export async function executePythonScript(scriptPath: string, args: string[]) {
  const pythonPath = getPythonPath() // Python from ~/.klever-desktop/
  const process = spawn(pythonPath, [scriptPath, ...args], {
    env: getPythonEnv()
  })

  // Handle output, errors, exit
}
```

---

## Build & Distribution

### Build System: Electron Forge 7

We use **GitHub Releases** for distribution (no app stores).

#### Configuration: `forge.config.js`

```javascript
module.exports = {
  packagerConfig: {
    name: 'Klever Desktop',
    icon: './build/icon',
    asar: true,
    extraResource: ['appagent', 'dist'],

    // macOS: Developer ID signing + notarization
    osxSign: {
      identity: 'Developer ID Application',
      'hardened-runtime': true,
      entitlements: 'build/entitlements.mac.plist',
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    },
  },

  makers: [
    // Windows: Squirrel installer
    { name: '@electron-forge/maker-squirrel', platforms: ['win32'] },
    // macOS: DMG disk image
    { name: '@electron-forge/maker-dmg', platforms: ['darwin'] },
    // ZIP maker disabled to reduce artifact size
  ],

  publishers: [
    // GitHub Releases
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'FigmaAI', name: 'KleverDesktop' },
        draft: true,
        prerelease: true,
      }
    }
  ]
}
```

### GitHub Actions Workflow

**File**: `.github/workflows/build.yml`

**Trigger**: Push tag `v*` or manual dispatch

**Flow**:
1. **Build on macOS runner**: DMG + notarization
2. **Build on Windows runner**: Setup.exe (Squirrel)
3. **Create GitHub Release**: Attach all artifacts

**Required Secrets** (macOS signing):
- `APPLE_ID` - Apple ID email
- `APPLE_ID_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - 10-character Team ID

**Optional Secrets** (Windows signing):
- `WINDOWS_CERT_FILE` - .pfx certificate
- `WINDOWS_CERT_PASSWORD` - Certificate password

### Release Process

```bash
# 1. Update version
npm version 2.0.1

# 2. Push tag (triggers GitHub Actions)
git push --tags

# 3. Wait for CI to build and create draft release

# 4. Review and publish release on GitHub
```

### Output Structure

```
out/
├── klever-desktop-darwin-arm64/        # Packaged app (macOS)
├── klever-desktop-win32-x64/           # Packaged app (Windows)
└── make/
    ├── dmg/darwin/arm64/
    │   └── Klever Desktop-2.0.0-arm64.dmg    # macOS installer
    └── squirrel.windows/x64/
        ├── klever-desktop-2.0.0 Setup.exe    # Windows installer
        ├── RELEASES                          # Update metadata
        └── klever-desktop-2.0.0-full.nupkg   # Update package
```

---

## Key Concepts

### 1. Model Configuration

Dual model support (local + remote):

```typescript
interface ModelConfig {
  enableLocal: boolean       // Use Ollama
  enableApi: boolean         // Use remote API
  localBaseUrl: string       // Ollama endpoint
  localModel: string         // e.g., 'qwen3-vl:4b'
  apiBaseUrl: string         // Remote API endpoint
  apiKey: string             // API key
  apiModel: string           // e.g., 'gpt-4o-mini'
}
```

**Provider Detection**: Automatically detects OpenAI, OpenRouter, Anthropic, Grok from URL.

### 2. Project & Task Management

**Data Storage**: `~/.klever-desktop/projects.json`

```typescript
interface Project {
  id: string
  name: string
  platform: 'android' | 'web'
  device?: string          // Android device ID
  url?: string             // Web URL
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
  tasks: Task[]
  workspaceDir: string     // ~/Documents/{projectName}/
}

interface Task {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  resultPath?: string      // Path to result files
  output?: string
  error?: string
}
```

### 3. Python Runtime Management

**Architecture**: Python is downloaded to `~/.klever-desktop/python/` during the setup wizard

**Key Functions** (`main/utils/python-runtime.ts`):
- `getPythonPath()` - Path to Python installation in ~/.klever-desktop/
- `getPythonInstallDir()` - Get Python install directory
- `getAppagentPath()` - Path to appagent directory
- `executePythonScript(scriptPath, args)` - Execute Python script
- `checkPythonRuntime()` - Verify Python availability
- `installPlaywrightBrowsers()` - Install Playwright Chromium

**Development**:
```bash
# Python is downloaded automatically by the app to ~/.klever-desktop/python/
# during the first-run setup wizard

# Or use system Python for development
python3 -m pip install -r appagent/requirements.txt
python3 -m playwright install chromium
```

**Production**: Python is downloaded to `~/.klever-desktop/python/{platform}-{arch}/python/` on first run

### 4. Real-Time Progress Updates

For long-running operations, use IPC event listeners:

```typescript
// Renderer (React component)
useEffect(() => {
  window.electronAPI.onTaskOutput((data: string) => {
    setOutput(prev => [...prev, data])
  })
}, [])

// Main (handler)
getMainWindow()?.webContents.send('task:output', outputLine)
```

**Available Event Channels**:
- `env:progress` - Environment setup
- `task:output` - Task execution output
- `task:complete` - Task completion
- `project:output` - Project execution
- `integration:test:output` - Integration test output
- `integration:test:complete` - Test completion

### 5. File Paths

- **User Data**: `app.getPath('userData')` → `~/.klever-desktop/`
- **Projects Storage**: `{userData}/projects.json`
- **Python Runtime**: `~/.klever-desktop/python/{platform}-{arch}/python/`
- **Workspaces**: `~/Documents/{projectName}/`
- **Config**: `appagent/config.yaml`

---

## Documentation

### Build & Deployment

- **[docs/GITHUB_RELEASE_GUIDE.md](docs/GITHUB_RELEASE_GUIDE.md)** - Complete GitHub Releases guide
  - Developer ID signing and notarization (macOS)
  - Code signing options (Windows)
  - Building and publishing step-by-step

- **[docs/GITHUB_RELEASE_GUIDE_KR.md](docs/GITHUB_RELEASE_GUIDE_KR.md)** - 한국어 GitHub 릴리즈 가이드

- **[docs/BUILD_ICONS.md](docs/BUILD_ICONS.md)** - Icon generation guide
  - Platform-specific formats (ICNS, ICO)
  - Size requirements
  - Asset generation tools

### Technical Docs

- **[docs/BUILD_13_FIX_SUMMARY.md](docs/BUILD_13_FIX_SUMMARY.md)** - Build 13 fixes summary
- **[docs/CRASH_ANALYSIS.md](docs/CRASH_ANALYSIS.md)** - Crash debugging guide

### Main Docs

- **[README.md](README.md)** - User-facing documentation
- **[PRIVACY.md](PRIVACY.md)** - Privacy policy

---

## Best Practices

### Code Organization

1. **IPC Handlers**: Group related handlers in same file (e.g., all project operations in `project.ts`)
2. **Hooks**: Extract stateful logic into custom hooks for reusability
3. **Components**: Keep components under 300 lines; split into smaller pieces if larger
4. **Types**: Share types between main and renderer via `src/types/` and `main/types/`

### Error Handling

- Always return `{ success: boolean, error?: string }` from IPC handlers
- Use try-catch blocks in async operations
- Log errors with descriptive context

### Performance

- Debounce API calls and expensive operations (500ms recommended)
- Use `useMemo` and `useCallback` for expensive computations
- Minimize IPC calls; batch operations when possible

### Security

- Never use `any` type; maintain strict type safety
- Avoid command injection in Python subprocess calls
- Validate user input before file system operations
- Use asar for code protection in production

### Development

- Test in both dev and production builds
- Update TypeScript types when adding IPC handlers
- Run `npm run typecheck` before committing
- Use ESLint auto-fix: `npm run lint:fix`

---

## Troubleshooting

### Common Issues

**"[method] is not a function" error**:
- **Cause**: IPC handler added to `main/handlers/` but not exposed in `main/preload.ts`
- **Fix**: Add the method to `contextBridge.exposeInMainWorld()` in preload.ts

**Python subprocess not working**:
- **Cause**: Python not installed in ~/.klever-desktop/ or dependencies missing
- **Fix**: Run the Setup Wizard in the app to download and install Python

**Vite port already in use**:
- **Cause**: Another process using port 5173
- **Fix**: Kill the process or change port in `vite.config.ts`

**TypeScript errors after changes**:
- **Cause**: Types not updated or imports changed
- **Fix**: Run `npm run typecheck` and update types accordingly

**Build fails on macOS**:
- **Cause**: Missing entitlements or certificates
- **Fix**: Check `build/entitlements.mac.plist` exists and certificates installed

---

## Additional Resources

- **Electron Docs**: https://www.electronjs.org/docs/latest
- **Electron Forge**: https://www.electronforge.io/
- **shadcn/ui**: https://ui.shadcn.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **Vite**: https://vitejs.dev/
- **Ollama**: https://ollama.com/

---

**Last Updated**: 2025-11-23
**Version**: 2.0.0
**Distribution**: GitHub Releases only

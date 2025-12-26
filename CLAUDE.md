# CLAUDE.md

Development guide for Klever Desktop - AI-powered UI automation application.

## Quick Reference

```bash
npm install          # Install dependencies
npm run start        # Development with hot reload
npm run typecheck    # TypeScript validation
npm run lint:fix     # Auto-fix linting
npm run package      # Build unsigned package
npm run make         # Create installers (DMG/Setup.exe)
```

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 18, TypeScript 5, Tailwind CSS, shadcn/ui, Framer Motion |
| Desktop | Electron 33, Vite 5, Electron Forge 7 |
| Backend | Python 3.11+, Playwright, ADB |
| AI | LiteLLM, Ollama, OpenAI, Anthropic |

## Architecture

```
Renderer (React)  <-->  Preload (contextBridge)  <-->  Main (Node.js)  <-->  Python
    src/                   main/preload.ts              main/               core/, engines/
```

### Directory Structure

```
main/
├── index.ts              # Window management
├── preload.ts            # IPC bridge (100+ methods)
├── handlers/             # 15 IPC handler modules
│   ├── task.ts           # Task execution
│   ├── project.ts        # Project CRUD
│   ├── config.ts         # Configuration
│   ├── model.ts          # LLM management
│   └── ...
└── utils/                # Utilities
    ├── python-runtime.ts # Python subprocess
    ├── config-storage.ts # config.json
    └── ...

src/
├── App.tsx               # Router & layout
├── pages/                # 4 main pages
├── components/           # 70+ components
│   ├── ui/               # shadcn/ui (40)
│   └── ...               # Custom (30)
└── hooks/                # 9 custom hooks

core/                     # Python shared code
engines/appagent/         # Automation engine
```

## IPC Pattern

Every feature requiring main process access follows this pattern:

### 1. Add Handler

```typescript
// main/handlers/example.ts
export function registerExampleHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('example:action', async (event, arg: string) => {
    try {
      const result = await doSomething(arg)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}
```

### 2. Register Handler

```typescript
// main/handlers/index.ts
import { registerExampleHandlers } from './example'

export function registerAllHandlers(ipcMain, getMainWindow) {
  // ... other handlers
  registerExampleHandlers(ipcMain, getMainWindow)
}
```

### 3. Expose in Preload

```typescript
// main/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  exampleAction: (arg: string) => ipcRenderer.invoke('example:action', arg),
  onExampleEvent: (cb: (data: string) => void) => {
    ipcRenderer.on('example:event', (_, data) => cb(data))
  },
})
```

### 4. Add Types

```typescript
// src/types/electron.d.ts
declare global {
  interface Window {
    electronAPI: {
      exampleAction: (arg: string) => Promise<{ success: boolean; data?: any; error?: string }>
      onExampleEvent: (callback: (data: string) => void) => void
    }
  }
}
```

### 5. Use in React

```typescript
const result = await window.electronAPI.exampleAction('value')
useEffect(() => {
  window.electronAPI.onExampleEvent((data) => console.log(data))
}, [])
```

**Checklist:**
- [ ] Handler in `main/handlers/*.ts`
- [ ] Registered in `main/handlers/index.ts`
- [ ] Exposed in `main/preload.ts`
- [ ] Types in `src/types/electron.d.ts`
- [ ] Run `npm run typecheck`

## Data Storage

All data stored in `~/.klever-desktop/`:

| File | Purpose |
|------|---------|
| `config.json` | App configuration |
| `projects.json` | Projects & tasks |
| `python/` | Downloaded Python runtime |
| `python-env/` | Virtual environment |
| `Projects/` | Workspace directories |

### Config Structure (v3.0)

```typescript
interface AppConfig {
  version: "3.0"
  model: {
    providers: ProviderConfig[]
    lastUsed?: { provider: string; model: string }
  }
  execution: { maxTokens, temperature, requestInterval, maxRounds }
  android: { screenshotDir, xmlDir, sdkPath }
  web: { browserType, headless }
  preferences: { darkMode, systemLanguage }
}
```

### Project Structure

```typescript
interface Project {
  id: string                    // proj_xxx
  name: string
  platform: 'android' | 'web'
  status: 'active' | 'archived'
  tasks: Task[]
  workspaceDir: string
}

interface Task {
  id: string                    // task_xxx
  goal: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  modelProvider?: string
  modelName?: string
  resultPath?: string
}
```

## Python Integration

```typescript
// Spawn Python process
import { spawnBundledPython } from '../utils/python-runtime'

const process = spawnBundledPython([
  'engines/appagent/run.py',
  '--task_desc', taskGoal,
  '--model', modelName,
], { env: buildEnvFromConfig(config) })

process.stdout?.on('data', (chunk) => {
  mainWindow?.webContents.send('task:output', chunk.toString())
})
```

### Environment Variables

22 variables passed to Python:
- Model: `MODEL_PROVIDER`, `MODEL_NAME`, `API_KEY`, `API_BASE_URL`
- Execution: `MAX_TOKENS`, `TEMPERATURE`, `REQUEST_INTERVAL`, `MAX_ROUNDS`
- Android: `ANDROID_SCREENSHOT_DIR`, `ANDROID_XML_DIR`, `ANDROID_SDK_PATH`
- Web: `WEB_BROWSER_TYPE`, `WEB_HEADLESS`

## Components

Use shadcn/ui for consistency:

```typescript
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
```

Available: Button, Card, Dialog, Input, Label, Select, Switch, Tabs, Accordion, Toast, Progress, etc.

## Build & Release

### Local Build

```bash
npm run package    # Package only
npm run make       # Create DMG/Setup.exe
```

### GitHub Actions

Push tag to trigger:
```bash
npm version 2.0.10
git push && git push origin v2.0.10
```

**Required Secrets:**
- `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`
- `CERTIFICATE_P12_BASE64`, `CERTIFICATE_PASSWORD`

## Troubleshooting

### "method is not a function"
Handler not exposed in `main/preload.ts`.

### Python subprocess fails
Run Setup Wizard or reset environment in Settings.

### Port 5173 in use
```bash
lsof -ti:5173 | xargs kill -9
```

### TypeScript errors
```bash
npm run typecheck
```
Update types in `src/types/electron.d.ts` or `main/types/`.

## Best Practices

1. **IPC Handlers**: Always return `{ success, data?, error? }`
2. **Error Handling**: Use try-catch, log with context
3. **Types**: Never use `any`, update types when adding handlers
4. **Components**: Keep under 300 lines, extract to hooks
5. **State**: Use React hooks, no Redux needed

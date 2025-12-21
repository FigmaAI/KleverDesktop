# CLAUDE.md

Comprehensive development guide for Klever Desktop - AI-powered UI automation tool.

## Table of Contents

- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Development Workflow](#development-workflow)
- [Build & Distribution](#build--distribution)
- [Key Concepts](#key-concepts)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites
- **Node.js** 18+
- **Git** for version control
- **Python** 3.11+ (auto-downloaded by app during setup)

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

---

## Tech Stack

### Frontend (React Renderer Process)
- **React** 18.3.1 - UI framework with hooks
- **TypeScript** 5.5.4 - Strict type checking
- **React Router DOM** 6.26.0 - Client-side routing (HashRouter)
- **shadcn/ui** - Component library built on Radix UI (30+ components)
- **Tailwind CSS** 3.4.15 - Utility-first CSS framework
- **Framer Motion** 11.5.4 - Advanced animations
- **Lucide React** 0.454.0 - Icon library (454+ icons)
- **React Markdown** 9.0.1 - Markdown rendering

### Desktop Framework
- **Electron** 33.4.11 - Cross-platform desktop framework
- **Electron Forge** 7.10.2 - Build and packaging tooling
- **Vite** 5.4.5 - Fast build tool and dev server
  - Separate configs for main, renderer, and preload
  - Hot module replacement in development
  - Optimized production builds

### Backend & Automation
- **Python** 3.11+ - Automation runtime (bundled at `~/.klever-desktop/python/`)
- **Playwright** 4.x+ - Web browser automation (Chromium, Firefox, WebKit)
- **ADB** - Android Debug Bridge for device automation
- **LiteLLM** - Multi-provider AI abstraction (100+ models)
- **Anthropic SDK** - Direct Anthropic API support

### AI Integration
- **Ollama** - Local AI models (recommended: qwen3-vl:4b, qwen2.5-vl:7b)
- **Multi-Provider Support** - OpenAI, Anthropic, OpenRouter, Grok, etc.
- **LiteLLM** - Unified API for 100+ AI providers

---

## Architecture

### Three-Layer Electron Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Renderer Process                       │
│  React App (src/) - UI Components & Business Logic      │
│  - 5 main pages: SetupWizard, ProjectList, etc.        │
│  - 73+ components (30+ shadcn/ui components)            │
│  - 6 custom hooks for state management                  │
│  - Uses contextBridge API via window.electronAPI        │
└─────────────────────────────────────────────────────────┘
                           ↕ IPC
┌─────────────────────────────────────────────────────────┐
│                    Preload Script                        │
│  main/preload.ts - Context Bridge (152 lines)           │
│  - Exposes 70+ IPC methods to renderer                  │
│  - Event listeners for real-time updates                │
│  - Secure renderer-main communication                   │
└─────────────────────────────────────────────────────────┘
                           ↕ IPC
┌─────────────────────────────────────────────────────────┐
│                    Main Process                          │
│  main/index.ts - Entry point & window management        │
│  main/handlers/ - 12 handler modules (2,195 lines)      │
│  main/utils/ - Utility modules (5,158 lines)            │
│  - Python subprocess management                          │
│  - Configuration & project storage                       │
│  - File system operations                                │
└─────────────────────────────────────────────────────────┘
                           ↕ Subprocess
┌─────────────────────────────────────────────────────────┐
│                    Python Backend                        │
│  appagent/scripts/ - Automation scripts (12 files)      │
│  - self_explorer.py - Main automation loop              │
│  - and_controller.py - Android automation (ADB)         │
│  - browser_use_wrapper.py - Web automation (Browser-Use)│
│  - model.py - AI model integration (LiteLLM)            │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
KleverDesktop/
├── main/                              # Electron Main Process
│   ├── index.ts                       # Entry point (158 lines)
│   ├── preload.ts                     # Context bridge (152 lines)
│   │
│   ├── handlers/                      # IPC Handlers (2,195 lines)
│   │   ├── index.ts                   # Handler registration
│   │   ├── system-checks.ts           # System verification (247 lines)
│   │   ├── installations.ts           # Python/Playwright setup (196 lines)
│   │   ├── config.ts                  # Configuration operations (131 lines)
│   │   ├── model.ts                   # Model management (317 lines)
│   │   ├── project.ts                 # Project CRUD (285 lines)
│   │   ├── task.ts                    # Task CRUD & execution (446 lines)
│   │   ├── integration.ts             # Integration testing (323 lines)
│   │   ├── ollama.ts                  # Ollama operations (51 lines)
│   │   ├── utilities.ts               # System utilities (104 lines)
│   │   ├── dialogs.ts                 # File dialogs (31 lines)
│   │   ├── github.ts                  # GitHub API
│   │   └── translator.ts              # Translation (22 lines)
│   │
│   ├── utils/                         # Utility Modules (5,158 lines)
│   │   ├── config-storage.ts          # config.json management (246 lines)
│   │   ├── config-env-builder.ts      # Config → env vars (172 lines)
│   │   ├── python-runtime.ts          # Python path management (503 lines)
│   │   ├── python-download.ts         # Download Python (143 lines)
│   │   ├── python-manager.ts          # venv + packages (381 lines)
│   │   ├── litellm-providers.ts       # Provider database (581 lines)
│   │   ├── project-storage.ts         # projects.json management (143 lines)
│   │   ├── process-manager.ts         # Process lifecycle (99 lines)
│   │   └── translator.ts              # Multi-language translation (285 lines)
│   │
│   └── types/                         # TypeScript Types
│       ├── config.ts                  # AppConfig schema
│       ├── project.ts                 # Project/Task types
│       ├── model.ts                   # Model types
│       └── process.ts                 # Process types
│
├── src/                               # React Renderer Process
│   ├── main.tsx                       # React entry point
│   ├── App.tsx                        # Router & layout
│   │
│   ├── pages/                         # Page Components (~2,097 lines)
│   │   ├── SetupWizard.tsx            # Environment setup wizard
│   │   ├── ProjectList.tsx            # Projects dashboard
│   │   ├── ProjectDetail.tsx          # Project view + tasks
│   │   ├── ProjectCreate.tsx          # Create project form
│   │   └── Settings.tsx               # Application settings
│   │
│   ├── components/                    # UI Components (73+)
│   │   ├── ui/                        # shadcn/ui components (30+)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── terminal.tsx           # Custom terminal component
│   │   │   └── ... (26+ more)
│   │   │
│   │   ├── SetupStepper.tsx
│   │   ├── ModelConfigStep.tsx
│   │   ├── PlatformConfigStep.tsx
│   │   ├── LanguageSelector.tsx
│   │   ├── TaskMarkdownDialog.tsx
│   │   └── ... (43+ custom components)
│   │
│   ├── hooks/                         # Custom React Hooks (6)
│   │   ├── useModelConfig.tsx
│   │   ├── useSettings.tsx
│   │   ├── usePlatformTools.tsx
│   │   ├── useIntegrationTest.tsx
│   │   ├── useTerminal.tsx
│   │   └── useLiteLLMProviders.tsx
│   │
│   ├── contexts/
│   │   └── TerminalContext.tsx        # Terminal output streaming
│   │
│   ├── types/                         # TypeScript Types
│   │   ├── electron.d.ts              # Electron API types
│   │   ├── project.ts
│   │   ├── setupWizard.ts
│   │   └── terminal.ts
│   │
│   └── utils/
│       └── ansiParser.tsx             # ANSI color parsing for logs
│
├── appagent/                          # Python Automation Scripts
│   ├── scripts/                       # Main automation code (12 files)
│   │   ├── self_explorer.py           # Main automation loop
│   │   ├── and_controller.py          # Android automation (ADB)
│   │   ├── browser_use_wrapper.py     # Web automation (Browser-Use)
│   │   ├── task_executor.py           # Task execution orchestration
│   │   ├── model.py                   # AI model integration (LiteLLM)
│   │   ├── config.py                  # Config loading
│   │   ├── prompts.py                 # Prompt templates
│   │   ├── schemas.py                 # Data schemas
│   │   ├── document_generation.py     # Report generation
│   │   ├── step_recorder.py
│   │   ├── utils.py
│   │   └── __init__.py
│   │
│   └── requirements.txt               # Python dependencies (9 packages)
│
├── build/                             # Build Assets
│   ├── icon.icns                      # macOS icon
│   ├── icon.ico                       # Windows icon
│   └── entitlements.mac.plist         # macOS entitlements
│
├── .github/workflows/
│   └── build.yml                      # GitHub Releases automation
│
├── scripts/                           # Build & utility scripts
│   ├── verify-bundle.js
│   ├── python-sync.js
│   └── python-refresh.js
│
├── forge.config.js                    # Electron Forge configuration
├── vite.config.ts                     # Vite config (renderer)
├── vite.main.config.js                # Vite config (main)
├── vite.preload.config.js             # Vite config (preload)
├── tsconfig.json                      # TypeScript config
├── package.json                       # Project metadata
├── eslint.config.mjs                  # ESLint configuration
├── tailwind.config.js                 # Tailwind CSS configuration
├── components.json                    # shadcn/ui components config
└── README.md                          # User documentation
```

---

## Development Workflow

### 1. IPC Communication Pattern

Every feature that requires main process access follows this pattern:

#### Step 1: Add Handler in `main/handlers/`

```typescript
// main/handlers/example.ts
import { IpcMain, BrowserWindow } from 'electron'

export function registerExampleHandlers(
  ipcMain: IpcMain,
  getMainWindow: () => BrowserWindow | null
) {
  ipcMain.handle('example:action', async (event, arg: MyArgType) => {
    try {
      // Get main window for sending progress updates
      const mainWindow = getMainWindow()
      mainWindow?.webContents.send('example:progress', 'Starting...')

      // Perform the action
      const result = await performAction(arg)

      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
}
```

#### Step 2: Register in `main/handlers/index.ts`

```typescript
import { registerExampleHandlers } from './example'

export function registerAllHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null) {
  registerSystemCheckHandlers(ipcMain, getMainWindow)
  registerConfigHandlers(ipcMain)
  // ... other handlers
  registerExampleHandlers(ipcMain, getMainWindow)
}
```

#### Step 3: Expose in `main/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods

  // Action (invoke)
  exampleAction: (arg: MyArgType) => ipcRenderer.invoke('example:action', arg),

  // Event listener (on)
  onExampleProgress: (callback: (data: string) => void) => {
    ipcRenderer.on('example:progress', (_event, data) => callback(data))
  },
})
```

#### Step 4: Add TypeScript Types in `src/types/electron.d.ts`

```typescript
declare global {
  interface Window {
    electronAPI: {
      // ... existing methods

      exampleAction: (arg: MyArgType) => Promise<{
        success: boolean
        data?: MyResultType
        error?: string
      }>

      onExampleProgress: (callback: (data: string) => void) => void
    }
  }
}

export {}
```

#### Step 5: Use in React Components

```typescript
import { useEffect, useState } from 'react'

export function MyComponent() {
  const [progress, setProgress] = useState('')
  const [loading, setLoading] = useState(false)

  // Listen for progress updates
  useEffect(() => {
    window.electronAPI.onExampleProgress((data) => {
      setProgress(data)
    })
  }, [])

  const handleAction = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.exampleAction({ param: 'value' })
      if (result.success) {
        console.log('Success:', result.data)
      } else {
        console.error('Error:', result.error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleAction}>Run Action</button>
      {loading && <p>Progress: {progress}</p>}
    </div>
  )
}
```

**CRITICAL CHECKLIST** when adding IPC handlers:

- [ ] Handler implemented in `main/handlers/*.ts`
- [ ] Handler registered in `main/handlers/index.ts`
- [ ] Method exposed in `main/preload.ts`
- [ ] Types added to `src/types/electron.d.ts`
- [ ] Run `npm run typecheck` to verify
- [ ] Test in both dev and production builds

**Common Error**: If you add a handler but forget to expose it in preload.ts, you'll get:
```
TypeError: window.electronAPI.exampleAction is not a function
```

### 2. Component Development

Use shadcn/ui components for consistency:

```typescript
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function MyComponent() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>My Feature</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="input">Input Label</Label>
              <Input id="input" placeholder="Enter value..." />
            </div>
            <Button onClick={() => setOpen(true)}>Open Dialog</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogHeader>
          <p>Dialog content goes here</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Available shadcn/ui Components** (30+):
- Layout: Card, Separator, Tabs, Accordion
- Form: Input, Label, Select, Checkbox, Switch, Slider, Toggle
- Feedback: Toast, Dialog, Alert Dialog, Progress
- Navigation: Dropdown Menu, Popover, Tooltip
- Custom: Terminal, Theme Toggler, Animated buttons

### 3. State Management

Use React hooks for state management:

```typescript
// Custom hook example (src/hooks/useModelConfig.tsx)
import { useState, useCallback, useEffect } from 'react'

export function useModelConfig() {
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.configLoad()
      if (result.success) {
        setModelConfig(result.config)
      } else {
        setError(result.error || 'Failed to load config')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  return { modelConfig, loading, error, loadConfig }
}
```

**State Management Patterns:**
- `useState` - Local component state
- `useContext` - Shared state (e.g., TerminalContext)
- Custom hooks - Reusable stateful logic
- **No Redux/Zustand** - Keep it simple with React hooks

### 4. Python Integration

Python scripts are bundled and executed via subprocess:

```typescript
// main/utils/python-runtime.ts
import { spawn, SpawnOptions } from 'child_process'

export function spawnBundledPython(args: string[], options?: SpawnOptions) {
  const pythonPath = getPythonPath() // ~/.klever-desktop/python/{platform}-{arch}/python/bin/python3
  const env = getPythonEnv()         // Sets up Python environment variables

  return spawn(pythonPath, args, {
    env: { ...process.env, ...env },
    ...options
  })
}
```

**Task Execution Example** (`main/handlers/task.ts`):

```typescript
import { spawnBundledPython } from '../utils/python-runtime'
import { buildEnvFromConfig } from '../utils/config-env-builder'

export function registerTaskHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('task:start', async (event, projectId: string, taskId: string) => {
    try {
      // Load config and build environment variables
      const config = await loadAppConfig()
      const env = buildEnvFromConfig(config)

      // Build Python CLI arguments
      const args = [
        path.join(getAppagentPath(), 'scripts', 'self_explorer.py'),
        '--app', projectName,
        '--platform', platform,
        '--root_dir', workspaceDir,
        '--task_desc', taskGoal,
        '--model', modelName,
      ]

      // Spawn Python process
      const pythonProcess = spawnBundledPython(args, { env })

      // Stream output to renderer
      pythonProcess.stdout?.on('data', (chunk) => {
        const output = chunk.toString()
        getMainWindow()?.webContents.send('task:output', output)
      })

      // Handle process exit
      pythonProcess.on('exit', (code) => {
        getMainWindow()?.webContents.send('task:complete', { code, taskId })
      })

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}
```

**Environment Variables Passed to Python** (22 total):

```bash
# Model Configuration
MODEL_PROVIDER=ollama
MODEL_NAME=ollama/llama3.2-vision
API_KEY=
API_BASE_URL=http://localhost:11434

# Execution Settings
MAX_TOKENS=4096
TEMPERATURE=0.0
REQUEST_INTERVAL=10
MAX_ROUNDS=20

# Platform Settings (Android)
ANDROID_SCREENSHOT_DIR=/sdcard
ANDROID_XML_DIR=/sdcard

# Platform Settings (Web)
WEB_BROWSER_TYPE=chromium
WEB_VIEWPORT_WIDTH=1280
WEB_VIEWPORT_HEIGHT=720

# Image Settings
IMAGE_MAX_WIDTH=1280
IMAGE_MAX_HEIGHT=720
IMAGE_QUALITY=95
IMAGE_COMPRESSION=true

# Preferences
OUTPUT_LANGUAGE=en
ENABLE_REFLECTION=true
```

### 5. Real-Time Progress Updates

For long-running operations, use IPC event listeners:

```typescript
// Renderer (React component)
import { useEffect, useState } from 'react'

export function TaskExecutionView() {
  const [output, setOutput] = useState<string[]>([])

  useEffect(() => {
    // Listen for task output
    window.electronAPI.onTaskOutput((data: string) => {
      setOutput((prev) => [...prev, data])
    })

    // Listen for task completion
    window.electronAPI.onTaskComplete((result) => {
      console.log('Task completed:', result)
    })
  }, [])

  return (
    <div>
      <h2>Task Output</h2>
      <pre>{output.join('\n')}</pre>
    </div>
  )
}
```

**Available Event Channels:**

| Channel | Purpose | Data Type |
|---------|---------|-----------|
| `env:progress` | Environment setup progress | `string` |
| `python:progress` | Python download progress | `string` |
| `ollama:pull:progress` | Ollama model download | `string` |
| `project:output` | Project execution output | `string` |
| `project:error` | Project execution errors | `string` |
| `project:exit` | Project process exit | `{ code: number }` |
| `task:output` | Task execution output | `string` |
| `task:error` | Task execution errors | `string` |
| `task:complete` | Task completion | `{ code: number, taskId: string }` |
| `integration:test:output` | Integration test output | `string` |
| `integration:test:complete` | Integration test complete | `{ success: boolean }` |

---

## Build & Distribution

### Build System: Electron Forge 7

We use **GitHub Releases** for distribution (no app stores).

#### Configuration: `forge.config.js`

```javascript
const path = require('path')

module.exports = {
  packagerConfig: {
    name: 'Klever Desktop',
    executableName: 'klever-desktop',
    icon: './build/icon',
    appBundleId: 'com.klever.desktop',
    appCategoryType: 'public.app-category.developer-tools',
    asar: true,
    extraResource: ['appagent', 'dist'],

    // macOS: Developer ID signing + notarization
    osxSign: {
      identity: 'Developer ID Application',
      'hardened-runtime': true,
      entitlements: 'build/entitlements.mac.plist',
      'entitlements-inherit': 'build/entitlements.mac.plist',
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    },

    // Windows: Code signing (optional)
    ...(process.env.WINDOWS_CERT_FILE && {
      certificateFile: process.env.WINDOWS_CERT_FILE,
      certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
    }),
  },

  makers: [
    // Windows: Squirrel installer
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'klever-desktop',
        setupIcon: './build/icon.ico',
      },
    },
    // macOS: DMG disk image
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        name: 'Klever Desktop',
        icon: './build/icon.icns',
        format: 'ULFO', // Read-only compressed
      },
    },
  ],

  publishers: [
    // GitHub Releases
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'FigmaAI',
          name: 'KleverDesktop',
        },
        draft: true,
        prerelease: true,
      },
    },
  ],
}
```

### GitHub Actions Workflow

**File**: `.github/workflows/build.yml`

**Triggers:**
- Manual workflow dispatch (with draft/prerelease options)
- Push tag `v*` (optional)

**Jobs:**

1. **build-macos** (macOS runner):
   - Install certificate from `CERTIFICATE_P12_BASE64`
   - Create temporary keychain
   - Build universal binary (Intel + Apple Silicon)
   - Notarize via Apple ID
   - Create DMG

2. **build-windows** (Windows runner):
   - Install dependencies
   - Build Setup.exe
   - Create RELEASES file for auto-updates
   - Create .nupkg package

**Required Secrets** (macOS signing):
```bash
APPLE_ID                  # Apple ID email
APPLE_ID_PASSWORD         # App-specific password
APPLE_TEAM_ID            # 10-character Team ID
CERTIFICATE_P12_BASE64   # Base64-encoded .p12 certificate
CERTIFICATE_PASSWORD     # Certificate password
```

**Optional Secrets** (Windows signing):
```bash
WINDOWS_CERT_FILE        # Path to .pfx certificate
WINDOWS_CERT_PASSWORD    # Certificate password
```

### Release Process

```bash
# 1. Update version in package.json
npm version 2.0.2

# 2. Commit and push changes
git push

# 3. Create and push tag
git push origin v2.0.2

# 4. GitHub Actions will automatically:
#    - Build on macOS and Windows runners
#    - Sign and notarize builds
#    - Create draft release on GitHub
#    - Upload artifacts (DMG, Setup.exe)

# 5. Review draft release on GitHub
#    - Edit release notes
#    - Mark as release (not prerelease)
#    - Publish release
```

### Build Output Structure

```
out/
├── klever-desktop-darwin-arm64/        # Packaged app (macOS)
│   └── Klever Desktop.app
│
├── klever-desktop-win32-x64/           # Packaged app (Windows)
│   ├── klever-desktop.exe
│   └── resources/
│
└── make/
    ├── dmg/darwin/arm64/
    │   └── Klever.Desktop-2.0.1-arm64.dmg    # macOS installer
    │
    └── squirrel.windows/x64/
        ├── klever-desktop-2.0.1 Setup.exe    # Windows installer
        ├── RELEASES                           # Update metadata
        └── klever-desktop-2.0.1-full.nupkg   # Update package
```

---

## Key Concepts

### 1. Model Configuration (Multi-Provider)

**Storage**: `~/.klever-desktop/config.json`

**Config Structure:**

```typescript
interface AppConfig {
  version: string // "3.0"
  model: {
    providers: ProviderConfig[]
    lastUsed?: {
      providerId: string
      modelName: string
    }
  }
  execution: ExecutionConfig
  android: AndroidConfig
  web: WebConfig
  image: ImageConfig
  preferences: PreferencesConfig
}

interface ProviderConfig {
  id: string                  // 'ollama', 'openai', 'anthropic', 'custom'
  name: string                // Display name
  apiKey: string              // Empty for Ollama
  preferredModel: string      // 'ollama/llama3.2-vision' or 'gpt-4o'
  baseUrl?: string            // http://localhost:11434 for Ollama
}

interface ExecutionConfig {
  maxTokens: number           // 4096
  temperature: number         // 0.0 - 1.0
  requestInterval: number     // Seconds between AI calls
  maxRounds: number           // Max automation rounds
}
```

**Provider Detection** (`main/utils/litellm-providers.ts`):

The app automatically detects providers from base URL:
- `localhost:11434` → Ollama
- `api.openai.com` → OpenAI
- `api.anthropic.com` → Anthropic
- `openrouter.ai` → OpenRouter
- `api.x.ai` → Grok

**LiteLLM Model Format**:
```
ollama/llama3.2-vision          # Ollama local model
gpt-4o                          # OpenAI
claude-3-5-sonnet-20241022      # Anthropic
openrouter/anthropic/claude-3.5-sonnet  # OpenRouter
```

### 2. Project & Task Management

**Data Storage**: `~/.klever-desktop/projects.json`

**Project Structure:**

```typescript
interface Project {
  id: string                    // UUID: proj_1234567890
  name: string                  // User-friendly name
  platform: 'android' | 'web'   // Platform type
  status: 'active' | 'archived'
  createdAt: string             // ISO datetime
  updatedAt: string
  tasks: Task[]                 // Embedded tasks array
  workspaceDir: string          // ~/Documents/{projectName}/

  // Platform-specific
  device?: string               // Android device ID (from adb devices)
  url?: string                  // Web URL
}
```

**Task Structure:**

```typescript
interface Task {
  id: string                    // UUID: task_1234567890
  projectId: string             // Parent project ID
  name: string                  // Task name
  description?: string          // Optional description
  goal: string                  // Task objective (--task_desc CLI param)
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

  // Model configuration
  modelProvider?: string        // Provider ID: 'ollama', 'openai', etc.
  modelName?: string            // Full model: "ollama/llama3.2-vision"
  language?: string             // Output language: 'en', 'ko', 'ja'

  // Web platform
  url?: string                  // Web URL (overrides project URL)

  // Results
  output?: string               // Task output logs
  resultPath?: string           // Path to result directory

  // Timestamps
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
}
```

**CRUD Operations:**

| Handler | Method | Description |
|---------|--------|-------------|
| `project:list` | GET | List all projects |
| `project:get` | GET | Get single project by ID |
| `project:create` | POST | Create new project |
| `project:update` | PATCH | Update project metadata |
| `project:delete` | DELETE | Delete project and all tasks |
| `task:create` | POST | Create task in project |
| `task:update` | PATCH | Update task metadata |
| `task:delete` | DELETE | Delete task |
| `task:start` | POST | Execute task (spawn Python) |
| `task:stop` | POST | Stop running task |

### 3. Python Runtime Management

**Architecture:**

- Python downloaded to `~/.klever-desktop/python/{platform}-{arch}/python/`
- Virtual environment created at `~/.klever-desktop/python-env/`
- appagent scripts bundled in app resources

**Key Functions** (`main/utils/python-runtime.ts`):

```typescript
// Get Python executable path
getPythonPath(): string
// Returns: ~/.klever-desktop/python/{platform}-{arch}/python/bin/python3

// Get Python install directory
getPythonInstallDir(): string
// Returns: ~/.klever-desktop/python/{platform}-{arch}/python

// Get appagent directory
getAppagentPath(): string
// Returns: {app.getAppPath()}/appagent (dev)
//          {process.resourcesPath}/appagent (prod)

// Get Python environment variables
getPythonEnv(): Record<string, string>
// Sets up PYTHONPATH, LD_LIBRARY_PATH, etc.

// Spawn Python process
spawnBundledPython(args: string[], options?: SpawnOptions): ChildProcess

// Check Python runtime availability
checkPythonRuntime(): Promise<boolean>
```

**Development vs Production:**

| Mode | Python Path | appagent Path |
|------|-------------|---------------|
| **Development** | System Python or downloaded Python | `./appagent/` |
| **Production** | Downloaded Python in `~/.klever-desktop/` | `{process.resourcesPath}/appagent/` |

**Python Dependencies** (`appagent/requirements.txt`):

```
argparse
beautifulsoup4
colorama
opencv-python
playwright
pyshine
pyyaml
requests
litellm
anthropic
```

### 4. File Paths Reference

**User Data Directory:**
- macOS: `~/Library/Application Support/klever-desktop/`
- Windows: `%APPDATA%\klever-desktop\`
- Linux: `~/.klever-desktop/`

**Key Files & Directories:**

| Path | Purpose |
|------|---------|
| `~/.klever-desktop/config.json` | Application configuration |
| `~/.klever-desktop/projects.json` | Projects and tasks database |
| `~/.klever-desktop/python/{platform}-{arch}/python/` | Downloaded Python runtime |
| `~/.klever-desktop/python-env/` | Python virtual environment |
| `~/Documents/{projectName}/` | Project workspace directory |
| `~/Documents/{projectName}/apps/{app}/demos/self_explore_{timestamp}/` | Task result directory |

**App Resources (Production):**
- `process.resourcesPath/appagent/` - Python automation scripts
- `app.getAppPath()` - App installation directory

### 5. Configuration Migration

**Version Tracking:**

The app uses `config.version` to track configuration format:

```typescript
// Version 1.0: Legacy format
{
  enableLocal: true,
  enableApi: false,
  localModel: "llama3.2-vision",
  // ...
}

// Version 3.0: Multi-provider format
{
  version: "3.0",
  model: {
    providers: [
      { id: "ollama", apiKey: "", preferredModel: "ollama/llama3.2-vision" }
    ]
  }
}
```

**Migration Logic** (`main/utils/config-storage.ts`):

```typescript
export async function loadAppConfig(): Promise<AppConfig> {
  let config = await readConfigFile()

  // Migrate from legacy format
  if (!config.version || config.version === '1.0') {
    config = migrateLegacyConfig(config)
    await saveAppConfig(config)
  }

  // Merge with defaults to ensure all fields exist
  return mergeWithDefaults(config)
}
```

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
- Handle errors gracefully in UI with toast notifications

**Example:**

```typescript
// main/handlers/example.ts
ipcMain.handle('example:action', async (event, arg) => {
  try {
    const result = await performAction(arg)
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to perform action:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
```

### Performance

- **Debounce API calls**: Use 500ms debounce for search inputs, text changes
- **Memoization**: Use `useMemo` and `useCallback` for expensive computations
- **Batch IPC calls**: Group related operations when possible
- **Lazy loading**: Use React.lazy() for large components
- **Optimize images**: Compress screenshots before display

### Security

- **Never use `any` type**: Maintain strict type safety
- **Avoid command injection**: Validate inputs before subprocess calls
- **Validate file paths**: Check paths before file system operations
- **Use ASAR**: Enable ASAR for code protection in production
- **Content Security Policy**: Restrict resource loading in renderer

### Development

- **Type checking**: Run `npm run typecheck` before committing
- **Linting**: Use `npm run lint:fix` for auto-fixing
- **Test builds**: Test in both dev and production builds before release
- **Update types**: Always update TypeScript types when adding IPC handlers
- **Error boundaries**: Wrap components in error boundaries for graceful failures

---

## Troubleshooting

### Common Issues

**"[method] is not a function" error**

**Cause**: IPC handler added to `main/handlers/` but not exposed in `main/preload.ts`

**Fix**: Add the method to `contextBridge.exposeInMainWorld()` in preload.ts:

```typescript
// main/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods
  myNewMethod: (arg) => ipcRenderer.invoke('my:handler', arg),
})
```

---

**Python subprocess not working**

**Cause**: Python not installed in `~/.klever-desktop/` or dependencies missing

**Fix**: Run the Setup Wizard in the app to download and install Python:

1. Open Klever Desktop
2. If not prompted, go to Settings → Reset Environment
3. Complete the setup wizard

---

**Vite port already in use**

**Cause**: Another process using port 5173

**Fix**:

```bash
# Kill the process
lsof -ti:5173 | xargs kill -9

# Or change port in vite.config.ts
export default defineConfig({
  server: {
    port: 5174  // Change to different port
  }
})
```

---

**TypeScript errors after changes**

**Cause**: Types not updated or imports changed

**Fix**:

```bash
npm run typecheck
```

Review errors and update types accordingly. Common fixes:
- Update `src/types/electron.d.ts` when adding IPC methods
- Update `main/types/*.ts` when changing data structures
- Check import paths are correct

---

**Build fails on macOS**

**Cause**: Missing entitlements or certificates

**Fix**:

1. Verify `build/entitlements.mac.plist` exists
2. Check certificates are installed:
   ```bash
   security find-identity -v -p codesigning
   ```
3. Ensure environment variables are set:
   ```bash
   echo $APPLE_ID
   echo $APPLE_TEAM_ID
   ```

---

**Task execution hangs**

**Cause**: Long-running operation with no output or Python error

**Fix**:

1. Check Python logs in task output
2. Verify model connection (Settings → Test Connection)
3. Check Python environment:
   ```bash
   ~/.klever-desktop/python-env/bin/pip list
   ```
4. Reinstall Python environment (Settings → Reset Environment)

---

**Ollama connection fails**

**Cause**: Ollama not running or model not pulled

**Fix**:

1. Start Ollama:
   ```bash
   ollama serve
   ```

2. Pull the model:
   ```bash
   ollama pull llama3.2-vision
   # or
   ollama pull qwen2.5-vl:7b
   ```

3. Test connection in Settings → Model Configuration

---

**ADB device not detected**

**Cause**: USB debugging not enabled or ADB not installed

**Fix**:

1. Enable USB debugging on Android device:
   - Settings → About phone → Tap "Build number" 7 times
   - Settings → Developer options → Enable USB debugging

2. Install ADB (via Android Studio or platform-tools)

3. Verify device connection:
   ```bash
   adb devices
   ```

---

**Playwright browsers not installed**

**Cause**: Playwright browsers not downloaded

**Fix**:

Run Setup Wizard or manually install:

```bash
~/.klever-desktop/python-env/bin/playwright install chromium
```

---

### Debug Tips

**Enable verbose logging:**

```typescript
// main/index.ts
if (process.env.DEBUG) {
  app.commandLine.appendSwitch('enable-logging')
  app.commandLine.appendSwitch('v', '1')
}
```

**Inspect renderer DevTools:**

- Press `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux)
- Or enable in code:
  ```typescript
  mainWindow.webContents.openDevTools()
  ```

**Check main process logs:**

```bash
# macOS
tail -f ~/Library/Logs/klever-desktop/main.log

# Windows
type %APPDATA%\klever-desktop\logs\main.log
```

**Verify IPC communication:**

```typescript
// In renderer (DevTools console)
await window.electronAPI.configLoad()
```

---

## Additional Resources

- **Electron Documentation**: https://www.electronjs.org/docs/latest
- **Electron Forge**: https://www.electronforge.io/
- **shadcn/ui**: https://ui.shadcn.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **Vite**: https://vitejs.dev/
- **Ollama**: https://ollama.com/
- **LiteLLM**: https://docs.litellm.ai/
- **Playwright**: https://playwright.dev/
- **AppAgent**: https://github.com/FigmaAI/appagent

---

**Last Updated**: 2025-12-12
**Version**: 2.0.3
**Distribution**: GitHub Releases only
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CssVarsProvider } from '@mui/joy/styles'
import CssBaseline from '@mui/joy/CssBaseline'
import App from './App'
import './index.css'

// Mock Electron API for browser testing
if (!window.electronAPI) {
  const mockCallbacks: Record<string, Function[]> = {}

  window.electronAPI = {
    checkPython: async () => ({ success: true, version: '3.11.0', isValid: true }),
    checkPackages: async () => ({ success: true, output: 'All packages installed' }),
    installPackages: async () => ({ success: true }),
    installPlaywright: async () => ({ success: true }),
    installAndroidStudio: async () => ({ success: true }),
    installPython: async () => ({ success: true }),
    checkHomebrew: async () => ({ success: true, version: '4.0.0' }),
    checkOllama: async () => ({ success: true, running: true, models: [] }),
    checkAndroidStudio: async () => ({ success: true, version: 'installed' }),
    checkPlaywright: async () => ({ success: true }),
    ollamaList: async () => ({ success: true, models: [] }),
    ollamaPull: async () => ({ success: true }),
    configLoad: async () => ({ success: true, config: {} }),
    configSave: async () => ({ success: true }),
    projectStart: async () => ({ success: true }),
    projectStop: async () => ({ success: true }),
    openExternal: async () => ({ success: true }),
    getSystemInfo: async () => ({
      platform: 'browser',
      arch: 'x64',
      cpus: 4,
      totalMemory: 16000000000,
      freeMemory: 8000000000,
    }),
    testModelConnection: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return { success: true, message: 'Mock connection successful!' }
    },
    saveModelConfig: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return { success: true }
    },
    fetchApiModels: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return { success: true, provider: 'openai', models: ['gpt-4', 'gpt-3.5-turbo'] }
    },
    runIntegrationTest: async () => {
      setTimeout(() => {
        const outputCallbacks = mockCallbacks['integration:output'] || []
        const completeCallbacks = mockCallbacks['integration:complete'] || []

        outputCallbacks.forEach(cb => cb('Starting integration test...\n'))
        setTimeout(() => {
          outputCallbacks.forEach(cb => cb('Checking Python environment...\n'))
        }, 500)
        setTimeout(() => {
          outputCallbacks.forEach(cb => cb('Checking model configuration...\n'))
        }, 1000)
        setTimeout(() => {
          outputCallbacks.forEach(cb => cb('All checks passed!\n'))
          completeCallbacks.forEach(cb => cb(true))
        }, 2000)
      }, 100)
      return { success: true }
    },
    onInstallProgress: (cb) => {
      if (!mockCallbacks['install:progress']) mockCallbacks['install:progress'] = []
      mockCallbacks['install:progress'].push(cb)
    },
    onOllamaPullProgress: (cb) => {
      if (!mockCallbacks['ollama:pull:progress']) mockCallbacks['ollama:pull:progress'] = []
      mockCallbacks['ollama:pull:progress'].push(cb)
    },
    onProjectOutput: (cb) => {
      if (!mockCallbacks['project:output']) mockCallbacks['project:output'] = []
      mockCallbacks['project:output'].push(cb)
    },
    onProjectError: (cb) => {
      if (!mockCallbacks['project:error']) mockCallbacks['project:error'] = []
      mockCallbacks['project:error'].push(cb)
    },
    onProjectExit: (cb) => {
      if (!mockCallbacks['project:exit']) mockCallbacks['project:exit'] = []
      mockCallbacks['project:exit'].push(cb)
    },
    onIntegrationTestOutput: (cb) => {
      if (!mockCallbacks['integration:output']) mockCallbacks['integration:output'] = []
      mockCallbacks['integration:output'].push(cb)
    },
    onIntegrationTestComplete: (cb) => {
      if (!mockCallbacks['integration:complete']) mockCallbacks['integration:complete'] = []
      mockCallbacks['integration:complete'].push(cb)
    },
    removeAllListeners: (channel) => {
      delete mockCallbacks[channel]
    },
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CssVarsProvider>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CssVarsProvider>
  </React.StrictMode>,
)

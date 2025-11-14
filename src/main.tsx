import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CssVarsProvider } from '@mui/joy/styles'
import CssBaseline from '@mui/joy/CssBaseline'
import App from './App'
import './index.css'

import { Project, ProjectCreateInput, Task, TaskCreateInput } from './types/project'

// Mock Electron API for browser testing
if (!window.electronAPI) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockCallbacks: Record<string, any[]> = {}

  // Mock data storage
  let mockProjects: Project[] = []

  window.electronAPI = {
    // NEW: Unified Environment Setup
    envCheck: async () => ({
      success: true,
      bundledPython: {
        path: '/usr/bin/python3',
        exists: true,
        version: '3.11.0',
        isBundled: false,
      },
      venv: {
        exists: false,
        valid: false,
        path: '/mock/venv',
        pythonExecutable: '/mock/venv/bin/python',
      },
    }),
    envSetup: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      return { success: true }
    },

    // LEGACY: Environment checks (kept for backward compatibility)
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
    configReset: async () => ({ success: true }),
    checkSetup: async () => ({ success: true, setupComplete: true }),
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

    // Project Management
    projectList: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return { success: true, projects: mockProjects }
    },
    projectGet: async (projectId: string) => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const project = mockProjects.find(p => p.id === projectId)
      if (!project) return { success: false, error: 'Project not found' }
      return { success: true, project }
    },
    projectCreate: async (projectInput: ProjectCreateInput) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      const newProject = {
        id: `proj_${Date.now()}`,
        ...projectInput,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [],
        workspaceDir: `/Documents/${projectInput.name}`,
      }
      mockProjects.push(newProject)
      return { success: true, project: newProject }
    },
    projectUpdate: async (projectId: string, updates: Partial<Project>) => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const projectIndex = mockProjects.findIndex(p => p.id === projectId)
      if (projectIndex === -1) return { success: false, error: 'Project not found' }
      mockProjects[projectIndex] = {
        ...mockProjects[projectIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      return { success: true, project: mockProjects[projectIndex] }
    },
    projectDelete: async (projectId: string) => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const projectIndex = mockProjects.findIndex(p => p.id === projectId)
      if (projectIndex === -1) return { success: false, error: 'Project not found' }
      mockProjects.splice(projectIndex, 1)
      return { success: true }
    },

    // Task Management
    taskCreate: async (taskInput: TaskCreateInput) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      const project = mockProjects.find(p => p.id === taskInput.projectId)
      if (!project) return { success: false, error: 'Project not found' }
      const newTask = {
        id: `task_${Date.now()}`,
        name: taskInput.name,
        description: taskInput.description,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      project.tasks.push(newTask)
      return { success: true, task: newTask }
    },
    taskUpdate: async (projectId: string, taskId: string, updates: Partial<Task>) => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const project = mockProjects.find(p => p.id === projectId)
      if (!project) return { success: false, error: 'Project not found' }
      const taskIndex = project.tasks.findIndex((t: Task) => t.id === taskId)
      if (taskIndex === -1) return { success: false, error: 'Task not found' }
      project.tasks[taskIndex] = {
        ...project.tasks[taskIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      return { success: true, task: project.tasks[taskIndex] }
    },
    taskDelete: async (projectId: string, taskId: string) => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const project = mockProjects.find(p => p.id === projectId)
      if (!project) return { success: false, error: 'Project not found' }
      const taskIndex = project.tasks.findIndex((t: Task) => t.id === taskId)
      if (taskIndex === -1) return { success: false, error: 'Task not found' }
      project.tasks.splice(taskIndex, 1)
      return { success: true }
    },
    taskStart: async (projectId: string, taskId: string) => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const project = mockProjects.find(p => p.id === projectId)
      if (!project) return { success: false, error: 'Project not found' }
      const task = project.tasks.find((t: Task) => t.id === taskId)
      if (!task) return { success: false, error: 'Task not found' }
      task.status = 'running' as const
      task.lastRunAt = new Date().toISOString()

      // Simulate task completion after 5 seconds
      setTimeout(() => {
        task.status = 'completed' as const
        const callbacks = mockCallbacks['task:complete'] || []
        callbacks.forEach(cb => cb({ projectId, taskId, code: 0 }))
      }, 5000)

      return { success: true, pid: 12345 }
    },
    taskStop: async (projectId: string, taskId: string) => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      const project = mockProjects.find(p => p.id === projectId)
      if (!project) return { success: false, error: 'Project not found' }
      const task = project.tasks.find((t: Task) => t.id === taskId)
      if (!task) return { success: false, error: 'Task not found' }
      task.status = 'cancelled' as const
      return { success: true }
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
    stopIntegrationTest: async () => {
      return { success: true }
    },
    onEnvProgress: (cb) => {
      if (!mockCallbacks['env:progress']) mockCallbacks['env:progress'] = []
      mockCallbacks['env:progress'].push(cb)
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
    onTaskOutput: (cb) => {
      if (!mockCallbacks['task:output']) mockCallbacks['task:output'] = []
      mockCallbacks['task:output'].push(cb)
    },
    onTaskError: (cb) => {
      if (!mockCallbacks['task:error']) mockCallbacks['task:error'] = []
      mockCallbacks['task:error'].push(cb)
    },
    onTaskComplete: (cb) => {
      if (!mockCallbacks['task:complete']) mockCallbacks['task:complete'] = []
      mockCallbacks['task:complete'].push(cb)
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

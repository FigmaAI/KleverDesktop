import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n' // Initialize i18n

import { Project, ProjectCreateInput, Task, TaskCreateInput } from './types/project'

// Mock Electron API for browser testing
if (!window.electronAPI) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type MockCallback = (...args: any[]) => void;
  const mockCallbacks: Record<string, MockCallback[]> = {}

  // Mock data storage
  let mockProjects: Project[] = []

  window.electronAPI = {
    // NEW: Unified Environment Setup
    envCheck: async () => ({
      success: false,
      error: 'Python runtime not available',
      bundledPython: {
        path: '/mock/.klever-desktop/python/darwin-arm64/python/bin/python3',
        exists: false,
        version: undefined,
        isBundled: true,
      },
      playwright: {
        installed: false,
      }
    }),
    envSetup: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      return { success: true }
    },
    envReset: async () => ({ success: true }),

    // Python Runtime Management (Post-Install Download)
    pythonCheckInstalled: async () => ({
      success: true,
      installed: false,
      path: '/mock/.klever-desktop/python/darwin-arm64/python',
    }),
    pythonGetInstallPath: async () => ({
      success: true,
      path: '/mock/.klever-desktop/python/darwin-arm64/python',
    }),
    pythonDownload: async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
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
    checkChocolatey: async () => ({ success: true, version: '2.0.0' }),
    checkOllama: async () => ({ success: true, running: true, models: [] }),
    checkAndroidStudio: async () => ({ success: true, version: 'installed' }),
    checkPlaywright: async () => ({ success: true }),
    ollamaCheck: async () => ({ installed: true, path: '/usr/local/bin/ollama', version: '0.1.0' }),
    ollamaList: async () => ({ success: true, models: [] }),
    ollamaPull: async () => ({ success: true }),
    configLoad: async () => ({
      success: true,
      config: {
        version: '3.0',
        model: {
          providers: [
            {
              id: 'ollama',
              apiKey: '',
              preferredModel: 'ollama/llama3.2-vision',
              baseUrl: 'http://localhost:11434',
            },
          ],
          lastUsed: {
            provider: 'ollama',
            model: 'ollama/llama3.2-vision',
          },
        },
        execution: { maxTokens: 4096, temperature: 0.0, requestInterval: 10, maxRounds: 20 },
        android: { screenshotDir: '/sdcard', xmlDir: '/sdcard', sdkPath: '' },
        web: { browserType: 'chromium' as const, headless: false },
        image: { maxWidth: 512, maxHeight: 512, quality: 85, optimize: true },
        preferences: { darkMode: false, minDist: 30, docRefine: false, systemLanguage: 'en' as const },
      }
    }),
    configSave: async () => ({ success: true }),
    configReset: async () => ({ success: true }),
    configHardReset: async () => ({ success: true }),
    configUpdateLastUsed: async () => ({ success: true }),
    appRestart: async () => {
      console.log('[Mock] App restart requested - reloading page...');
      window.location.reload();
      return { success: true };
    },
    checkSetup: async () => ({ success: true, setupComplete: true }),
    projectStart: async () => ({ success: true }),
    projectStop: async () => ({ success: true }),
    openExternal: async () => ({ success: true }),
    showFolderSelectDialog: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return '/Users/mockuser/Documents/MockProject';
    },
    openFolder: async () => ({ success: true }),
    openPath: async () => ({ success: true }),
    clipboardWriteText: async () => ({ success: true }),
    fileRead: async () => ({ success: true, content: '' }),
    fileExists: async () => ({ success: true, exists: true }),
    fileReadImage: async (_filePath: string, _baseDir?: string) => ({ success: true, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }),
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
    fetchLiteLLMModels: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return {
        success: true,
        providers: [
          {
            id: 'openai',
            name: 'OpenAI',
            requiresBaseUrl: false,
            apiKeyUrl: 'https://platform.openai.com/api-keys',
            models: [
              { id: 'gpt-4o', name: 'GPT-4 Omni', supportsVision: true, contextWindow: 128000 },
              { id: 'gpt-4o-mini', name: 'GPT-4 Omni Mini', supportsVision: true, contextWindow: 128000 },
            ],
          },
          {
            id: 'anthropic',
            name: 'Anthropic Claude',
            requiresBaseUrl: false,
            apiKeyUrl: 'https://console.anthropic.com/',
            models: [
              { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', supportsVision: true, contextWindow: 200000 },
            ],
          },
        ],
      }
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
      const newProject: Project = {
        id: `proj_${Date.now()}`,
        name: projectInput.name,
        platform: projectInput.platform,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [],
        workspaceDir: projectInput.workspaceDir || `/Users/mockuser/Documents/${projectInput.name}`,
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
      const newTask: Task = {
        id: `task_${Date.now()}`,
        name: taskInput.name,
        description: taskInput.description,
        goal: taskInput.goal,
        url: taskInput.url,
        modelProvider: taskInput.modelProvider,
        modelName: taskInput.modelName,
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
    cleanupIntegrationTest: async () => {
      return { success: true }
    },
    fetchGitHubStars: async (repo: string) => {
      // Mock GitHub API response
      console.log('[Mock] Fetching GitHub stars for:', repo)
      await new Promise((resolve) => setTimeout(resolve, 500))
      return { success: true, stars: 123 }
    },
    onEnvProgress: (cb) => {
      if (!mockCallbacks['env:progress']) mockCallbacks['env:progress'] = []
      mockCallbacks['env:progress'].push(cb)
      return () => {
        const idx = mockCallbacks['env:progress']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['env:progress'].splice(idx, 1)
      }
    },
    onInstallProgress: (cb) => {
      if (!mockCallbacks['install:progress']) mockCallbacks['install:progress'] = []
      mockCallbacks['install:progress'].push(cb)
      return () => {
        const idx = mockCallbacks['install:progress']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['install:progress'].splice(idx, 1)
      }
    },
    onPythonProgress: (cb) => {
      if (!mockCallbacks['python:progress']) mockCallbacks['python:progress'] = []
      mockCallbacks['python:progress'].push(cb)
      return () => {
        const idx = mockCallbacks['python:progress']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['python:progress'].splice(idx, 1)
      }
    },
    onOllamaPullProgress: (cb) => {
      if (!mockCallbacks['ollama:pull:progress']) mockCallbacks['ollama:pull:progress'] = []
      mockCallbacks['ollama:pull:progress'].push(cb)
      return () => {
        const idx = mockCallbacks['ollama:pull:progress']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['ollama:pull:progress'].splice(idx, 1)
      }
    },
    onProjectOutput: (cb) => {
      if (!mockCallbacks['project:output']) mockCallbacks['project:output'] = []
      mockCallbacks['project:output'].push(cb)
      return () => {
        const idx = mockCallbacks['project:output']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['project:output'].splice(idx, 1)
      }
    },
    onProjectError: (cb) => {
      if (!mockCallbacks['project:error']) mockCallbacks['project:error'] = []
      mockCallbacks['project:error'].push(cb)
      return () => {
        const idx = mockCallbacks['project:error']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['project:error'].splice(idx, 1)
      }
    },
    onProjectExit: (cb) => {
      if (!mockCallbacks['project:exit']) mockCallbacks['project:exit'] = []
      mockCallbacks['project:exit'].push(cb)
      return () => {
        const idx = mockCallbacks['project:exit']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['project:exit'].splice(idx, 1)
      }
    },
    onIntegrationTestOutput: (cb) => {
      if (!mockCallbacks['integration:output']) mockCallbacks['integration:output'] = []
      mockCallbacks['integration:output'].push(cb)
      return () => {
        const idx = mockCallbacks['integration:output']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['integration:output'].splice(idx, 1)
      }
    },
    onIntegrationTestComplete: (cb) => {
      if (!mockCallbacks['integration:complete']) mockCallbacks['integration:complete'] = []
      mockCallbacks['integration:complete'].push(cb)
      return () => {
        const idx = mockCallbacks['integration:complete']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['integration:complete'].splice(idx, 1)
      }
    },
    onTaskOutput: (cb) => {
      if (!mockCallbacks['task:output']) mockCallbacks['task:output'] = []
      mockCallbacks['task:output'].push(cb)
      return () => {
        const idx = mockCallbacks['task:output']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['task:output'].splice(idx, 1)
      }
    },
    onTaskError: (cb) => {
      if (!mockCallbacks['task:error']) mockCallbacks['task:error'] = []
      mockCallbacks['task:error'].push(cb)
      return () => {
        const idx = mockCallbacks['task:error']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['task:error'].splice(idx, 1)
      }
    },
    onTaskComplete: (cb) => {
      if (!mockCallbacks['task:complete']) mockCallbacks['task:complete'] = []
      mockCallbacks['task:complete'].push(cb)
      return () => {
        const idx = mockCallbacks['task:complete']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['task:complete'].splice(idx, 1)
      }
    },
    onTaskAutoStart: (cb) => {
      if (!mockCallbacks['task:auto-start']) mockCallbacks['task:auto-start'] = []
      mockCallbacks['task:auto-start'].push(cb)
      return () => {
        const idx = mockCallbacks['task:auto-start']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['task:auto-start'].splice(idx, 1)
      }
    },
    onTaskScheduled: (cb) => {
      if (!mockCallbacks['task:scheduled']) mockCallbacks['task:scheduled'] = []
      mockCallbacks['task:scheduled'].push(cb)
      return () => {
        const idx = mockCallbacks['task:scheduled']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['task:scheduled'].splice(idx, 1)
      }
    },
    onTaskScheduleCancelled: (cb) => {
      if (!mockCallbacks['task:schedule-cancelled']) mockCallbacks['task:schedule-cancelled'] = []
      mockCallbacks['task:schedule-cancelled'].push(cb)
      return () => {
        const idx = mockCallbacks['task:schedule-cancelled']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['task:schedule-cancelled'].splice(idx, 1)
      }
    },
    onTaskScheduleTriggered: (cb) => {
      if (!mockCallbacks['task:schedule-triggered']) mockCallbacks['task:schedule-triggered'] = []
      mockCallbacks['task:schedule-triggered'].push(cb)
      return () => {
        const idx = mockCallbacks['task:schedule-triggered']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['task:schedule-triggered'].splice(idx, 1)
      }
    },
    onTaskScheduleError: (cb) => {
      if (!mockCallbacks['task:schedule-error']) mockCallbacks['task:schedule-error'] = []
      mockCallbacks['task:schedule-error'].push(cb)
      return () => {
        const idx = mockCallbacks['task:schedule-error']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['task:schedule-error'].splice(idx, 1)
      }
    },
    removeAllListeners: (channel) => {
      delete mockCallbacks[channel]
    },
    removeListener: (_channel: string, _callback: (...args: unknown[]) => void) => {
      // Mock implementation - in real electron this would remove specific listener
    },

    // Google Login (mock)
    googleLoginWebStart: async () => ({ success: true }),
    googleLoginWebStop: async () => ({ success: true }),
    googleLoginWebGetStatus: async () => ({ success: true, loggedIn: false }),
    googleLoginWebVerifyStatus: async () => ({ success: true, loggedIn: false, verified: false }),
    googleLoginGetProfilePath: async () => ({ success: true, path: '/mock/profile' }),
    googleLoginAndroidListDevices: async () => ({ success: true, devices: [] }),
    googleLoginAndroidStart: async () => ({ success: true }),
    googleLoginAndroidStop: async () => ({ success: true }),
    googleLoginAndroidGetStatus: async () => ({ success: true, loggedIn: false }),
    googleLoginClear: async () => ({ success: true }),
    onGoogleLoginWebStatus: (cb) => {
      if (!mockCallbacks['google-login:web:status']) mockCallbacks['google-login:web:status'] = []
      mockCallbacks['google-login:web:status'].push(cb)
      return () => {
        const idx = mockCallbacks['google-login:web:status']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['google-login:web:status'].splice(idx, 1)
      }
    },
    onGoogleLoginAndroidStatus: (cb) => {
      if (!mockCallbacks['google-login:android:status']) mockCallbacks['google-login:android:status'] = []
      mockCallbacks['google-login:android:status'].push(cb)
      return () => {
        const idx = mockCallbacks['google-login:android:status']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['google-login:android:status'].splice(idx, 1)
      }
    },

    // APK Installation (mock)
    apkSelectFile: async () => ({ success: true, canceled: true }),
    playstoreParseUrl: async () => ({ success: true, packageName: 'com.example.app' }),

    // Task Progress (mock)
    onTaskProgress: (cb) => {
      if (!mockCallbacks['task:progress']) mockCallbacks['task:progress'] = []
      mockCallbacks['task:progress'].push(cb)
      return () => {
        const idx = mockCallbacks['task:progress']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['task:progress'].splice(idx, 1)
      }
    },

    // Schedule Management (mock)
    scheduleList: async () => ({ success: true, schedules: [] }),
    scheduleAdd: async (_projectId: string, _taskId: string, _scheduledAt: string) => ({
      success: true,
    }),
    scheduleCancel: async () => ({ success: true }),
    onScheduleAdded: (cb) => {
      if (!mockCallbacks['schedule:added']) mockCallbacks['schedule:added'] = []
      mockCallbacks['schedule:added'].push(cb)
      return () => {
        const idx = mockCallbacks['schedule:added']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['schedule:added'].splice(idx, 1)
      }
    },
    onScheduleStarted: (cb) => {
      if (!mockCallbacks['schedule:started']) mockCallbacks['schedule:started'] = []
      mockCallbacks['schedule:started'].push(cb)
      return () => {
        const idx = mockCallbacks['schedule:started']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['schedule:started'].splice(idx, 1)
      }
    },
    onScheduleCancelled: (cb) => {
      if (!mockCallbacks['schedule:cancelled']) mockCallbacks['schedule:cancelled'] = []
      mockCallbacks['schedule:cancelled'].push(cb)
      return () => {
        const idx = mockCallbacks['schedule:cancelled']?.indexOf(cb)
        if (idx !== undefined && idx > -1) mockCallbacks['schedule:cancelled'].splice(idx, 1)
      }
    },
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
)

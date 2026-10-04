import type { Project, Task, TestCase } from '@/types/project'
import { DEFAULT_CONFIG } from '@/hooks/useSettings'

// UI development only: native execution and account access require Electron.
export function installBrowserPreview() {
  let projects: Project[] = []
  let config = structuredClone(DEFAULT_CONFIG)
  const nativeOnly = async () => ({ success: false, error: 'Open Klever Desktop to use this feature.' })
  const listeners = new Map<string, Set<(data: never) => void>>()
  const subscribe = <T,>(event: string, callback: (data: T) => void) => {
    const callbacks = listeners.get(event) || new Set<(data: never) => void>()
    callbacks.add(callback)
    listeners.set(event, callbacks)
    return () => { callbacks.delete(callback) }
  }
  const emit = <T,>(event: string, data: T) => listeners.get(event)?.forEach((callback) => callback(data as never))
  const findTask = (projectId: string, taskId: string) => projects.find((project) => project.id === projectId)?.tasks.find((task) => task.id === taskId)

  window.electronAPI = {
    chatgptStatus: async () => ({ success: true, data: { authenticated: false } }),
    chatgptLogin: nativeOnly,
    chatgptCancel: async () => ({ success: true, data: { authenticated: false } }),
    chatgptLogout: async () => ({ success: true, data: { authenticated: false } }),
    onChatGPTUpdated: (callback) => subscribe('chatgpt:updated', callback),
    androidStatus: async () => ({ success: true, ready: false, sdkPath: '' }),
    androidListDevices: async () => ({ success: true, devices: [] }),
    androidListEmulators: async () => ({ success: true, names: [] }),
    androidStartEmulator: nativeOnly,
    androidInstallTools: nativeOnly,
    configLoad: async () => ({ success: true, config }),
    configSave: async (updated) => { config = structuredClone(updated); return { success: true } },
    openExternal: nativeOnly,
    openPath: nativeOnly,
    openFolder: nativeOnly,
    showFolderSelectDialog: async () => null,
    clipboardWriteText: async (text) => { await navigator.clipboard.writeText(text); return { success: true } },
    fileRead: nativeOnly,
    fileExists: async () => ({ success: true, exists: false }),
    fileReadImage: nativeOnly,
    projectList: async () => ({ success: true, projects: structuredClone(projects) }),
    projectGet: async (id) => ({ success: true, project: projects.find((project) => project.id === id) }),
    projectCreate: async (input) => {
      const now = new Date().toISOString()
      const project: Project = { testCases: [], id: `proj_${crypto.randomUUID()}`, name: input.name, platform: 'android', status: 'active', tasks: [], createdAt: now, updatedAt: now, workspaceDir: input.workspaceDir || '/preview/results' }
      projects = [...projects, project]
      return { success: true, project }
    },
    projectUpdate: async (id, updates) => {
      const project = projects.find((item) => item.id === id)
      if (!project) return { success: false, error: 'Project not found' }
      Object.assign(project, updates)
      return { success: true, project }
    },
    projectDelete: async (id) => { projects = projects.filter((project) => project.id !== id); return { success: true } },
    testCaseCreate: async (input) => {
      const project = projects.find((item) => item.id === input.projectId)
      if (!project) return { success: false, error: 'Project not found' }
      const now = new Date().toISOString()
      const testCase: TestCase = { id: `case_${crypto.randomUUID()}`, projectId: project.id, name: input.name, goal: input.goal, description: input.description, apkSource: input.apkSource, revision: 1, createdAt: now, updatedAt: now }
      project.testCases = [...(project.testCases || []), testCase]
      return { success: true, testCase: structuredClone(testCase) }
    },
    testCaseUpdate: async (projectId, caseId, input) => {
      const testCase = projects.find((project) => project.id === projectId)?.testCases?.find((item) => item.id === caseId)
      if (!testCase) return { success: false, error: 'Test course not found' }
      Object.assign(testCase, input, { revision: testCase.revision + 1, updatedAt: new Date().toISOString() })
      return { success: true, testCase: structuredClone(testCase) }
    },
    testCaseArchive: async (projectId, caseId) => {
      const testCase = projects.find((project) => project.id === projectId)?.testCases?.find((item) => item.id === caseId)
      if (!testCase) return { success: false, error: 'Test course not found' }
      testCase.archived = true
      return { success: true }
    },
    testCaseRun: async (projectId, caseId, input) => {
      const project = projects.find((item) => item.id === projectId)
      const testCase = project?.testCases?.find((item) => item.id === caseId)
      if (!project || !testCase) return { success: false, error: 'Test course not found' }
      if (testCase.archived) return { success: false, error: 'Test course is archived' }
      const now = new Date().toISOString()
      const reference = [...project.tasks].reverse().find((run) => run.testCaseId === caseId && run.status === 'completed' && run.goal === testCase.goal)
      const task: Task = { id: `task_${crypto.randomUUID()}`, projectId, testCaseId: caseId, caseRevision: testCase.revision, caseSnapshot: { id: caseId, revision: testCase.revision, name: testCase.name, goal: testCase.goal, description: testCase.description, apkSource: input.apkSource || testCase.apkSource }, name: testCase.name, goal: testCase.goal, description: testCase.description, apkSource: input.apkSource || testCase.apkSource, buildLabel: input.buildLabel, deviceSerial: input.deviceSerial, referenceRunId: input.referenceRunId || reference?.id, status: 'pending', createdAt: now, updatedAt: now, scheduledAt: input.scheduledAt, isScheduled: !!input.scheduledAt }
      project.tasks.push(task)
      project.lastApkSource = task.apkSource
      if (input.scheduledAt) emit('schedule:added', { projectId, taskId: task.id, scheduledAt: input.scheduledAt })
      return { success: true, task: structuredClone(task) }
    },
    taskRecordingGet: async (projectId, taskId) => {
      const project = projects.find((item) => item.id === projectId)
      const run = findTask(projectId, taskId)
      if (!project || !run) return { success: false, error: 'Run not found' }
      return { success: true, manifest: { schemaVersion: 1, project: { id: project.id, name: project.name, platform: 'android' }, run: structuredClone(run) } }
    },
    taskCreate: async (input) => {
      const project = projects.find((item) => item.id === input.projectId)
      if (!project) return { success: false, error: 'Project not found' }
      const now = new Date().toISOString()
      const task: Task = { projectId: input.projectId, id: `task_${crypto.randomUUID()}`, name: input.name, goal: input.goal, description: input.description, apkSource: input.apkSource, status: 'pending', createdAt: now, updatedAt: now }
      project.tasks.push(task)
      project.lastApkSource = task.apkSource
      return { success: true, task }
    },
    taskDelete: async (projectId, taskId) => {
      const project = projects.find((item) => item.id === projectId)
      if (project) project.tasks = project.tasks.filter((task) => task.id !== taskId)
      return { success: true }
    },
    taskStart: nativeOnly,
    taskStop: nativeOnly,
    onTaskRecorded: (callback) => subscribe('task:recorded', callback),
    onTaskStarted: (callback) => subscribe('task:started', callback),
    onTaskOutput: (callback) => subscribe('task:output', callback),
    onTaskError: (callback) => subscribe('task:error', callback),
    onTaskComplete: (callback) => subscribe('task:complete', callback),
    onTaskProgress: (callback) => subscribe('task:progress', callback),
    scheduleList: async () => ({ success: true, scheduledTasks: projects.flatMap((project) => project.tasks.filter((task) => task.isScheduled).map((task) => ({ projectId: project.id, projectName: project.name, task }))) }),
    scheduleAdd: async (projectId, taskId, scheduledAt) => {
      const task = findTask(projectId, taskId)
      if (!task) return { success: false, error: 'Test not found' }
      task.scheduledAt = scheduledAt
      task.isScheduled = true
      emit('schedule:added', { projectId, taskId, scheduledAt })
      return { success: true }
    },
    scheduleCancel: async (projectId, taskId) => {
      const task = findTask(projectId, taskId)
      if (task) task.isScheduled = false
      emit('schedule:cancelled', { projectId, taskId })
      return { success: true }
    },
    onScheduleAdded: (callback) => subscribe('schedule:added', callback),
    onScheduleStarted: (callback) => subscribe('schedule:started', callback),
    onScheduleCancelled: (callback) => subscribe('schedule:cancelled', callback),
    onScheduleFailed: (callback) => subscribe('schedule:failed', callback),
    apkSelectFile: async () => ({ success: true, canceled: true }),
  }
}

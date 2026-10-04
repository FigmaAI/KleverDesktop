/** Narrow renderer bridge for native tests, recordings, schedules, and the ChatGPT account. */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

function listen<T>(channel: string, callback: (data: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('electronAPI', {
  androidStatus: () => ipcRenderer.invoke('android:status'),
  androidListDevices: () => ipcRenderer.invoke('android:devices'),
  androidListEmulators: () => ipcRenderer.invoke('android:emulators'),
  androidStartEmulator: (avdName?: string) => ipcRenderer.invoke('android:start-emulator', avdName),
  androidInstallTools: () => ipcRenderer.invoke('android:installTools'),

  configLoad: () => ipcRenderer.invoke('config:load'),
  configSave: (config: Record<string, unknown>) => ipcRenderer.invoke('config:save', config),

  chatgptStatus: () => ipcRenderer.invoke('chatgpt:status'),
  chatgptLogin: (options?: { reconsent?: boolean }) => ipcRenderer.invoke('chatgpt:login', options),
  chatgptCancel: () => ipcRenderer.invoke('chatgpt:cancel'),
  chatgptLogout: () => ipcRenderer.invoke('chatgpt:logout'),
  onChatGPTUpdated: (callback: (data: unknown) => void) => listen('chatgpt:updated', callback),

  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (folderPath: string) => ipcRenderer.invoke('shell:openPath', folderPath),
  showFolderSelectDialog: () => ipcRenderer.invoke('dialog:showFolderSelect'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('dialog:openFolder', folderPath),
  clipboardWriteText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  fileRead: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  fileExists: (filePath: string) => ipcRenderer.invoke('file:exists', filePath),
  fileReadImage: (filePath: string, baseDir?: string) => ipcRenderer.invoke('file:readImage', filePath, baseDir),
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  fetchGitHubStars: (repo: string) => ipcRenderer.invoke('github:fetchStars', repo),

  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => ipcRenderer.removeListener(channel, callback),

  projectList: () => ipcRenderer.invoke('project:list'),
  projectGet: (projectId: string) => ipcRenderer.invoke('project:get', projectId),
  projectCreate: (input: Record<string, unknown>) => ipcRenderer.invoke('project:create', input),
  projectUpdate: (projectId: string, updates: Record<string, unknown>) => ipcRenderer.invoke('project:update', projectId, updates),
  projectDelete: (projectId: string) => ipcRenderer.invoke('project:delete', projectId),
  testCaseCreate: (input: Record<string, unknown>) => ipcRenderer.invoke('testcase:create', input),
  testCaseUpdate: (projectId: string, caseId: string, input: Record<string, unknown>) => ipcRenderer.invoke('testcase:update', projectId, caseId, input),
  testCaseArchive: (projectId: string, caseId: string) => ipcRenderer.invoke('testcase:archive', projectId, caseId),
  testCaseRun: (projectId: string, caseId: string, input: Record<string, unknown> = {}) => ipcRenderer.invoke('testcase:run', projectId, caseId, input),
  taskRecordingGet: (projectId: string, taskId: string) => ipcRenderer.invoke('task:recording:get', projectId, taskId),
  taskCreate: (input: Record<string, unknown>) => ipcRenderer.invoke('task:create', input),
  taskDelete: (projectId: string, taskId: string) => ipcRenderer.invoke('task:delete', projectId, taskId),
  taskStart: (projectId: string, taskId: string) => ipcRenderer.invoke('task:start', projectId, taskId),
  taskStop: (projectId: string, taskId: string) => ipcRenderer.invoke('task:stop', projectId, taskId),
  onTaskRecorded: (callback: (data: { projectId: string; taskId: string }) => void) => listen('task:recorded', callback),
  onTaskStarted: (callback: (data: { projectId: string; taskId: string }) => void) => listen('task:started', callback),
  onTaskOutput: (callback: (data: unknown) => void) => listen('task:output', callback),
  onTaskError: (callback: (data: unknown) => void) => listen('task:error', callback),
  onTaskComplete: (callback: (data: unknown) => void) => listen('task:complete', callback),
  onTaskProgress: (callback: (data: unknown) => void) => listen('task:progress', callback),

  scheduleList: () => ipcRenderer.invoke('schedule:list'),
  scheduleAdd: (projectId: string, taskId: string, scheduledAt: string) => ipcRenderer.invoke('schedule:add', projectId, taskId, scheduledAt),
  scheduleCancel: (projectId: string, taskId: string) => ipcRenderer.invoke('schedule:cancel', projectId, taskId),
  onScheduleAdded: (callback: (data: { projectId: string; taskId: string; scheduledAt: string }) => void) => listen('schedule:added', callback),
  onScheduleStarted: (callback: (data: { projectId: string; taskId: string }) => void) => listen('schedule:started', callback),
  onScheduleCancelled: (callback: (data: { projectId: string; taskId: string }) => void) => listen('schedule:cancelled', callback),
  onScheduleFailed: (callback: (data: { projectId: string; taskId: string; error: string }) => void) => listen('schedule:failed', callback),
  apkSelectFile: () => ipcRenderer.invoke('apk:selectFile'),
});

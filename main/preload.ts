/**
 * Electron Preload Script
 * Exposes IPC methods to renderer process via context bridge
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // NEW: Unified Environment Setup
  envCheck: () => ipcRenderer.invoke('env:check'),
  envSetup: () => ipcRenderer.invoke('env:setup'),
  envReset: () => ipcRenderer.invoke('env:reset'),

  // NEW: Python Environment Sync (for post-update synchronization)
  syncCheck: () => ipcRenderer.invoke('sync:check'),
  syncRun: (forceRecreateVenv?: boolean) => ipcRenderer.invoke('sync:run', forceRecreateVenv),
  syncReset: () => ipcRenderer.invoke('sync:reset'),
  syncUpdateManifest: () => ipcRenderer.invoke('sync:updateManifest'),

  // Python Runtime Management (Post-Install Download)
  pythonCheckInstalled: () => ipcRenderer.invoke('python:checkInstalled'),
  pythonGetInstallPath: () => ipcRenderer.invoke('python:getInstallPath'),
  pythonDownload: () => ipcRenderer.invoke('python:download'),

  // LEGACY: Environment checks (kept for backward compatibility)
  checkPython: () => ipcRenderer.invoke('check:python'),
  checkPackages: () => ipcRenderer.invoke('check:packages'),
  installPackages: () => ipcRenderer.invoke('install:packages'),
  installPlaywright: () => ipcRenderer.invoke('install:playwright'),
  installAndroidStudio: () => ipcRenderer.invoke('install:androidStudio'),
  installPython: () => ipcRenderer.invoke('install:python'),
  checkOllama: () => ipcRenderer.invoke('check:ollama'),
  checkAndroidStudio: () => ipcRenderer.invoke('check:androidStudio'),
  checkPlaywright: () => ipcRenderer.invoke('check:playwright'),
  checkHomebrew: () => ipcRenderer.invoke('check:homebrew'),
  checkChocolatey: () => ipcRenderer.invoke('check:chocolatey'),

  // Ollama operations
  ollamaCheck: () => ipcRenderer.invoke('ollama:check'),
  ollamaList: () => ipcRenderer.invoke('ollama:list'),
  ollamaPull: (modelName: string) => ipcRenderer.invoke('ollama:pull', modelName),

  // Config operations
  configLoad: () => ipcRenderer.invoke('config:load'),
  configSave: (config: Record<string, unknown>) => ipcRenderer.invoke('config:save', config),
  configReset: () => ipcRenderer.invoke('config:reset'),
  configHardReset: () => ipcRenderer.invoke('config:hardReset'),
  configUpdateLastUsed: (lastUsed: { provider: string; model: string }) =>
    ipcRenderer.invoke('config:updateLastUsed', lastUsed),
  appRestart: () => ipcRenderer.invoke('app:restart'),
  checkSetup: () => ipcRenderer.invoke('config:checkSetup'),

  // Project operations
  projectStart: (projectConfig: Record<string, unknown>) => ipcRenderer.invoke('project:start', projectConfig),
  projectStop: () => ipcRenderer.invoke('project:stop'),

  // Shell operations
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  openPath: (folderPath: string) => ipcRenderer.invoke('shell:openPath', folderPath),
  showFolderSelectDialog: () => ipcRenderer.invoke('dialog:showFolderSelect'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('dialog:openFolder', folderPath),

  // Clipboard operations
  clipboardWriteText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),

  // File operations
  fileRead: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  fileExists: (filePath: string) => ipcRenderer.invoke('file:exists', filePath),
  fileReadImage: (filePath: string, baseDir?: string) => ipcRenderer.invoke('file:readImage', filePath, baseDir),

  // System info
  getSystemInfo: () => ipcRenderer.invoke('system:info'),

  // Model configuration and testing
  testModelConnection: (config: Record<string, unknown>) => ipcRenderer.invoke('model:testConnection', config),
  saveModelConfig: (config: Record<string, unknown>) => ipcRenderer.invoke('model:saveConfig', config),
  fetchApiModels: (config: Record<string, unknown>) => ipcRenderer.invoke('model:fetchApiModels', config),
  fetchLiteLLMModels: (forceRefresh?: boolean) => ipcRenderer.invoke('model:fetchLiteLLMModels', forceRefresh),

  // Integration test
  runIntegrationTest: (config: Record<string, unknown>) => ipcRenderer.invoke('integration:test', config),
  stopIntegrationTest: () => ipcRenderer.invoke('integration:stop'),
  cleanupIntegrationTest: () => ipcRenderer.invoke('integration:cleanup'),

  // GitHub API
  fetchGitHubStars: (repo: string) => ipcRenderer.invoke('github:fetchStars', repo),

  // Event listeners (return cleanup function)
  onEnvProgress: (callback: (data: string) => void) => {
    const handler = (_event: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('env:progress', handler);
    return () => ipcRenderer.removeListener('env:progress', handler);
  },
  onInstallProgress: (callback: (data: string) => void) => {
    const handler = (_event: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('install:progress', handler);
    return () => ipcRenderer.removeListener('install:progress', handler);
  },
  onPythonProgress: (callback: (data: string) => void) => {
    const handler = (_event: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('python:progress', handler);
    return () => ipcRenderer.removeListener('python:progress', handler);
  },
  onSyncProgress: (callback: (data: string) => void) => {
    const handler = (_event: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('sync:progress', handler);
    return () => ipcRenderer.removeListener('sync:progress', handler);
  },
  onPythonSyncNeeded: (callback: (data: { reason: string; currentVersion: string; previousVersion?: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { reason: string; currentVersion: string; previousVersion?: string }) => callback(data);
    ipcRenderer.on('python:sync-needed', handler);
    return () => ipcRenderer.removeListener('python:sync-needed', handler);
  },
  onOllamaPullProgress: (callback: (data: string) => void) => {
    const handler = (_event: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('ollama:pull:progress', handler);
    return () => ipcRenderer.removeListener('ollama:pull:progress', handler);
  },
  onProjectOutput: (callback: (data: string) => void) => {
    const handler = (_event: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('project:output', handler);
    return () => ipcRenderer.removeListener('project:output', handler);
  },
  onProjectError: (callback: (data: string) => void) => {
    const handler = (_event: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('project:error', handler);
    return () => ipcRenderer.removeListener('project:error', handler);
  },
  onProjectExit: (callback: (code: number) => void) => {
    const handler = (_event: IpcRendererEvent, code: number) => callback(code);
    ipcRenderer.on('project:exit', handler);
    return () => ipcRenderer.removeListener('project:exit', handler);
  },
  onIntegrationTestOutput: (callback: (data: string) => void) => {
    const handler = (_event: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('integration:output', handler);
    return () => ipcRenderer.removeListener('integration:output', handler);
  },
  onIntegrationTestComplete: (callback: (success: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, success: boolean) => callback(success);
    ipcRenderer.on('integration:complete', handler);
    return () => ipcRenderer.removeListener('integration:complete', handler);
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Remove a specific listener (safer than removeAllListeners)
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },

  // ============================================
  // Project Management
  // ============================================
  projectList: () => ipcRenderer.invoke('project:list'),
  projectGet: (projectId: string) => ipcRenderer.invoke('project:get', projectId),
  projectCreate: (projectInput: Record<string, unknown>) => ipcRenderer.invoke('project:create', projectInput),
  projectUpdate: (projectId: string, updates: Record<string, unknown>) => ipcRenderer.invoke('project:update', projectId, updates),
  projectDelete: (projectId: string) => ipcRenderer.invoke('project:delete', projectId),

  // ============================================
  // Task Management
  // ============================================
  taskCreate: (taskInput: Record<string, unknown>) => ipcRenderer.invoke('task:create', taskInput),
  taskUpdate: (projectId: string, taskId: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('task:update', projectId, taskId, updates),
  taskDelete: (projectId: string, taskId: string) => ipcRenderer.invoke('task:delete', projectId, taskId),
  taskStart: (projectId: string, taskId: string) => ipcRenderer.invoke('task:start', projectId, taskId),
  taskStop: (projectId: string, taskId: string) => ipcRenderer.invoke('task:stop', projectId, taskId),

  // Task event listeners (return cleanup function)
  onTaskOutput: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('task:output', handler);
    return () => ipcRenderer.removeListener('task:output', handler);
  },
  onTaskError: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('task:error', handler);
    return () => ipcRenderer.removeListener('task:error', handler);
  },
  onTaskComplete: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('task:complete', handler);
    return () => ipcRenderer.removeListener('task:complete', handler);
  },
  onTaskAutoStart: (callback: (data: { projectId: string; taskId: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { projectId: string; taskId: string }) => callback(data);
    ipcRenderer.on('task:auto-start', handler);
    return () => ipcRenderer.removeListener('task:auto-start', handler);
  },
  onTaskScheduled: (callback: (data: { taskId: string; projectId: string; scheduledAt: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { taskId: string; projectId: string; scheduledAt: string }) => callback(data);
    ipcRenderer.on('task:scheduled', handler);
    return () => ipcRenderer.removeListener('task:scheduled', handler);
  },
  onTaskScheduleCancelled: (callback: (data: { taskId: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { taskId: string }) => callback(data);
    ipcRenderer.on('task:schedule-cancelled', handler);
    return () => ipcRenderer.removeListener('task:schedule-cancelled', handler);
  },
  onTaskScheduleTriggered: (callback: (data: { taskId: string; projectId: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { taskId: string; projectId: string }) => callback(data);
    ipcRenderer.on('task:schedule-triggered', handler);
    return () => ipcRenderer.removeListener('task:schedule-triggered', handler);
  },
  onTaskScheduleError: (callback: (data: { taskId: string; projectId: string; error: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { taskId: string; projectId: string; error: string }) => callback(data);
    ipcRenderer.on('task:schedule-error', handler);
    return () => ipcRenderer.removeListener('task:schedule-error', handler);
  },
  onTaskProgress: (callback: (data: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on('task:progress', handler);
    return () => ipcRenderer.removeListener('task:progress', handler);
  },

  // ============================================
  // Schedule Management (Task-based)
  // ============================================
  scheduleList: () => ipcRenderer.invoke('schedule:list'),
  scheduleAdd: (projectId: string, taskId: string, scheduledAt: string) =>
    ipcRenderer.invoke('schedule:add', projectId, taskId, scheduledAt),
  scheduleCancel: (projectId: string, taskId: string) =>
    ipcRenderer.invoke('schedule:cancel', projectId, taskId),

  // Schedule event listeners (return cleanup function)
  onScheduleAdded: (callback: (data: { projectId: string; taskId: string; scheduledAt: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { projectId: string; taskId: string; scheduledAt: string }) => callback(data);
    ipcRenderer.on('schedule:added', handler);
    return () => ipcRenderer.removeListener('schedule:added', handler);
  },
  onScheduleStarted: (callback: (data: { projectId: string; taskId: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { projectId: string; taskId: string }) => callback(data);
    ipcRenderer.on('schedule:started', handler);
    return () => ipcRenderer.removeListener('schedule:started', handler);
  },
  onScheduleCancelled: (callback: (data: { projectId: string; taskId: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { projectId: string; taskId: string }) => callback(data);
    ipcRenderer.on('schedule:cancelled', handler);
    return () => ipcRenderer.removeListener('schedule:cancelled', handler);
  },

  // ============================================
  // Google Login (Pre-authentication)
  // ============================================
  // Web browser login
  googleLoginWebStart: () => ipcRenderer.invoke('google-login:web:start'),
  googleLoginWebStop: () => ipcRenderer.invoke('google-login:web:stop'),
  googleLoginWebGetStatus: () => ipcRenderer.invoke('google-login:web:get-status'),
  googleLoginWebVerifyStatus: () => ipcRenderer.invoke('google-login:web:verify-status'),
  googleLoginGetProfilePath: () => ipcRenderer.invoke('google-login:get-profile-path'),

  // Android device login
  googleLoginAndroidListDevices: () => ipcRenderer.invoke('google-login:android:list-devices'),
  googleLoginAndroidStart: (deviceId: string) => ipcRenderer.invoke('google-login:android:start', deviceId),
  googleLoginAndroidStop: () => ipcRenderer.invoke('google-login:android:stop'),
  googleLoginAndroidGetStatus: () => ipcRenderer.invoke('google-login:android:get-status'),

  // Clear login config
  googleLoginClear: (platform: 'web' | 'android' | 'all') => ipcRenderer.invoke('google-login:clear', platform),

  // Google login event listeners (return cleanup function)
  onGoogleLoginWebStatus: (callback: (status: string, message?: string) => void) => {
    const handler = (_event: IpcRendererEvent, status: string, message?: string) => callback(status, message);
    ipcRenderer.on('google-login:web:status', handler);
    return () => ipcRenderer.removeListener('google-login:web:status', handler);
  },
  onGoogleLoginAndroidStatus: (callback: (status: string, message?: string) => void) => {
    const handler = (_event: IpcRendererEvent, status: string, message?: string) => callback(status, message);
    ipcRenderer.on('google-login:android:status', handler);
    return () => ipcRenderer.removeListener('google-login:android:status', handler);
  },

  // ============================================
  // APK Installation
  // ============================================
  apkSelectFile: () => ipcRenderer.invoke('apk:selectFile'),
  playstoreParseUrl: (url: string) => ipcRenderer.invoke('playstore:parseUrl', url),
});

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
  fetchLiteLLMModels: () => ipcRenderer.invoke('model:fetchLiteLLMModels'),

  // Integration test
  runIntegrationTest: (config: Record<string, unknown>) => ipcRenderer.invoke('integration:test', config),
  stopIntegrationTest: () => ipcRenderer.invoke('integration:stop'),
  cleanupIntegrationTest: () => ipcRenderer.invoke('integration:cleanup'),

  // GitHub API
  fetchGitHubStars: (repo: string) => ipcRenderer.invoke('github:fetchStars', repo),

  // Event listeners
  onEnvProgress: (callback: (data: string) => void) => {
    ipcRenderer.on('env:progress', (_event: IpcRendererEvent, data: string) => callback(data));
  },
  onInstallProgress: (callback: (data: string) => void) => {
    ipcRenderer.on('install:progress', (_event: IpcRendererEvent, data: string) => callback(data));
  },
  onPythonProgress: (callback: (data: string) => void) => {
    ipcRenderer.on('python:progress', (_event: IpcRendererEvent, data: string) => callback(data));
  },
  onOllamaPullProgress: (callback: (data: string) => void) => {
    ipcRenderer.on('ollama:pull:progress', (_event: IpcRendererEvent, data: string) => callback(data));
  },
  onProjectOutput: (callback: (data: string) => void) => {
    ipcRenderer.on('project:output', (_event: IpcRendererEvent, data: string) => callback(data));
  },
  onProjectError: (callback: (data: string) => void) => {
    ipcRenderer.on('project:error', (_event: IpcRendererEvent, data: string) => callback(data));
  },
  onProjectExit: (callback: (code: number) => void) => {
    ipcRenderer.on('project:exit', (_event: IpcRendererEvent, code: number) => callback(code));
  },
  onIntegrationTestOutput: (callback: (data: string) => void) => {
    ipcRenderer.on('integration:output', (_event: IpcRendererEvent, data: string) => callback(data));
  },
  onIntegrationTestComplete: (callback: (success: boolean) => void) => {
    ipcRenderer.on('integration:complete', (_event: IpcRendererEvent, success: boolean) => callback(success));
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
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

  // Task event listeners
  onTaskOutput: (callback: (data: unknown) => void) => {
    ipcRenderer.on('task:output', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },
  onTaskError: (callback: (data: unknown) => void) => {
    ipcRenderer.on('task:error', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },
  onTaskComplete: (callback: (data: unknown) => void) => {
    ipcRenderer.on('task:complete', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },
  onTaskAutoStart: (callback: (data: { projectId: string; taskId: string }) => void) => {
    ipcRenderer.on('task:auto-start', (_event: IpcRendererEvent, data: { projectId: string; taskId: string }) => callback(data));
  },
  onTaskScheduled: (callback: (data: { taskId: string; projectId: string; scheduledAt: string }) => void) => {
    ipcRenderer.on('task:scheduled', (_event: IpcRendererEvent, data: { taskId: string; projectId: string; scheduledAt: string }) => callback(data));
  },
  onTaskScheduleCancelled: (callback: (data: { taskId: string }) => void) => {
    ipcRenderer.on('task:schedule-cancelled', (_event: IpcRendererEvent, data: { taskId: string }) => callback(data));
  },
  onTaskScheduleTriggered: (callback: (data: { taskId: string; projectId: string }) => void) => {
    ipcRenderer.on('task:schedule-triggered', (_event: IpcRendererEvent, data: { taskId: string; projectId: string }) => callback(data));
  },
  onTaskScheduleError: (callback: (data: { taskId: string; projectId: string; error: string }) => void) => {
    ipcRenderer.on('task:schedule-error', (_event: IpcRendererEvent, data: { taskId: string; projectId: string; error: string }) => callback(data));
  },
  onTaskProgress: (callback: (data: unknown) => void) => {
    ipcRenderer.on('task:progress', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },

  // ============================================
  // Schedule Management
  // ============================================
  scheduleList: () => ipcRenderer.invoke('schedule:list'),
  scheduleAdd: (projectId: string, taskId: string, scheduledAt: string, silent: boolean) => 
    ipcRenderer.invoke('schedule:add', projectId, taskId, scheduledAt, silent),
  scheduleCancel: (scheduleId: string) => ipcRenderer.invoke('schedule:cancel', scheduleId),

  // Schedule event listeners
  onScheduleAdded: (callback: (data: unknown) => void) => {
    ipcRenderer.on('schedule:added', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },
  onScheduleStarted: (callback: (data: unknown) => void) => {
    ipcRenderer.on('schedule:started', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },
  onScheduleCompleted: (callback: (data: unknown) => void) => {
    ipcRenderer.on('schedule:completed', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },
  onScheduleCancelled: (callback: (data: unknown) => void) => {
    ipcRenderer.on('schedule:cancelled', (_event: IpcRendererEvent, data: unknown) => callback(data));
  },

  // ============================================
  // Translation
  // ============================================
  translateText: (text: string, targetLang: string) => ipcRenderer.invoke('translator:translateText', text, targetLang),
  translateMarkdown: (markdown: string, targetLang: string) => ipcRenderer.invoke('translator:translateMarkdown', markdown, targetLang),

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

  // Google login event listeners
  onGoogleLoginWebStatus: (callback: (status: string, message?: string) => void) => {
    ipcRenderer.on('google-login:web:status', (_event: IpcRendererEvent, status: string, message?: string) => callback(status, message));
  },
  onGoogleLoginAndroidStatus: (callback: (status: string, message?: string) => void) => {
    ipcRenderer.on('google-login:android:status', (_event: IpcRendererEvent, status: string, message?: string) => callback(status, message));
  },

  // ============================================
  // APK Installation
  // ============================================
  apkSelectFile: () => ipcRenderer.invoke('apk:selectFile'),
  playstoreParseUrl: (url: string) => ipcRenderer.invoke('playstore:parseUrl', url),
});

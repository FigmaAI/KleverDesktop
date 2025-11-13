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

  // Ollama operations
  ollamaList: () => ipcRenderer.invoke('ollama:list'),
  ollamaPull: (modelName: string) => ipcRenderer.invoke('ollama:pull', modelName),

  // Config operations
  configLoad: () => ipcRenderer.invoke('config:load'),
  configSave: (config: Record<string, unknown>) => ipcRenderer.invoke('config:save', config),
  checkSetup: () => ipcRenderer.invoke('check:setup'),

  // Project operations
  projectStart: (projectConfig: Record<string, unknown>) => ipcRenderer.invoke('project:start', projectConfig),
  projectStop: () => ipcRenderer.invoke('project:stop'),

  // Shell operations
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // System info
  getSystemInfo: () => ipcRenderer.invoke('system:info'),

  // Model configuration and testing
  testModelConnection: (config: Record<string, unknown>) => ipcRenderer.invoke('model:testConnection', config),
  saveModelConfig: (config: Record<string, unknown>) => ipcRenderer.invoke('model:saveConfig', config),
  fetchApiModels: (config: Record<string, unknown>) => ipcRenderer.invoke('model:fetchApiModels', config),

  // Integration test
  runIntegrationTest: (config: Record<string, unknown>) => ipcRenderer.invoke('integration:test', config),
  stopIntegrationTest: () => ipcRenderer.invoke('integration:stop'),

  // Event listeners
  onEnvProgress: (callback: (data: string) => void) => {
    ipcRenderer.on('env:progress', (_event: IpcRendererEvent, data: string) => callback(data));
  },
  onInstallProgress: (callback: (data: string) => void) => {
    ipcRenderer.on('install:progress', (_event: IpcRendererEvent, data: string) => callback(data));
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
});

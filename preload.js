const { contextBridge, ipcRenderer } = require('electron');

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
  ollamaPull: (modelName) => ipcRenderer.invoke('ollama:pull', modelName),

  // Config operations
  configLoad: () => ipcRenderer.invoke('config:load'),
  configSave: (config) => ipcRenderer.invoke('config:save', config),
  checkSetup: () => ipcRenderer.invoke('check:setup'),

  // Project operations
  projectStart: (projectConfig) => ipcRenderer.invoke('project:start', projectConfig),
  projectStop: () => ipcRenderer.invoke('project:stop'),

  // Shell operations
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // System info
  getSystemInfo: () => ipcRenderer.invoke('system:info'),

  // Model configuration and testing
  testModelConnection: (config) => ipcRenderer.invoke('model:testConnection', config),
  saveModelConfig: (config) => ipcRenderer.invoke('model:saveConfig', config),
  fetchApiModels: (config) => ipcRenderer.invoke('model:fetchApiModels', config),

  // Integration test
  runIntegrationTest: (config) => ipcRenderer.invoke('integration:test', config),
  stopIntegrationTest: () => ipcRenderer.invoke('integration:stop'),

  // Event listeners
  onEnvProgress: (callback) => {
    ipcRenderer.on('env:progress', (event, data) => callback(data));
  },
  onInstallProgress: (callback) => {
    ipcRenderer.on('install:progress', (event, data) => callback(data));
  },
  onOllamaPullProgress: (callback) => {
    ipcRenderer.on('ollama:pull:progress', (event, data) => callback(data));
  },
  onProjectOutput: (callback) => {
    ipcRenderer.on('project:output', (event, data) => callback(data));
  },
  onProjectError: (callback) => {
    ipcRenderer.on('project:error', (event, data) => callback(data));
  },
  onProjectExit: (callback) => {
    ipcRenderer.on('project:exit', (event, code) => callback(code));
  },
  onIntegrationTestOutput: (callback) => {
    ipcRenderer.on('integration:output', (event, data) => callback(data));
  },
  onIntegrationTestComplete: (callback) => {
    ipcRenderer.on('integration:complete', (event, success) => callback(success));
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // ============================================
  // Project Management
  // ============================================
  projectList: () => ipcRenderer.invoke('project:list'),
  projectGet: (projectId) => ipcRenderer.invoke('project:get', projectId),
  projectCreate: (projectInput) => ipcRenderer.invoke('project:create', projectInput),
  projectUpdate: (projectId, updates) => ipcRenderer.invoke('project:update', projectId, updates),
  projectDelete: (projectId) => ipcRenderer.invoke('project:delete', projectId),

  // ============================================
  // Task Management
  // ============================================
  taskCreate: (taskInput) => ipcRenderer.invoke('task:create', taskInput),
  taskUpdate: (projectId, taskId, updates) => ipcRenderer.invoke('task:update', projectId, taskId, updates),
  taskDelete: (projectId, taskId) => ipcRenderer.invoke('task:delete', projectId, taskId),
  taskStart: (projectId, taskId) => ipcRenderer.invoke('task:start', projectId, taskId),
  taskStop: (projectId, taskId) => ipcRenderer.invoke('task:stop', projectId, taskId),

  // Task event listeners
  onTaskOutput: (callback) => {
    ipcRenderer.on('task:output', (event, data) => callback(data));
  },
  onTaskError: (callback) => {
    ipcRenderer.on('task:error', (event, data) => callback(data));
  },
  onTaskComplete: (callback) => {
    ipcRenderer.on('task:complete', (event, data) => callback(data));
  },
});

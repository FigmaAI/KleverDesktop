const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Environment checks
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
  runIntegrationTest: () => ipcRenderer.invoke('integration:test'),

  // Event listeners
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
});

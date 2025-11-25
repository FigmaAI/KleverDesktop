export {};

import type { Project, ProjectCreateInput, Task, TaskCreateInput } from './project';

interface OllamaModel {
  name: string;
  size?: number;
  modified?: string;
}

interface AppConfig {
  version: string;
  model: {
    enableLocal: boolean;
    enableApi: boolean;
    api: {
      provider?: string;
      baseUrl: string;
      key: string;
      model: string;
    };
    local: {
      baseUrl: string;
      model: string;
    };
  };
  execution: {
    maxTokens: number;
    temperature: number;
    requestInterval: number;
    maxRounds: number;
  };
  android: {
    screenshotDir: string;
    xmlDir: string;
    sdkPath: string;
  };
  web: {
    browserType: 'chromium' | 'firefox' | 'webkit';
    headless: boolean;
    viewportWidth: number;
    viewportHeight: number;
  };
  image: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    optimize: boolean;
  };
  preferences: {
    darkMode: boolean;
    minDist: number;
    docRefine: boolean;
  };
}

declare global {
  interface Window {
    electronAPI: {
      // NEW: Unified Environment Setup
      envCheck: () => Promise<{
        success: boolean;
        bundledPython?: {
          path: string;
          exists: boolean;
          version?: string;
          isBundled?: boolean;
        };
        venv?: {
          exists: boolean;
          valid: boolean;
          path: string;
          pythonExecutable: string;
        };
        playwright?: {
          installed: boolean;
        };
        appagent?: {
          path?: string;
          exists?: boolean;
        };
        error?: string;
      }>;
      envSetup: () => Promise<{ success: boolean; error?: string }>;
      envReset: () => Promise<{ success: boolean; error?: string }>;

      // Python Runtime Management (Post-Install Download)
      pythonCheckInstalled: () => Promise<{
        success: boolean;
        installed: boolean;
        path: string;
        error?: string;
      }>;
      pythonGetInstallPath: () => Promise<{
        success: boolean;
        path: string;
        error?: string;
      }>;
      pythonDownload: () => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;

      // LEGACY: Environment checks (kept for backward compatibility)
      checkPython: () => Promise<{ success: boolean; version?: string; isValid?: boolean; error?: string; bundled?: boolean }>;
      checkPackages: () => Promise<{ success: boolean; output?: string; error?: string }>;
      installPackages: () => Promise<{ success: boolean; output?: string }>;
      installPlaywright: () => Promise<{ success: boolean; output?: string; error?: string }>;
      installAndroidStudio: () => Promise<{ success: boolean; output?: string; error?: string }>;
      installPython: () => Promise<{ success: boolean; output?: string; error?: string }>;
      checkHomebrew: () => Promise<{ success: boolean; version?: string; error?: string }>;
      checkChocolatey: () => Promise<{ success: boolean; version?: string; error?: string }>;
      checkOllama: () => Promise<{ success: boolean; running?: boolean; models?: OllamaModel[]; error?: string }>;
      checkAndroidStudio: () => Promise<{ success: boolean; version?: string; path?: string; method?: string; error?: string }>;
      checkPlaywright: () => Promise<{ success: boolean; output?: string; error?: string }>;

      // Ollama operations
      ollamaList: () => Promise<{ success: boolean; models?: string[]; error?: string }>;
      ollamaPull: (modelName: string) => Promise<{ success: boolean }>;

      // Config operations
      configLoad: () => Promise<{ success: boolean; config?: AppConfig; error?: string }>;
      configSave: (config: AppConfig) => Promise<{ success: boolean; error?: string }>;
      configReset: () => Promise<{ success: boolean; error?: string }>;
      configHardReset: () => Promise<{ success: boolean; error?: string }>;
      appRestart: () => Promise<{ success: boolean; error?: string }>;
      checkSetup: () => Promise<{ success: boolean; setupComplete: boolean }>;

      // Project operations
      projectStart: (projectConfig: {
        platform: 'android' | 'web';
        name: string;
        url?: string;
        device?: string;
      }) => Promise<{ success: boolean; pid?: number; error?: string }>;
      projectStop: () => Promise<{ success: boolean; error?: string }>;

      // Shell operations
      openExternal: (url: string) => Promise<{ success: boolean }>;
      openPath: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      showFolderSelectDialog: () => Promise<string | null>;

      // Clipboard operations
      clipboardWriteText: (text: string) => Promise<{ success: boolean; error?: string }>;


      // File operations
      fileRead: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      fileExists: (filePath: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>;
      fileReadImage: (filePath: string, baseDir?: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;

      // System info
      getSystemInfo: () => Promise<{
        platform: string;
        arch: string;
        cpus: number;
        totalMemory: number;
        freeMemory: number;
      }>;

      // Model configuration and testing
      testModelConnection: (config: {
        enableLocal: boolean;
        enableApi: boolean;
        apiBaseUrl: string;
        apiKey: string;
        apiModel: string;
        localBaseUrl: string;
        localModel: string;
      }) => Promise<{ success: boolean; message?: string }>;
      saveModelConfig: (config: {
        enableLocal: boolean;
        enableApi: boolean;
        apiBaseUrl: string;
        apiKey: string;
        apiModel: string;
        localBaseUrl: string;
        localModel: string;
      }) => Promise<{ success: boolean; error?: string }>;
      fetchApiModels: (config: {
        apiBaseUrl: string;
        apiKey: string;
      }) => Promise<{
        success: boolean;
        provider?: string;
        models?: string[];
        error?: string
      }>;
      fetchLiteLLMModels: () => Promise<{
        success: boolean;
        providers?: Array<{
          id: string;
          name: string;
          requiresBaseUrl: boolean;
          defaultBaseUrl?: string;
          apiKeyUrl: string;
          models: Array<{
            id: string;
            name: string;
            maxInputTokens?: number;
            maxOutputTokens?: number;
            supportsVision?: boolean;
          }>;
          description?: string;
        }>;
        error?: string;
      }>;

      // Integration test
      runIntegrationTest: (config: {
        enableLocal: boolean;
        enableApi: boolean;
        apiBaseUrl: string;
        apiKey: string;
        apiModel: string;
        localBaseUrl: string;
        localModel: string;
      }) => Promise<{ success: boolean }>;
      stopIntegrationTest: () => Promise<{ success: boolean; error?: string }>;
      cleanupIntegrationTest: () => Promise<{ success: boolean; error?: string }>;

      // GitHub API
      fetchGitHubStars: (repo: string) => Promise<{ success: boolean; stars?: number; error?: string }>;

      // Event listeners
      onEnvProgress: (callback: (data: string) => void) => void;
      onInstallProgress: (callback: (data: string) => void) => void;
      onPythonProgress: (callback: (data: string) => void) => void;
      onOllamaPullProgress: (callback: (data: string) => void) => void;
      onProjectOutput: (callback: (data: string) => void) => void;
      onProjectError: (callback: (data: string) => void) => void;
      onProjectExit: (callback: (code: number) => void) => void;
      onIntegrationTestOutput: (callback: (data: string) => void) => void;
      onIntegrationTestComplete: (callback: (success: boolean) => void) => void;

      // Remove listeners
      removeAllListeners: (channel: string) => void;

      // ============================================
      // Project Management
      // ============================================
      projectList: () => Promise<{ success: boolean; projects?: Project[]; error?: string }>;
      projectGet: (projectId: string) => Promise<{ success: boolean; project?: Project; error?: string }>;
      projectCreate: (projectInput: ProjectCreateInput) => Promise<{ success: boolean; project?: Project; error?: string; message?: string }>;
      openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      projectUpdate: (projectId: string, updates: Partial<Project>) => Promise<{ success: boolean; project?: Project; error?: string }>;
      projectDelete: (projectId: string) => Promise<{ success: boolean; error?: string }>;

      // ============================================
      // Task Management
      // ============================================
      taskCreate: (taskInput: TaskCreateInput) => Promise<{ success: boolean; task?: Task; error?: string }>;
      taskUpdate: (projectId: string, taskId: string, updates: Partial<Task>) => Promise<{ success: boolean; task?: Task; error?: string }>;
      taskDelete: (projectId: string, taskId: string) => Promise<{ success: boolean; error?: string }>;
      taskStart: (projectId: string, taskId: string) => Promise<{ success: boolean; pid?: number; error?: string }>;
      taskStop: (projectId: string, taskId: string) => Promise<{ success: boolean; error?: string }>;

      // Task event listeners
      onTaskOutput: (callback: (data: { projectId: string; taskId: string; output: string }) => void) => void;
      onTaskError: (callback: (data: { projectId: string; taskId: string; error: string }) => void) => void;
      onTaskComplete: (callback: (data: { projectId: string; taskId: string; code: number }) => void) => void;
    };
  }
}

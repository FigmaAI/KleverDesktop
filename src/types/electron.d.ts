export { };

import type { Project, ProjectCreateInput, Task, TaskCreateInput, TaskMetrics } from './project';

interface OllamaModel {
  name: string;
  size?: number;
  modified?: string;
}

/**
 * Provider configuration for multi-provider model settings
 */
interface ProviderConfig {
  id: string;              // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  apiKey: string;          // API key (empty for Ollama)
  preferredModel: string;  // Preferred model for this provider
  baseUrl?: string;        // Base URL (required for Ollama)
}

/**
 * Last used model selection
 */
interface LastUsedModel {
  provider: string;
  model: string;
}

/**
 * Google login configuration
 */
interface GoogleLoginConfig {
  web?: {
    enabled: boolean;
    profilePath: string;
    lastLoginAt?: string;
  };
  android?: {
    enabled: boolean;
    deviceId?: string;
    lastLoginAt?: string;
  };
}

/**
 * Multi-provider AppConfig
 * Supports multiple registered providers with individual API keys
 */
interface AppConfig {
  version: string;
  model: {
    providers: ProviderConfig[];  // Registered providers with API keys
    lastUsed?: LastUsedModel;     // Last used provider/model for task creation
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
    browserType:
    | 'chromium'        // Playwright's isolated Chromium (default)
    | 'chrome'          // Google Chrome
    | 'chrome-beta' | 'chrome-dev' | 'chrome-canary'
    | 'msedge'          // Microsoft Edge
    | 'msedge-beta' | 'msedge-dev' | 'msedge-canary'
    | 'firefox'         // Mozilla Firefox
    | 'webkit';         // WebKit (Safari engine)
    headless: boolean;
  };
  image?: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
    optimize: boolean;
  };
  preferences: {
    darkMode: boolean;
    minDist: number;
    docRefine: boolean;
    systemLanguage?: 'en' | 'ko' | 'zh';
  };
  googleLogin?: GoogleLoginConfig;
}

/**
 * ModelConfig for IPC calls (single provider selection)
 */
interface ModelConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
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
          error?: string;
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
      checkOllama: () => Promise<{ success: boolean; installed?: boolean; running?: boolean; version?: string; models?: OllamaModel[]; error?: string }>;
      checkAndroidStudio: () => Promise<{ success: boolean; version?: string; path?: string; method?: string; error?: string }>;
      checkPlaywright: () => Promise<{ success: boolean; output?: string; error?: string }>;

      // Ollama operations
      ollamaCheck: () => Promise<{ installed: boolean; path: string | null; version?: string; error?: string }>;
      ollamaList: () => Promise<{ success: boolean; models?: string[]; error?: string }>;
      ollamaPull: (modelName: string) => Promise<{ success: boolean }>;

      // Config operations
      configLoad: () => Promise<{ success: boolean; config?: AppConfig; error?: string }>;
      configSave: (config: AppConfig) => Promise<{ success: boolean; error?: string }>;
      configReset: () => Promise<{ success: boolean; error?: string }>;
      configHardReset: () => Promise<{ success: boolean; error?: string }>;
      configUpdateLastUsed: (lastUsed: LastUsedModel) => Promise<{ success: boolean; error?: string }>;
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

      // Model configuration and testing (unified format)
      testModelConnection: (config: ModelConfig) => Promise<{ success: boolean; message?: string }>;
      saveModelConfig: (config: ModelConfig) => Promise<{ success: boolean; error?: string }>;
      fetchApiModels: (config: {
        apiBaseUrl: string;
        apiKey: string;
      }) => Promise<{
        success: boolean;
        provider?: string;
        models?: string[];
        error?: string
      }>;
      fetchLiteLLMModels: (forceRefresh?: boolean) => Promise<{
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
        source?: 'network' | 'cache' | 'bundled';
      }>;

      // Integration test (unified format)
      runIntegrationTest: (config: ModelConfig) => Promise<{ success: boolean }>;
      stopIntegrationTest: () => Promise<{ success: boolean; error?: string }>;
      cleanupIntegrationTest: () => Promise<{ success: boolean; error?: string }>;

      // GitHub API
      fetchGitHubStars: (repo: string) => Promise<{ success: boolean; stars?: number; error?: string }>;

      // Event listeners (return cleanup function)
      onEnvProgress: (callback: (data: string) => void) => () => void;
      onInstallProgress: (callback: (data: string) => void) => () => void;
      onPythonProgress: (callback: (data: string) => void) => () => void;
      onOllamaPullProgress: (callback: (data: string) => void) => () => void;
      onProjectOutput: (callback: (data: string) => void) => () => void;
      onProjectError: (callback: (data: string) => void) => () => void;
      onProjectExit: (callback: (code: number) => void) => () => void;
      onIntegrationTestOutput: (callback: (data: string) => void) => () => void;
      onIntegrationTestComplete: (callback: (success: boolean) => void) => () => void;

      // Remove listeners
      removeAllListeners: (channel: string) => void;
      removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;

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

      // Task event listeners (return cleanup function)
      onTaskOutput: (callback: (data: { projectId: string; taskId: string; output: string }) => void) => () => void;
      onTaskError: (callback: (data: { projectId: string; taskId: string; error: string }) => void) => () => void;
      onTaskComplete: (callback: (data: { projectId: string; taskId: string; code: number }) => void) => () => void;
      onTaskAutoStart: (callback: (data: { projectId: string; taskId: string }) => void) => () => void;
      onTaskScheduled: (callback: (data: { taskId: string; projectId: string; scheduledAt: string }) => void) => () => void;
      onTaskScheduleCancelled: (callback: (data: { taskId: string }) => void) => () => void;
      onTaskScheduleTriggered: (callback: (data: { taskId: string; projectId: string }) => void) => () => void;
      onTaskScheduleError: (callback: (data: { taskId: string; projectId: string; error: string }) => void) => () => void;
      onTaskProgress: (callback: (data: { projectId: string; taskId: string; metrics: TaskMetrics }) => void) => () => void;

      // ============================================
      // Schedule Management (Task-based)
      // ============================================
      scheduleList: () => Promise<{ success: boolean; scheduledTasks?: { projectId: string; projectName: string; task: Task }[]; error?: string }>;
      scheduleAdd: (projectId: string, taskId: string, scheduledAt: string) => Promise<{ success: boolean; error?: string }>;
      scheduleCancel: (projectId: string, taskId: string) => Promise<{ success: boolean; error?: string }>;

      // Schedule event listeners (return cleanup function)
      onScheduleAdded: (callback: (data: { projectId: string; taskId: string; scheduledAt: string }) => void) => () => void;
      onScheduleStarted: (callback: (data: { projectId: string; taskId: string }) => void) => () => void;
      onScheduleCancelled: (callback: (data: { projectId: string; taskId: string }) => void) => () => void;

      // ============================================
      // Google Login (Pre-authentication)
      // ============================================
      // Web browser login
      googleLoginWebStart: () => Promise<{ success: boolean; error?: string }>;
      googleLoginWebStop: () => Promise<{ success: boolean; error?: string }>;
      googleLoginWebGetStatus: () => Promise<{
        success: boolean;
        loggedIn: boolean;
        lastLoginAt?: string;
        profilePath?: string;
        error?: string;
      }>;
      googleLoginWebVerifyStatus: () => Promise<{
        success: boolean;
        loggedIn: boolean;
        verified: boolean;
        lastLoginAt?: string;
        profilePath?: string;
        error?: string;
      }>;
      googleLoginGetProfilePath: () => Promise<{ success: boolean; path: string }>;

      // Android device login
      googleLoginAndroidListDevices: () => Promise<{
        success: boolean;
        devices: string[];
        error?: string;
      }>;
      googleLoginAndroidStart: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
      googleLoginAndroidStop: () => Promise<{ success: boolean; error?: string }>;
      googleLoginAndroidGetStatus: () => Promise<{
        success: boolean;
        loggedIn: boolean;
        deviceId?: string;
        lastLoginAt?: string;
        error?: string;
      }>;

      // Clear login config
      googleLoginClear: (platform: 'web' | 'android' | 'all') => Promise<{ success: boolean; error?: string }>;

      // Google login event listeners
      onGoogleLoginWebStatus: (callback: (status: string, message?: string) => void) => () => void;
      onGoogleLoginAndroidStatus: (callback: (status: string, message?: string) => void) => () => void;

      // ============================================
      // APK Installation
      // ============================================
      apkSelectFile: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
      playstoreParseUrl: (url: string) => Promise<{ success: boolean; packageName?: string; error?: string }>;
    };
  }
}

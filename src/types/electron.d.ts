export {};

interface OllamaModel {
  name: string;
  size?: number;
  modified?: string;
}

interface AppConfig {
  modelProvider?: 'ollama' | 'api';
  ollamaModel?: string;
  apiKey?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    electronAPI: {
      // Environment checks
      checkPython: () => Promise<{ success: boolean; version?: string; isValid?: boolean; error?: string }>;
      checkPackages: () => Promise<{ success: boolean; output?: string; error?: string }>;
      installPackages: () => Promise<{ success: boolean; output?: string }>;
      checkOllama: () => Promise<{ success: boolean; running?: boolean; models?: OllamaModel[]; error?: string }>;
      checkAdb: () => Promise<{ success: boolean; devices?: string[]; error?: string }>;
      checkPlaywright: () => Promise<{ success: boolean; output?: string; error?: string }>;

      // Ollama operations
      ollamaList: () => Promise<{ success: boolean; models?: string[]; error?: string }>;
      ollamaPull: (modelName: string) => Promise<{ success: boolean }>;

      // Config operations
      configLoad: () => Promise<{ success: boolean; config?: AppConfig; error?: string }>;
      configSave: (config: AppConfig) => Promise<{ success: boolean; error?: string }>;

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
        modelType: 'local' | 'api';
        apiBaseUrl: string;
        apiKey: string;
        apiModel: string;
        localBaseUrl: string;
        localModel: string;
      }) => Promise<{ success: boolean; message?: string }>;
      saveModelConfig: (config: {
        modelType: 'local' | 'api';
        apiBaseUrl: string;
        apiKey: string;
        apiModel: string;
        localBaseUrl: string;
        localModel: string;
      }) => Promise<{ success: boolean; error?: string }>;

      // Integration test
      runIntegrationTest: () => Promise<{ success: boolean }>;

      // Event listeners
      onInstallProgress: (callback: (data: string) => void) => void;
      onOllamaPullProgress: (callback: (data: string) => void) => void;
      onProjectOutput: (callback: (data: string) => void) => void;
      onProjectError: (callback: (data: string) => void) => void;
      onProjectExit: (callback: (code: number) => void) => void;
      onIntegrationTestOutput: (callback: (data: string) => void) => void;
      onIntegrationTestComplete: (callback: (success: boolean) => void) => void;

      // Remove listeners
      removeAllListeners: (channel: string) => void;
    };
  }
}

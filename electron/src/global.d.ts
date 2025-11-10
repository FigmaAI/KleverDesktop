export {};

declare global {
  interface Window {
    electronAPI: {
      // Environment checks
      checkPython: () => Promise<{ success: boolean; version?: string; isValid?: boolean; error?: string }>;
      checkPackages: () => Promise<{ success: boolean; output?: string; error?: string }>;
      installPackages: () => Promise<{ success: boolean; output?: string }>;
      checkOllama: () => Promise<{ success: boolean; running?: boolean; models?: any[]; error?: string }>;
      checkAdb: () => Promise<{ success: boolean; devices?: string[]; error?: string }>;
      checkPlaywright: () => Promise<{ success: boolean; output?: string; error?: string }>;

      // Ollama operations
      ollamaList: () => Promise<{ success: boolean; models?: string[]; error?: string }>;
      ollamaPull: (modelName: string) => Promise<{ success: boolean }>;

      // Config operations
      configLoad: () => Promise<{ success: boolean; config?: any; error?: string }>;
      configSave: (config: any) => Promise<{ success: boolean; error?: string }>;

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

      // Event listeners
      onInstallProgress: (callback: (data: string) => void) => void;
      onOllamaPullProgress: (callback: (data: string) => void) => void;
      onProjectOutput: (callback: (data: string) => void) => void;
      onProjectError: (callback: (data: string) => void) => void;
      onProjectExit: (callback: (code: number) => void) => void;

      // Remove listeners
      removeAllListeners: (channel: string) => void;
    };
  }
}

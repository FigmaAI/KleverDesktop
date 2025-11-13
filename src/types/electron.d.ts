export {};

import type { Project, ProjectCreateInput, Task, TaskCreateInput } from './project';

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
      // NEW: Unified Environment Setup
      envCheck: () => Promise<{
        success: boolean;
        bundledPython?: {
          path: string;
          exists: boolean;
        };
        venv?: {
          exists: boolean;
          valid: boolean;
          path: string;
          pythonExecutable: string;
        };
        error?: string;
      }>;
      envSetup: () => Promise<{ success: boolean; error?: string }>;

      // LEGACY: Environment checks (kept for backward compatibility)
      checkPython: () => Promise<{ success: boolean; version?: string; isValid?: boolean; error?: string; bundled?: boolean }>;
      checkPackages: () => Promise<{ success: boolean; output?: string; error?: string }>;
      installPackages: () => Promise<{ success: boolean; output?: string }>;
      installPlaywright: () => Promise<{ success: boolean; output?: string; error?: string }>;
      installAndroidStudio: () => Promise<{ success: boolean; output?: string; error?: string }>;
      installPython: () => Promise<{ success: boolean; output?: string; error?: string }>;
      checkHomebrew: () => Promise<{ success: boolean; version?: string; error?: string }>;
      checkOllama: () => Promise<{ success: boolean; running?: boolean; models?: OllamaModel[]; error?: string }>;
      checkAndroidStudio: () => Promise<{ success: boolean; version?: string; error?: string }>;
      checkPlaywright: () => Promise<{ success: boolean; output?: string; error?: string }>;

      // Ollama operations
      ollamaList: () => Promise<{ success: boolean; models?: string[]; error?: string }>;
      ollamaPull: (modelName: string) => Promise<{ success: boolean }>;

      // Config operations
      configLoad: () => Promise<{ success: boolean; config?: AppConfig; error?: string }>;
      configSave: (config: AppConfig) => Promise<{ success: boolean; error?: string }>;
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

      // Event listeners
      onEnvProgress: (callback: (data: string) => void) => void;
      onInstallProgress: (callback: (data: string) => void) => void;
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
      projectCreate: (projectInput: ProjectCreateInput) => Promise<{ success: boolean; project?: Project; error?: string }>;
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

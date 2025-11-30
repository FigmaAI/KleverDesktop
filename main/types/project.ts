/**
 * Project and Task type definitions
 */

export type PlatformType = 'android' | 'web';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ApkSourceType = 'apk_file' | 'play_store_url';

export interface ApkSource {
  type: ApkSourceType;
  path?: string;        // APK file path (for apk_file type)
  url?: string;         // Play Store URL (for play_store_url type)
  packageName?: string; // Extracted or detected package name
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  goal: string; // Task goal/objective (passed as --task_desc CLI parameter)
  status: TaskStatus;
  // Model selection for this task
  modelProvider?: string; // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  modelName?: string; // Full model identifier (e.g., "ollama/llama3.2-vision", "gpt-4o")
  // Legacy fields (deprecated)
  model?: string; // [DEPRECATED] No longer used
  language?: string; // Output language preference (e.g., 'en', 'ko', 'ja')
  output?: string;
  resultPath?: string; // Task result directory path (e.g., {workspaceDir}/apps/{app}/demos/self_explore_{timestamp})
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  url?: string; // Web platform only - passed as --url CLI parameter
  apkSource?: ApkSource; // Android only: APK file path or Play Store URL
}

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  platform: PlatformType;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  tasks: Task[];
  workspaceDir: string;
  lastApkSource?: ApkSource; // Last used APK source for this project (Android only)
}

export interface ProjectsData {
  projects: Project[];
}

export interface CreateProjectInput {
  name: string;
  platform: PlatformType;
  workspaceDir?: string;
}

export interface UpdateProjectInput {
  name?: string;
  platform?: PlatformType;
  status?: ProjectStatus;
}

export interface CreateTaskInput {
  projectId: string;
  name: string;
  description?: string;
  goal: string;
  modelProvider?: string; // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  modelName?: string; // Full model identifier (e.g., "ollama/llama3.2-vision", "gpt-4o")
  language?: string; // Output language preference (e.g., 'en', 'ko', 'ja')
  url?: string; // Web platform only
  apkSource?: ApkSource; // Android only: APK file path or Play Store URL
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  goal?: string;
  status?: TaskStatus;
}

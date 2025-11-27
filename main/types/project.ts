/**
 * Project and Task type definitions
 */

export type PlatformType = 'android' | 'web';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  goal: string; // Task goal/objective (passed as --task_desc CLI parameter)
  status: TaskStatus;
  // Model override (optional) - if not specified, uses config.json defaults
  // modelName contains full model identifier (e.g., "ollama/llama3.2-vision", "gpt-4o")
  modelName?: string; // Passed as --model_name CLI parameter
  // Legacy fields (deprecated)
  modelProvider?: string; // [DEPRECATED] No longer used
  model?: string; // [DEPRECATED] No longer used
  output?: string;
  resultPath?: string; // Task result directory path (e.g., {workspaceDir}/apps/{app}/demos/self_explore_{timestamp})
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  url?: string; // Web platform only - passed as --url CLI parameter
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
  modelName?: string; // Full model identifier (e.g., "ollama/llama3.2-vision", "gpt-4o")
  url?: string;
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  goal?: string;
  status?: TaskStatus;
}

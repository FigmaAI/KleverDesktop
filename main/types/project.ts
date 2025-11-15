/**
 * Project and Task type definitions
 */

export type PlatformType = 'android' | 'web';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  goal: string; // Task goal/objective (passed as --task_desc CLI parameter)
  status: TaskStatus;
  // Model override (optional) - if not specified, uses config.json defaults
  modelProvider?: 'api' | 'local'; // Passed as --model CLI parameter
  modelName?: string; // Passed as --model_name CLI parameter (e.g., "gpt-4o", "qwen3-vl:4b")
  // Legacy field (deprecated, use modelProvider + modelName instead)
  model?: string;
  output?: string;
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
  modelProvider?: 'api' | 'local';
  modelName?: string;
  url?: string;
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  goal?: string;
  status?: TaskStatus;
}

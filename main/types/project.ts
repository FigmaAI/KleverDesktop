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
  goal: string;
  status: TaskStatus;
  output?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  platform: PlatformType;
  device?: string;       // For android: device ID, for web: not used
  url?: string;          // For web: target URL, for android: optional
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
  device?: string;
  url?: string;
}

export interface UpdateProjectInput {
  name?: string;
  platform?: PlatformType;
  device?: string;
  url?: string;
  status?: ProjectStatus;
}

export interface CreateTaskInput {
  projectId: string;
  name: string;
  description?: string;
  goal: string;
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  goal?: string;
  status?: TaskStatus;
}

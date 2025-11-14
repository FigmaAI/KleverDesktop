export type Platform = 'android' | 'web'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Task {
  id: string
  name: string
  description?: string
  goal: string // Task goal/objective (used as TASK_DESCRIPTION env var)
  status: TaskStatus
  model?: string // Model used for this task (e.g., "qwen3-vl:4b", "gpt-4o")
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  startedAt?: string
  completedAt?: string
  output?: string
  error?: string
  url?: string
  device?: string
}

export type ProjectStatus = 'active' | 'archived'

export interface Project {
  id: string
  name: string
  platform: Platform
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  tasks: Task[]
  workspaceDir: string // Path to project workspace directory
}

export interface ProjectCreateInput {
  name: string
  platform: Platform
  workspaceDir?: string
}

export interface TaskCreateInput {
  projectId: string
  name: string
  description?: string
  goal: string
  model?: string
  url?: string
  device?: string
}

export interface TaskStartInput {
  projectId: string
  taskId: string
}

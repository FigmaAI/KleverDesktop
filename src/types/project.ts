export type Platform = 'android' | 'web'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Task {
  id: string
  name: string
  description?: string
  goal: string // Task goal/objective (passed as --task_desc CLI parameter)
  status: TaskStatus
  // Model override (optional) - if not specified, uses config.json defaults
  modelProvider?: 'api' | 'local' // Passed as --model CLI parameter
  modelName?: string // Passed as --model_name CLI parameter (e.g., "gpt-4o", "qwen3-vl:4b")
  // Legacy field (deprecated, use modelProvider + modelName instead)
  model?: string
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  startedAt?: string
  completedAt?: string
  output?: string
  error?: string
  resultPath?: string // Task result directory path
  url?: string // Web platform only - passed as --url CLI parameter
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
  modelProvider?: 'api' | 'local'
  modelName?: string
  url?: string
}

export interface TaskStartInput {
  projectId: string
  taskId: string
}

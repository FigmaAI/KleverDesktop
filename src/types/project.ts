export type Platform = 'android' | 'web'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Task {
  id: string
  name: string
  description: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  resultPath?: string
  output?: string
  error?: string
}

export type ProjectStatus = 'active' | 'archived'

export interface Project {
  id: string
  name: string
  platform: Platform
  device?: string // For Android: device ID or emulator name
  url?: string // For Web: website URL
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  tasks: Task[]
  workspaceDir: string // Path to project workspace directory
}

export interface ProjectCreateInput {
  name: string
  platform: Platform
  device?: string
  url?: string
}

export interface TaskCreateInput {
  projectId: string
  name: string
  description: string
}

export interface TaskStartInput {
  projectId: string
  taskId: string
}

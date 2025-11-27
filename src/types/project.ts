export type Platform = 'android' | 'web'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface TaskMetrics {
  rounds?: number
  maxRounds?: number
  // API model metrics
  tokens?: number
  estimatedCost?: number
  // Local model metrics
  cpuUsage?: number
  memoryUsage?: number
}

export interface Task {
  id: string
  name: string
  description?: string
  goal: string // Task goal/objective (passed as --task_desc CLI parameter)
  status: TaskStatus
  // Model override (optional) - if not specified, uses config.json defaults
  modelProvider?: string // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  modelName?: string // Model name for LiteLLM (e.g., "ollama/llama3.2-vision", "gpt-4o")
  // Legacy field (deprecated, use modelProvider + modelName instead)
  model?: string
  language?: string // Output language preference (e.g., 'en', 'ko', 'ja')
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  startedAt?: string
  completedAt?: string
  output?: string
  error?: string
  resultPath?: string // Task result directory path
  url?: string // Web platform only - passed as --url CLI parameter
  metrics?: TaskMetrics // Task execution metrics
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
  modelProvider?: string  // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  modelName?: string      // Model name for LiteLLM
  language?: string       // Output language preference (e.g., 'en', 'ko', 'ja')
  url?: string
}

export interface TaskStartInput {
  projectId: string
  taskId: string
}

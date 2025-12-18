export type Platform = 'android' | 'web'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type ApkSourceType = 'apk_file' | 'play_store_url'

export interface ApkSource {
  type: ApkSourceType
  path?: string        // APK file path (for apk_file type)
  url?: string         // Play Store URL (for play_store_url type)
  packageName?: string // Extracted or detected package name
}

export interface TaskMetrics {
  rounds?: number
  maxRounds?: number
  // API model metrics - ENHANCED
  tokens?: number              // Total tokens (backward compatible)
  inputTokens?: number         // Input tokens count
  outputTokens?: number        // Output tokens count
  estimatedCost?: number       // Estimated cost in dollars
  // Execution time metrics
  startTime?: number           // Unix timestamp (ms)
  endTime?: number             // Unix timestamp (ms)
  durationMs?: number          // Execution duration in milliseconds
  tokensPerSecond?: number     // Inference speed (for local models)
  // Local model metrics
  cpuUsage?: number
  memoryUsage?: number
  isLocalModel?: boolean       // Flag for local vs API model
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
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  startedAt?: string
  completedAt?: string
  output?: string
  error?: string
  resultPath?: string // Task result directory path
  url?: string // Web platform only - passed as --url CLI parameter
  apkSource?: ApkSource // Android only: APK file path or Play Store URL
  metrics?: TaskMetrics // Task execution metrics
  // Scheduling
  scheduledAt?: string // ISO datetime string for when the task should run
  isScheduled?: boolean // Whether this task is scheduled
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
  lastApkSource?: ApkSource // Last used APK source for this project (Android only)
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
  url?: string            // Web platform only
  apkSource?: ApkSource   // Android only: APK file path or Play Store URL
  maxRounds?: number      // Max rounds override
  scheduledAt?: string    // ISO datetime string for when the task should run
  isScheduled?: boolean   // Whether this task is scheduled
}

export interface TaskStartInput {
  projectId: string
  taskId: string
}

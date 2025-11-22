/**
 * Shared types for SetupWizard components
 */

export interface ToolStatus {
  checking: boolean
  installed: boolean
  version?: string
  error?: string
  installing?: boolean
}

export interface ModelConfig {
  enableLocal: boolean
  enableApi: boolean
  apiProvider?: string      // Selected provider ID (e.g., 'openai', 'anthropic', 'openrouter')
  apiBaseUrl: string
  apiKey: string
  apiModel: string
  localBaseUrl: string
  localModel: string
}

export type TestStatus = 'idle' | 'testing' | 'success' | 'error'

export interface PlatformToolsState {
  python: ToolStatus
  pythonEnv: ToolStatus
  androidStudio: ToolStatus
  homebrew: ToolStatus
}

export interface StepConfig {
  label: string
  description: string
}

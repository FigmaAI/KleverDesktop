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

/**
 * Unified model configuration
 * No more local/api distinction - all providers are treated equally
 * Ollama is just another provider that happens to run locally
 */
export interface ModelConfig {
  provider: string     // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  model: string        // Model name (e.g., 'llama3.2-vision', 'gpt-4o')
  apiKey: string       // API key (empty for Ollama)
  baseUrl: string      // Custom base URL (optional, for OpenRouter etc.)
}

/**
 * Legacy ModelConfig for backward compatibility during migration
 * @deprecated Use ModelConfig instead
 */
export interface LegacyModelConfig {
  enableLocal: boolean
  enableApi: boolean
  apiProvider?: string
  apiBaseUrl: string
  apiKey: string
  apiModel: string
  localBaseUrl: string
  localModel: string
}

/**
 * Convert legacy config to new unified format
 */
export function migrateLegacyModelConfig(legacy: LegacyModelConfig): ModelConfig {
  // If API was enabled, use API settings
  if (legacy.enableApi && legacy.apiModel) {
    return {
      provider: legacy.apiProvider || 'openai',
      model: legacy.apiModel,
      apiKey: legacy.apiKey,
      baseUrl: legacy.apiBaseUrl,
    }
  }
  
  // Otherwise, use local settings (Ollama)
  return {
    provider: 'ollama',
    model: legacy.localModel || 'llama3.2-vision',
    apiKey: '',
    baseUrl: '',
  }
}

export type TestStatus = 'idle' | 'testing' | 'success' | 'error'

export interface PlatformToolsState {
  python: ToolStatus
  pythonEnv: ToolStatus
  androidStudio: ToolStatus
  homebrew: ToolStatus
  chocolatey: ToolStatus
}

export interface StepConfig {
  label: string
  description: string
}

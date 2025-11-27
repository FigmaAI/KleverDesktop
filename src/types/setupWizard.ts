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
 * Single provider configuration (used in Settings UI for editing)
 */
export interface ProviderConfig {
  id: string              // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  apiKey: string          // API key (empty for Ollama)
  preferredModel: string  // Preferred model for this provider
  baseUrl?: string        // Base URL (required for Ollama)
}

/**
 * Model configuration for a single provider (used in UI forms)
 * This is for editing/testing a single provider, not the full config
 */
export interface ModelConfig {
  provider: string     // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  model: string        // Model name (e.g., 'llama3.2-vision', 'gpt-4o')
  apiKey: string       // API key (empty for Ollama)
  baseUrl: string      // Custom base URL (optional, for OpenRouter etc.)
}

/**
 * Full multi-provider model settings (matches AppConfig.model)
 */
export interface MultiProviderModelSettings {
  providers: ProviderConfig[]
  lastUsed?: {
    provider: string
    model: string
  }
}

/**
 * Legacy ModelConfig for backward compatibility during migration
 * @deprecated Use ProviderConfig instead
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
 * Convert legacy config to new multi-provider format
 */
export function migrateLegacyModelConfig(legacy: LegacyModelConfig): MultiProviderModelSettings {
  const providers: ProviderConfig[] = []
  
  // Add Ollama if local model was set
  if (legacy.localModel) {
    providers.push({
      id: 'ollama',
      apiKey: '',
      preferredModel: legacy.localModel.startsWith('ollama/') 
        ? legacy.localModel 
        : `ollama/${legacy.localModel}`,
      baseUrl: 'http://localhost:11434',
    })
  }
  
  // Add API provider if enabled
  if (legacy.enableApi && legacy.apiModel) {
    providers.push({
      id: legacy.apiProvider || 'openai',
      apiKey: legacy.apiKey,
      preferredModel: legacy.apiModel,
      baseUrl: legacy.apiBaseUrl || undefined,
    })
  }
  
  // Ensure at least Ollama is present
  if (providers.length === 0) {
    providers.push({
      id: 'ollama',
      apiKey: '',
      preferredModel: 'ollama/llama3.2-vision',
      baseUrl: 'http://localhost:11434',
    })
  }
  
  return {
    providers,
    lastUsed: providers.length > 0 
      ? { provider: providers[0].id, model: providers[0].preferredModel }
      : undefined,
  }
}

export type TestStatus = 'idle' | 'testing' | 'success' | 'error'

export interface PlatformToolsState {
  python: ToolStatus
  pythonEnv: ToolStatus
  androidStudio: ToolStatus
  homebrew: ToolStatus
  chocolatey: ToolStatus
  ollama: ToolStatus
}

export interface StepConfig {
  label: string
  description: string
}

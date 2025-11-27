/**
 * Model configuration type definitions
 * Unified model config - no more local/api distinction
 */

export type ModelProvider = 'ollama' | 'openai' | 'anthropic' | 'xai' | 'gemini' | 'openrouter' | 'mistral' | 'deepseek' | string;

/**
 * Unified model configuration
 * All providers (including Ollama) are treated equally via LiteLLM
 */
export interface ModelConfig {
  provider: string;     // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  model: string;        // Model name for LiteLLM (e.g., 'ollama/llama3.2-vision', 'gpt-4o')
  apiKey: string;       // API key (empty for Ollama)
  baseUrl: string;      // Base URL (required for Ollama: http://localhost:11434)
}

/**
 * Legacy ModelConfig for backward compatibility
 * @deprecated Use ModelConfig instead
 */
export interface LegacyModelConfig {
  enableLocal: boolean;
  enableApi: boolean;
  localBaseUrl: string;
  localModel: string;
  apiBaseUrl: string;
  apiKey: string;
  apiModel: string;
  modelType?: 'local' | 'api';
}

/**
 * Check if config uses legacy format
 */
export function isLegacyModelConfig(config: unknown): config is LegacyModelConfig {
  if (!config || typeof config !== 'object') return false;
  return 'enableLocal' in config || 'enableApi' in config || 'modelType' in config;
}

/**
 * Migrate legacy model config to new format
 */
export function migrateLegacyModelConfig(legacy: LegacyModelConfig): ModelConfig {
  // Determine which model settings to use
  if (legacy.enableApi && legacy.apiModel) {
    // Detect provider from model name
    let provider = 'openai';
    const model = legacy.apiModel;
    
    if (model.startsWith('claude-') || model.startsWith('anthropic/')) {
      provider = 'anthropic';
    } else if (model.startsWith('grok') || model.startsWith('xai/')) {
      provider = 'xai';
    } else if (model.startsWith('gemini/')) {
      provider = 'gemini';
    } else if (model.startsWith('openrouter/')) {
      provider = 'openrouter';
    } else if (model.startsWith('mistral/')) {
      provider = 'mistral';
    } else if (model.startsWith('deepseek/')) {
      provider = 'deepseek';
    }
    
    return {
      provider,
      model,
      apiKey: legacy.apiKey || '',
      baseUrl: legacy.apiBaseUrl || '',
    };
  }
  
  // Default to Ollama
  const localModel = legacy.localModel || 'llama3.2-vision';
  return {
    provider: 'ollama',
    model: localModel.startsWith('ollama/') ? localModel : `ollama/${localModel}`,
    apiKey: '',
    baseUrl: 'http://localhost:11434',
  };
}

export interface ModelInfo {
  id: string;
  name?: string;
  created?: number;
  owned_by?: string;
}

export interface TestConnectionInput {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface FetchModelsInput {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface FetchModelsResult {
  success: boolean;
  models?: ModelInfo[];
  error?: string;
}

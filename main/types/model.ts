/**
 * Model configuration type definitions
 */

export type ModelProvider = 'openai' | 'openrouter' | 'anthropic' | 'grok' | 'unknown';

export interface ModelConfig {
  // Dual mode support
  enableLocal: boolean;
  enableApi: boolean;

  // Local model (Ollama)
  localBaseUrl: string;
  localModel: string;

  // API model
  apiBaseUrl: string;
  apiKey: string;
  apiModel: string;

  // Legacy support
  modelType?: 'local' | 'api';
}

export interface ModelInfo {
  id: string;
  name?: string;
  created?: number;
  owned_by?: string;
}

export interface TestConnectionInput {
  baseUrl: string;
  apiKey?: string;
  model: string;
  isLocal?: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface FetchModelsInput {
  apiBaseUrl: string;
  apiKey: string;
}

export interface FetchModelsResult {
  success: boolean;
  models?: ModelInfo[];
  error?: string;
}

/**
 * LiteLLM Provider Utilities
 * 
 * Fetches and manages provider/model information from LiteLLM's GitHub repository.
 * Data source: https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
 * 
 * Includes caching strategy:
 * 1. Try to fetch from network
 * 2. On success, cache to local file
 * 3. On failure, use cached data or bundled fallback
 */

import { net } from 'electron';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Raw model data from LiteLLM API
 */
interface LiteLLMModelData {
  max_input_tokens?: number;
  max_tokens?: number;
  max_output_tokens?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  mode?: string;
  litellm_provider?: string;
  supports_vision?: boolean;
}

/**
 * Model information from LiteLLM
 */
export interface LiteLLMModel {
  id: string;
  name: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  inputCostPerToken?: number;
  outputCostPerToken?: number;
  supportsVision?: boolean;
  mode?: string;
}

/**
 * Provider information
 */
export interface LiteLLMProvider {
  id: string;
  name: string;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
  apiKeyUrl: string;
  models: LiteLLMModel[];
  description?: string;
}

/**
 * Provider metadata
 */
const PROVIDER_METADATA: Record<string, Partial<LiteLLMProvider>> = {
  ollama: {
    name: 'Ollama (Local)',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://ollama.ai/',
    description: 'Run models locally via Ollama - no API key required',
  },
  openai: {
    name: 'OpenAI',
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'GPT-4, GPT-4o, and other OpenAI models',
  },
  anthropic: {
    name: 'Anthropic Claude',
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.anthropic.com/v1/messages',
    apiKeyUrl: 'https://console.anthropic.com/',
    description: 'Claude Opus, Sonnet, and Haiku models',
  },
  xai: {
    name: 'xAI Grok',
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.x.ai/v1/chat/completions',
    apiKeyUrl: 'https://console.x.ai/',
    description: 'Grok and Grok Vision models',
  },
  gemini: {
    name: 'Google Gemini',
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Gemini 2.0 Flash, Pro, and Vision models',
  },
  openrouter: {
    name: 'OpenRouter',
    requiresBaseUrl: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiKeyUrl: 'https://openrouter.ai/keys',
    description: 'Access 100+ models via OpenRouter',
  },
  mistral: {
    name: 'Mistral AI',
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.mistral.ai/v1/chat/completions',
    apiKeyUrl: 'https://console.mistral.ai/',
    description: 'Mistral Large and Pixtral models',
  },
  deepseek: {
    name: 'DeepSeek',
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
    apiKeyUrl: 'https://platform.deepseek.com/',
    description: 'DeepSeek Chat and Reasoner models',
  },
  cohere: {
    name: 'Cohere',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://dashboard.cohere.ai/api-keys',
    description: 'Command and Command R models',
  },
  azure: {
    name: 'Azure OpenAI',
    requiresBaseUrl: true,
    apiKeyUrl: 'https://portal.azure.com/',
    description: 'OpenAI models via Azure',
  },
  bedrock: {
    name: 'AWS Bedrock',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://console.aws.amazon.com/bedrock/',
    description: 'Claude, Llama, and other models via AWS',
  },
  vertex_ai: {
    name: 'Google Vertex AI',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://console.cloud.google.com/vertex-ai',
    description: 'Gemini and other models via Google Cloud',
  },
  perplexity: {
    name: 'Perplexity',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://www.perplexity.ai/settings/api',
    description: 'Perplexity online models',
  },
  together_ai: {
    name: 'Together AI',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://api.together.xyz/settings/api-keys',
    description: 'Open source models via Together AI',
  },
};

/**
 * Bundled fallback data - popular models that are always available
 * This ensures the app works even without network access
 */
const BUNDLED_PROVIDERS: LiteLLMProvider[] = [
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://ollama.ai/',
    description: 'Run models locally via Ollama - no API key required',
    models: [],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'GPT-4, GPT-4o, and other OpenAI models',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', maxInputTokens: 128000, supportsVision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', maxInputTokens: 128000, supportsVision: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', maxInputTokens: 128000, supportsVision: true },
      { id: 'o1', name: 'O1', maxInputTokens: 200000 },
      { id: 'o1-mini', name: 'O1 Mini', maxInputTokens: 128000 },
      { id: 'o1-preview', name: 'O1 Preview', maxInputTokens: 128000 },
      { id: 'o3-mini', name: 'O3 Mini', maxInputTokens: 200000 },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.anthropic.com/v1/messages',
    apiKeyUrl: 'https://console.anthropic.com/',
    description: 'Claude Opus, Sonnet, and Haiku models',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', maxInputTokens: 200000, supportsVision: true },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', maxInputTokens: 200000, supportsVision: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', maxInputTokens: 200000, supportsVision: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', maxInputTokens: 200000, supportsVision: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', maxInputTokens: 200000, supportsVision: true },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Gemini 2.0 Flash, Pro, and Vision models',
    models: [
      { id: 'gemini/gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', maxInputTokens: 1048576, supportsVision: true },
      { id: 'gemini/gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', maxInputTokens: 1048576, supportsVision: true },
      { id: 'gemini/gemini-2.0-flash', name: 'Gemini 2.0 Flash', maxInputTokens: 1048576, supportsVision: true },
      { id: 'gemini/gemini-1.5-pro', name: 'Gemini 1.5 Pro', maxInputTokens: 2097152, supportsVision: true },
      { id: 'gemini/gemini-1.5-flash', name: 'Gemini 1.5 Flash', maxInputTokens: 1048576, supportsVision: true },
    ],
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://console.x.ai/',
    description: 'Grok and Grok Vision models',
    models: [
      { id: 'xai/grok-3', name: 'Grok 3', maxInputTokens: 131072 },
      { id: 'xai/grok-3-mini', name: 'Grok 3 Mini', maxInputTokens: 131072 },
      { id: 'xai/grok-2-vision-1212', name: 'Grok 2 Vision', maxInputTokens: 32768, supportsVision: true },
      { id: 'xai/grok-2-1212', name: 'Grok 2', maxInputTokens: 131072 },
      { id: 'xai/grok-vision-beta', name: 'Grok Vision Beta', maxInputTokens: 8192, supportsVision: true },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    requiresBaseUrl: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiKeyUrl: 'https://openrouter.ai/keys',
    description: 'Access 100+ models via OpenRouter',
    models: [
      { id: 'openrouter/auto', name: 'Auto (Best Available)', maxInputTokens: 128000 },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://console.mistral.ai/',
    description: 'Mistral Large and Pixtral models',
    models: [
      { id: 'mistral/mistral-large-latest', name: 'Mistral Large', maxInputTokens: 128000 },
      { id: 'mistral/pixtral-large-latest', name: 'Pixtral Large', maxInputTokens: 128000, supportsVision: true },
      { id: 'mistral/mistral-small-latest', name: 'Mistral Small', maxInputTokens: 32000 },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://platform.deepseek.com/',
    description: 'DeepSeek Chat and Reasoner models',
    models: [
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', maxInputTokens: 64000 },
      { id: 'deepseek/deepseek-reasoner', name: 'DeepSeek Reasoner', maxInputTokens: 64000 },
    ],
  },
];

// Cache paths
function getCachePath(): string {
  return path.join(app.getPath('userData'), 'litellm-models-cache.json');
}

// In-memory cache
let cachedProviders: LiteLLMProvider[] | null = null;
type FetchResult = { success: boolean; providers?: LiteLLMProvider[]; error?: string; source?: 'network' | 'cache' | 'bundled' };
let fetchInProgress: Promise<FetchResult> | null = null;

/**
 * Load cached data from disk
 */
function loadFromCache(): LiteLLMProvider[] | null {
  try {
    const cachePath = getCachePath();
    if (fs.existsSync(cachePath)) {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      // Check if cache is less than 24 hours old
      const cacheAge = Date.now() - (cacheData.timestamp || 0);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge < maxAge && cacheData.providers) {
        return cacheData.providers;
      }
    }
  } catch {
    // Cache read failed, will fetch from network
  }
  return null;
}

/**
 * Save data to disk cache
 */
function saveToCache(providers: LiteLLMProvider[]): void {
  try {
    const cachePath = getCachePath();
    const cacheData = {
      timestamp: Date.now(),
      providers,
    };
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
  } catch {
    // Cache write failed, continue without caching
  }
}

/**
 * Detect provider from model name
 */
export function detectProvider(modelName: string): string {
  if (!modelName) return 'unknown';
  
  const lower = modelName.toLowerCase();
  
  if (modelName.startsWith('ollama/')) return 'ollama';
  if (modelName.startsWith('openrouter/')) return 'openrouter';
  if (modelName.startsWith('anthropic/') || modelName.startsWith('claude-')) return 'anthropic';
  if (modelName.startsWith('gpt-') || modelName.startsWith('o1-') || modelName.startsWith('o3-')) return 'openai';
  if (modelName.startsWith('gemini/')) return 'gemini';
  if (modelName.startsWith('mistral/')) return 'mistral';
  if (modelName.startsWith('deepseek/')) return 'deepseek';
  if (modelName.startsWith('command-') || modelName.startsWith('cohere/')) return 'cohere';
  if (modelName.startsWith('azure/')) return 'azure';
  if (modelName.startsWith('bedrock/')) return 'bedrock';
  if (modelName.startsWith('vertex_ai/')) return 'vertex_ai';
  if (modelName.startsWith('perplexity/')) return 'perplexity';
  if (modelName.startsWith('together_ai/')) return 'together_ai';
  if (modelName.startsWith('xai/')) return 'xai';
  
  if (lower.includes('grok')) return 'xai';
  if (lower.includes('claude')) return 'anthropic';
  if (lower.includes('gemini')) return 'gemini';
  
  return 'unknown';
}

/**
 * Check if model supports vision
 */
export function isVisionModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  const visionKeywords = [
    'vision', 'gpt-4o', 'claude-3', 'claude-sonnet-4', 'claude-opus-4',
    'gemini', 'grok-vision', 'grok-2-vision', 'pixtral', 'llava',
  ];
  return visionKeywords.some(keyword => lower.includes(keyword));
}

export function requiresBaseUrl(providerId: string): boolean {
  return PROVIDER_METADATA[providerId]?.requiresBaseUrl ?? false;
}

export function getDefaultBaseUrl(providerId: string): string | undefined {
  return PROVIDER_METADATA[providerId]?.defaultBaseUrl;
}

/**
 * Fetch from network with timeout
 * Uses GitHub API instead of raw.githubusercontent.com for better network compatibility
 * (some networks block raw.githubusercontent.com)
 */
function fetchFromNetwork(): Promise<Record<string, LiteLLMModelData> | null> {
  // Use GitHub API with raw content header - works better through firewalls
  const url = 'https://api.github.com/repos/BerriAI/litellm/contents/model_prices_and_context_window.json';
  
  return new Promise((resolve) => {
    try {
      const request = net.request({ method: 'GET', url });
      
      // Request raw content instead of JSON metadata
      request.setHeader('Accept', 'application/vnd.github.raw');
      request.setHeader('User-Agent', 'KleverDesktop');
      
      let data = '';
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          request.abort();
          resolve(null);
        }
      }, 15000);

      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          clearTimeout(timeout);
          resolved = true;
          resolve(null);
          return;
        }

        response.on('data', (chunk) => {
          data += chunk.toString();
        });

        response.on('end', () => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch {
              resolve(null);
            }
          }
        });

        response.on('error', () => {
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            resolve(null);
          }
        });
      });

      request.on('error', () => {
        if (!resolved) {
          clearTimeout(timeout);
          resolved = true;
          resolve(null);
        }
      });

      request.end();
    } catch {
      resolve(null);
    }
  });
}

/**
 * Categorize models by provider
 */
function categorizeModels(modelData: Record<string, LiteLLMModelData>): LiteLLMProvider[] {
  const providerMap: Record<string, LiteLLMProvider> = {};
  
  for (const [modelId, modelInfo] of Object.entries(modelData)) {
    if (!modelId || modelId === '' || typeof modelInfo !== 'object') continue;
    if (modelId === 'sample_spec') continue; // Skip sample entry
    
    // Only include chat models
    if (modelInfo.mode && modelInfo.mode !== 'chat') continue;
    
    const providerId = detectProvider(modelId);
    if (providerId === 'unknown') continue;
    
    if (!providerMap[providerId]) {
      const metadata = PROVIDER_METADATA[providerId] || {
        name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
        requiresBaseUrl: false,
        apiKeyUrl: '',
      };
      
      providerMap[providerId] = {
        id: providerId,
        name: metadata.name || providerId,
        requiresBaseUrl: metadata.requiresBaseUrl || false,
        defaultBaseUrl: metadata.defaultBaseUrl,
        apiKeyUrl: metadata.apiKeyUrl || '',
        description: metadata.description,
        models: [],
      };
    }
    
    providerMap[providerId].models.push({
      id: modelId,
      name: modelId,
      maxInputTokens: modelInfo.max_input_tokens || modelInfo.max_tokens || 0,
      maxOutputTokens: modelInfo.max_output_tokens || 0,
      inputCostPerToken: modelInfo.input_cost_per_token,
      outputCostPerToken: modelInfo.output_cost_per_token,
      supportsVision: modelInfo.supports_vision || isVisionModel(modelId),
      mode: modelInfo.mode || 'chat',
    });
  }
  
  // Ensure Ollama is always present
  if (!providerMap['ollama']) {
    providerMap['ollama'] = BUNDLED_PROVIDERS.find(p => p.id === 'ollama')!;
  }
  
  // Sort models within each provider
  for (const provider of Object.values(providerMap)) {
    provider.models.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  // Sort providers by priority
  const priority = ['ollama', 'openai', 'anthropic', 'gemini', 'xai', 'openrouter', 'mistral', 'deepseek'];
  return Object.values(providerMap).sort((a, b) => {
    const aIdx = priority.indexOf(a.id);
    const bIdx = priority.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Main fetch function with caching strategy
 */
export async function fetchLiteLLMModels(): Promise<FetchResult> {
  // Return in-memory cache if available
  if (cachedProviders) {
    return { success: true, providers: cachedProviders, source: 'cache' };
  }
  
  // Wait for in-progress fetch
  if (fetchInProgress) {
    return fetchInProgress;
  }
  
  fetchInProgress = (async () => {
    // Strategy 1: Try network fetch
    const networkData = await fetchFromNetwork();
    if (networkData) {
      const providers = categorizeModels(networkData);
      cachedProviders = providers;
      saveToCache(providers);
      fetchInProgress = null;
      return { success: true, providers, source: 'network' as const };
    }
    
    // Strategy 2: Try disk cache
    const diskCache = loadFromCache();
    if (diskCache) {
      cachedProviders = diskCache;
      fetchInProgress = null;
      return { success: true, providers: diskCache, source: 'cache' as const };
    }
    
    // Strategy 3: Use bundled fallback
    cachedProviders = BUNDLED_PROVIDERS;
    fetchInProgress = null;
    return { success: true, providers: BUNDLED_PROVIDERS, source: 'bundled' as const };
  })();
  
  return fetchInProgress;
}

export function getProviderMetadata(providerId: string): Partial<LiteLLMProvider> | undefined {
  return PROVIDER_METADATA[providerId];
}

export function searchModels(providers: LiteLLMProvider[], query: string): LiteLLMModel[] {
  const results: LiteLLMModel[] = [];
  const lowerQuery = query.toLowerCase();
  
  for (const provider of providers) {
    for (const model of provider.models) {
      if (model.name.toLowerCase().includes(lowerQuery)) {
        results.push(model);
      }
    }
  }
  
  return results;
}

/**
 * Clear cache (for debugging/testing)
 */
export function clearCache(): void {
  cachedProviders = null;
  try {
    const cachePath = getCachePath();
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  } catch {
    // Cache clear failed, ignore
  }
}

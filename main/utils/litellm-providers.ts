/**
 * LiteLLM Provider Utilities
 * 
 * Fetches and manages provider/model information from LiteLLM's GitHub repository.
 * Data source: https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
 */

import * as https from 'https';

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
  id: string;                    // Full model ID (e.g., "gpt-4o", "claude-3-5-sonnet-20241022")
  name: string;                  // Display name
  maxInputTokens?: number;       // Context window size
  maxOutputTokens?: number;      // Max output tokens
  inputCostPerToken?: number;    // Cost per input token (USD)
  outputCostPerToken?: number;   // Cost per output token (USD)
  supportsVision?: boolean;      // Whether model supports image inputs
  mode?: string;                 // "chat" or "completion"
}

/**
 * Provider information
 */
export interface LiteLLMProvider {
  id: string;                    // Provider ID (e.g., "openai", "anthropic")
  name: string;                  // Display name (e.g., "OpenAI", "Anthropic Claude")
  requiresBaseUrl: boolean;      // Whether custom base URL is required
  defaultBaseUrl?: string;       // Default base URL if required
  apiKeyUrl: string;             // URL where users can get API key
  models: LiteLLMModel[];        // Available models
  description?: string;          // Provider description
}

/**
 * Provider metadata (hardcoded, not fetched from API)
 */
const PROVIDER_METADATA: Record<string, Partial<LiteLLMProvider>> = {
  openai: {
    name: 'OpenAI',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'GPT-4, GPT-4o, and other OpenAI models',
  },
  anthropic: {
    name: 'Anthropic Claude',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://console.anthropic.com/',
    description: 'Claude Opus, Sonnet, and Haiku models',
  },
  xai: {
    name: 'xAI Grok',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://console.x.ai/',
    description: 'Grok and Grok Vision models',
  },
  gemini: {
    name: 'Google Gemini',
    requiresBaseUrl: false,
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
    apiKeyUrl: 'https://console.mistral.ai/',
    description: 'Mistral Large and Pixtral models',
  },
  deepseek: {
    name: 'DeepSeek',
    requiresBaseUrl: false,
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
 * Detect provider from model name
 */
export function detectProvider(modelName: string): string {
  if (!modelName) return 'unknown';
  
  const lower = modelName.toLowerCase();
  
  // Check for explicit prefixes first
  if (modelName.startsWith('openrouter/')) return 'openrouter';
  if (modelName.startsWith('anthropic/') || modelName.startsWith('claude-')) return 'anthropic';
  if (modelName.startsWith('gpt-') || modelName.startsWith('o1-')) return 'openai';
  if (modelName.startsWith('gemini/')) return 'gemini';
  if (modelName.startsWith('mistral/')) return 'mistral';
  if (modelName.startsWith('deepseek/')) return 'deepseek';
  if (modelName.startsWith('command-') || modelName.startsWith('cohere/')) return 'cohere';
  if (modelName.startsWith('azure/')) return 'azure';
  if (modelName.startsWith('bedrock/')) return 'bedrock';
  if (modelName.startsWith('vertex_ai/')) return 'vertex_ai';
  if (modelName.startsWith('perplexity/')) return 'perplexity';
  if (modelName.startsWith('together_ai/')) return 'together_ai';
  
  // Check for common model name patterns
  if (lower.includes('grok')) return 'xai';
  if (lower.includes('claude')) return 'anthropic';
  if (lower.includes('gemini')) return 'gemini';
  
  return 'unknown';
}

/**
 * Check if model supports vision (image inputs)
 */
export function isVisionModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  const visionKeywords = [
    'vision',
    'gpt-4o',        // GPT-4o series supports vision
    'claude-3',      // All Claude 3 models support vision
    'claude-sonnet-4',  // Claude Sonnet 4 supports vision
    'claude-opus-4', // Claude Opus 4 supports vision
    'gemini',        // All Gemini models support vision
    'grok-vision',   // Grok Vision
    'pixtral',       // Mistral Pixtral
    'llava',
  ];
  
  return visionKeywords.some(keyword => lower.includes(keyword));
}

/**
 * Check if provider requires custom base URL
 */
export function requiresBaseUrl(providerId: string): boolean {
  const metadata = PROVIDER_METADATA[providerId];
  return metadata?.requiresBaseUrl ?? false;
}

/**
 * Get default base URL for provider (if required)
 */
export function getDefaultBaseUrl(providerId: string): string | undefined {
  const metadata = PROVIDER_METADATA[providerId];
  return metadata?.defaultBaseUrl;
}

/**
 * Fetch model data from LiteLLM GitHub repository
 */
export async function fetchLiteLLMModels(): Promise<{ success: boolean; providers?: LiteLLMProvider[]; error?: string }> {
  const url = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
  
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'KleverDesktop',
      },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode !== 200) {
        resolve({ success: false, error: `HTTP ${res.statusCode}` });
        return;
      }
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const modelData = JSON.parse(data);
          const providers = categorizeModels(modelData);
          resolve({ success: true, providers });
        } catch (error) {
          resolve({ success: false, error: `Failed to parse JSON: ${error}` });
        }
      });
    }).on('error', (error) => {
      resolve({ success: false, error: error.message });
    }).on('timeout', () => {
      resolve({ success: false, error: 'Request timeout' });
    });
  });
}

/**
 * Categorize models by provider
 */
function categorizeModels(modelData: Record<string, LiteLLMModelData>): LiteLLMProvider[] {
  const providerMap: Record<string, LiteLLMProvider> = {};
  
  // Process each model from LiteLLM data
  for (const [modelId, modelInfo] of Object.entries(modelData)) {
    // Skip invalid entries
    if (!modelId || modelId === '' || typeof modelInfo !== 'object') {
      continue;
    }
    
    const providerId = detectProvider(modelId);
    
    // Initialize provider if not exists
    if (!providerMap[providerId]) {
      const metadata = PROVIDER_METADATA[providerId] || {
        name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
        requiresBaseUrl: false,
        apiKeyUrl: '',
        description: '',
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
    
    // Add model to provider
    const model: LiteLLMModel = {
      id: modelId,
      name: modelId,
      maxInputTokens: modelInfo.max_input_tokens || modelInfo.max_tokens || 0,
      maxOutputTokens: modelInfo.max_output_tokens || 0,
      inputCostPerToken: modelInfo.input_cost_per_token,
      outputCostPerToken: modelInfo.output_cost_per_token,
      supportsVision: isVisionModel(modelId),
      mode: modelInfo.mode || 'chat',
    };
    
    providerMap[providerId].models.push(model);
  }
  
  // Sort models within each provider by name
  for (const provider of Object.values(providerMap)) {
    provider.models.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  // Convert to array and sort by provider name
  const providers = Object.values(providerMap).sort((a, b) => {
    // Prioritize popular providers
    const priority = ['openai', 'anthropic', 'gemini', 'xai', 'openrouter', 'mistral', 'deepseek'];
    const aIndex = priority.indexOf(a.id);
    const bIndex = priority.indexOf(b.id);
    
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    return a.name.localeCompare(b.name);
  });
  
  return providers;
}

/**
 * Get provider metadata by ID
 */
export function getProviderMetadata(providerId: string): Partial<LiteLLMProvider> | undefined {
  return PROVIDER_METADATA[providerId];
}

/**
 * Search models across all providers
 */
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


/**
 * Model management IPC handlers
 * Handles model configuration, connection testing, and model fetching
 *
 * IMPORTANT: This handler saves model configuration to config.json (NOT config.yaml)
 */

import { IpcMain } from 'electron';
import * as https from 'https';
import * as http from 'http';
import { loadAppConfig, saveAppConfig } from '../utils/config-storage';
import { ModelConfig, isLegacyModelConfig, migrateLegacyModelConfig } from '../types/model';
import { fetchLiteLLMModels, getChatCompletionsUrl } from '../utils/litellm-providers';
import { testWithLLM } from '../utils/llm-service';

/**
 * Register all model management handlers
 */
export function registerModelHandlers(ipcMain: IpcMain): void {
  // Test model connection via Python/LiteLLM
  // This uses the unified LLM service which handles all provider-specific logic
  ipcMain.handle('model:testConnection', async (_event, config: ModelConfig) => {
    try {
      // Handle legacy config format
      let modelConfig: ModelConfig;
      if (isLegacyModelConfig(config)) {
        modelConfig = migrateLegacyModelConfig(config);
      } else {
        modelConfig = config;
      }

      console.log(`[model:testConnection] Testing model: ${modelConfig.model} (provider: ${modelConfig.provider})`);

      // Use Python/LiteLLM service for testing
      // LiteLLM automatically handles:
      // - Provider detection from model name prefix (e.g., 'openrouter/', 'ollama/')
      // - Model name transformation for each provider
      // - API routing and authentication
      const result = await testWithLLM(
        modelConfig.model,
        modelConfig.apiKey,
        modelConfig.baseUrl
      );

      if (result.success) {
        console.log(`[model:testConnection] Success: ${result.message}`);
        return { success: true, message: result.message || 'Connection successful!' };
      } else {
        console.error(`[model:testConnection] Failed: ${result.error}`);
        return { success: false, message: result.error || 'Connection failed' };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[model:testConnection] Error: ${message}`);
      return { success: false, message };
    }
  });

  // Save model configuration to config.json
  ipcMain.handle('model:saveConfig', async (_event, modelConfig: ModelConfig) => {
    console.log('[model:saveConfig] === SAVE MODEL CONFIG START ===');
    console.log('[model:saveConfig] Received config:', JSON.stringify(modelConfig, null, 2));
    
    try {
      // Handle legacy config format
      let config: ModelConfig;
      if (isLegacyModelConfig(modelConfig)) {
        console.log('[model:saveConfig] Detected legacy config, migrating...');
        config = migrateLegacyModelConfig(modelConfig);
      } else {
        config = modelConfig;
      }
      console.log('[model:saveConfig] Config to save:', JSON.stringify(config, null, 2));

      // Load current config (or defaults)
      const appConfig = loadAppConfig();
      console.log('[model:saveConfig] Loaded current config, model section:', JSON.stringify(appConfig.model, null, 2));

      // Update or add provider configuration
      const existingProviderIndex = appConfig.model.providers.findIndex(
        p => p.id === config.provider
      );
      
      const newProviderConfig = {
        id: config.provider,
        apiKey: config.apiKey,
        preferredModel: config.model,
        baseUrl: config.baseUrl || undefined,
      };

      if (existingProviderIndex >= 0) {
        // Update existing provider
        appConfig.model.providers[existingProviderIndex] = newProviderConfig;
      } else {
        // Add new provider
        appConfig.model.providers.push(newProviderConfig);
      }

      // Update lastUsed
      appConfig.model.lastUsed = {
        provider: config.provider,
        model: config.model,
      };
      
      console.log('[model:saveConfig] Updated model config:', JSON.stringify(appConfig.model, null, 2));

      // Save updated config to config.json
      saveAppConfig(appConfig);
      console.log('[model:saveConfig] === SAVE MODEL CONFIG SUCCESS ===');

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[model:saveConfig] === SAVE MODEL CONFIG FAILED ===');
      console.error('[model:saveConfig] Error:', message);
      return { success: false, error: message };
    }
  });

  // Fetch all LiteLLM providers and models from GitHub
  ipcMain.handle('model:fetchLiteLLMModels', async () => {
    try {
      const result = await fetchLiteLLMModels();

      if (!result.success && result.error) {
        console.error(`[model:fetchLiteLLMModels] Failed: ${result.error}`);
      }

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[model:fetchLiteLLMModels] Error:', message);
      return { success: false, error: message };
    }
  });

  // Fetch API models from various providers (legacy support)
  ipcMain.handle('model:fetchApiModels', async (_event, config: { apiBaseUrl: string; apiKey: string }) => {
    try {
      const { apiBaseUrl, apiKey } = config;

      // Detect provider from URL
      let provider = 'unknown';
      let modelsEndpoint = '';

      if (apiBaseUrl.includes('api.openai.com')) {
        provider = 'openai';
        modelsEndpoint = 'https://api.openai.com/v1/models';
      } else if (apiBaseUrl.includes('openrouter.ai')) {
        provider = 'openrouter';
        modelsEndpoint = 'https://openrouter.ai/api/v1/models';
      } else if (apiBaseUrl.includes('api.anthropic.com')) {
        provider = 'anthropic';
        // Anthropic doesn't have a models endpoint, return predefined list
        return {
          success: true,
          provider: 'anthropic',
          models: [
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
          ],
        };
      } else if (apiBaseUrl.includes('api.x.ai') || apiBaseUrl.includes('api.grok')) {
        provider = 'grok';
        // Grok/X.AI doesn't have public models endpoint, return predefined list
        return {
          success: true,
          provider: 'grok',
          models: ['grok-beta', 'grok-vision-beta'],
        };
      }

      if (!modelsEndpoint) {
        return {
          success: false,
          provider: 'unknown',
          error: 'Unknown API provider. Please enter model name manually.',
        };
      }

      const urlObj = new globalThis.URL(modelsEndpoint);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      return new Promise<{ success: boolean; provider: string; models?: string[]; error?: string }>((resolve) => {
        const options: http.RequestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + (urlObj.search || ''),
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        };

        if (apiKey) {
          if (provider === 'openrouter') {
            (options.headers as Record<string, string>)['Authorization'] = `Bearer ${apiKey}`;
            (options.headers as Record<string, string>)['HTTP-Referer'] = 'https://github.com/FigmaAI/KleverDesktop';
            (options.headers as Record<string, string>)['X-Title'] = 'Klever Desktop';
          } else {
            (options.headers as Record<string, string>)['Authorization'] = `Bearer ${apiKey}`;
          }
        }

        const req = protocol.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const parsed = JSON.parse(data);
                let models: string[] = [];

                if (provider === 'openai') {
                  // OpenAI returns { data: [{ id: 'gpt-4', ... }] }
                  interface OpenAIModel { id: string }
                  models =
                    parsed.data
                      ?.filter(
                        (m: OpenAIModel) =>
                          m.id && !m.id.includes('embedding') && !m.id.includes('tts') && !m.id.includes('whisper')
                      )
                      .map((m: OpenAIModel) => m.id) || [];
                } else if (provider === 'openrouter') {
                  // OpenRouter returns { data: [{ id: 'openai/gpt-4', ... }] }
                  interface OpenRouterModel { id: string }
                  models = parsed.data?.map((m: OpenRouterModel) => m.id) || [];
                }

                resolve({
                  success: true,
                  provider,
                  models: models.slice(0, 50), // Limit to first 50 models
                });
              } catch {
                resolve({ success: false, provider, error: 'Failed to parse models response' });
              }
            } else {
              resolve({ success: false, provider, error: `HTTP ${res.statusCode}: ${data}` });
            }
          });
        });

        req.on('error', (error) => {
          resolve({ success: false, provider, error: error.message });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, provider, error: 'Request timeout' });
        });

        req.end();
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, provider: 'unknown', error: message };
    }
  });
}

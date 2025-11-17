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
import { ModelConfig } from '../types';
import { fetchLiteLLMModels } from '../utils/litellm-providers';

/**
 * Register all model management handlers
 */
export function registerModelHandlers(ipcMain: IpcMain): void {
  // Test model connection
  ipcMain.handle('model:testConnection', async (_event, config: ModelConfig) => {
    try {
      // Support both old (modelType) and new (enableLocal/enableApi) formats
      const configWithType = config as ModelConfig & { modelType?: string };
      const isLocal = configWithType.modelType === 'local' || config.enableLocal;
      const url = isLocal ? config.localBaseUrl : config.apiBaseUrl;
      const model = isLocal ? config.localModel : config.apiModel;

      const urlObj = new globalThis.URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      return new Promise<{ success: boolean; message?: string }>((resolve) => {
        const postData = JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 50,
        });

        const options: http.RequestOptions = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': globalThis.Buffer.byteLength(postData),
          },
          timeout: 10000,
        };

        if (!isLocal && config.apiKey) {
          (options.headers as Record<string, string>)['Authorization'] = `Bearer ${config.apiKey}`;
        }

        const req = protocol.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
              resolve({ success: true, message: 'Connection successful!' });
            } else {
              resolve({ success: false, message: `HTTP ${res.statusCode}: ${data}` });
            }
          });
        });

        req.on('error', (error) => {
          resolve({ success: false, message: error.message });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ success: false, message: 'Connection timeout' });
        });

        req.write(postData);
        req.end();
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message };
    }
  });

  // Save model configuration to config.json
  ipcMain.handle('model:saveConfig', async (_event, modelConfig: ModelConfig) => {
    try {
      // Load current config (or defaults)
      const appConfig = loadAppConfig();

      // Update model configuration from the received ModelConfig
      // Note: ModelConfig from renderer has flat structure (enableLocal, localBaseUrl, etc.)
      // We need to convert it to nested structure for AppConfig
      appConfig.model.enableLocal = modelConfig.enableLocal;
      appConfig.model.enableApi = modelConfig.enableApi;
      appConfig.model.local.baseUrl = modelConfig.localBaseUrl;
      appConfig.model.local.model = modelConfig.localModel;
      appConfig.model.api.baseUrl = modelConfig.apiBaseUrl;
      appConfig.model.api.key = modelConfig.apiKey;
      appConfig.model.api.model = modelConfig.apiModel;

      // Save updated config to config.json
      saveAppConfig(appConfig);

      console.log('[model:saveConfig] Model configuration saved to config.json');
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[model:saveConfig] Error:', message);
      return { success: false, error: message };
    }
  });

  // Fetch all LiteLLM providers and models from GitHub
  ipcMain.handle('model:fetchLiteLLMModels', async () => {
    try {
      console.log('[model:fetchLiteLLMModels] Fetching model data from LiteLLM GitHub...');
      const result = await fetchLiteLLMModels();
      
      if (result.success) {
        console.log(`[model:fetchLiteLLMModels] Success: ${result.providers?.length} providers, ${result.providers?.reduce((acc, p) => acc + p.models.length, 0)} models`);
      } else {
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

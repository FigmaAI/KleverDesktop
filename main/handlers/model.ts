/**
 * Model management IPC handlers
 * Handles model configuration, connection testing, and model fetching
 */

import { IpcMain } from 'electron';
import * as https from 'https';
import * as http from 'http';
import { loadConfig, saveConfig } from '../utils/config-manager';
import { ModelConfig } from '../types';

/**
 * Register all model management handlers
 */
export function registerModelHandlers(ipcMain: IpcMain): void {
  // Test model connection
  ipcMain.handle('model:testConnection', async (_event, config: ModelConfig) => {
    try {
      // Support both old (modelType) and new (enableLocal/enableApi) formats
      const isLocal = (config as any).modelType === 'local' || config.enableLocal;
      const url = isLocal ? config.localBaseUrl : config.apiBaseUrl;
      const model = isLocal ? config.localModel : config.apiModel;

      const urlObj = new URL(url);
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
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 10000,
        };

        if (!isLocal && config.apiKey) {
          (options.headers as any)['Authorization'] = `Bearer ${config.apiKey}`;
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
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });

  // Save model configuration
  ipcMain.handle('model:saveConfig', async (_event, config: ModelConfig) => {
    try {
      const yamlConfig = loadConfig();

      // Determine primary provider: if both enabled, prefer API
      let modelProvider = 'local';
      if (config.enableApi && config.enableLocal) {
        modelProvider = 'api';
      } else if (config.enableApi) {
        modelProvider = 'api';
      } else if (config.enableLocal) {
        modelProvider = 'local';
      }

      // Update config
      yamlConfig.MODEL = modelProvider;
      yamlConfig.ENABLE_LOCAL = config.enableLocal;
      yamlConfig.ENABLE_API = config.enableApi;
      yamlConfig.API_BASE_URL = config.apiBaseUrl;
      yamlConfig.API_KEY = config.apiKey;
      yamlConfig.API_MODEL = config.apiModel;
      yamlConfig.LOCAL_BASE_URL = config.localBaseUrl;
      yamlConfig.LOCAL_MODEL = config.localModel;

      // Save config
      saveConfig(yamlConfig);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Fetch API models from various providers
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

      const urlObj = new URL(modelsEndpoint);
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
            (options.headers as any)['Authorization'] = `Bearer ${apiKey}`;
            (options.headers as any)['HTTP-Referer'] = 'https://github.com/FigmaAI/KleverDesktop';
            (options.headers as any)['X-Title'] = 'Klever Desktop';
          } else {
            (options.headers as any)['Authorization'] = `Bearer ${apiKey}`;
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
                  models =
                    parsed.data
                      ?.filter(
                        (m: any) =>
                          m.id && !m.id.includes('embedding') && !m.id.includes('tts') && !m.id.includes('whisper')
                      )
                      .map((m: any) => m.id) || [];
                } else if (provider === 'openrouter') {
                  // OpenRouter returns { data: [{ id: 'openai/gpt-4', ... }] }
                  models = parsed.data?.map((m: any) => m.id) || [];
                }

                resolve({
                  success: true,
                  provider,
                  models: models.slice(0, 50), // Limit to first 50 models
                });
              } catch (error) {
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
    } catch (error: any) {
      return { success: false, provider: 'unknown', error: error.message };
    }
  });
}

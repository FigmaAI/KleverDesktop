/**
 * Translation utility using configured AI models
 * Translates text to target language (ko, ja, en)
 */

import * as https from 'https';
import * as http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { loadAppConfig } from './config-storage';

const execAsync = promisify(exec);

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
};

export interface TranslationResult {
  success: boolean;
  translatedText?: string;
  error?: string;
}

/**
 * Translate text using macOS native translation (macOS 12+)
 * Falls back to AI model if native translation fails
 */
async function translateWithMacOS(text: string, targetLang: string): Promise<TranslationResult> {
  // Only available on macOS
  if (os.platform() !== 'darwin') {
    return { success: false, error: 'macOS translation only available on macOS' };
  }

  try {
    // Map language codes to macOS locale codes
    const langMap: Record<string, string> = {
      en: 'en_US',
      ko: 'ko_KR',
      ja: 'ja_JP',
    };

    const targetLocale = langMap[targetLang] || targetLang;

    // Use AppleScript to call macOS translation service
    const script = `
      use framework "Foundation"
      use framework "NaturalLanguage"
      
      set sourceText to "${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
      set targetLanguage to "${targetLocale}"
      
      -- This is a simplified approach - actual implementation would use NLLanguageRecognizer
      -- For now, return empty to fallback to AI translation
      return ""
    `;

    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const result = stdout.trim();

    if (result && result !== text) {
      return {
        success: true,
        translatedText: result,
      };
    }

    // macOS translation not available or failed, fallback to AI
    return { success: false, error: 'macOS translation not available' };
  } catch (error) {
    console.log('[translator] macOS translation failed, will fallback to AI:', error);
    return { success: false, error: 'macOS translation failed' };
  }
}

/**
 * Translate text to target language using LiteLLM
 * @param text - Text to translate
 * @param targetLang - Target language code ('ko', 'ja', 'en')
 * @returns Translation result
 */
export async function translateText(
  text: string,
  targetLang: string,
): Promise<TranslationResult> {
  // Try macOS native translation first (free, offline, fast)
  if (os.platform() === 'darwin') {
    console.log('[translator] Attempting macOS native translation...');
    const macResult = await translateWithMacOS(text, targetLang);
    if (macResult.success) {
      console.log('[translator] macOS translation successful');
      return macResult;
    }
    console.log('[translator] macOS translation unavailable, falling back to AI model');
  }

  // Fallback to AI model translation
  try {
    // Load config to get model settings
    const config = await loadAppConfig();

    if (!config || !config.model) {
      return {
        success: false,
        error: 'Model configuration not found',
      };
    }

    const { provider, model, apiKey, baseUrl } = config.model;

    if (!provider || !model) {
      return {
        success: false,
        error: 'Model not configured',
      };
    }

    const targetLangName = LANGUAGE_NAMES[targetLang] || targetLang;

    const prompt = `Translate the following text to ${targetLangName}. Respond with ONLY the translation, without any explanation or additional text.

Text to translate:
${text}`;

    // Construct model name for LiteLLM
    const modelName = provider === 'ollama' ? `ollama/${model}` : model;

    // Determine API endpoint based on provider
    // Use config baseUrl if provided, otherwise use provider's default
    let apiUrl: string;
    if (baseUrl && baseUrl.trim() !== '') {
      // User has configured a custom baseUrl
      apiUrl = baseUrl;
    } else {
      // Use provider's default baseUrl
      if (provider === 'ollama') {
        apiUrl = 'http://localhost:11434/v1/chat/completions';
      } else if (provider === 'openai') {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
      } else if (provider === 'anthropic') {
        apiUrl = 'https://api.anthropic.com/v1/messages';
      } else if (provider === 'xai') {
        apiUrl = 'https://api.x.ai/v1/chat/completions';
      } else if (provider === 'gemini') {
        apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
      } else if (provider === 'mistral') {
        apiUrl = 'https://api.mistral.ai/v1/chat/completions';
      } else if (provider === 'deepseek') {
        apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      } else if (provider === 'openrouter') {
        apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      } else {
        // Default to OpenAI-compatible endpoint
        apiUrl = 'https://api.openai.com/v1/chat/completions';
      }
    }

    const urlObj = new URL(apiUrl);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    // Build request payload
    const postData = JSON.stringify({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4096,
    });

    return new Promise<TranslationResult>((resolve) => {
      const options: http.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 30000, // 30 second timeout for translation
      };

      // Add API key for non-Ollama providers
      if (provider !== 'ollama' && apiKey) {
        (options.headers as Record<string, string>)['Authorization'] = `Bearer ${apiKey}`;
      }

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              const parsed = JSON.parse(data);
              const translatedText = parsed.choices?.[0]?.message?.content?.trim();

              if (!translatedText) {
                resolve({
                  success: false,
                  error: 'No translation received from model',
                });
              } else {
                resolve({
                  success: true,
                  translatedText,
                });
              }
            } catch (parseError) {
              resolve({
                success: false,
                error: 'Failed to parse translation response',
              });
            }
          } else {
            resolve({
              success: false,
              error: `Translation request failed: HTTP ${res.statusCode}`,
            });
          }
        });
      });

      req.on('error', (error) => {
        console.error('[translator] Request error:', error);
        resolve({
          success: false,
          error: error.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Translation request timeout',
        });
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error('[translator] Translation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Translate markdown content from English to target language
 * @param markdown - English markdown content to translate
 * @param targetLang - Target language code ('ko', 'ja')
 * @returns Translation result
 */
export async function translateMarkdown(
  markdown: string,
  targetLang: string,
): Promise<TranslationResult> {
  // Simply translate the entire markdown text
  return translateText(markdown, targetLang);
}

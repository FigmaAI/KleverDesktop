/**
 * Translation utility using configured AI models via Python/LiteLLM
 * Translates text to target language (ko, ja, en)
 * 
 * Uses the unified llm_service.py for all LLM calls, which handles:
 * - Provider-specific API formats automatically
 * - Model name format conversions
 * - Consistent error handling
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { loadAppConfig } from './config-storage';
import { translateWithLLM } from './llm-service';

const execAsync = promisify(exec);

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
 * Translate text to target language using LiteLLM (via Python)
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

  // Fallback to AI model translation via Python/LiteLLM
  try {
    // Load config to get model settings
    const config = await loadAppConfig();

    if (!config || !config.model || !config.model.providers || config.model.providers.length === 0) {
      return {
        success: false,
        error: 'Model configuration not found',
      };
    }

    // Get the last used provider/model, or fall back to first provider
    let provider: string;
    let model: string;
    let apiKey: string;
    let baseUrl: string | undefined;

    if (config.model.lastUsed) {
      provider = config.model.lastUsed.provider;
      model = config.model.lastUsed.model;
      const providerConfig = config.model.providers.find(p => p.id === provider);
      apiKey = providerConfig?.apiKey || '';
      baseUrl = providerConfig?.baseUrl;
    } else {
      const firstProvider = config.model.providers[0];
      provider = firstProvider.id;
      model = firstProvider.preferredModel;
      apiKey = firstProvider.apiKey;
      baseUrl = firstProvider.baseUrl;
    }

    if (!provider || !model) {
      return {
        success: false,
        error: 'Model not configured',
      };
    }

    console.log(`[translator] Using Python/LiteLLM service: provider=${provider}, model=${model}`);

    // Call Python LLM service (LiteLLM handles all provider-specific logic)
    const result = await translateWithLLM(text, targetLang, model, apiKey, baseUrl);

    if (result.success) {
      console.log('[translator] Translation successful via LiteLLM');
      return {
        success: true,
        translatedText: result.translatedText,
      };
    } else {
      console.error('[translator] LiteLLM translation failed:', result.error);
      return {
        success: false,
        error: result.error || 'Translation failed',
      };
    }
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

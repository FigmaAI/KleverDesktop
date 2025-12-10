/**
 * Translation utility using configured AI models via Python/LiteLLM
 * Translates text to target language (ko, ja, en)
 * 
 * Uses the unified llm_service.py for all LLM calls, which handles:
 * - Provider-specific API formats automatically
 * - Model name format conversions
 * - Consistent error handling
 */

import { loadAppConfig } from './config-storage';
import { translateWithLLM } from './llm-service';

export interface TranslationResult {
  success: boolean;
  translatedText?: string;
  error?: string;
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
  // Use AI model translation via Python/LiteLLM
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
      // Truncate error message for logging
      const errorMsg = result.error || 'Translation failed';
      const truncatedError = errorMsg.length > 200 ? errorMsg.substring(0, 200) + '...' : errorMsg;
      console.error('[translator] LiteLLM translation failed:', truncatedError);
      return {
        success: false,
        error: errorMsg,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const truncatedError = errorMsg.length > 200 ? errorMsg.substring(0, 200) + '...' : errorMsg;
    console.error('[translator] Translation failed:', truncatedError);
    return {
      success: false,
      error: errorMsg,
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

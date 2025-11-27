/**
 * Translation utility using configured AI models
 * Translates English text to target language (ko, ja)
 */

import { loadAppConfig } from './config-storage';

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
 * Translate text from English to target language using LiteLLM
 * @param text - English text to translate
 * @param targetLang - Target language code ('ko', 'ja')
 * @returns Translation result
 */
export async function translateText(
  text: string,
  targetLang: string,
): Promise<TranslationResult> {
  try {
    // If target is English, no translation needed
    if (targetLang === 'en') {
      return {
        success: true,
        translatedText: text,
      };
    }

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

    const prompt = `Translate the following text from English to ${targetLangName}. Respond with ONLY the translation, without any explanation or additional text.

Text to translate:
${text}`;

    // Construct model name for LiteLLM
    const modelName = provider === 'ollama' ? `ollama/${model}` : model;

    // Prepare request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key for non-Ollama providers
    if (provider !== 'ollama' && apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Determine API endpoint
    let apiUrl = baseUrl || 'http://localhost:4000';
    if (provider === 'ollama') {
      apiUrl = baseUrl || 'http://localhost:11434/v1/chat/completions';
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`Translation request failed: ${response.statusText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const translatedText = data.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      return {
        success: false,
        error: 'No translation received from model',
      };
    }

    return {
      success: true,
      translatedText,
    };
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

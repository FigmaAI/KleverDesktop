/**
 * Environment variable builder from AppConfig
 *
 * Converts config.json to environment variables for appagent Python scripts
 * These env vars serve as default values that can be overridden by CLI parameters
 * 
 * Reference: https://docs.litellm.ai/docs/providers/ollama
 * - Ollama models use format: "ollama/model_name"
 * - Ollama requires api_base: "http://localhost:11434"
 */

import { AppConfig } from '../types/config';

/**
 * Build environment variables from AppConfig
 * Returns environment variables for Python appagent scripts
 *
 * @param config - Application configuration from config.json
 * @returns Environment variables object
 */
export function buildEnvFromConfig(config: AppConfig): Record<string, string> {
  return {
    // ========================================
    // Model Configuration (4 variables - unified)
    // ========================================
    // LiteLLM uses model name directly (e.g., "ollama/llama3.2-vision", "gpt-4o")
    MODEL_PROVIDER: config.model.provider,
    MODEL_NAME: config.model.model,
    API_KEY: config.model.apiKey,
    API_BASE_URL: config.model.baseUrl,

    // ========================================
    // Execution Configuration (4 variables)
    // ========================================
    MAX_TOKENS: config.execution.maxTokens.toString(),
    TEMPERATURE: config.execution.temperature.toString(),
    REQUEST_INTERVAL: config.execution.requestInterval.toString(),
    MAX_ROUNDS: config.execution.maxRounds.toString(),

    // ========================================
    // Android Configuration (3 variables)
    // ========================================
    ANDROID_SCREENSHOT_DIR: config.android.screenshotDir,
    ANDROID_XML_DIR: config.android.xmlDir,
    ANDROID_SDK_PATH: config.android.sdkPath,

    // ========================================
    // Web Configuration (4 variables)
    // ========================================
    WEB_BROWSER_TYPE: config.web.browserType,
    WEB_HEADLESS: config.web.headless.toString(),
    WEB_VIEWPORT_WIDTH: config.web.viewportWidth.toString(),
    WEB_VIEWPORT_HEIGHT: config.web.viewportHeight.toString(),

    // ========================================
    // Image Configuration (4 variables)
    // ========================================
    IMAGE_MAX_WIDTH: config.image.maxWidth.toString(),
    IMAGE_MAX_HEIGHT: config.image.maxHeight.toString(),
    IMAGE_QUALITY: config.image.quality.toString(),
    OPTIMIZE_IMAGES: config.image.optimize.toString(),

    // ========================================
    // Preferences (3 variables)
    // ========================================
    DARK_MODE: config.preferences.darkMode.toString(),
    MIN_DIST: config.preferences.minDist.toString(),
    DOC_REFINE: config.preferences.docRefine.toString(),
  };
}

/**
 * Utility to log environment variables (for debugging)
 * Masks sensitive values like API_KEY
 */
export function logEnvVars(envVars: Record<string, string>): void {
  const masked = { ...envVars };

  // Mask sensitive values
  if (masked.API_KEY) {
    masked.API_KEY = masked.API_KEY.slice(0, 8) + '...';
  }

  console.log('[config-env-builder] Environment variables:');
  console.log(JSON.stringify(masked, null, 2));
}

/**
 * Validate that all required environment variables are present
 * @param envVars - Environment variables object
 * @returns true if all required variables exist
 */
export function validateEnvVars(envVars: Record<string, string>): boolean {
  const requiredVars = [
    // Model (4)
    'MODEL_PROVIDER',
    'MODEL_NAME',
    'API_KEY',
    'API_BASE_URL',
    // Execution (4)
    'MAX_TOKENS',
    'TEMPERATURE',
    'REQUEST_INTERVAL',
    'MAX_ROUNDS',
    // Android (3)
    'ANDROID_SCREENSHOT_DIR',
    'ANDROID_XML_DIR',
    'ANDROID_SDK_PATH',
    // Web (4)
    'WEB_BROWSER_TYPE',
    'WEB_HEADLESS',
    'WEB_VIEWPORT_WIDTH',
    'WEB_VIEWPORT_HEIGHT',
    // Image (4)
    'IMAGE_MAX_WIDTH',
    'IMAGE_MAX_HEIGHT',
    'IMAGE_QUALITY',
    'OPTIMIZE_IMAGES',
    // Preferences (3)
    'DARK_MODE',
    'MIN_DIST',
    'DOC_REFINE',
  ];

  const missingVars = requiredVars.filter((varName) => !(varName in envVars));

  if (missingVars.length > 0) {
    console.error('[config-env-builder] Missing environment variables:', missingVars);
    return false;
  }

  return true;
}

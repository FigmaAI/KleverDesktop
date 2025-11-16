/**
 * Environment variable builder from AppConfig
 *
 * Converts config.json to 22 environment variables for appagent Python scripts
 * These env vars serve as default values that can be overridden by CLI parameters
 */

import { AppConfig } from '../types/config';

/**
 * Build environment variables from AppConfig
 * Returns a Record of 22 environment variable key-value pairs
 *
 * @param config - Application configuration from config.json
 * @returns Environment variables object (22 variables)
 */
export function buildEnvFromConfig(config: AppConfig): Record<string, string> {
  // Determine MODEL value based on enabled flags
  // If both enabled, API takes precedence
  // If neither enabled, default to 'local'
  let modelProvider: string;
  if (config.model.enableApi) {
    modelProvider = 'api';
  } else if (config.model.enableLocal) {
    modelProvider = 'local';
  } else {
    // Fallback: if neither is enabled, default to local
    modelProvider = 'local';
  }

  return {
    // ========================================
    // Model Configuration (6 variables)
    // ========================================
    MODEL: modelProvider,
    API_BASE_URL: config.model.api.baseUrl,
    API_KEY: config.model.api.key,
    API_MODEL: config.model.api.model,
    LOCAL_BASE_URL: config.model.local.baseUrl,
    LOCAL_MODEL: config.model.local.model,

    // ========================================
    // Execution Configuration (4 variables)
    // ========================================
    MAX_TOKENS: config.execution.maxTokens.toString(),
    TEMPERATURE: config.execution.temperature.toString(),
    REQUEST_INTERVAL: config.execution.requestInterval.toString(),
    MAX_ROUNDS: config.execution.maxRounds.toString(),

    // ========================================
    // Android Configuration (2 variables)
    // ========================================
    ANDROID_SCREENSHOT_DIR: config.android.screenshotDir,
    ANDROID_XML_DIR: config.android.xmlDir,

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

  console.log('[config-env-builder] Environment variables (22 total):');
  console.log(JSON.stringify(masked, null, 2));
}

/**
 * Validate that all 22 required environment variables are present
 * @param envVars - Environment variables object
 * @returns true if all 22 variables exist
 */
export function validateEnvVars(envVars: Record<string, string>): boolean {
  const requiredVars = [
    // Model (6)
    'MODEL',
    'API_BASE_URL',
    'API_KEY',
    'API_MODEL',
    'LOCAL_BASE_URL',
    'LOCAL_MODEL',
    // Execution (4)
    'MAX_TOKENS',
    'TEMPERATURE',
    'REQUEST_INTERVAL',
    'MAX_ROUNDS',
    // Android (2)
    'ANDROID_SCREENSHOT_DIR',
    'ANDROID_XML_DIR',
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

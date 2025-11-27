/**
 * Application configuration type definitions for config.json
 * This file defines the complete schema for ~/.klever-desktop/config.json
 */

/**
 * Unified model settings - no more local/api distinction
 * All providers (including Ollama) are treated equally via LiteLLM
 * 
 * Reference: https://docs.litellm.ai/docs/providers/ollama
 * - Ollama models use format: "ollama/model_name" (e.g., "ollama/llama3.2-vision")
 * - Ollama requires api_base: "http://localhost:11434"
 * - Ollama does not require API key
 */
export interface ModelSettings {
  provider: string;     // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  model: string;        // Model name for LiteLLM (e.g., 'ollama/llama3.2-vision', 'gpt-4o')
  apiKey: string;       // API key (empty for Ollama)
  baseUrl: string;      // Base URL (required for Ollama: http://localhost:11434)
}

/**
 * Legacy model settings for backward compatibility
 * @deprecated Will be removed in future versions
 */
export interface LegacyModelSettings {
  enableLocal: boolean;
  enableApi: boolean;
  api: {
    provider?: string;
    baseUrl: string;
    key: string;
    model: string;
  };
  local: {
    baseUrl: string;
    model: string;
  };
}

/**
 * Execution/runtime configuration
 */
export interface ExecutionConfig {
  maxTokens: number;
  temperature: number;
  requestInterval: number;
  maxRounds: number;
}

/**
 * Android platform configuration
 */
export interface AndroidConfig {
  screenshotDir: string;
  xmlDir: string;
  sdkPath: string;
}

/**
 * Web platform configuration
 */
export interface WebConfig {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Image processing configuration
 */
export interface ImageConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  optimize: boolean;
}

/**
 * User preferences
 */
export interface PreferencesConfig {
  darkMode: boolean;
  minDist: number;
  docRefine: boolean;
}

/**
 * Complete application configuration
 * Stored in ~/.klever-desktop/config.json
 */
export interface AppConfig {
  version: string;
  model: ModelSettings;
  execution: ExecutionConfig;
  android: AndroidConfig;
  web: WebConfig;
  image: ImageConfig;
  preferences: PreferencesConfig;
}

/**
 * Legacy AppConfig for migration support
 * @deprecated Use AppConfig instead
 */
export interface LegacyAppConfig {
  version: string;
  model: LegacyModelSettings;
  execution: ExecutionConfig;
  android: AndroidConfig;
  web: WebConfig;
  image: ImageConfig;
  preferences: PreferencesConfig;
}

/**
 * Check if config uses legacy format
 */
export function isLegacyConfig(config: unknown): config is LegacyAppConfig {
  if (!config || typeof config !== 'object') return false;
  const modelConfig = (config as Record<string, unknown>).model;
  if (!modelConfig || typeof modelConfig !== 'object') return false;
  return 'enableLocal' in modelConfig || 'enableApi' in modelConfig;
}

/**
 * Migrate legacy config to new format
 */
export function migrateConfig(legacy: LegacyAppConfig): AppConfig {
  const legacyModel = legacy.model;
  
  // Determine which model settings to use
  let provider: string;
  let model: string;
  let apiKey: string;
  let baseUrl: string;
  
  if (legacyModel.enableApi && legacyModel.api?.model) {
    // Use API settings
    provider = legacyModel.api.provider || 'openai';
    model = legacyModel.api.model;
    apiKey = legacyModel.api.key || '';
    baseUrl = legacyModel.api.baseUrl || '';
  } else {
    // Use local (Ollama) settings
    provider = 'ollama';
    // Convert to LiteLLM format: ollama/model_name
    const localModel = legacyModel.local?.model || 'llama3.2-vision';
    model = localModel.startsWith('ollama/') ? localModel : `ollama/${localModel}`;
    apiKey = '';
    baseUrl = 'http://localhost:11434';
  }
  
  return {
    version: legacy.version || '2.0',
    model: {
      provider,
      model,
      apiKey,
      baseUrl,
    },
    execution: legacy.execution,
    android: legacy.android,
    web: legacy.web,
    image: legacy.image,
    preferences: legacy.preferences,
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: AppConfig = {
  version: '2.0',
  model: {
    provider: 'ollama',
    model: 'ollama/llama3.2-vision',  // LiteLLM format
    apiKey: '',
    baseUrl: 'http://localhost:11434',  // Required for Ollama
  },
  execution: {
    maxTokens: 4096,
    temperature: 0.0,
    requestInterval: 10,
    maxRounds: 20,
  },
  android: {
    screenshotDir: '/sdcard/Pictures',
    xmlDir: '/sdcard/Documents',
    sdkPath: '',
  },
  web: {
    browserType: 'chromium',
    headless: false,
    viewportWidth: 1280,
    viewportHeight: 720,
  },
  image: {
    maxWidth: 512,
    maxHeight: 512,
    quality: 85,
    optimize: true,
  },
  preferences: {
    darkMode: false,
    minDist: 30,
    docRefine: false,
  },
};

/**
 * Environment variable mapping
 * Maps config.json paths to environment variable names
 */
export const ENV_VAR_MAPPING = {
  // Model configuration (4 variables - simplified)
  MODEL_PROVIDER: 'model.provider',
  MODEL_NAME: 'model.model',
  API_KEY: 'model.apiKey',
  API_BASE_URL: 'model.baseUrl',

  // Execution configuration (4 variables)
  MAX_TOKENS: 'execution.maxTokens',
  TEMPERATURE: 'execution.temperature',
  REQUEST_INTERVAL: 'execution.requestInterval',
  MAX_ROUNDS: 'execution.maxRounds',

  // Android configuration (3 variables)
  ANDROID_SCREENSHOT_DIR: 'android.screenshotDir',
  ANDROID_XML_DIR: 'android.xmlDir',
  ANDROID_SDK_PATH: 'android.sdkPath',

  // Web configuration (4 variables)
  WEB_BROWSER_TYPE: 'web.browserType',
  WEB_HEADLESS: 'web.headless',
  WEB_VIEWPORT_WIDTH: 'web.viewportWidth',
  WEB_VIEWPORT_HEIGHT: 'web.viewportHeight',

  // Image configuration (4 variables)
  IMAGE_MAX_WIDTH: 'image.maxWidth',
  IMAGE_MAX_HEIGHT: 'image.maxHeight',
  IMAGE_QUALITY: 'image.quality',
  OPTIMIZE_IMAGES: 'image.optimize',

  // Preferences (3 variables)
  DARK_MODE: 'preferences.darkMode',
  MIN_DIST: 'preferences.minDist',
  DOC_REFINE: 'preferences.docRefine',
} as const;

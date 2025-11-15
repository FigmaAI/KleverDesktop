/**
 * Application configuration type definitions for config.json
 * This file defines the complete schema for ~/.klever-desktop/config.json
 */

/**
 * Model settings in AppConfig (nested structure)
 * Note: This is different from main/types/model.ts ModelConfig (flat structure)
 * The flat ModelConfig is used by renderer, and handlers convert it to this structure
 */
export interface ModelSettings {
  // Dual mode support: both can be enabled simultaneously
  enableLocal: boolean;
  enableApi: boolean;

  // API model configuration
  api: {
    baseUrl: string;
    key: string;
    model: string;
  };

  // Local model configuration (Ollama)
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
  sdkPath: string;  // Android SDK root path (e.g., /Users/username/Library/Android/sdk)
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
 * Default configuration values
 */
export const DEFAULT_CONFIG: AppConfig = {
  version: '1.0',
  model: {
    enableLocal: true,
    enableApi: false,
    api: {
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      key: '',
      model: 'gpt-4o',
    },
    local: {
      baseUrl: 'http://localhost:11434/v1/chat/completions',
      model: 'qwen3-vl:4b',
    },
  },
  execution: {
    maxTokens: 4096,
    temperature: 0.0,
    requestInterval: 10,
    maxRounds: 20,
  },
  android: {
    screenshotDir: '/sdcard/Pictures',  // Android API 29+ Scoped Storage: use public Pictures directory
    xmlDir: '/sdcard/Documents',        // Android API 29+ Scoped Storage: use public Documents directory for XML files
    sdkPath: '/Volumes/Backup/Android-SDK',  // Android SDK root path
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
  // Model configuration (6 variables)
  MODEL: 'MODEL', // Computed from enableLocal/enableApi
  API_BASE_URL: 'model.api.baseUrl',
  API_KEY: 'model.api.key',
  API_MODEL: 'model.api.model',
  LOCAL_BASE_URL: 'model.local.baseUrl',
  LOCAL_MODEL: 'model.local.model',

  // Execution configuration (4 variables)
  MAX_TOKENS: 'execution.maxTokens',
  TEMPERATURE: 'execution.temperature',
  REQUEST_INTERVAL: 'execution.requestInterval',
  MAX_ROUNDS: 'execution.maxRounds',

  // Android configuration (3 variables)
  ANDROID_SCREENSHOT_DIR: 'android.screenshotDir',
  ANDROID_XML_DIR: 'android.xmlDir',
  ANDROID_HOME: 'android.sdkPath',

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

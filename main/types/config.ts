/**
 * Application configuration type definitions for config.json
 * This file defines the complete schema for ~/.klever-desktop/config.json
 */

/**
 * Individual provider configuration
 * Each provider type can have one registered configuration
 */
export interface ProviderConfig {
  id: string;              // Provider ID (e.g., 'ollama', 'openai', 'anthropic')
  apiKey: string;          // API key (empty for Ollama)
  preferredModel: string;  // Preferred model for this provider (e.g., 'gpt-4o', 'ollama/llama3.2-vision')
  baseUrl?: string;        // Base URL (required for Ollama: http://localhost:11434)
}

/**
 * Last used model selection for task creation
 */
export interface LastUsedModel {
  provider: string;
  model: string;
}

/**
 * Multi-provider model settings
 * Supports multiple registered providers with individual API keys
 * 
 * Reference: https://docs.litellm.ai/docs/providers/ollama
 * - Ollama models use format: "ollama/model_name" (e.g., "ollama/llama3.2-vision")
 * - Ollama requires api_base: "http://localhost:11434"
 * - Ollama does not require API key
 */
export interface ModelSettings {
  providers: ProviderConfig[];  // Registered providers with API keys
  lastUsed?: LastUsedModel;     // Last used provider/model for task creation
}

/**
 * Legacy single-provider model settings (for migration)
 * @deprecated Use ModelSettings with providers array instead
 */
export interface SingleProviderModelSettings {
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
/**
 * Browser channels supported by Browser-Use/Playwright
 */
export type BrowserChannel =
  | 'chromium'        // Playwright's isolated Chromium (default)
  | 'chrome'          // Google Chrome
  | 'chrome-beta'     // Chrome Beta
  | 'chrome-dev'      // Chrome Dev
  | 'chrome-canary'   // Chrome Canary
  | 'msedge'          // Microsoft Edge
  | 'msedge-beta'     // Edge Beta
  | 'msedge-dev'      // Edge Dev
  | 'msedge-canary'   // Edge Canary
  | 'firefox'         // Mozilla Firefox
  | 'webkit';         // WebKit (Safari engine)

export interface WebConfig {
  browserType: BrowserChannel;
  headless: boolean;
}

/**
 * Image processing configuration
 * @deprecated Image optimization is deprecated and no longer used
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
  systemLanguage: 'en' | 'ko';  // System UI language
}

/**
 * Web browser Google login configuration
 */
export interface WebGoogleLoginConfig {
  enabled: boolean;
  profilePath: string;       // Path to browser profile directory
  lastLoginAt?: string;      // ISO timestamp of last successful login
}

/**
 * Android device Google login configuration
 */
export interface AndroidGoogleLoginConfig {
  enabled: boolean;
  deviceId?: string;         // Device ID where login was performed
  lastLoginAt?: string;      // ISO timestamp of last successful login
}

/**
 * Google login configuration for pre-authentication
 * Used to maintain login sessions for automation tasks
 */
export interface GoogleLoginConfig {
  web?: WebGoogleLoginConfig;
  android?: AndroidGoogleLoginConfig;
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
  image?: ImageConfig;  // @deprecated - image optimization is no longer used
  preferences: PreferencesConfig;
  googleLogin?: GoogleLoginConfig;  // Optional Google login pre-authentication
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
  image?: ImageConfig;  // @deprecated - image optimization is no longer used
  preferences: PreferencesConfig;
}

/**
 * Check if config uses very old legacy format (enableLocal/enableApi)
 */
export function isLegacyConfig(config: unknown): config is LegacyAppConfig {
  if (!config || typeof config !== 'object') return false;
  const modelConfig = (config as Record<string, unknown>).model;
  if (!modelConfig || typeof modelConfig !== 'object') return false;
  return 'enableLocal' in modelConfig || 'enableApi' in modelConfig;
}

/**
 * Check if config uses single-provider format (needs migration to multi-provider)
 */
export function isSingleProviderConfig(config: unknown): boolean {
  if (!config || typeof config !== 'object') return false;
  const modelConfig = (config as Record<string, unknown>).model;
  if (!modelConfig || typeof modelConfig !== 'object') return false;
  // Single-provider format has 'provider' field directly, not 'providers' array
  return 'provider' in modelConfig && !('providers' in modelConfig);
}

/**
 * Migrate very old legacy config (enableLocal/enableApi) to multi-provider format
 */
export function migrateConfig(legacy: LegacyAppConfig): AppConfig {
  const legacyModel = legacy.model;
  const providers: ProviderConfig[] = [];
  let lastUsedProvider = 'ollama';
  let lastUsedModel = 'ollama/llama3.2-vision';
  
  // Add Ollama if local was enabled
  if (legacyModel.local?.model) {
    const localModel = legacyModel.local.model;
    const ollamaModel = localModel.startsWith('ollama/') ? localModel : `ollama/${localModel}`;
    providers.push({
      id: 'ollama',
      apiKey: '',
      preferredModel: ollamaModel,
      baseUrl: 'http://localhost:11434',
    });
    if (!legacyModel.enableApi) {
      lastUsedProvider = 'ollama';
      lastUsedModel = ollamaModel;
    }
  }
  
  // Add API provider if enabled
  if (legacyModel.enableApi && legacyModel.api?.model) {
    const provider = legacyModel.api.provider || 'openai';
    providers.push({
      id: provider,
      apiKey: legacyModel.api.key || '',
      preferredModel: legacyModel.api.model,
      baseUrl: legacyModel.api.baseUrl || undefined,
    });
    lastUsedProvider = provider;
    lastUsedModel = legacyModel.api.model;
  }
  
  // Ensure at least Ollama is present
  if (providers.length === 0) {
    providers.push({
      id: 'ollama',
      apiKey: '',
      preferredModel: 'ollama/llama3.2-vision',
      baseUrl: 'http://localhost:11434',
    });
  }
  
  return {
    version: '3.0',
    model: {
      providers,
      lastUsed: {
        provider: lastUsedProvider,
        model: lastUsedModel,
      },
    },
    execution: legacy.execution,
    android: legacy.android,
    web: legacy.web,

    preferences: legacy.preferences,
  };
}

/**
 * Migrate single-provider config to multi-provider format
 */
export function migrateSingleProviderConfig(config: {
  version: string;
  model: SingleProviderModelSettings;
  execution: ExecutionConfig;
  android: AndroidConfig;
  web: WebConfig;

  preferences: PreferencesConfig;
}): AppConfig {
  const { provider, model, apiKey, baseUrl } = config.model;
  
  return {
    version: '3.0',
    model: {
      providers: [{
        id: provider,
        apiKey: apiKey,
        preferredModel: model,
        baseUrl: baseUrl || undefined,
      }],
      lastUsed: {
        provider,
        model,
      },
    },
    execution: config.execution,
    android: config.android,
    web: config.web,

    preferences: config.preferences,
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: AppConfig = {
  version: '3.0',
  model: {
    providers: [
      {
        id: 'ollama',
        apiKey: '',
        preferredModel: 'ollama/llama3.2-vision',
        baseUrl: 'http://localhost:11434',
      },
    ],
    lastUsed: {
      provider: 'ollama',
      model: 'ollama/llama3.2-vision',
    },
  },
  execution: {
    maxTokens: 4096,
    temperature: 0.0,
    requestInterval: 10,
    maxRounds: 20,
  },
  android: {
    screenshotDir: '/sdcard',
    xmlDir: '/sdcard',
    sdkPath: '/Volumes/Backup/Android/sdk',
  },
  web: {
    browserType: 'chromium',
    headless: false,
  },

  preferences: {
    darkMode: false,
    minDist: 30,
    docRefine: false,
    systemLanguage: 'en',
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

  // Web configuration (2 variables)
  WEB_BROWSER_TYPE: 'web.browserType',
  WEB_HEADLESS: 'web.headless',

  // Preferences (3 variables)
  DARK_MODE: 'preferences.darkMode',
  MIN_DIST: 'preferences.minDist',
  DOC_REFINE: 'preferences.docRefine',
} as const;

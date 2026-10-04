/** Settings for native app testing. ChatGPT account credentials stay outside settings. */
export interface AppConfig {
  version: '4.0';
  execution: { maxRounds: number };
  android: { sdkPath: string };
  preferences: { darkMode: boolean; systemLanguage: 'en' | 'ko' | 'zh_CN' };
}

export const DEFAULT_CONFIG: AppConfig = {
  version: '4.0',
  execution: { maxRounds: 20 },
  android: { sdkPath: '' },
  preferences: { darkMode: false, systemLanguage: 'en' },
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Whitelist retained settings so old credentials and removed options never survive migration. */
export function normalizeAppConfig(value: unknown): AppConfig {
  const source = record(value);
  const execution = record(source.execution);
  const android = record(source.android);
  const preferences = record(source.preferences);
  const maxRounds = execution.maxRounds;
  const language = preferences.systemLanguage;
  return {
    version: '4.0',
    execution: {
      maxRounds: typeof maxRounds === 'number' && Number.isInteger(maxRounds) && maxRounds >= 1 && maxRounds <= 200
        ? maxRounds : DEFAULT_CONFIG.execution.maxRounds,
    },
    android: {
      sdkPath: typeof android.sdkPath === 'string' ? android.sdkPath : '',
    },
    preferences: {
      darkMode: typeof preferences.darkMode === 'boolean' ? preferences.darkMode : false,
      systemLanguage: language === 'ko' || language === 'zh_CN' ? language : 'en',
    },
  };
}

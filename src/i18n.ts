import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ko from './locales/ko.json';
import zh_CN from './locales/zh_CN.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'zh_CN', name: 'Simplified Chinese', nativeName: '中文（简体）' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

const resources = {
  en: { translation: en },
  ko: { translation: ko },
  zh_CN: { translation: zh_CN },
};

/**
 * Detect system language and return supported language code
 * Returns 'ko' for Korean, 'zh_CN' for Simplified Chinese, otherwise 'en'
 */
const detectSystemLanguage = (): SupportedLanguage => {
  // Check localStorage first (user preference)
  const savedLang = localStorage.getItem('klever-language');
  if (savedLang && SUPPORTED_LANGUAGES.some(l => l.code === savedLang)) {
    return savedLang as SupportedLanguage;
  }

  // Detect system locale from browser/Electron
  // window.navigator.language reflects system locale in Electron
  const systemLocale = window.navigator.language
    || window.navigator.languages?.[0]
    || 'en';

  // Check if the system language starts with supported language codes
  const lang = systemLocale.toLowerCase();

  if (lang.startsWith('ko')) {
    return 'ko';
  }

  // Chinese language detection
  if (lang.startsWith('zh')) {
    // Traditional Chinese: Taiwan, Hong Kong, Macau
    if (lang.includes('tw') || lang.includes('hk') || lang.includes('mo') || lang.includes('hant')) {
      // For now, default to Simplified until zh_TW is added
      // TODO: Return 'zh_TW' when Traditional Chinese support is added
      return 'zh_CN';
    }
    // Simplified Chinese: Mainland China, Singapore, or general Chinese
    // zh, zh-CN, zh-SG, zh-Hans all map to Simplified
    return 'zh_CN';
  }

  // Default to English for all other languages
  return 'en';
};

const detectedLanguage = detectSystemLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: detectedLanguage, // Use detected language as initial
    fallbackLng: 'en',
    defaultNS: 'translation',

    detection: {
      // Order of detection
      order: ['localStorage', 'navigator'],
      // Keys to lookup language from
      lookupLocalStorage: 'klever-language',
      // Cache user language
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    react: {
      useSuspense: false, // Disable suspense for SSR compatibility
    },
  });

/**
 * Change the application language
 * @param language - Language code ('en', 'ko', or 'zh_CN')
 */
export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(language);
  localStorage.setItem('klever-language', language);
};

/**
 * Get the current language
 * @returns Current language code
 */
export const getCurrentLanguage = (): SupportedLanguage => {
  const lang = i18n.language;
  // Handle cases like 'en-US' -> 'en'
  const shortLang = lang.split('-')[0];
  return SUPPORTED_LANGUAGES.some(l => l.code === shortLang)
    ? (shortLang as SupportedLanguage)
    : 'en';
};

export default i18n;

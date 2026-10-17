/**
 * i18n.ts — i18next initialisation for the app.
 *
 * Package choice rationale:
 *   • i18next + react-i18next: the de-facto standard for React / React Native i18n.
 *     Works synchronously with bundled JSON resources — no network required,
 *     no native modules, compatible with Expo managed workflow.
 *   • expo-localization was intentionally NOT used here: it detects the DEVICE
 *     locale, but this app already stores a user-selected language preference in
 *     AsyncStorage via useSettingsStore. We read that stored value directly on
 *     startup so the app respects the user's explicit in-app choice, not the OS
 *     locale. expo-localization would only be needed as a fallback if no stored
 *     preference exists — which we handle with the 'hi' hardcoded default instead.
 *
 * Startup flow:
 *   1. Module loads → i18next.init() called with lng: 'hi' (synchronous default).
 *   2. initI18nLanguage() is called from I18nProvider on mount:
 *      - Reads AsyncStorage key 'investsuite:settings_v1'.
 *      - Parses JSON → extracts `.language` ('en' | 'hi').
 *      - Calls i18n.changeLanguage() if it differs from 'hi'.
 *   3. I18nProvider subscribes to useSettingsStore so any in-app Settings toggle
 *      calls i18n.changeLanguage() immediately — no restart required.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Bundled translation resources — imported statically so Metro bundles them
// at build time. No dynamic require() — safe for all Expo build targets.
import hi from '../../assets/i18n/hi.json';
import en from '../../assets/i18n/en.json';

const SETTINGS_KEY = 'investsuite:settings_v1';

export type AppLanguage = 'hi' | 'en';

/** Converts camelCase/snake_case/kebab-case into a clean, human-readable label. */
export function humanizeKey(key: string): string {
  if (!key) return '';
  const lastPart = key.split('.').pop() || key;
  return lastPart
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Reads the persisted language preference from AsyncStorage.
 *  Returns 'hi' as the default if nothing is stored or parsing fails. */
export async function getStoredLanguage(): Promise<AppLanguage> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { language?: AppLanguage };
      if (parsed.language === 'en' || parsed.language === 'hi') {
        return parsed.language;
      }
    }
  } catch {
    // ignore — fall through to default
  }
  return 'hi';
}

// Initialise i18next synchronously with bundled resources and 'hi' as the
// boot-time default. The correct stored language is applied asynchronously
// by I18nProvider calling initI18nLanguage() after AsyncStorage is readable.
i18n
  .use(initReactI18next)
  .init({
    resources: {
      hi: { translation: hi },
      en: { translation: en },
    },
    lng: 'hi',          // boot default — overridden by initI18nLanguage()
    fallbackLng: ['en', 'hi'],
    interpolation: {
      escapeValue: false, // React Native does not need HTML escaping
    },
    compatibilityJSON: 'v4', // required for RN bundler (no Intl.PluralRules polyfill needed with v4)
    parseMissingKeyHandler: (key: string, defaultValue?: string) => {
      if (defaultValue) return defaultValue;
      try {
        const enVal = i18n.getResource('en', 'translation', key);
        if (typeof enVal === 'string' && enVal) return enVal;
        const hiVal = i18n.getResource('hi', 'translation', key);
        if (typeof hiVal === 'string' && hiVal) return hiVal;
      } catch {
        // fallback to humanized label below
      }
      return humanizeKey(key);
    },
  });

/** Called once on app mount to align i18next with the persisted preference. */
export async function initI18nLanguage(): Promise<void> {
  const lang = await getStoredLanguage();
  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
}

export default i18n;

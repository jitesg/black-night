/**
 * I18nProvider — Bridges useSettingsStore language preference with i18next.
 *
 * Responsibilities:
 *   1. On mount: reads the persisted language from AsyncStorage and aligns
 *      i18next via initI18nLanguage() (async, one-time).
 *   2. Reactively: subscribes to the `settings.language` value from
 *      useSettingsStore. Whenever the Settings screen calls
 *      update('language', …), this provider detects the change and
 *      immediately calls i18n.changeLanguage() — no app restart needed.
 *
 * Usage: wrap the app root (inside SafeAreaProvider, outside WorkspaceProvider)
 * in _layout.tsx:
 *
 *   <I18nProvider>
 *     <GestureHandlerRootView …>
 *       …
 *     </GestureHandlerRootView>
 *   </I18nProvider>
 */

import { useEffect } from 'react';
import i18n, { initI18nLanguage } from '@/lib/i18n';
import { useSettingsStore } from '@/hooks/useSettingsStore';

interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const { settings, loaded } = useSettingsStore();

  // One-time startup: read AsyncStorage and set the correct initial language.
  // This runs before the settings store has loaded (it may still show DEFAULTS),
  // so we read directly from AsyncStorage for accuracy.
  useEffect(() => {
    initI18nLanguage();
  }, []);

  // Reactive: whenever the settings store has loaded and language changes,
  // immediately propagate to i18next so all t() calls re-render.
  useEffect(() => {
    if (!loaded) return;
    if (i18n.language !== settings.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [settings.language, loaded]);

  // I18nProvider is a pure logic component — it renders its children unchanged.
  // Using a React fragment avoids any extra View wrapper in the component tree.
  return <>{children}</>;
}

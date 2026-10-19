/**
 * useSettingsStore — Persistent settings backed by AsyncStorage.
 *
 * Architecture: Context-based singleton.
 *   Every call to useSettingsStore() returns the SAME shared state instance,
 *   so an update() in any one screen (e.g. language.tsx) is immediately
 *   visible to all other mounted consumers (e.g. I18nProvider, settings/index).
 *
 *   The old per-hook useState implementation created independent state per
 *   caller — an update in one component was invisible to all others, which
 *   is why I18nProvider's reactive useEffect never fired when language.tsx
 *   called update('language', …).
 *
 * Cold-boot theme restore:
 *   SettingsStoreProvider reads the persisted settings inside a useLayoutEffect
 *   so the theme is applied before the first visible frame. The `themeReady`
 *   flag is exposed so the root layout can hold back its own render until
 *   colorScheme.set() has been called, eliminating the light-mode flash on
 *   devices that have Dark theme saved.
 *
 * Usage:
 *   1. Wrap the app root in <SettingsStoreProvider> (done in _layout.tsx).
 *   2. Call useSettingsStore() anywhere — identical signature as before.
 *      No import changes required in any consumer.
 */
import React, {
  createContext, useCallback, useContext, useLayoutEffect, useRef, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';

const KEY = 'investsuite:settings_v1';

export interface SettingsState {
  // Language
  language: 'en' | 'hi';

  // Appearance
  theme: 'light' | 'dark' | 'system';

  // Notifications
  notifReminders: boolean;
  notifCourtAlerts: boolean;
  notifDeadlines: boolean;
  notifDailySummary: boolean;
  notifInvestigations: boolean;

  // AI Assistant
  aiSuggestions: boolean;
  aiDraftAssistance: boolean;
  aiKnowledgeSearch: boolean;
  aiReportGeneration: boolean;
  aiRestrictCaseData: boolean;

  // Reminders
  reminderTime: string;        // "HH:MM" 24h
  reminderSound: 'default' | 'bell' | 'chime' | 'alarm' | 'silent';
  reminderSnooze: 5 | 10 | 15 | 30;
  reminderRepeat: 'once' | 'daily' | 'weekly' | 'monthly';
  reminderEarly: number;       // minutes before (0 = off)
  reminderNag: number;         // repeat-until-done interval in minutes (0 = off)
  reminderPrivate: boolean;    // hide reminder text on the lock screen

  // Search preferences
  searchHistory: boolean;
  smartSuggestions: boolean;
  autocomplete: boolean;
  predictiveSearch: boolean;
  typoTolerance: boolean;
  highlightMatches: boolean;
  instantSearch: boolean;

  // Security
  appLock: boolean;
  pinLock: boolean;
  biometric: boolean;
  autoLockTimeout: 0 | 1 | 5 | 15 | 30; // 0 = Immediately

  // Privacy
  hideSensitive: boolean;

  // Backup meta
  lastBackupDate: string | null;
}

const DEFAULTS: SettingsState = {
  language: 'hi',
  theme: 'system',
  notifReminders: true,
  notifCourtAlerts: true,
  notifDeadlines: true,
  notifDailySummary: false,
  notifInvestigations: true,
  aiSuggestions: true,
  aiDraftAssistance: true,
  aiKnowledgeSearch: true,
  aiReportGeneration: true,
  aiRestrictCaseData: false,
  reminderTime: '09:00',
  reminderSound: 'default',
  reminderSnooze: 10,
  reminderRepeat: 'once',
  reminderEarly: 0,
  reminderNag: 0,
  reminderPrivate: false,
  searchHistory: true,
  smartSuggestions: true,
  autocomplete: true,
  predictiveSearch: true,
  typoTolerance: true,
  highlightMatches: true,
  instantSearch: true,
  appLock: false,
  pinLock: false,
  biometric: false,
  autoLockTimeout: 5,
  hideSensitive: false,
  lastBackupDate: null,
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface SettingsStoreValue {
  settings: SettingsState;
  loaded: boolean;
  /** true once the persisted theme has been read and colorScheme.set() called */
  themeReady: boolean;
  update: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  updateMany: (patch: Partial<SettingsState>) => void;
}

const SettingsStoreContext = createContext<SettingsStoreValue | null>(null);

// ─── Provider (mount once at the app root) ────────────────────────────────────

export function SettingsStoreProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  // Ref to avoid stale-closure issues in update callbacks
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ── Theme restore: useLayoutEffect fires synchronously before paint ──────────
  // useLayoutEffect is the earliest hook that runs before the browser/native
  // compositor commits the first frame.  We kick off the AsyncStorage read
  // here and set themeReady=true only after colorScheme.set() has been called,
  // so the root layout can gate its render on themeReady and the user never
  // sees a light-mode flash on a device with Dark theme saved.
  //
  // Note: AsyncStorage.getItem is always asynchronous (there is no synchronous
  // native AsyncStorage API). useLayoutEffect cannot suspend the commit, but by
  // setting themeReady only after the read resolves — and having the root layout
  // render null until themeReady — we ensure the first painted frame is already
  // in the correct theme rather than flashing then correcting.
  useLayoutEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as Partial<SettingsState>;
          if (parsed.theme) colorScheme.set(parsed.theme);
        }
      } catch {
        // Fail silently — NativeWind system default is fine
      } finally {
        if (!cancelled) setThemeReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Full settings load (runs after theme is ready) ───────────────────────────
  useLayoutEffect(() => {
    if (!themeReady) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as Partial<SettingsState>;
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // use defaults
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [themeReady]);

  const update = useCallback(<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K],
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => null);
      return next;
    });
  }, []);

  const updateMany = useCallback((patch: Partial<SettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => null);
      return next;
    });
  }, []);

  return (
    <SettingsStoreContext.Provider value={{ settings, loaded, themeReady, update, updateMany }}>
      {children}
    </SettingsStoreContext.Provider>
  );
}

// ─── Hook (identical public API as before — no consumer changes needed) ───────

export function useSettingsStore(): SettingsStoreValue {
  const ctx = useContext(SettingsStoreContext);
  if (!ctx) {
    throw new Error('useSettingsStore must be used inside <SettingsStoreProvider>');
  }
  return ctx;
}

/**
 * Reads persisted settings from AsyncStorage directly outside of React components.
 */
export async function getPersistedSettings(): Promise<SettingsState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SettingsState>;
      return { ...DEFAULTS, ...parsed };
    }
  } catch {}
  return DEFAULTS;
}

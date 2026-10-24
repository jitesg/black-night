/* global require */
// Install console interceptor FIRST — must precede all other imports so that
// any console.log/warn/error emitted during module initialisation is captured.
// This is a side-effect-only import; the module overrides console.* globally.
import '@/lib/debugLogStore';
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, View, StyleSheet, Platform } from 'react-native';
import { CopLoader } from '@/components/common/CopLoader';
import { Stack, router, useRouter, useSegments, type RelativePathString } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useFonts } from 'expo-font';

import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { I18nProvider } from '@/components/I18nProvider';
import { SettingsStoreProvider, useSettingsStore } from '@/hooks/useSettingsStore';
import { AppLockProvider, useAppLock } from '@/context/AppLockContext';
import { KeyboardInsetView } from '@/components/common/KeyboardInsetView';
import { getDatabase } from '@/lib/db/database';
import { seedSystemContent, restoreDevContent, getPerSeedFileStatus, seedReady } from '@/lib/db/seedManager';
import { runKnowledgeDiagnostics } from '@/lib/diagnostics/knowledgeDiagnostics';
import * as knowledgeRepo from '@/lib/db/knowledgeRepo';
import { lookupCirculars, isCircularLookupQuery } from '@/ai/circularLookup';
import { lookupSop, isSopLookupQuery } from '@/ai/sopLookup';
import { getAll as getAllSops, getById as getSopById, search as searchSops, getSopStepCount } from '@/ai/sopIndex';
import { migrateCompletedToExecutions, migrateDefaultKaryvahiHindiNames } from '@/lib/db/firKaryvahiRepo';
import { seedDefaultPhrasesIfEmpty } from '@/lib/db/phraseLibraryRepo';
import { AppLogger } from '@/lib/appLogger';
import { clearDevSession } from '@/lib/devOptionsAuth';
import { clearSession } from '@/lib/sysFormatAuth';
import * as Notifications from 'expo-notifications';
import { requestReminderPermissions, setupReminderCategories } from '@/lib/reminderNotifications';
import { resyncReminderNotifications } from '@/lib/reminderService';
import { handleReminderResponse, toResponseLike } from '@/lib/reminderActions';
import { registerReminderBackgroundTask } from '@/lib/reminderBackgroundTask';
import { syncAppNotifications } from '@/lib/appNotificationSync';
import { CD_GAP_KIND } from '@/lib/caseDiaryGapService';
import { AIProviderManager } from '@/ai/level5/AIProviderManager';
import { LearningEngine } from '@/ai/level5/LearningEngine';
import { NAV_THEME } from '@/lib/theme';
import "../global.css";

// ── Background re-lock threshold ──────────────────────────────────────────────
// If the app spends ≥ this many ms in the background, all in-memory PIN sessions
// are invalidated on return to foreground. The blur overlay alone is not enough —
// a user who returns after a long break should be required to re-authenticate.
const BACKGROUND_RELOCK_MS = 2 * 60 * 1000; // 2 minutes

// ── Auth note ────────────────────────────────────────────────────────────────
// This app uses LOCAL SQLite auth (PIN / workspace setup), NOT Supabase Auth.
// ctx.tsx defines SessionProvider / useSession but they are not wired into the
// root layout — the app has no Supabase login flow.  Stack.Protected and
// SessionProvider are intentionally absent here.  If Supabase Auth is added
// in future, wrap the Stack below in <SessionProvider> and gate screens with
// <Stack.Protected guard={!!session}>.

// ── Global crash handler (DEV only) ──────────────────────────────────────────
// Captures unhandled JS errors and stores them in the AppLogger ring-buffer
// before the default error overlay shows. The CRASH entry includes the last
// 100 structured events so every crash is fully self-contained.
// ErrorUtils is a React Native global (polyfilled by Hermes / JSC engine).
declare const ErrorUtils: {
  getGlobalHandler(): (error: Error, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: Error, isFatal?: boolean) => void): void;
};

if (__DEV__) {
  const _prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    AppLogger.crash(
      error?.message ?? String(error),
      error?.stack ?? '',
      'Global',
      isFatal ? 'Fatal Error' : 'Unhandled Error',
    );
    _prevHandler(error, isFatal);
  });
}

// ── One-time migration runner ─────────────────────────────────────────────────
// Checks the app_migrations table for each named migration. If not yet applied,
// runs it inside its own try/catch so one failing migration doesn't block others
// or the rest of app startup. The flag is set ONLY on clean completion — a
// failed migration retries on the next launch (all migrations must be idempotent).
//
// To add a new migration: append a new { name, run } entry to MIGRATIONS below.
// The array is executed in order; earlier entries are checked/applied first.
const MIGRATIONS: Array<{ name: string; run: () => Promise<unknown> }> = [
  {
    name: 'v250_executions_backfill',
    run:  migrateCompletedToExecutions,
  },
  {
    name: 'v290_phrase_library_seed',
    run:  seedDefaultPhrasesIfEmpty,
  },
  {
    name: 'v340_default_karyvahi_hindi_names',
    run:  migrateDefaultKaryvahiHindiNames,
  },
];

async function runOneTimeMigrations(): Promise<void> {
  const db = await getDatabase();
  for (const m of MIGRATIONS) {
    try {
      const applied = await db.getFirstAsync<{ migration_name: string }>(
        'SELECT migration_name FROM app_migrations WHERE migration_name = ?',
        [m.name]
      );
      if (applied) continue; // already done — fast path, no work

      await m.run(); // throws on failure → flag is NOT set → retries next launch
      await db.runAsync(
        'INSERT OR IGNORE INTO app_migrations (migration_name, applied_at) VALUES (?, ?)',
        [m.name, Math.floor(Date.now() / 1000)]
      );
      console.info(`[Migration] ${m.name} — applied and flagged ✓`);
    } catch (err) {
      // Log clearly but do NOT rethrow — a migration failure must not crash the app.
      // The missing flag means it will retry next launch.
      console.error(`[Migration] ${m.name} — FAILED, will retry on next launch:`, err);
      AppLogger.error('Migration', m.name, 'one-time migration failed', err);
    }
  }
}

// ── LoadingSpinner — must sit inside SettingsStoreProvider ───────────────────
// Reads themeReady + the live navTheme so the spinner is already painted in
// the correct (potentially dark) palette from the very first frame, with no
// light-surface flash at any point during DB init.
function LoadingSpinner({
  navTheme, isDark,
}: {
  navTheme: typeof NAV_THEME.light;
  isDark: boolean;
}) {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={navTheme.colors.background} translucent={false} />
      <CopLoader
        background={navTheme.colors.background}
        textColor={navTheme.colors.text}
        mutedColor={isDark ? '#94A3B8' : '#64748B'}
        accent={navTheme.colors.primary}
      />
    </SafeAreaProvider>
  );
}

function AppNavigatorContent({
  isBackground, navTheme, isDark, hideSensitive,
}: {
  isBackground: boolean;
  navTheme: typeof NAV_THEME.light;
  isDark: boolean;
  hideSensitive: boolean;
}) {
  const { locked } = useAppLock();
  const router = useRouter();
  const segments = useSegments() as readonly string[];
  const isAppLockScreen = segments.includes('app-lock');

  useEffect(() => {
    if (!locked || isAppLockScreen) return;
    // Defer one tick so the navigator is mounted before we navigate.
    const id = setTimeout(() => router.replace('/(app)/app-lock/pin-entry'), 0);
    return () => clearTimeout(id);
  }, [locked, isAppLockScreen, router]);

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={navTheme.colors.background}
        translucent={false}
      />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <WorkspaceProvider>
          {/* Keep the navigator mounted while locked: unmounting it and then
              calling router.replace() crashed the app when App Lock turned on.
              The spinner covers the screen until the lock screen opens. */}
          <KeyboardInsetView>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: navTheme.colors.background } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(app)" />
            </Stack>
          </KeyboardInsetView>
          {locked && !isAppLockScreen && (
            <View style={StyleSheet.absoluteFillObject}>
              <LoadingSpinner navTheme={navTheme} isDark={isDark} />
            </View>
          )}
          <PortalHost />
          {/* App-switcher blur shield — covers the entire screen when the app
              is backgrounded so the OS screenshot does not capture FIR/case data. */}
          {isBackground && hideSensitive && (
            <View style={StyleSheet.absoluteFillObject} className="bg-background items-center justify-center">
              <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: `${navTheme.colors.primary}15` }}>
                <View className="w-8 h-8 rounded-lg bg-muted" />
              </View>
            </View>
          )}
        </WorkspaceProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

// ── AppNavigator — must sit inside SettingsStoreProvider ──────────────────────
// Reads themeReady AND dbReady before mounting screens. Both are required:
//   • themeReady — colorScheme.set() has been called; first frame is correct theme.
//   • dbReady    — SQLite schema + seed writes are complete; screens can safely query.
// While either flag is false, a single shared LoadingSpinner is shown so the
// user sees exactly one brief loading state with no flash at any point.
function AppNavigator({
  dbReady, isBackground, navTheme, isDark,
}: {
  dbReady: boolean;
  isBackground: boolean;
  navTheme: typeof NAV_THEME.light;
  isDark: boolean;
}) {
  const { themeReady, settings } = useSettingsStore();

  const ready = themeReady && dbReady;
  // Route to open once the app is ready (notification tap).
  const pendingRouteRef = useRef<string | null>(null);
  const [openTick, setOpenTick] = useState(0);

  // Notification taps: reminder action buttons (snooze / done) are handled here
  // while the app is open; tapping a reminder opens Reminders, tapping a
  // "केस डायरी लंबित" alert opens that FIR's case diary tab.
  useEffect(() => {
    const open = (route: string) => {
      pendingRouteRef.current = route;
      setOpenTick((n) => n + 1);
    };
    const cdRoute = (response: Notifications.NotificationResponse): string | null => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      return data?.kind === CD_GAP_KIND && typeof data.firId === 'string'
        ? `/(app)/mukadma/${data.firId}/case-diary`
        : null;
    };
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const cd = cdRoute(response);
      if (cd) { open(cd); return; }
      const r = toResponseLike(response);
      if (!r.reminderId) return;
      if (r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) open('/(app)/reminders');
      else handleReminderResponse(r);
    });
    // App was closed and opened by tapping a notification.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const cd = cdRoute(response);
      const r = toResponseLike(response);
      if (cd) open(cd);
      else if (r.reminderId && r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) open('/(app)/reminders');
      else return;
      Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
    }).catch(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const route = pendingRouteRef.current;
    if (!ready || !route) return;
    pendingRouteRef.current = null;
    const id = setTimeout(() => {
      try { router.push(route as RelativePathString); } catch {}
    }, 300);
    return () => clearTimeout(id);
  }, [ready, openTick]);

  if (!themeReady || !dbReady) {
    return <LoadingSpinner navTheme={navTheme} isDark={isDark} />;
  }

  return (
    <AppLockProvider>
      <AppNavigatorContent
        isBackground={isBackground}
        navTheme={navTheme}
        isDark={isDark}
        hideSensitive={settings.hideSensitive}
      />
    </AppLockProvider>
  );
}

export default function RootLayout() {
  // dbReady: true once getDatabase() + seedSystemContent() + restoreDevContent()
  // have all resolved. Screens that read from the DB must not mount until this
  // is true — otherwise they race the seeding writes and may see an empty DB.
  const [dbReady, setDbReady] = useState(false);

  // NotoSansDevanagari variable font — loaded once at app root so every screen
  // using T.* typography tokens picks it up via fontFamily:'NotoSansDevanagari'.
  // The font covers the full Unicode Devanagari block with matching weight/baseline
  // to Latin glyphs, eliminating the visual inconsistency between Hindi and English text.
  // On iOS, SF Pro has native Devanagari support so this font is not needed there;
  // on Web (preview), the system font is used as a fallback.
  // oxlint-disable-next-line eslint(no-undef)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-undef
  const fontAsset = (require as any)('../../assets/fonts/NotoSansDevanagari-Regular.ttf') as number;
  const [fontsLoaded, fontError] = useFonts({
    NotoSansDevanagari: fontAsset,
  });
  const isFontReady = Platform.OS === 'web' || fontsLoaded || !!fontError;

  // Active colour scheme — drives StatusBar style + contentStyle background.
  // SettingsStoreProvider (below) kicks off the AsyncStorage read in parallel
  // with DB init so colorScheme.set() completes well before either sequence
  // finishes — the spinner is always painted in the correct theme.
  const { colorScheme: scheme } = useColorScheme();
  const isDark = scheme === 'dark';
  const navTheme = isDark ? NAV_THEME.dark : NAV_THEME.light;

  // ── App-switcher blur shield + background re-lock ────────────────────────
  // When the app moves to the background the OS takes a screenshot for the
  // app-switcher. We show an opaque overlay to prevent sensitive case/FIR data
  // from being visible in that screenshot.
  // Additionally, if the app stays in the background for ≥ BACKGROUND_RELOCK_MS,
  // all in-memory PIN sessions are cleared on return — user must re-authenticate.
  const [isBackground, setIsBackground] = useState(false);
  const appStateRef        = useRef<AppStateStatus>(AppState.currentState);
  const backgroundAtRef    = useRef<number | null>(null);
  const lastReminderResyncRef = useRef(0);

  useEffect(() => {
    AIProviderManager.registerProvider({
      type: 'cloud-llm',
      name: 'Gemini (AI Copilot)',
      isAvailable: true,
      isDefault: true,
      endpoint: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-copilot-provider`,
      timeoutMs: 15000,
      fallbackProvider: 'offline-rules',
    });
    AIProviderManager.setDefaultProvider('cloud-llm');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await requestReminderPermissions();
        await setupReminderCategories();
        await registerReminderBackgroundTask();
      } catch (e) {
        if (__DEV__) console.warn('[Reminders] setup failed:', e);
      }
    })();
  }, []);

  // Once the DB is ready, re-schedule pending reminders (new sound channels,
  // after restore/reboot).
  useEffect(() => {
    if (!dbReady) return;
    resyncReminderNotifications().catch((e) => {
      if (__DEV__) console.warn('[Reminders] resync failed:', e);
    });
  }, [dbReady]);

  useEffect(() => {
    LearningEngine.loadPatterns();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await syncAppNotifications();
      } catch (e) {
        if (__DEV__) console.warn('[AppNotificationSync] Startup sync failed:', e);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;

      if (prev === 'active' && (next === 'background' || next === 'inactive')) {
        // Entering background — show blur shield, record timestamp.
        setIsBackground(true);
        backgroundAtRef.current = Date.now();
      } else if (next === 'active') {
        // Returning to foreground — hide blur shield.
        setIsBackground(false);
        // Re-lock sessions if the app was backgrounded long enough.
        const elapsed = backgroundAtRef.current !== null
          ? Date.now() - backgroundAtRef.current
          : 0;
        backgroundAtRef.current = null;
        if (elapsed >= BACKGROUND_RELOCK_MS) {
          clearDevSession();   // Dev Options PIN session
          clearSession();      // System Format Manager PIN session
        }
        (async () => {
          try {
            await syncAppNotifications();
            // Top up repeat-until-done alerts (at most every 10 minutes).
            if (Date.now() - lastReminderResyncRef.current > 10 * 60000) {
              lastReminderResyncRef.current = Date.now();
              await resyncReminderNotifications();
            }
          } catch (e) {
            if (__DEV__) console.warn('[AppNotificationSync] Active transition sync failed:', e);
          }
        })();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // ── Startup sequence (strictly ordered) ──────────────────────────────────
    // 1. getDatabase()        — opens SQLite, runs schema migrations.
    // 2. seedSystemContent()  — upserts bundled system formats + knowledge.
    // 3. restoreDevContent()  — (DEV only) merges developer-authored content.
    // 4. setDbReady(true)     — unblocks the Navigator so screens can mount.
    //
    // All three steps are fully awaited in sequence. The Navigator is rendered
    // only after step 4, so no screen can call getAllFormats / getFormatById
    // while seeding writes are still in flight.
    (async () => {
      try {
        const t0 = Date.now();
        if (typeof window !== 'undefined') {
          (window as any).__runKnowledgeDiagnostics = runKnowledgeDiagnostics;
          (window as any).__knowledgeRepo = knowledgeRepo;
          (window as any).__seedManager = { getPerSeedFileStatus, seedReady, seedSystemContent };
          (window as any).__circularLookup = { lookupCirculars, isCircularLookupQuery };
          (window as any).__sopLookup = { lookupSop, isSopLookupQuery };
          (window as any).__sopIndex = { getAll: getAllSops, getById: getSopById, search: searchSops, getSopStepCount };
          (window as any).__getDatabase = getDatabase;
        }
        AppLogger.sync('App Start — DB init', { phase: 'start' });

        await getDatabase(); // schema + migrations
        console.info(`[AppStart] DB init complete in ${Date.now() - t0}ms`);

        // ── One-time data migrations (run exactly once per install) ───────────
        // Uses the app_migrations table as a flag store. Each named migration is
        // checked and executed at most once; the flag is set ONLY after a clean
        // successful run. If it throws, the flag is NOT set and it retries on the
        // next startup (safe — all migrations are idempotent / transactional).
        await runOneTimeMigrations();

        const t1 = Date.now();
        const result = await seedSystemContent(); // step 2 — fully awaited
        AppLogger.sync('System Content Update', {
          added: result.added, updated: result.updated, skipped: result.skipped,
        });
        console.info(
          `[AppStart] seedSystemContent complete in ${Date.now() - t1}ms — ` +
          `Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}`
        );

        // Step 3 — DEV only, strictly after step 2.
        if (__DEV__) {
          const t2 = Date.now();
          const devResult = await restoreDevContent(); // fully awaited
          console.info(
            `[AppStart] restoreDevContent complete in ${Date.now() - t2}ms — ` +
            `Added: ${devResult.added}, Updated: ${devResult.updated}, ` +
            `Skipped: ${devResult.skipped} (ran AFTER seedSystemContent ✓)`
          );
          if (devResult.added + devResult.updated > 0) {
            AppLogger.sync('Dev Content Restore', {
              added: devResult.added,
              updated: devResult.updated,
              skipped: devResult.skipped,
            });
          }
        }
      } catch (e) {
        AppLogger.error('App', 'RootLayout', 'DB startup failed', e);
        console.error('[AppStart] DB startup failed:', e);
      } finally {
        // Always unblock the UI — even on error, so the app doesn't freeze.
        setDbReady(true);
      }
    })();
  }, []);

  // SettingsStoreProvider wraps EVERYTHING — including the loading state —
  // so its useLayoutEffect (which reads AsyncStorage and calls colorScheme.set())
  // starts running in parallel with the DB init sequence, not after it.
  // By the time the spinner is first shown, the theme-restore read has had the
  // entire ~1.5-2s DB-init window to complete (AsyncStorage reads take ~5-20ms),
  // so the spinner is painted in the correct theme from the very first frame.
  //
  // Font loading: we wait for fontsLoaded before mounting AppNavigator so the
  // NotoSansDevanagari font is available on the first render of every screen.
  // The spinner is already shown during DB init, so the extra font-load wait
  // (typically <50ms, font is bundled) adds no perceptible delay.
  return (
    <SettingsStoreProvider>
      <I18nProvider>
        <AppNavigator
          dbReady={dbReady && isFontReady}
          isBackground={isBackground}
          navTheme={navTheme}
          isDark={isDark}
        />
      </I18nProvider>
    </SettingsStoreProvider>
  );
}

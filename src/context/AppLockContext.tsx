import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import {
  isAppLockSessionActive, touchAppLockSession, clearAppLockSession,
} from '@/lib/appLockAuth';
import { TIMEOUT_OPTIONS } from '@/app/(app)/settings/security';

interface AppLockContextValue {
  locked: boolean;
  unlock: () => void;
  relock: () => void;
}

const AppLockContext = createContext<AppLockContextValue>({
  locked: false, unlock: () => {}, relock: () => {},
});

export function useAppLock() { return useContext(AppLockContext); }

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettingsStore();
  // Lock only once a PIN exists (pinLock is turned on by PIN setup). Locking
  // with no PIN left the user stuck on a lock screen they couldn't pass.
  const lockEnabled = !!settings.appLock && !!settings.pinLock;
  const [locked, setLocked] = useState(
    () => lockEnabled && !isAppLockSessionActive()
  );
  const backgroundAtRef = useRef<number | null>(null);

  const unlock = () => { touchAppLockSession(); setLocked(false); };
  const relock = () => { clearAppLockSession(); setLocked(true); };

  useEffect(() => {
    if (lockEnabled && !isAppLockSessionActive()) setLocked(true);
  }, [lockEnabled]);

  useEffect(() => {
    // Reuse this app's existing TimeoutVal → milliseconds mapping from
    // settings/security.tsx's timeout-options array (import/reuse it
    // rather than redefining) to convert settings.autoLockTimeout into
    // a millisecond threshold, `timeoutMs` below.
    const option = TIMEOUT_OPTIONS.find((o) => o.value === settings.autoLockTimeout);
    const timeoutMinutes = option !== undefined ? option.value : 5;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    // Lock again only when the session ended (the officer exited the app)
    // or the app sat in the background longer than the auto-lock timeout.
    // "Immediately" (0) means lock on exit only, so quick trips to a file
    // picker, camera or permission dialog don't bring up the lock screen.
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background') {
        backgroundAtRef.current = Date.now();
      } else if (next === 'active') {
        const elapsed = backgroundAtRef.current ? Date.now() - backgroundAtRef.current : 0;
        backgroundAtRef.current = null;
        if (!lockEnabled) return;
        if (!isAppLockSessionActive() || (timeoutMs > 0 && elapsed >= timeoutMs)) relock();
      }
    });
    return () => sub.remove();
  }, [lockEnabled, settings.autoLockTimeout]);

  return (
    <AppLockContext.Provider value={{ locked: lockEnabled && locked, unlock, relock }}>
      {children}
    </AppLockContext.Provider>
  );
}

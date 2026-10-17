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
  const [locked, setLocked] = useState(
    () => !!settings.appLock && !isAppLockSessionActive()
  );
  const backgroundAtRef = useRef<number | null>(null);

  const unlock = () => { touchAppLockSession(); setLocked(false); };
  const relock = () => { clearAppLockSession(); setLocked(true); };

  useEffect(() => {
    if (settings.appLock && !isAppLockSessionActive()) setLocked(true);
  }, [settings.appLock]);

  useEffect(() => {
    // Reuse this app's existing TimeoutVal → milliseconds mapping from
    // settings/security.tsx's timeout-options array (import/reuse it
    // rather than redefining) to convert settings.autoLockTimeout into
    // a millisecond threshold, `timeoutMs` below.
    const option = TIMEOUT_OPTIONS.find((o) => o.value === settings.autoLockTimeout);
    const timeoutMinutes = option !== undefined ? option.value : 5;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundAtRef.current = Date.now();
      } else if (next === 'active') {
        const elapsed = backgroundAtRef.current ? Date.now() - backgroundAtRef.current : 0;
        backgroundAtRef.current = null;
        if (settings.appLock && elapsed >= timeoutMs) relock();
      }
    });
    return () => sub.remove();
  }, [settings.appLock, settings.autoLockTimeout]);

  return (
    <AppLockContext.Provider value={{ locked: !!settings.appLock && locked, unlock, relock }}>
      {children}
    </AppLockContext.Provider>
  );
}

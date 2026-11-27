/**
 * Tablet keyboard keys, JS side (owner, sample क). Scrolling (↓ ↑ PgUp PgDn Space Home End) is done natively in
 * MainActivity (plugins/withHardwareKeys.js); only Ctrl+F / "/" reach JS as DeviceEventEmitter "investsuiteHardwareKey"
 * {kind: "search"} → the current screen's SearchBar (searchFocusRegistry). Started once from index.ts; never throws.
 */
import { DeviceEventEmitter, Platform } from 'react-native';
import { focusCurrentSearch } from './searchFocusRegistry';

let started = false;

export function startHardwareKeys(): void {
  if (started || Platform.OS !== 'android') return;
  started = true;
  try {
    DeviceEventEmitter.addListener('investsuiteHardwareKey', (e: { kind?: string } | undefined) => {
      try { if (e?.kind === 'search') focusCurrentSearch(); } catch { /* ignore */ }
    });
  } catch { /* old APK without the native part — nothing to listen to */ }
}

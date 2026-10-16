/**
 * devContentPersistence.ts — Storage-backend adapter for Developer System Content.
 *
 * ARCHITECTURE
 * ────────────
 * Developer-created System Content (Formats + Knowledge) must survive browser
 * refreshes, Fast Refresh, hot reloads, and app restarts — on ALL platforms.
 *
 * Storage selection is AUTOMATIC — no manual config required:
 *
 *   Expo Web / SQLite Stub active
 *     └─▶ localStorage  (synchronous, survives tab refreshes)
 *
 *   Android / iOS / Real SQLite
 *     └─▶ AsyncStorage  (persisted to device storage, survives app restarts)
 *
 * The decision is made ONCE per session after getDatabase() resolves.
 * Both paths expose an identical async key/value API so callers never
 * need to know which backend is active.
 *
 * PRODUCTION SAFETY
 * ─────────────────
 * This module is imported only from devSeedStore.ts and seedManager.ts,
 * both of which are already gated on __DEV__ by their callers.
 * All keys use the namespace prefix "__investsuite_devcontent_" so they
 * never collide with the SQLite stub's "__investsuite_stub_" tables.
 *
 * KEY SCHEME
 * ──────────
 *  __investsuite_devcontent_formats_v1     → JSON array of SeedFormat
 *  __investsuite_devcontent_knowledge_v1   → JSON array of SeedKnowledge
 *  __investsuite_devcontent_last_export    → ISO timestamp string
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, getIsUsingStub } from './db/database';

// ─── Namespace prefix ─────────────────────────────────────────────────────────
const NS = '__investsuite_devcontent_';

// ─── Keys ─────────────────────────────────────────────────────────────────────
export const DC_KEY_FORMATS     = `${NS}formats_v1`;
export const DC_KEY_KNOWLEDGE   = `${NS}knowledge_v1`;
export const DC_KEY_LAST_EXPORT = `${NS}last_export`;

// ─── Backend resolution ───────────────────────────────────────────────────────
/**
 * Resolve which storage backend to use for the current session.
 * Awaits getDatabase() so _useStub is known before we decide.
 * The decision is cached in-process — subsequent calls are instant.
 */
let _resolvedIsStub: boolean | null = null;

async function _isStub(): Promise<boolean> {
  if (_resolvedIsStub !== null) return _resolvedIsStub;
  // Trigger DB init so getIsUsingStub() returns the correct value.
  await getDatabase();
  _resolvedIsStub = getIsUsingStub();
  return _resolvedIsStub;
}

// ─── localStorage helpers (Web / Stub path) ───────────────────────────────────
function _lsGet(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function _lsSet(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* quota / access denied */ }
}

function _lsRemove(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* access denied */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read a stored value by key.
 * Returns the raw string, or null if not found.
 */
export async function dcGet(key: string): Promise<string | null> {
  if (await _isStub()) {
    return _lsGet(key);
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write a value by key.
 * Silently swallows storage errors — content remains in memory via devSeedStore.
 */
export async function dcSet(key: string, value: string): Promise<void> {
  if (await _isStub()) {
    _lsSet(key, value);
    return;
  }
  try {
    await AsyncStorage.setItem(key, value);
  } catch { /* storage full or unavailable */ }
}

/**
 * Remove a key from storage.
 */
export async function dcRemove(key: string): Promise<void> {
  if (await _isStub()) {
    _lsRemove(key);
    return;
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch { /* ignore */ }
}

/**
 * Remove all developer content keys (used by resetToBundle).
 */
export async function dcClearAll(): Promise<void> {
  await Promise.all([
    dcRemove(DC_KEY_FORMATS),
    dcRemove(DC_KEY_KNOWLEDGE),
    dcRemove(DC_KEY_LAST_EXPORT),
  ]);
}

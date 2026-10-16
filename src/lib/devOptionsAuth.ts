/**
 * devOptionsAuth.ts — PIN authentication for the Developer Options Console.
 *
 * Completely separate from sysFormatAuth (System Format Manager PIN).
 *
 * DESIGN:
 *  - 6-digit numeric PIN.
 *  - PIN existence check: `hasPinSet()` — drives first-time setup vs entry screen.
 *  - Stored in AsyncStorage as SHA-256(salt + pin), with salt stored alongside.
 *  - Format stored: JSON { v: 2, salt: '<hex>', hash: '<hex>' }
 *  - Legacy migration: if stored value is a plain btoa blob (v1), it is detected
 *    on first successful verify and silently re-stored as v2 hash.
 *  - In-memory session with 30-minute timeout (longer than SFM — dev sessions longer).
 *  - Max 5 wrong attempts → 30-second lockout.
 *  - `changePin(current, new)` — available from Change PIN screen inside Dev Options.
 *  - `clearDevSession()` — clears session on explicit sign-out.
 *
 * SECURITY NOTE:
 *  - This is a __DEV__-only module. The PIN protects dev tools from accidental access
 *    by non-developer users on a shared device — not cryptographic security for secrets.
 *  - AsyncStorage is used (not expo-secure-store) for Web compatibility.
 *  - SHA-256 + random salt prevents casual inspection and rainbow-table attacks.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// ── Storage key ───────────────────────────────────────────────────────────────
const PIN_KEY = '__dev_options_pin_v2__';    // v2 key — v1 key is ignored
const PIN_KEY_LEGACY = '__dev_options_pin_v1__';

// ── Session config ────────────────────────────────────────────────────────────
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ATTEMPTS       = 5;
const LOCKOUT_MS         = 30 * 1000;       // 30 seconds

// ── In-memory session state ───────────────────────────────────────────────────
let _sessionAt: number | null    = null;
let _sessionValid                = false;
let _attempts                    = 0;
let _lockedUntil: number | null  = null;

// ── Stored value shape ────────────────────────────────────────────────────────
interface StoredPin {
  v: 2;
  salt: string; // 16 random bytes as hex (32 chars)
  hash: string; // SHA-256(salt + pin) as hex
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

/** Generates a random 16-byte hex salt. */
function _genSalt(): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns SHA-256(salt + pin) as a lower-case hex string. */
async function _hashPin(salt: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + pin,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
}

// ── Legacy v1 decoder (btoa obfuscation — migration path only) ───────────────
function _decodeLegacy(stored: string): string | null {
  try {
    const raw = atob(stored);
    const parts = raw.split(':');
    return parts.length === 3 ? parts[1] : null;
  } catch {
    return null;
  }
}

// ── PIN persistence ───────────────────────────────────────────────────────────

/** Returns true if a v2 Developer Options PIN has been created. */
export async function hasPinSet(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PIN_KEY);
    return val !== null && val.trim().length > 0;
  } catch {
    return false;
  }
}

/** Stores a new PIN as SHA-256 hash (first-time setup — does not require old PIN). */
export async function storePin(pin: string): Promise<void> {
  const salt = _genSalt();
  const hash = await _hashPin(salt, pin.trim());
  const record: StoredPin = { v: 2, salt, hash };
  await AsyncStorage.setItem(PIN_KEY, JSON.stringify(record));
}

/** Changes PIN — requires current PIN to be correct. */
export async function changePin(
  currentPin: string,
  newPin: string,
): Promise<{ ok: boolean; error?: string }> {
  if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
    return { ok: false, error: 'New PIN must be exactly 6 digits.' };
  }
  const ok = await verifyPin(currentPin, /* countAttempt */ false);
  if (!ok) return { ok: false, error: 'Current PIN is incorrect.' };
  try {
    await storePin(newPin.trim());
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to save new PIN.' };
  }
}

/** Removes the stored PIN entirely (developer use only — triggers first-time setup next launch). */
export async function removePin(): Promise<void> {
  await AsyncStorage.multiRemove([PIN_KEY, PIN_KEY_LEGACY]);
  clearDevSession();
}

// ── PIN verification ──────────────────────────────────────────────────────────

/**
 * Verifies the supplied PIN against the stored hash.
 *
 * Migration path: if no v2 record exists but a legacy v1 btoa blob does,
 * we decode and compare it. On success we silently re-store as v2 hash.
 *
 * @param input        The PIN entered by the user.
 * @param countAttempt Whether to track failed attempts / lockout. Default: true.
 */
export async function verifyPin(
  input: string,
  countAttempt = true,
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PIN_KEY);

    let ok = false;

    if (raw) {
      // ── v2 path (hashed) ────────────────────────────────────────────────────
      const stored = JSON.parse(raw) as StoredPin;
      const candidate = await _hashPin(stored.salt, input.trim());
      ok = candidate === stored.hash;
    } else {
      // ── Legacy v1 migration path (btoa obfuscation) ─────────────────────────
      const legacyRaw = await AsyncStorage.getItem(PIN_KEY_LEGACY);
      if (!legacyRaw) return false;
      const decoded = _decodeLegacy(legacyRaw);
      ok = decoded !== null && input.trim() === decoded;
      if (ok) {
        // Silently upgrade to v2 hash on first successful legacy verify.
        await storePin(input.trim());
        await AsyncStorage.removeItem(PIN_KEY_LEGACY);
      }
    }

    if (ok) {
      _sessionValid  = true;
      _sessionAt     = Date.now();
      _attempts      = 0;
      _lockedUntil   = null;
    } else if (countAttempt) {
      _attempts += 1;
      if (_attempts >= MAX_ATTEMPTS) {
        _lockedUntil = Date.now() + LOCKOUT_MS;
        _attempts    = 0;
      }
    }
    return ok;
  } catch {
    return false;
  }
}

// ── Session management ────────────────────────────────────────────────────────

export function isDevSessionActive(): boolean {
  if (!_sessionValid || _sessionAt === null) return false;
  if (Date.now() - _sessionAt > SESSION_TIMEOUT_MS) {
    _sessionValid = false;
    _sessionAt    = null;
    return false;
  }
  return true;
}

export function touchDevSession(): void {
  if (_sessionValid) _sessionAt = Date.now();
}

export function clearDevSession(): void {
  _sessionValid = false;
  _sessionAt    = null;
  _attempts     = 0;
  _lockedUntil  = null;
}

// ── Lockout helpers ───────────────────────────────────────────────────────────

export function isLockedOut(): boolean {
  if (_lockedUntil === null) return false;
  if (Date.now() >= _lockedUntil) { _lockedUntil = null; return false; }
  return true;
}

export function lockoutSecondsRemaining(): number {
  if (_lockedUntil === null) return 0;
  return Math.max(0, Math.ceil((_lockedUntil - Date.now()) / 1000));
}

export function attemptsRemaining(): number {
  return Math.max(0, MAX_ATTEMPTS - _attempts);
}

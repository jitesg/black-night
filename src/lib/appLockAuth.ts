/**
 * appLockAuth.ts — PIN and biometric authentication for App Lock.
 *
 * Completely separate from devOptionsAuth (Developer Options PIN)
 * and sysFormatAuth (System Format Manager PIN).
 *
 * DESIGN:
 *  - 6-digit numeric PIN.
 *  - Separate storage key: `__app_lock_pin_v2__`
 *  - Stored in AsyncStorage as SHA-256(salt + pin) with salt.
 *  - In-memory session that lasts until the app exits.
 *  - Max 5 wrong attempts -> 30-second lockout.
 *  - Biometric wrapper around expo-local-authentication with web guard.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

// ── Storage key ───────────────────────────────────────────────────────────────
const PIN_KEY = '__app_lock_pin_v2__';

// ── Session config ────────────────────────────────────────────────────────────
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

function _genSalt(): string {
  const bytes = Crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function _hashPin(salt: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + pin,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
}

// ── PIN persistence ───────────────────────────────────────────────────────────

/** Returns true if an App Lock PIN has been created. */
export async function hasAppLockPinSet(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PIN_KEY);
    return val !== null && val.trim().length > 0;
  } catch {
    return false;
  }
}

/** Stores a new App Lock PIN as SHA-256 hash. */
export async function setAppLockPin(pin: string): Promise<void> {
  const salt = _genSalt();
  const hash = await _hashPin(salt, pin.trim());
  const record: StoredPin = { v: 2, salt, hash };
  await AsyncStorage.setItem(PIN_KEY, JSON.stringify(record));
}

// ── PIN verification ──────────────────────────────────────────────────────────

/**
 * Verifies the supplied PIN against the stored hash.
 * @param input        The PIN entered by the user.
 * @param countAttempt Whether to track failed attempts / lockout. Default: true.
 */
export async function verifyAppLockPin(
  input: string,
  countAttempt = true,
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PIN_KEY);
    let ok = false;

    if (raw) {
      const stored = JSON.parse(raw) as StoredPin;
      const candidate = await _hashPin(stored.salt, input.trim());
      ok = candidate === stored.hash;
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

// The session lasts until the app exits or is closed (or the auto-lock
// timeout passes in the background). No in-app expiry: a 30-minute expiry
// made the lock screen pop up mid-use, e.g. when opening an add screen.
export function isAppLockSessionActive(): boolean {
  return _sessionValid && _sessionAt !== null;
}

export function touchAppLockSession(): void {
  _sessionValid = true;
  _sessionAt    = Date.now();
}

export function clearAppLockSession(): void {
  _sessionValid = false;
  _sessionAt    = null;
  _attempts     = 0;
  _lockedUntil  = null;
}

// ── Lockout helpers ───────────────────────────────────────────────────────────

export function isAppLockLockedOut(): boolean {
  if (_lockedUntil === null) return false;
  if (Date.now() >= _lockedUntil) { _lockedUntil = null; return false; }
  return true;
}

export function appLockLockoutSecondsRemaining(): number {
  if (_lockedUntil === null) return 0;
  return Math.max(0, Math.ceil((_lockedUntil - Date.now()) / 1000));
}

export function appLockAttemptsRemaining(): number {
  return Math.max(0, MAX_ATTEMPTS - _attempts);
}

// ── Biometric authentication ──────────────────────────────────────────────────

/** Checks if biometric hardware is present and user is enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (process.env.EXPO_OS === 'web') return false;
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  } catch {
    return false;
  }
}

/** Prompts biometric authentication and returns result success boolean. */
export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    if (process.env.EXPO_OS === 'web') return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock InvestSuite',
    });
    return !!result.success;
  } catch {
    return false;
  }
}

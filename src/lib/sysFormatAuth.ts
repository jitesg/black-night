/**
 * System Format Manager — Owner Authentication
 *
 * PIN-based access control for the owner-only System Format module.
 * PIN is stored in AsyncStorage as SHA-256(salt + pin). Session expires
 * after TIMEOUT_MS of inactivity. Supports future biometric/RBAC upgrade.
 *
 * Default PIN: 2025  (owner must change via the module settings on first run)
 *
 * Storage format (v2):  JSON { v: 2, salt: '<hex>', hash: '<hex>' }
 * Legacy migration: if a plain-text v1 value is found, it is compared directly
 * and silently upgraded to v2 hash on first successful login.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PIN_KEY         = '__sfm_owner_pin_v2__';  // v2 key — hashed
const PIN_KEY_LEGACY  = '__sfm_owner_pin__';      // v1 key — plain text
const DEFAULT_PIN     = '2025';
const TIMEOUT_MS      = 15 * 60 * 1000; // 15 minutes

// ── In-memory session ──────────────────────────────────────────────────────
let _sessionAt: number | null = null;
let _sessionValid = false;

// ── Stored value shape ─────────────────────────────────────────────────────
interface StoredPin {
  v: 2;
  salt: string;
  hash: string;
}

// ── Crypto helpers ─────────────────────────────────────────────────────────

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

/** Stores a PIN as a salted SHA-256 hash. */
async function _storeHashed(pin: string): Promise<void> {
  const salt = _genSalt();
  const hash = await _hashPin(salt, pin.trim());
  await AsyncStorage.setItem(PIN_KEY, JSON.stringify({ v: 2, salt, hash } satisfies StoredPin));
}

// ── Session helpers ────────────────────────────────────────────────────────

export function isSessionActive(): boolean {
  if (!_sessionValid || _sessionAt === null) return false;
  if (Date.now() - _sessionAt > TIMEOUT_MS) {
    _sessionValid = false;
    _sessionAt    = null;
    return false;
  }
  return true;
}

export function touchSession(): void {
  if (_sessionValid) _sessionAt = Date.now();
}

export function clearSession(): void {
  _sessionValid = false;
  _sessionAt    = null;
}

// ── PIN management ─────────────────────────────────────────────────────────

export async function verifyPin(input: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PIN_KEY);

    let ok = false;

    if (raw) {
      // ── v2 hashed path ────────────────────────────────────────────────────
      const stored = JSON.parse(raw) as StoredPin;
      const candidate = await _hashPin(stored.salt, input.trim());
      ok = candidate === stored.hash;
    } else {
      // ── Legacy v1 plain-text migration path ───────────────────────────────
      const legacyRaw = await AsyncStorage.getItem(PIN_KEY_LEGACY);
      const legacyPin = legacyRaw ?? DEFAULT_PIN;
      ok = input.trim() === legacyPin.trim();
      if (ok) {
        // Upgrade: hash and store as v2, remove the plain-text v1 entry.
        await _storeHashed(input.trim());
        if (legacyRaw) await AsyncStorage.removeItem(PIN_KEY_LEGACY);
      }
    }

    if (ok) {
      _sessionValid = true;
      _sessionAt    = Date.now();
    }
    return ok;
  } catch {
    return false;
  }
}

/**
 * Returns true if the owner has never set a custom PIN — i.e. the module is
 * still protected only by the factory default '2025'.
 *
 * Logic: if there is no v2 hashed record AND no legacy plain-text record,
 * the default PIN fallback is in effect. This is the only state in which
 * the owner has not yet chosen their own PIN.
 *
 * Used by the auth screen to force a PIN change immediately after the owner
 * first logs in with the default, before granting access to the dashboard.
 */
export async function isDefaultPin(): Promise<boolean> {
  try {
    const v2  = await AsyncStorage.getItem(PIN_KEY);
    if (v2) return false;           // owner has set a hashed PIN — not default
    const v1  = await AsyncStorage.getItem(PIN_KEY_LEGACY);
    if (v1) return false;           // owner had a custom plain-text PIN (being migrated)
    return true;                    // neither key exists → factory default '2025' is active
  } catch {
    return false;                   // safe fallback: don't block access on storage error
  }
}

export async function changePin(currentPin: string, newPin: string): Promise<{ ok: boolean; error?: string }> {
  if (newPin.length < 4) return { ok: false, error: 'PIN must be at least 4 characters.' };
  const valid = await verifyPin(currentPin);
  if (!valid) return { ok: false, error: 'Current PIN is incorrect.' };
  try {
    await _storeHashed(newPin.trim());
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to save new PIN.' };
  }
}

// ── Role helpers (forward-compatible with RBAC) ────────────────────────────

export type OwnerRole = 'owner' | 'guest';

export function getCurrentRole(): OwnerRole {
  return isSessionActive() ? 'owner' : 'guest';
}

export function canEdit():    boolean { return isSessionActive(); }
export function canPublish(): boolean { return isSessionActive(); }
export function canDelete():  boolean { return isSessionActive(); }
export function canArchive(): boolean { return isSessionActive(); }

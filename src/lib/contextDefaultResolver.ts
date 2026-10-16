/**
 * contextDefaultResolver.ts
 *
 * Resolves "@MARKER.field" strings found in FormatKey.default_value at
 * format-fill time, replacing them with live DB values scoped to the
 * current FIR.
 *
 * ── Syntax ────────────────────────────────────────────────────────────────
 *   "@LAST_CD.case_diary_number"  → next sequential diary number for firId
 *   "@LAST_CD.preparation_date"  → preparation_date of most-recent diary
 *                                   (or today if none exists)
 *   "@FIR.ghatnasthal"           → firs.ghatnasthal for firId
 *
 * ── Extension ─────────────────────────────────────────────────────────────
 * To add a new source (e.g. "@WORKSPACE.police_station"), register a new
 * entry in CONTEXT_RESOLVERS below.  Each resolver receives (firId, field)
 * and returns the resolved string (or '' if unresolvable).
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *   const resolved = await resolveContextDefaults(keys, firId);
 *   // resolved is Record<keyName, resolvedValue> — only entries with
 *   // "@"-markers are included; static defaults are left untouched.
 */

import { getCaseDiariesByFIR, getNextDiaryNumber } from './db/caseDiaryRepo';
import { getFIRById } from './db/firRepo';

// ── Utility ────────────────────────────────────────────────────────────────

/** Returns today as YYYY-MM-DD in local time (never UTC-shifted). */
function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Zero-pads a positive integer to at least 2 digits. */
function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

// ── Resolver functions ─────────────────────────────────────────────────────

/** Resolvers for @LAST_CD.* markers */
const LAST_CD_RESOLVERS: Record<string, (firId: string) => Promise<string>> = {
  case_diary_number: async (firId) => {
    const next = await getNextDiaryNumber(firId);
    return padTwo(next);
  },
  preparation_date: async (firId) => {
    const diaries = await getCaseDiariesByFIR(firId);
    if (!diaries.length) return todayLocalISO();
    // Most recent diary (getCaseDiariesByFIR orders DESC)
    return diaries[0].preparation_date ?? todayLocalISO();
  },
};

/** Resolvers for @FIR.* markers */
const FIR_RESOLVERS: Record<string, (firId: string) => Promise<string>> = {
  ghatnasthal: async (firId) => {
    const fir = await getFIRById(firId);
    return fir?.ghatnasthal ?? '';
  },
  fir_number: async (firId) => {
    const fir = await getFIRById(firId);
    return fir?.fir_number ?? '';
  },
  section: async (firId) => {
    const fir = await getFIRById(firId);
    return fir?.section ?? '';
  },
  complainant_name: async (firId) => {
    const fir = await getFIRById(firId);
    return fir?.complainant_name ?? '';
  },
};

/**
 * Top-level registry: maps each "@PREFIX" to its field-resolver map.
 * Add a new entry here to support a new context source.
 */
const CONTEXT_RESOLVERS: Record<string, Record<string, (firId: string) => Promise<string>>> = {
  LAST_CD: LAST_CD_RESOLVERS,
  FIR: FIR_RESOLVERS,
};

// ── Legacy marker mapping ──────────────────────────────────────────────────
//
// The seed JSON uses "__FROM_*__" as raw default_value strings.  We translate
// them here to the canonical "@PREFIX.field" syntax so a single resolver
// handles both forms.  No other code needs to know about the legacy strings.

const LEGACY_MARKER_MAP: Record<string, string> = {
  '__FROM_LAST_CD_NUMBER__': '@LAST_CD.case_diary_number',
  '__FROM_LAST_CD_DATE__':   '@LAST_CD.preparation_date',
  '__FROM_RELATED_FIR__':    '@FIR.ghatnasthal',
};

/** Normalise a default_value to canonical "@PREFIX.field" form (or return as-is). */
function _normaliseMarker(dv: string): string {
  return LEGACY_MARKER_MAP[dv] ?? dv;
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Minimum shape we need from a FormatKey to detect marker defaults. */
export interface KeyWithDefault {
  key_name: string;
  default_value?: string | null;
}

/**
 * Scans `keys` for "@PREFIX.field" markers (and legacy "__FROM_*__" markers)
 * in their default_value and resolves each one against `firId`.
 *
 * Legacy markers recognised and translated transparently:
 *   __FROM_LAST_CD_NUMBER__   →  @LAST_CD.case_diary_number
 *   __FROM_LAST_CD_DATE__     →  @LAST_CD.preparation_date
 *   __FROM_RELATED_FIR__      →  @FIR.ghatnasthal
 *
 * @param keys     Array of FormatKey-like objects (only key_name + default_value needed)
 * @param firId    Current FIR id; if falsy, all markers return ''
 * @returns        Record<keyName, resolvedString> — only marker keys included.
 *                 Static default_value strings are NOT included (caller keeps them).
 */
export async function resolveContextDefaults(
  keys: KeyWithDefault[],
  firId: string | undefined | null,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const key of keys) {
    const raw = key.default_value;
    if (!raw) continue;

    // Accept both "@PREFIX.field" and legacy "__FROM_*__" forms
    const isAtMarker     = raw.startsWith('@');
    const isLegacyMarker = raw.startsWith('__FROM_') && raw.endsWith('__');
    if (!isAtMarker && !isLegacyMarker) continue;  // static default — skip

    if (!firId) { result[key.key_name] = ''; continue; }

    // Normalise legacy "__FROM_*__" → "@PREFIX.field"
    const dv = _normaliseMarker(raw);

    // Parse "@PREFIX.field"
    const withoutAt = dv.slice(1);              // "LAST_CD.case_diary_number"
    const dot = withoutAt.indexOf('.');
    if (dot === -1) { result[key.key_name] = ''; continue; }

    const prefix = withoutAt.slice(0, dot);     // "LAST_CD"
    const field  = withoutAt.slice(dot + 1);    // "case_diary_number"

    const prefixResolvers = CONTEXT_RESOLVERS[prefix];
    if (!prefixResolvers) {
      console.warn(`[contextDefaultResolver] Unknown marker prefix: @${prefix}`);
      result[key.key_name] = '';
      continue;
    }

    const fieldResolver = prefixResolvers[field];
    if (!fieldResolver) {
      console.warn(`[contextDefaultResolver] Unknown field "${field}" for prefix @${prefix}`);
      result[key.key_name] = '';
      continue;
    }

    try {
      result[key.key_name] = await fieldResolver(firId);
    } catch (e) {
      console.warn(`[contextDefaultResolver] Failed to resolve @${prefix}.${field}:`, e);
      result[key.key_name] = '';
    }
  }

  return result;
}

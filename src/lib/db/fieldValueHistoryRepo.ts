/**
 * fieldValueHistoryRepo — Cross-module field value autocomplete index.
 *
 * Design:
 *   • ONE shared table `field_value_history` keyed by canonical semantic keys
 *     (see FIELD_KEYS). Modules funnel their fields into the same bucket so
 *     suggestions merge correctly regardless of origin screen.
 *   • Write: recordFieldValue(fieldKey, value) — trim whitespace, skip blanks,
 *     UPSERT (insert or increment use_count + bump last_used_at). Called once
 *     per save, NOT on every keystroke.
 *   • Read:  getSuggestions(fieldKey, prefix, limit) — prefix match,
 *     ordered by use_count DESC, last_used_at DESC.
 *
 * Canonical key constants (FIELD_KEYS) are exported so call-sites use typed
 * identifiers rather than raw strings, preventing typo-drift.
 */

import { getDatabase, generateUUID, nowTimestamp } from './database';
import { scoredFuzzyMatch } from '@/lib/searchUtils';

// ── Canonical field key constants ─────────────────────────────────────────────
export const FIELD_KEYS = {
  person_name:          'person_name',
  father_husband_name:  'father_husband_name',
  address:              'address',
  police_station:       'police_station',
  section:              'section',
  fir_number:           'fir_number',
  caste:                'caste',
  case_matter:          'case_matter',
} as const;

export type FieldKey = typeof FIELD_KEYS[keyof typeof FIELD_KEYS];

// ── Record ─────────────────────────────────────────────────────────────────────

/**
 * Record a single (fieldKey, value) pair on save.
 *
 * Dedupe: if (field_key, LOWER(TRIM(value))) already exists, increment
 * use_count and bump last_used_at — do NOT insert a duplicate row.
 * Stores the trimmed value as-typed for correct display in suggestions.
 *
 * Silently no-ops on empty/whitespace-only values.
 */
export async function recordFieldValue(fieldKey: FieldKey, value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) return;

  const db = await getDatabase();
  const normalized = trimmed.toLowerCase();

  // Check for an existing row matching this canonical (field_key, normalized value)
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM field_value_history
     WHERE field_key = ? AND LOWER(TRIM(value)) = ?`,
    [fieldKey, normalized]
  );

  const now = nowTimestamp();

  if (existing) {
    await db.runAsync(
      `UPDATE field_value_history
         SET use_count = use_count + 1, last_used_at = ?
       WHERE id = ?`,
      [now, existing.id]
    );
  } else {
    const id = generateUUID();
    await db.runAsync(
      `INSERT INTO field_value_history (id, field_key, value, use_count, last_used_at)
       VALUES (?, ?, ?, 1, ?)`,
      [id, fieldKey, trimmed, now]
    );
  }
}

/**
 * Record multiple values for the same field key in one call.
 * Convenience wrapper — iterates and calls recordFieldValue for each non-blank.
 */
export async function recordFieldValues(fieldKey: FieldKey, values: string[]): Promise<void> {
  for (const v of values) {
    await recordFieldValue(fieldKey, v);
  }
}

// ── Query ──────────────────────────────────────────────────────────────────────

export interface FieldValueSuggestion {
  value: string;
  use_count: number;
}

/**
 * Return up to `limit` suggestions for `fieldKey` whose value starts with `prefix`.
 * Ordered by use_count DESC, last_used_at DESC (most-used / most-recent first).
 *
 * When typoTolerant is true:
 *   Widens SQL to LIKE '%' || ? || '%' on the first 2 chars, fetches up to limit * 4
 *   candidates by use_count DESC, post-filters and sorts with scoredFuzzyMatch(trimmedPrefix, value)
 *   (matched:true, sort score desc then use_count desc), and returns top limit.
 *
 * Returns an empty array for blank prefixes so the dropdown doesn't appear
 * before the officer has typed anything.
 */
export async function getSuggestions(
  fieldKey: FieldKey,
  prefix: string,
  limit = 8,
  typoTolerant = false
): Promise<FieldValueSuggestion[]> {
  const trimmedPrefix = prefix.trim();
  if (!trimmedPrefix) return [];

  const db = await getDatabase();

  if (typoTolerant) {
    const searchPattern = trimmedPrefix.length >= 2 ? trimmedPrefix.slice(0, 2) : trimmedPrefix;
    const candidates = await db.getAllAsync<FieldValueSuggestion>(
      `SELECT value, use_count
         FROM field_value_history
        WHERE field_key = ? AND value LIKE '%' || ? || '%'
        ORDER BY use_count DESC, last_used_at DESC
        LIMIT ?`,
      [fieldKey, searchPattern, limit * 4]
    );

    return candidates
      .map((c) => ({ ...c, match: scoredFuzzyMatch(trimmedPrefix, c.value) }))
      .filter((c) => c.match.matched)
      .sort((a, b) => {
        if (b.match.score !== a.match.score) {
          return b.match.score - a.match.score;
        }
        return b.use_count - a.use_count;
      })
      .slice(0, limit)
      .map(({ value, use_count }) => ({ value, use_count }));
  }

  return db.getAllAsync<FieldValueSuggestion>(
    `SELECT value, use_count
       FROM field_value_history
      WHERE field_key = ? AND value LIKE ? || '%'
      ORDER BY use_count DESC, last_used_at DESC
      LIMIT ?`,
    [fieldKey, trimmedPrefix, limit]
  );
}

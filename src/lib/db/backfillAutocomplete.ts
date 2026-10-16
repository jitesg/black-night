/**
 * backfillAutocomplete — One-time developer backfill of field_value_history.
 *
 * Covers the three source tables that the automatic boot-time backfill in
 * database.ts (_backfillFieldValueHistory, sentinel v280) does NOT include:
 *
 *   firs                        → crime_type, police_station
 *   gd_entries                  → gd_type
 *   prarthna_patra              → petition_type
 *   prarthna_patra_complainants → name, father_husband_name, full_address,
 *                                  police_station, jati
 *   prarthna_patra_accused      → name, father_name, full_address,
 *                                  police_station, jati
 *
 * Idempotency: guarded by a sentinel row in app_migrations so the heavy
 * SELECT + UPSERT work only runs once per device, even if the developer
 * presses the button multiple times.  A second press returns immediately
 * with { skipped: true }.
 *
 * UPSERT strategy: mirrors recordFieldValue in fieldValueHistoryRepo.ts —
 * dedupe on (field_key, LOWER(TRIM(value))), increment use_count on collision.
 */

import { getDatabase, generateUUID, nowTimestamp } from './database';
import type { FieldKey } from './fieldValueHistoryRepo';

// Sentinel written to app_migrations once the backfill completes.
const SENTINEL = 'backfill_autocomplete_gd_pp_v1';

export interface BackfillResult {
  /** True when the sentinel was already present — no work was done. */
  skipped: boolean;
  /** Number of (field_key, value) pairs upserted. */
  upserted: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Trim + blank-check normalisation shared by all source rows. */
function normalise(raw: string | null | undefined): string {
  return (raw ?? '').trim();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run the autocomplete backfill.
 *
 * Safe to call from any async context; acquires the app singleton DB via
 * getDatabase() — the same pattern used by every other repo in this module.
 *
 * @returns BackfillResult — callers can surface { upserted } in the UI.
 */
export async function runAutocompleteBackfill(): Promise<BackfillResult> {
  const db = await getDatabase();

  // ── Idempotency guard ────────────────────────────────────────────────────
  const already = await db.getFirstAsync<{ migration_name: string }>(
    `SELECT migration_name FROM app_migrations WHERE migration_name = ?`,
    [SENTINEL]
  );
  if (already) return { skipped: true, upserted: 0 };

  const now = nowTimestamp();
  let upserted = 0;

  /**
   * Upsert a single (fieldKey, rawValue) pair.
   * Mirrors _backfillFieldValueHistory in database.ts — dedupe on the
   * canonical lower-trimmed value, increment use_count on collision.
   */
  const upsert = async (fieldKey: FieldKey, rawValue: string | null | undefined) => {
    const trimmed = normalise(rawValue);
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();

    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM field_value_history
       WHERE field_key = ? AND LOWER(TRIM(value)) = ?`,
      [fieldKey, normalized]
    );

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
    upserted += 1;
  };

  // ── 1. firs → crime_type, police_station ─────────────────────────────────
  // fir_number / section / complainant_name are already covered by the v280
  // boot backfill; only the two missing fields are harvested here.
  const firs = await db.getAllAsync<{
    crime_type: string;
  }>(
    `SELECT crime_type
       FROM firs
      WHERE deleted_at IS NULL`
  );
  for (const row of firs) {
    await upsert('crime_type' as FieldKey, row.crime_type);
  }

  // workspace_settings holds the officer's own police station.
  const ws = await db.getFirstAsync<{ police_station: string }>(
    `SELECT police_station FROM workspace_settings LIMIT 1`
  );
  if (ws) {
    await upsert('police_station' as FieldKey, ws.police_station);
  }

  // gram_panchayats also stores police_station values entered by the officer.
  const gpStations = await db.getAllAsync<{ police_station: string }>(
    `SELECT DISTINCT police_station FROM gram_panchayats WHERE deleted_at IS NULL`
  );
  for (const row of gpStations) {
    await upsert('police_station' as FieldKey, row.police_station);
  }

  // ── 2. gd_entries → gd_type ──────────────────────────────────────────────
  const gdRows = await db.getAllAsync<{ gd_type: string }>(
    `SELECT gd_type FROM gd_entries WHERE deleted_at IS NULL`
  );
  for (const row of gdRows) {
    await upsert('case_matter' as FieldKey, row.gd_type);
  }

  // ── 3. prarthna_patra → petition_type ────────────────────────────────────
  const ppRows = await db.getAllAsync<{ petition_type: string }>(
    `SELECT petition_type FROM prarthna_patra WHERE deleted_at IS NULL`
  );
  for (const row of ppRows) {
    await upsert('case_matter' as FieldKey, row.petition_type);
  }

  // ── 4. prarthna_patra_complainants — person fields ────────────────────────
  const ppcRows = await db.getAllAsync<{
    name: string;
    father_husband_name: string;
    full_address: string;
    police_station: string;
    jati: string;
  }>(
    `SELECT name, father_husband_name, full_address, police_station, jati
       FROM prarthna_patra_complainants
      WHERE deleted_at IS NULL`
  );
  for (const row of ppcRows) {
    await upsert('person_name'         as FieldKey, row.name);
    await upsert('father_husband_name' as FieldKey, row.father_husband_name);
    await upsert('address'             as FieldKey, row.full_address);
    await upsert('police_station'      as FieldKey, row.police_station);
    await upsert('caste'               as FieldKey, row.jati);
  }

  // ── 5. prarthna_patra_accused — person fields ─────────────────────────────
  const ppaRows = await db.getAllAsync<{
    name: string;
    father_name: string;
    full_address: string;
    police_station: string;
    jati: string;
  }>(
    `SELECT name, father_name, full_address, police_station, jati
       FROM prarthna_patra_accused
      WHERE deleted_at IS NULL`
  );
  for (const row of ppaRows) {
    await upsert('person_name'         as FieldKey, row.name);
    await upsert('father_husband_name' as FieldKey, row.father_name);
    await upsert('address'             as FieldKey, row.full_address);
    await upsert('police_station'      as FieldKey, row.police_station);
    await upsert('caste'               as FieldKey, row.jati);
  }

  // ── Write sentinel ────────────────────────────────────────────────────────
  await db.runAsync(
    `INSERT OR IGNORE INTO app_migrations (migration_name) VALUES (?)`,
    [SENTINEL]
  );

  return { skipped: false, upserted };
}

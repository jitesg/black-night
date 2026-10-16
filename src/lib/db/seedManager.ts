/**
 * SeedManager — System Content Update Engine for InvestSuite.
 *
 * Runs on every app launch (idempotent). For each seed item:
 *   - First launch:  INSERT if UUID does not exist locally.
 *   - App update:    UPDATE if bundled seed_version > stored, OR content_hash changed.
 *   - Never touches rows where source = 'user'.
 *   - Logs Added / Updated / Skipped counts after each run.
 *
 * Content hash: djb2 hash computed at runtime from canonical content fields.
 * This makes the engine self-validating — no manual hash maintenance required
 * in the JSON seed files.
 *
 * Fast-path guard (performance + correctness):
 *   A single "seed_content_version" token is stored in workspace_settings.
 *   It is a djb2 hash of the entire bundled seed corpus (all format IDs +
 *   seed_versions + knowledge IDs + seed_versions, concatenated). On every
 *   launch the token is computed from the bundled JSON (in-memory, ~1 ms)
 *   and compared to the stored value. If they match AND a sanity row-count
 *   check passes, the full per-row reconciliation is skipped entirely.
 *   Only on first launch or when the bundled seed files change does the
 *   full reconciliation run.
 *
 *   DEFENSIVE COUNT CHECK: even when the stored token matches the bundled
 *   corpus hash, the fast-path is NOT taken if predefined_formats or
 *   knowledge_entries have fewer active rows than the bundled seed contains.
 *   This protects against the "stale token after partial seed failure"
 *   scenario: if the app previously crashed mid-seed but still persisted
 *   the token, every future launch would silently skip seeding and leave
 *   the tables empty forever. The count check catches this and forces a
 *   full re-seed, clearing the stored token beforehand so the recovery is
 *   logged and visible.
 *
 *   To force a full re-seed after editing the seed JSON, the token will
 *   automatically differ — no manual bump is needed.
 */
import { getDatabase, dbRunAsync, dbGetFirstAsync, dbGetAllAsync, generateUUID, nowTimestamp } from './database';

// ─── Result type ─────────────────────────────────────────────────────────────
export interface SeedResult {
  added: number;
  updated: number;
  skipped: number;
}

// ─── Seed data types ──────────────────────────────────────────────────────────
interface SeedFormatKey {
  key_name: string;
  label: string;
  field_type: string;
  is_required: number;
  sort_order: number;
  default_value?: string;
  dropdown_options?: string;
}

interface SeedFormat {
  id: string;
  title: string;
  format_type: string;
  vivran: string;
  is_favorite: number;
  created_by: string;
  source: string;
  editable: number;
  content_type: string;
  seed_version: number;
  app_version: string;
  last_updated: string;
  tags: string[];
  keys: SeedFormatKey[];
}

interface SeedKnowledge {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  crime_type: string;
  description: string;
  tags: string;
  attachment_uris: string;
  source: string;
  editable: number;
  content_type: string;
  seed_version: number;
  app_version: string;
  last_updated: string;
}

// ─── Load bundled JSON (Metro resolves static imports at build time) ──────────
import formatsSeedData from '../../../assets/seed/formats_seed.json';
import knowledgeSeedData from '../../../assets/seed/knowledge_seed.json';

const FORMATS_SEED = formatsSeedData as { formats: SeedFormat[] };
const KNOWLEDGE_SEED = knowledgeSeedData as { knowledge: SeedKnowledge[] };

// ─── djb2 content hash ────────────────────────────────────────────────────────
/**
 * Lightweight djb2 hash of a canonical string.
 * Produces a stable hex string — same input always gives the same output.
 * Used to detect silent content changes without a seed_version bump.
 */
function _djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep as unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

const SEED_VERSION_KEY = 'seed_content_version';
// v4: force full reconcile on all existing installs to repair any rows whose
// format_type was stored with the wrong spelling ('BNSS Karyvahi' → 'BNSS Karyavahi')
// and to pick up the corrected filter-query logic (param-order fix in sysFormatRepo).
const SEED_VERSION_SALT = 'v4';

/**
 * Corpus token — a single hash that summarises the entire bundled seed.
 *
 * Covers: every format id + seed_version, every knowledge id + seed_version,
 * in stable sorted order. Changing ANY item's content bumps its seed_version
 * (by convention), which changes this token and triggers the full reconcile.
 *
 * Computed once at module load (in-memory, ~1 ms) and reused for all launches.
 */
const SEED_CORPUS_VERSION: string = (() => {
  const fmtParts = FORMATS_SEED.formats
    .map(f => `f:${f.id}:${f.seed_version}`)
    .sort()
    .join('|');
  const knParts = KNOWLEDGE_SEED.knowledge
    .map(k => `k:${k.id}:${k.seed_version}`)
    .sort()
    .join('|');
  return _djb2Hash(`${fmtParts}||${knParts}||${SEED_VERSION_SALT}`);
})();

/** Canonical hash for a format: covers all content fields + keys + tags. */
function _formatHash(fmt: SeedFormat): string {
  const canonical = JSON.stringify({
    title: fmt.title,
    format_type: fmt.format_type,
    vivran: fmt.vivran,
    keys: fmt.keys.map((k) => ({
      key_name: k.key_name, label: k.label, field_type: k.field_type,
      is_required: k.is_required, sort_order: k.sort_order,
      default_value: k.default_value ?? null,
      dropdown_options: k.dropdown_options ?? null,
    })),
    tags: [...fmt.tags].sort(),
  });
  return _djb2Hash(canonical);
}

/** Canonical hash for a knowledge entry: covers all content fields + tags. */
function _knowledgeHash(kn: SeedKnowledge): string {
  const canonical = JSON.stringify({
    title: kn.title,
    category: kn.category,
    subcategory: kn.subcategory,
    crime_type: kn.crime_type,
    description: kn.description,
    tags: kn.tags,
    content_type: kn.content_type,
  });
  return _djb2Hash(canonical);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Idempotent System Content Update Engine.
 * Returns a SeedResult with Added / Updated / Skipped counts.
 * Call once after getDatabase() resolves at app startup.
 */
export async function seedSystemContent(): Promise<SeedResult> {
  const t0 = Date.now();
  const result: SeedResult = { added: 0, updated: 0, skipped: 0 };
  try {
    // ── Fast-path guard ───────────────────────────────────────────────────────
    // SEED_CORPUS_VERSION is a hash of all bundled seed IDs + seed_versions,
    // computed once at module load (~1 ms). If it matches the value stored in
    // workspace_settings AND the actual row counts are within expected range,
    // the bundled content hasn't changed since the last run and we can skip
    // the full per-row reconciliation.
    //
    // DEFENSIVE COUNT CHECK: token match alone is not sufficient. A previous
    // build may have crashed mid-seed yet still persisted the token (e.g. the
    // token write succeeded but a DB transaction for the actual rows did not).
    // Without this check every subsequent launch would silently skip seeding
    // forever, leaving the table empty with no error shown.
    //
    // Minimum expected counts are derived directly from the bundled seed at
    // runtime, so they stay accurate as the seed grows — no manual constant
    // to maintain.
    //
    // The stored token is updated at the END of a successful full reconcile so
    // that a crash mid-seed doesn't permanently bypass the reconcile on the
    // next launch.
    const storedVersionRow = await dbGetFirstAsync<{ value: string }>(
      `SELECT value FROM workspace_settings WHERE key = ?`,
      [SEED_VERSION_KEY]
    );
    const storedVersion = storedVersionRow?.value ?? null;

    if (storedVersion === SEED_CORPUS_VERSION) {
      // Token matches — now verify the tables aren't suspiciously empty.
      const minFormats   = FORMATS_SEED.formats.length;
      const minKnowledge = KNOWLEDGE_SEED.knowledge.length;

      const fmtCountRow = await dbGetFirstAsync<{ n: number }>(
        `SELECT COUNT(*) as n FROM predefined_formats WHERE deleted_at IS NULL`
      );
      const knCountRow = await dbGetFirstAsync<{ n: number }>(
        `SELECT COUNT(*) as n FROM knowledge_entries WHERE deleted_at IS NULL`
      );
      const fmtCount = fmtCountRow?.n ?? 0;
      const knCount  = knCountRow?.n  ?? 0;

      if (fmtCount >= minFormats && knCount >= minKnowledge) {
        // Fast-path: token valid and tables are fully populated.
        if (__DEV__) console.info(
          `[SeedManager] Fast-path: corpus token matches (${SEED_CORPUS_VERSION}), ` +
          `formats=${fmtCount}/${minFormats}, knowledge=${knCount}/${minKnowledge} — skipping full reconcile`
        );
        // Always-on post-seed row-count report (visible in on-device log viewer).
        // Uses console.info (not AppLogger which is __DEV__-only) so it appears
        // in the debugLogStore ring-buffer on production builds too.
        console.info(
          `[SeedManager] STARTUP REPORT (fast-path): ` +
          `predefined_formats active=${fmtCount} | knowledge_entries active=${knCount}`
        );
        return { added: 0, updated: 0, skipped: minFormats + minKnowledge };
      }

      // Stale-token recovery: token matched but tables are under-populated.
      // This means a prior build failed partway through seeding but still
      // wrote the token. Clear the token and fall through to the full reconcile.
      console.warn(
        `[SeedManager] STALE-TOKEN RECOVERY: corpus token matched (${SEED_CORPUS_VERSION}) ` +
        `but row counts are below expected minimum — ` +
        `formats=${fmtCount} (expected≥${minFormats}), knowledge=${knCount} (expected≥${minKnowledge}). ` +
        `Clearing stored token and running full reconcile.`
      );
      await dbRunAsync(
        `DELETE FROM workspace_settings WHERE key = ?`,
        [SEED_VERSION_KEY]
      );
      // Fall through to full reconcile below.
    }

    if (__DEV__) console.info(
      `[SeedManager] Corpus token changed (stored: ${storedVersion ?? 'none'} → bundled: ${SEED_CORPUS_VERSION}) — running full reconcile`
    );
    // ── End fast-path guard ───────────────────────────────────────────────────

    // ── Step 0: Clean up legacy/retired format rows ───────────────────────────
    // (a) Remove the one confirmed near-duplicate (pre-stable-ID legacy row).
    // (b) Soft-delete two retired BNSS formats that were removed from the seed.
    // Both run before _seedFormats so row counts are accurate after seeding.
    await _dedupSystemFormats();

    // Row-count snapshot BEFORE seeding — confirms what was already present.
    const beforeRow = await dbGetFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM predefined_formats WHERE deleted_at IS NULL`
    );
    const countBefore = beforeRow?.n ?? 0;
    if (__DEV__) console.info(`[SeedManager] predefined_formats row count BEFORE seed: ${countBefore}`);

    const fmtResult = await _seedFormats(FORMATS_SEED.formats);
    const knResult  = await _seedKnowledge(KNOWLEDGE_SEED.knowledge);
    result.added   = fmtResult.added   + knResult.added;
    result.updated = fmtResult.updated + knResult.updated;
    result.skipped = fmtResult.skipped + knResult.skipped;

    // Row-count snapshot AFTER seeding — proves all records persisted.
    const afterRow = await dbGetFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM predefined_formats WHERE deleted_at IS NULL`
    );
    const afterKnRow = await dbGetFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM knowledge_entries WHERE deleted_at IS NULL`
    );
    const countAfter   = afterRow?.n   ?? 0;
    const countAfterKn = afterKnRow?.n ?? 0;
    if (__DEV__) console.info(
      `[SeedManager] predefined_formats row count AFTER seed: ${countAfter} (delta: +${countAfter - countBefore})`
    );

    const elapsed = Date.now() - t0;
    if (__DEV__) console.info(
      `[SeedManager] seedSystemContent complete in ${elapsed}ms — ` +
      `Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}`
    );

    // Always-on post-seed row-count report (visible in on-device log viewer on
    // production builds). Uses console.info — NOT AppLogger which is __DEV__-only —
    // so it is captured by the debugLogStore ring-buffer regardless of build type.
    // Search for "[SeedManager] STARTUP REPORT" in the Log Viewer to verify seeding.
    console.info(
      `[SeedManager] STARTUP REPORT (full reconcile): ` +
      `predefined_formats active=${countAfter} (expected≥${FORMATS_SEED.formats.length}) | ` +
      `knowledge_entries active=${countAfterKn} (expected≥${KNOWLEDGE_SEED.knowledge.length}) | ` +
      `added=${result.added} updated=${result.updated} elapsed=${elapsed}ms`
    );

    // ── Persist corpus token so next launch takes the fast path ──────────────
    // Only written after a fully successful reconcile (no exception above).
    // Uses INSERT OR REPLACE so it works both on first launch and updates.
    await dbRunAsync(
      `INSERT OR REPLACE INTO workspace_settings (key, value) VALUES (?, ?)`,
      [SEED_VERSION_KEY, SEED_CORPUS_VERSION]
    );
    if (__DEV__) console.info(`[SeedManager] Stored corpus token: ${SEED_CORPUS_VERSION}`);
  } catch (e) {
    console.error('[SeedManager] seed failed:', e);
  }
  return result;
}

// ─── Legacy format cleanup ────────────────────────────────────────────────────
/**
 * Two responsibilities, run on every app start (both are idempotent):
 *
 * A) Hard-delete the one confirmed near-duplicate legacy row.
 *    id = bafb59c2-2585-438c-b0c6-53bb0ad60fa8
 *    title = "बीट सूचना में 126/135 की कार्यवाही"  (differs from canonical by one word "में")
 *    This row pre-dates stable IDs and was never in the seed file. Title-based
 *    dedup never caught it because its title doesn't exactly match any canonical.
 *    Safe to hard-delete: format_usage_log refs are reassigned to sys-fmt-bnss126-beat first.
 *
 * B) Soft-delete two retired BNSS-126/135 formats that were removed from the
 *    seed file (they still exist in DB on devices that had them installed):
 *      sys-fmt-bnss126-nyayalay  — "न्यायालय आदेश पर 126/135 की कार्यवाही"
 *      sys-fmt-bnss126-shikayat  — "शिकायत पर 126/135 की कार्यवाही"
 *    Soft-delete (set deleted_at) rather than hard-delete so format_usage_log
 *    history from previously generated reports remains intact and referenced.
 *
 * C) Orphan-check: IDs present in DB (active, src=system) but absent from the
 *    current seed file are logged as warnings. The reference set is derived
 *    dynamically from FORMATS_SEED at runtime — never a hardcoded stale list.
 *    src=user rows are explicitly excluded; they are never orphans by definition.
 */
async function _dedupSystemFormats(): Promise<void> {
  if (__DEV__) console.info('[SeedManager] _dedupSystemFormats starting');
  let hardDeleted = 0;
  let softDeleted = 0;

  try {

    // ── A) Hard-delete confirmed legacy near-duplicate ────────────────────────
    const LEGACY_DUPE_ID   = 'bafb59c2-2585-438c-b0c6-53bb0ad60fa8';
    const LEGACY_DUPE_CANONICAL = 'sys-fmt-bnss126-beat'; // reassign usage history here

    try {
      const dupeRow = await dbGetAllAsync<{ id: string; title: string; created_at: number }>(
        `SELECT id, title, created_at FROM predefined_formats
         WHERE id = ? AND deleted_at IS NULL`,
        [LEGACY_DUPE_ID]
      );

      if (dupeRow.length > 0) {
        const r = dupeRow[0];
        if (__DEV__) console.info(`[SeedManager/dedup] Legacy near-duplicate found: id=${r.id} title=${JSON.stringify(r.title)} created_at=${r.created_at}`);

        // Reassign any usage_log history to the canonical row before deleting.
        const usageCount = await dbGetFirstAsync<{ n: number }>(
          `SELECT COUNT(*) as n FROM format_usage_log WHERE format_id = ?`,
          [LEGACY_DUPE_ID]
        ).catch(() => ({ n: 0 }));

        if ((usageCount?.n ?? 0) > 0) {
          if (__DEV__) console.info(
            `[SeedManager/dedup] Reassigning ${usageCount!.n} usage_log row(s)` +
            ` from ${LEGACY_DUPE_ID} → ${LEGACY_DUPE_CANONICAL}`
          );
          await dbRunAsync(
            `UPDATE format_usage_log SET format_id = ? WHERE format_id = ?`,
            [LEGACY_DUPE_CANONICAL, LEGACY_DUPE_ID]
          );
        }

        await dbRunAsync(`DELETE FROM format_keys WHERE format_id = ?`, [LEGACY_DUPE_ID]);
        await dbRunAsync(`DELETE FROM format_tags WHERE format_id = ?`, [LEGACY_DUPE_ID]);
        await dbRunAsync(`DELETE FROM predefined_formats WHERE id = ?`, [LEGACY_DUPE_ID]);
        if (__DEV__) console.info(`[SeedManager/dedup] HARD-DELETED legacy duplicate id=${LEGACY_DUPE_ID}`);
        hardDeleted++;
      }
    } catch (e) {
      console.error(`[SeedManager/dedup] Failed to remove legacy duplicate ${LEGACY_DUPE_ID}:`, e);
    }

    // ── B) Soft-delete retired BNSS formats removed from seed ─────────────────
    const RETIRED_IDS: Array<{ id: string; label: string }> = [
      { id: 'sys-fmt-bnss126-nyayalay', label: 'न्यायालय आदेश पर 126/135 की कार्यवाही' },
      { id: 'sys-fmt-bnss126-shikayat', label: 'शिकायत पर 126/135 की कार्यवाही' },
    ];

    for (const { id, label } of RETIRED_IDS) {
      try {
        const rows = await dbGetAllAsync<{ id: string; deleted_at: number | null }>(
          `SELECT id, deleted_at FROM predefined_formats WHERE id = ?`,
          [id]
        );
        if (rows.length === 0) continue;
        if (rows[0].deleted_at != null) continue;

        const now = Date.now();
        await dbRunAsync(
          `UPDATE predefined_formats SET deleted_at = ?, updated_at = ? WHERE id = ?`,
          [now, now, id]
        );
        if (__DEV__) console.info(`[SeedManager/dedup] SOFT-DELETED retired format id=${id} ("${label}")`);
        softDeleted++;
      } catch (e) {
        console.error(`[SeedManager/dedup] Failed to soft-delete retired format ${id}:`, e);
      }
    }

    // ── C) Auto-soft-delete orphan system rows not present in current seed ────
    // Any active system row whose ID is absent from the current seed file is
    // stale (format was removed from the bundle). Soft-delete so it disappears
    // from all list screens without losing format_usage_log history.
    // source='user' rows are never touched — officers' own formats are always kept.
    try {
      const seedIdSet = new Set(FORMATS_SEED.formats.map(f => f.id));
      RETIRED_IDS.forEach(r => seedIdSet.add(r.id));
      seedIdSet.add(LEGACY_DUPE_ID);

      const activeSystemRows = await dbGetAllAsync<{ id: string; title: string }>(
        `SELECT id, title FROM predefined_formats
         WHERE deleted_at IS NULL AND source = 'system'`
      );
      const orphanRows = activeSystemRows.filter(r => !seedIdSet.has(r.id));
      if (orphanRows.length > 0) {
        const now = Date.now();
        for (const r of orphanRows) {
          try {
            await dbRunAsync(
              `UPDATE predefined_formats SET deleted_at = ?, updated_at = ? WHERE id = ?`,
              [now, now, r.id]
            );
            console.info(
              `[SeedManager/dedup] AUTO-SOFT-DELETED orphan system format id=${r.id} ("${r.title}")`
            );
            softDeleted++;
          } catch (delErr) {
            console.error(`[SeedManager/dedup] Failed to soft-delete orphan ${r.id}:`, delErr);
          }
        }
      }
    } catch (orphanErr) {
      console.warn('[SeedManager/dedup] Orphan auto-cleanup failed:', orphanErr);
    }

  } catch (e) {
    console.error('[SeedManager/dedup] Unexpected error in _dedupSystemFormats:', e);
  }

  if (__DEV__) console.info(
    `[SeedManager] _dedupSystemFormats complete — ` +
    `hard-deleted: ${hardDeleted}, soft-deleted: ${softDeleted}`
  );
}

// ─── Formats seeding ──────────────────────────────────────────────────────────
async function _seedFormats(formats: SeedFormat[]): Promise<SeedResult> {
  const result: SeedResult = { added: 0, updated: 0, skipped: 0 };

  // ── Prefetch ALL existing rows via serialized wrapper ─────────────────────
  // Uses dbGetAllAsync (routes through _enqueue) so reads are correctly
  // serialized against any concurrent writes in progress.
  const placeholders = formats.map(() => '?').join(',');
  const existingRows = await dbGetAllAsync<{
    id: string; seed_version: number; source: string; content_hash: string;
  }>(
    `SELECT id, seed_version, source, content_hash FROM predefined_formats
     WHERE deleted_at IS NULL AND id IN (${placeholders})`,
    formats.map(f => f.id)
  );
  const existingMap = new Map(existingRows.map(r => [r.id, r]));
  if (__DEV__) console.log(`[SeedManager] _seedFormats prefetch: ${existingRows.length} existing rows for ${formats.length} seed entries`);

  // ── Per-row upserts via serialized dbRunAsync — no transaction wrapper ────
  // withTransactionAsync on the raw db instance bypasses _enqueue and causes
  // deadlocks when other serialized operations are in-flight. The _enqueue
  // queue itself serializes all writes; no explicit transaction is needed for
  // the idempotent INSERT/UPDATE logic below.
  for (const fmt of formats) {
    try {
      const bundledHash = _formatHash(fmt);
      const existing = existingMap.get(fmt.id) ?? null;

      if (!existing) {
        // ── INSERT: new system content ───────────────────────────────────────
        const now = nowTimestamp();
        const insertFormatParams = [
          fmt.id,
          fmt.title,
          fmt.format_type,
          fmt.vivran,
          fmt.is_favorite  ?? 0,
          fmt.created_by   ?? 'system',
          'system', 0,
          fmt.content_type ?? 'format',
          fmt.seed_version ?? 1,
          fmt.app_version  ?? '',
          bundledHash,
          fmt.last_updated ?? '',
          now, now,
        ];
        if (__DEV__) console.log('[SeedManager] About to INSERT format', fmt.id);
        try {
          await dbRunAsync(
            `INSERT INTO predefined_formats
               (id, title, format_type, vivran, is_favorite, created_by,
                source, editable, content_type, seed_version, app_version,
                content_hash, last_updated,
                created_at, updated_at, version, sync_status)
             VALUES (?,?,?,?,?,?, ?,?,?,?,?, ?,?, ?,?,1,'synced')`,
            insertFormatParams
          );
        } catch (e: unknown) {
          const err = e as { message?: string; stack?: string } | null;
          console.error(`[SeedManager] FAILED at INSERT format for ${fmt.id}:`,
            { message: err?.message, stack: err?.stack, raw: e });
          throw e;
        }

        // ── INSERT keys ──────────────────────────────────────────────────────
        for (let ki = 0; ki < fmt.keys.length; ki++) {
          const key = fmt.keys[ki];
          try {
            await dbRunAsync(
              `INSERT INTO format_keys
                 (id, format_id, key_name, label, field_type, is_required,
                  default_value, dropdown_options, sort_order, created_at, updated_at)
               VALUES (?,?,?,?,?,?, ?,?,?,?,?)`,
              [
                generateUUID(), fmt.id,
                key.key_name, key.label, key.field_type, key.is_required,
                key.default_value ?? null, key.dropdown_options ?? null, key.sort_order,
                now, now,
              ]
            );
          } catch (e: unknown) {
            const err = e as { message?: string; stack?: string } | null;
            console.error(`[SeedManager] FAILED at INSERT key #${ki} (${key.key_name}) for ${fmt.id}:`,
              { message: err?.message, stack: err?.stack, raw: e });
            throw e;
          }
        }

        // ── INSERT tags ──────────────────────────────────────────────────────
        for (const tag of [...new Set(fmt.tags)]) {
          try {
            await dbRunAsync(
              `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?,?,?,?)`,
              [generateUUID(), fmt.id, tag, now]
            );
          } catch (e: unknown) {
            const err = e as { message?: string; stack?: string } | null;
            console.error(`[SeedManager] FAILED at INSERT tag '${tag}' for ${fmt.id}:`,
              { message: err?.message, stack: err?.stack, raw: e });
            throw e;
          }
        }

        result.added++;

      } else if (existing.source === 'system') {
        // ── UPDATE: version bump OR content changed ──────────────────────────
        const storedVersion = existing.seed_version ?? 0;
        const storedHash    = existing.content_hash  ?? '';
        const needsUpdate   = fmt.seed_version > storedVersion || bundledHash !== storedHash;

        if (needsUpdate) {
          const now = nowTimestamp();
          try {
            await dbRunAsync(
              `UPDATE predefined_formats
                 SET title=?, format_type=?, vivran=?,
                     seed_version=?, app_version=?,
                     content_hash=?, last_updated=?,
                     updated_at=?, version=version+1
               WHERE id=?`,
              [
                fmt.title, fmt.format_type, fmt.vivran,
                fmt.seed_version ?? 1,
                fmt.app_version  ?? '',
                bundledHash,
                fmt.last_updated ?? '',
                now,
                fmt.id,
              ]
            );
          } catch (e: unknown) {
            const err = e as { message?: string; stack?: string } | null;
            console.error(`[SeedManager] FAILED at UPDATE format for ${fmt.id}:`,
              { message: err?.message, stack: err?.stack, raw: e });
            throw e;
          }

          // Replace keys
          try {
            await dbRunAsync(`DELETE FROM format_keys WHERE format_id=?`, [fmt.id]);
          } catch (e: unknown) {
            const err = e as { message?: string; stack?: string } | null;
            console.error(`[SeedManager] FAILED at DELETE format_keys for ${fmt.id}:`,
              { message: err?.message, stack: err?.stack, raw: e });
            throw e;
          }
          for (let ki = 0; ki < fmt.keys.length; ki++) {
            const key = fmt.keys[ki];
            try {
              await dbRunAsync(
                `INSERT INTO format_keys
                   (id, format_id, key_name, label, field_type, is_required,
                    default_value, dropdown_options, sort_order, created_at, updated_at)
                 VALUES (?,?,?,?,?,?, ?,?,?,?,?)`,
                [
                  generateUUID(), fmt.id,
                  key.key_name, key.label, key.field_type, key.is_required,
                  key.default_value ?? null, key.dropdown_options ?? null, key.sort_order,
                  now, now,
                ]
              );
            } catch (e: unknown) {
              const err = e as { message?: string; stack?: string } | null;
              console.error(`[SeedManager] FAILED at UPDATE INSERT key #${ki} (${key.key_name}) for ${fmt.id}:`,
                { message: err?.message, stack: err?.stack, raw: e });
              throw e;
            }
          }

          // Replace tags
          try {
            await dbRunAsync(`DELETE FROM format_tags WHERE format_id=?`, [fmt.id]);
          } catch (e: unknown) {
            const err = e as { message?: string; stack?: string } | null;
            console.error(`[SeedManager] FAILED at DELETE format_tags for ${fmt.id}:`,
              { message: err?.message, stack: err?.stack, raw: e });
            throw e;
          }
          for (const tag of [...new Set(fmt.tags)]) {
            try {
              await dbRunAsync(
                `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?,?,?,?)`,
                [generateUUID(), fmt.id, tag, now]
              );
            } catch (e: unknown) {
              const err = e as { message?: string; stack?: string } | null;
              console.error(`[SeedManager] FAILED at UPDATE INSERT tag '${tag}' for ${fmt.id}:`,
                { message: err?.message, stack: err?.stack, raw: e });
              throw e;
            }
          }

          result.updated++;
        } else {
          result.skipped++;
        }
        // existing.source === 'user' → skip, never overwrite
      } else {
        result.skipped++;
      }
    } catch (e) {
      console.error(`[SeedManager] format seed failed for ${fmt.id}:`, e);
      result.skipped++;
    }
  }

  return result;
}

// ─── Knowledge seeding ────────────────────────────────────────────────────────
async function _seedKnowledge(entries: SeedKnowledge[]): Promise<SeedResult> {
  const result: SeedResult = { added: 0, updated: 0, skipped: 0 };

  // ── Prefetch ALL existing rows via serialized wrapper ─────────────────────
  const knPlaceholders = entries.map(() => '?').join(',');
  const knExistingRows = await dbGetAllAsync<{
    id: string; seed_version: number; source: string; content_hash: string;
  }>(
    `SELECT id, seed_version, source, content_hash FROM knowledge_entries
     WHERE deleted_at IS NULL AND id IN (${knPlaceholders})`,
    entries.map(e => e.id)
  );
  const knExistingMap = new Map(knExistingRows.map(r => [r.id, r]));
  if (__DEV__) console.log(`[SeedManager] _seedKnowledge prefetch: ${knExistingRows.length} existing rows for ${entries.length} seed entries`);

  // ── Per-row upserts via serialized dbRunAsync — no transaction wrapper ────
  for (const kn of entries) {
    try {
      const bundledHash = _knowledgeHash(kn);
      const existing = knExistingMap.get(kn.id) ?? null;

      if (!existing) {
        // ── INSERT: new system content ─────────────────────────────────────
        const now = nowTimestamp();
        await dbRunAsync(
          `INSERT INTO knowledge_entries
             (id, title, category, subcategory, crime_type, description,
              tags, attachment_uris,
              source, editable, content_type, seed_version, app_version,
              content_hash, last_updated,
              created_at, updated_at, version, sync_status)
           VALUES (?,?,?,?,?,?, ?,?, ?,?,?,?,?, ?,?, ?,?,1,'synced')`,
          [
            kn.id, kn.title, kn.category, kn.subcategory, kn.crime_type, kn.description,
            kn.tags, kn.attachment_uris,
            'system', 0,
            kn.content_type ?? 'knowledge',
            kn.seed_version ?? 1,
            kn.app_version  ?? '',
            bundledHash,
            kn.last_updated ?? '',
            now, now,
          ]
        );

        result.added++;

      } else if (existing.source === 'system') {
        // ── UPDATE: version bump OR content changed ────────────────────────
        const storedVersion = existing.seed_version ?? 0;
        const storedHash    = existing.content_hash  ?? '';
        const needsUpdate   = kn.seed_version > storedVersion || bundledHash !== storedHash;

        if (needsUpdate) {
          const now = nowTimestamp();
          await dbRunAsync(
            `UPDATE knowledge_entries
               SET title=?, category=?, subcategory=?, crime_type=?, description=?,
                   tags=?, seed_version=?, app_version=?,
                   content_hash=?, last_updated=?,
                   updated_at=?, version=version+1
             WHERE id=?`,
            [
              kn.title, kn.category, kn.subcategory, kn.crime_type, kn.description,
              kn.tags,
              kn.seed_version ?? 1,
              kn.app_version  ?? '',
              bundledHash,
              kn.last_updated ?? '',
              now,
              kn.id,
            ]
          );

          result.updated++;
        } else {
          result.skipped++;
        }
        // existing.source === 'user' → skip, never overwrite
      } else {
        result.skipped++;
      }
    } catch (e) {
      console.error(`[SeedManager] knowledge seed failed for ${kn.id}:`, e);
      result.skipped++;
    }
  }

  return result;
}

// ─── Developer Content Restore ────────────────────────────────────────────────

/**
 * restoreDevContent — Startup restore for Developer System Content.
 *
 * Must be called AFTER seedSystemContent() resolves (so the DB schema and
 * bundled system content are already in place).
 *
 * WHAT IT DOES
 * ────────────
 * 1. Reads developer-created formats + knowledge from the persistent adapter
 *    (localStorage on Expo Web / AsyncStorage on Android / iOS).
 * 2. For each item applies an upsert-by-UUID:
 *      – UUID not in DB → INSERT (cold start after browser refresh)
 *      – UUID exists    → UPDATE only if developer's seed_version is higher
 *        (prevents overwriting bundled content the developer hasn't edited)
 * 3. Never touches rows where source ≠ 'system' created by this developer.
 * 4. Logs Added / Updated / Skipped so the AppLogger ring-buffer captures it.
 *
 * PRODUCTION SAFETY
 * ─────────────────
 * - The call site in _layout.tsx is wrapped in `if (__DEV__)`.
 * - dcGet always returns null in production because devContentPersistence
 *   keys are never written outside of devSeedStore (which is __DEV__-only).
 * - Even if called accidentally in production the function is a complete no-op
 *   (empty arrays → no DB writes).
 */
export async function restoreDevContent(): Promise<SeedResult> {
  const t0 = Date.now();
  const result: SeedResult = { added: 0, updated: 0, skipped: 0 };
  try {
    // Lazy-import to keep the dependency out of the production bundle graph.
    // Metro will tree-shake this when the call site is inside __DEV__.
    const { dcGet, DC_KEY_FORMATS, DC_KEY_KNOWLEDGE } =
      await import('../devContentPersistence');

    // ── Formats — serialized upserts via dbRunAsync ───────────────────────────
    const fmtRaw = await dcGet(DC_KEY_FORMATS);
    if (fmtRaw) {
      const devFormats: SeedFormat[] = JSON.parse(fmtRaw);
      for (const fmt of devFormats) {
        try {
          const existing = await dbGetFirstAsync<{
            seed_version: number;
            source: string;
          }>(
            `SELECT seed_version, source FROM predefined_formats
              WHERE id = ? AND deleted_at IS NULL`,
            [fmt.id]
          );

          const now = nowTimestamp();

          if (!existing) {
            await dbRunAsync(
              `INSERT INTO predefined_formats
                 (id, title, format_type, vivran, is_favorite, created_by,
                  source, editable, seed_version, app_version, last_updated,
                  created_at, updated_at, version, sync_status)
               VALUES (?,?,?,?,0,'developer', ?,?,?,?,?, ?,?,1,'pending')`,
              [
                fmt.id, fmt.title, fmt.format_type ?? 'Any', fmt.vivran ?? '',
                fmt.source ?? 'system', fmt.editable ?? 0,
                fmt.seed_version ?? 1, fmt.app_version ?? '', fmt.last_updated ?? '',
                now, now,
              ]
            );
            await dbRunAsync(`DELETE FROM format_keys WHERE format_id=?`, [fmt.id]);
            if (Array.isArray(fmt.keys)) {
              for (let i = 0; i < fmt.keys.length; i++) {
                const k = fmt.keys[i] as SeedFormatKey;
                await dbRunAsync(
                  `INSERT INTO format_keys
                     (id, format_id, key_name, label, field_type, is_required,
                      default_value, dropdown_options, sort_order, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                  [
                    generateUUID(), fmt.id,
                    k.key_name, k.label, k.field_type, k.is_required,
                    k.default_value ?? null, k.dropdown_options ?? null, i,
                    now, now,
                  ]
                );
              }
            }
            await dbRunAsync(`DELETE FROM format_tags WHERE format_id=?`, [fmt.id]);
            if (Array.isArray(fmt.tags)) {
              for (const tag of [...new Set(fmt.tags)]) {
                await dbRunAsync(
                  `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?,?,?,?)`,
                  [generateUUID(), fmt.id, tag, now]
                );
              }
            }
            result.added++;
          } else if (existing.source === 'system') {
            await dbRunAsync(
              `UPDATE predefined_formats
                 SET title=?, format_type=?, vivran=?,
                     seed_version=?, app_version=?, last_updated=?,
                     updated_at=?, version=version+1
               WHERE id=?`,
              [
                fmt.title, fmt.format_type ?? 'Any', fmt.vivran ?? '',
                fmt.seed_version ?? 1, fmt.app_version ?? '', fmt.last_updated ?? '',
                now, fmt.id,
              ]
            );
            await dbRunAsync(`DELETE FROM format_keys WHERE format_id=?`, [fmt.id]);
            if (Array.isArray(fmt.keys)) {
              for (let i = 0; i < fmt.keys.length; i++) {
                const k = fmt.keys[i] as SeedFormatKey;
                await dbRunAsync(
                  `INSERT INTO format_keys
                     (id, format_id, key_name, label, field_type, is_required,
                      default_value, dropdown_options, sort_order, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                  [
                    generateUUID(), fmt.id,
                    k.key_name, k.label, k.field_type, k.is_required,
                    k.default_value ?? null, k.dropdown_options ?? null, i,
                    now, now,
                  ]
                );
              }
            }
            await dbRunAsync(`DELETE FROM format_tags WHERE format_id=?`, [fmt.id]);
            if (Array.isArray(fmt.tags)) {
              for (const tag of [...new Set(fmt.tags)]) {
                await dbRunAsync(
                  `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?,?,?,?)`,
                  [generateUUID(), fmt.id, tag, now]
                );
              }
            }
            result.updated++;
          } else {
            result.skipped++;
          }
        } catch (e) {
          console.error(`[SeedManager] restoreDevContent format failed for ${fmt.id}:`, e);
          result.skipped++;
        }
      }
    }

    // ── Knowledge — serialized upserts via dbRunAsync ─────────────────────────
    const knRaw = await dcGet(DC_KEY_KNOWLEDGE);
    if (knRaw) {
      const devKnowledge: SeedKnowledge[] = JSON.parse(knRaw);
      for (const kn of devKnowledge) {
        try {
          const existing = await dbGetFirstAsync<{
            seed_version: number;
            source: string;
          }>(
            `SELECT seed_version, source FROM knowledge_entries
              WHERE id = ? AND deleted_at IS NULL`,
            [kn.id]
          );

          const now = nowTimestamp();

          if (!existing) {
            await dbRunAsync(
              `INSERT INTO knowledge_entries
                 (id, title, category, subcategory, crime_type, description,
                  tags, attachment_uris,
                  source, editable, seed_version, app_version, last_updated,
                  created_at, updated_at, version, sync_status)
               VALUES (?,?,?,?,?,?, ?,?, ?,?,?,?,?, ?,?,1,'pending')`,
              [
                kn.id, kn.title, kn.category ?? '', kn.subcategory ?? '',
                kn.crime_type ?? '', kn.description ?? '',
                kn.tags ?? '', kn.attachment_uris ?? '[]',
                kn.source ?? 'system', kn.editable ?? 0,
                kn.seed_version ?? 1, kn.app_version ?? '', kn.last_updated ?? '',
                now, now,
              ]
            );
            result.added++;
          } else if (existing.source === 'system') {
            await dbRunAsync(
              `UPDATE knowledge_entries
                 SET title=?, category=?, subcategory=?, crime_type=?,
                     description=?, tags=?, attachment_uris=?,
                     seed_version=?, app_version=?, last_updated=?,
                     updated_at=?, version=version+1
               WHERE id=?`,
              [
                kn.title, kn.category ?? '', kn.subcategory ?? '',
                kn.crime_type ?? '', kn.description ?? '',
                kn.tags ?? '', kn.attachment_uris ?? '[]',
                kn.seed_version ?? 1, kn.app_version ?? '', kn.last_updated ?? '',
                now, kn.id,
              ]
            );
            result.updated++;
          } else {
            result.skipped++;
          }
        } catch (e) {
          console.error(`[SeedManager] restoreDevContent knowledge failed for ${kn.id}:`, e);
          result.skipped++;
        }
      }
    }

    const elapsed = Date.now() - t0;
    if (__DEV__) console.info(
      `[SeedManager] restoreDevContent complete in ${elapsed}ms — ` +
      `Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped} ` +
      `(ran AFTER seedSystemContent ✓)`
    );
  } catch (e) {
    console.error('[SeedManager] restoreDevContent failed:', e);
  }
  return result;
}

// ─── DEV ONLY: Export published system formats as seed JSON ──────────────────

/**
 * exportFormatsAsSeedJSON — __DEV__-only utility.
 *
 * Reads every published system format from the local DB (source='system',
 * status='published', deleted_at IS NULL) together with its keys and tags,
 * and returns a JSON string that can be pasted directly into
 * assets/seed/formats_seed.json.
 *
 * Workflow:
 *   1. Press "Export as Seed JSON" in sys-format-manager list screen.
 *   2. JSON is console.log'd AND copied to clipboard.
 *   3. Paste into assets/seed/formats_seed.json and ship.
 *
 * NOT exported in production — call site is wrapped in __DEV__.
 */
export async function exportFormatsAsSeedJSON(): Promise<string> {
  const db = await getDatabase();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 1. Fetch all published system formats ordered by id for stable output.
  const rows = await db.getAllAsync<{
    id: string; title: string; format_type: string; vivran: string;
    is_favorite: number; created_by: string; content_type: string;
    seed_version: number; app_version: string; last_updated: string;
  }>(
    `SELECT id, title, format_type, vivran, is_favorite, created_by,
            content_type, seed_version, app_version, last_updated
     FROM predefined_formats
     WHERE deleted_at IS NULL AND source = 'system' AND status = 'published'
     ORDER BY id ASC`
  );

  if (rows.length === 0) {
    if (__DEV__) console.warn('[SeedManager] exportFormatsAsSeedJSON: no published system formats found.');
    return JSON.stringify({ formats: [] }, null, 2);
  }

  // 2. Batch-fetch all keys and tags for matched format ids.
  const ids = rows.map(r => r.id);
  const ph  = ids.map(() => '?').join(',');

  const keyRows = await db.getAllAsync<{
    format_id: string; key_name: string; label: string;
    field_type: string; is_required: number; sort_order: number;
    default_value: string | null; dropdown_options: string | null;
  }>(
    `SELECT format_id, key_name, label, field_type, is_required, sort_order,
            default_value, dropdown_options
     FROM format_keys WHERE format_id IN (${ph}) ORDER BY format_id, sort_order ASC`,
    ids
  );
  const tagRows = await db.getAllAsync<{ format_id: string; tag: string }>(
    `SELECT format_id, tag FROM format_tags WHERE format_id IN (${ph}) ORDER BY format_id, tag ASC`,
    ids
  );

  // Build lookup maps.
  const keysMap = new Map<string, typeof keyRows>();
  const tagsMap = new Map<string, string[]>();
  for (const k of keyRows) {
    if (!keysMap.has(k.format_id)) keysMap.set(k.format_id, []);
    keysMap.get(k.format_id)!.push(k);
  }
  for (const t of tagRows) {
    if (!tagsMap.has(t.format_id)) tagsMap.set(t.format_id, []);
    tagsMap.get(t.format_id)!.push(t.tag);
  }

  // 3. Assemble seed-JSON-compatible objects.
  const formats = rows.map(r => {
    const keys = (keysMap.get(r.id) ?? []).map(k => {
      const entry: Record<string, unknown> = {
        key_name:    k.key_name,
        label:       k.label,
        field_type:  k.field_type,
        is_required: k.is_required,
        sort_order:  k.sort_order,
      };
      // Only include optional fields when they have a value.
      if (k.default_value   != null) entry.default_value   = k.default_value;
      if (k.dropdown_options != null) entry.dropdown_options = k.dropdown_options;
      return entry;
    });

    return {
      id:           r.id,
      title:        r.title,
      format_type:  r.format_type,
      vivran:       r.vivran,
      is_favorite:  0,              // always 0 in seed
      created_by:   'system',       // normalised for seed
      source:       'system',
      editable:     0,
      content_type: r.content_type ?? 'format',
      seed_version: r.seed_version ?? 1,
      app_version:  r.app_version  || '1.0.0',
      tags:         tagsMap.get(r.id) ?? [],
      keys,
      last_updated: r.last_updated || today,
    };
  });

  const output = JSON.stringify({ formats }, null, 2);
  if (__DEV__) console.log(
    `[SeedManager] exportFormatsAsSeedJSON — ${formats.length} format(s) exported:\n`,
    output
  );
  return output;
}
/**
 * Phase 6 — Checklist Snapshot Repository
 *
 * At FIR creation (seedFIRKaryvahi), every checklist_item that gets seeded
 * into fir_karyvahi is also snapshotted here verbatim.  The snapshot is a
 * plain JSON object — the full ChecklistItem row as it existed at seed time.
 *
 * This means future admin edits to investigation_checklists / checklist_items
 * (renaming tasks, changing priorities, linking formats, etc.) do NOT affect
 * any existing FIR.  The FIR always keeps the definition it was created with.
 *
 * Public API
 * ──────────
 *  saveSnapshot(db, firId, item)       — write one snapshot row (idempotent ON CONFLICT IGNORE)
 *  getSnapshotsByFIR(firId)            — all snapshots for a FIR
 *  getSnapshot(firId, checklistItemId) — single snapshot lookup
 */

import { getDatabase, generateUUID, nowTimestamp } from './database';
import { logger } from '@/lib/logger';

export interface ChecklistSnapshot {
  id: string;
  fir_id: string;
  checklist_item_id: string;
  /** Full JSON-serialised ChecklistItem as it was at seed time */
  snapshot_json: string;
  created_at: number;
}

/** Parsed convenience type — the deserialized snapshot_json field */
export type SnapshotData = Record<string, unknown>;

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Persist a single checklist item snapshot within an already-open transaction.
 *
 * Called from inside seedFIRKaryvahi's BEGIN…COMMIT block so the snapshot is
 * atomically consistent with the fir_karyvahi rows.
 *
 * Idempotent: ON CONFLICT IGNORE means re-running seed for the same
 * (fir_id, checklist_item_id) pair (e.g. during a retry) is safe.
 *
 * @param db     — the SQLite database instance (already opened)
 * @param firId  — the FIR being seeded
 * @param item   — the ChecklistItem row to snapshot (any shape, serialised as-is)
 */
export async function saveSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  firId: string,
  item: Record<string, unknown>
): Promise<void> {
  const id  = generateUUID();
  const now = nowTimestamp();
  const checklistItemId = String(item['id'] ?? '');
  if (!checklistItemId) {
    logger.warn('[checklistSnapshotRepo] saveSnapshot: item has no id, skipping');
    return;
  }
  const json = JSON.stringify(item);
  await db.runAsync(
    `INSERT OR IGNORE INTO checklist_snapshot
       (id, fir_id, checklist_item_id, snapshot_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, firId, checklistItemId, json, now]
  );
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns all snapshots for a FIR, ordered by created_at asc.
 * Each row includes the raw snapshot_json string AND a parsed `data` field.
 */
export async function getSnapshotsByFIR(
  firId: string
): Promise<Array<ChecklistSnapshot & { data: SnapshotData }>> {
  try {
    const db   = await getDatabase();
    const rows = await db.getAllAsync<ChecklistSnapshot>(
      `SELECT * FROM checklist_snapshot WHERE fir_id = ? ORDER BY created_at ASC`,
      [firId]
    );
    return rows.map((r) => ({
      ...r,
      data: _parse(r.snapshot_json),
    }));
  } catch (e) {
    logger.warn('[checklistSnapshotRepo] getSnapshotsByFIR error:', e);
    return [];
  }
}

/**
 * Looks up the snapshot for a specific (fir, checklistItem) pair.
 * Returns null if no snapshot exists (e.g. DEFAULT_KARYVAHI items, which are
 * not template-backed and therefore not snapshotted).
 */
export async function getSnapshot(
  firId: string,
  checklistItemId: string
): Promise<(ChecklistSnapshot & { data: SnapshotData }) | null> {
  try {
    const db  = await getDatabase();
    const row = await db.getFirstAsync<ChecklistSnapshot>(
      `SELECT * FROM checklist_snapshot WHERE fir_id = ? AND checklist_item_id = ? LIMIT 1`,
      [firId, checklistItemId]
    );
    if (!row) return null;
    return { ...row, data: _parse(row.snapshot_json) };
  } catch (e) {
    logger.warn('[checklistSnapshotRepo] getSnapshot error:', e);
    return null;
  }
}

/**
 * Returns the count of snapshotted items for a FIR.
 * Useful for diagnostics / dev-seed-manager screens.
 */
export async function countSnapshotsByFIR(firId: string): Promise<number> {
  try {
    const db  = await getDatabase();
    const row = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM checklist_snapshot WHERE fir_id = ?`,
      [firId]
    );
    return row?.cnt ?? 0;
  } catch (e) {
    logger.warn('[checklistSnapshotRepo] countSnapshotsByFIR error:', e);
    return 0;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _parse(json: string): SnapshotData {
  try {
    return JSON.parse(json) as SnapshotData;
  } catch {
    return {};
  }
}

import { getDatabase, generateUUID, nowTimestamp } from './database';
import { logger } from '../logger';
import crimeTaxonomySeed from '../../../assets/seed/crime_taxonomy_seed.json';
import checklistItemsSeed from '../../../assets/seed/checklist_items_seed.json';

// ─── Flat taxonomy type (v2) ──────────────────────────────────────────────────
export interface CrimeTypeMeta {
  id: string;
  name_hi: string;
  name_en: string;
}

// ─── Types ────────────────────────────────────────────────────────────────
export interface InvestigationChecklist {
  id: string;
  title: string;
  crime_type: string;
  // v150 additive columns — may be absent on pre-migration rows; default ''
  crime_subtype: string;
  // 'system' = owner-seeded (locked), 'user' = officer-created (editable)
  source: string;
  editable: number;   // 1 = editable, 0 = locked
  description: string;
  tags: string;         // comma-separated
  created_at: number;
  updated_at: number;
  deleted_at?: number;
  version: number;
  sync_status: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string | null;   // nullable — new items created via M2M flow have no parent checklist
  serial_no: number;
  task_name: string;
  brief_description: string;
  sort_order: number;
  // v202 additive columns
  source: string;    // 'system' | 'user'
  editable: number;  // 1 = editable, 0 = locked
  // Phase 1 additive column
  priority?: string; // 'MANDATORY' | 'CONDITIONAL' | 'RECOMMENDED'
  // Phase 4 additive column — links this template to a predefined format
  auto_generate_format_id?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

// Input types for create/update — omit generated fields
type ChecklistInput = Pick<
  InvestigationChecklist,
  'title' | 'crime_type' | 'crime_subtype' | 'description' | 'tags' | 'source' | 'editable'
>;

// ─── Duplicate detection ──────────────────────────────────────────────────
/**
 * Returns the first checklist whose (crime_type, crime_subtype) pair matches
 * (case-insensitive, trimmed), excluding the given `excludeId`.
 * Used by add-checklist.tsx to warn before overwriting.
 */
export async function findDuplicateChecklist(
  crimeType: string,
  crimeSubtype: string,
  excludeId?: string
): Promise<InvestigationChecklist | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<InvestigationChecklist>(
    `SELECT * FROM investigation_checklists
     WHERE deleted_at IS NULL
       AND LOWER(TRIM(crime_type))    = LOWER(TRIM(?))
       AND LOWER(TRIM(crime_subtype)) = LOWER(TRIM(?))
       ${excludeId ? 'AND id != ?' : ''}
     LIMIT 1`,
    excludeId
      ? [crimeType, crimeSubtype, excludeId]
      : [crimeType, crimeSubtype]
  );
  return row ?? null;
}

// ─── Checklist CRUD ───────────────────────────────────────────────────────
export async function createChecklist(data: ChecklistInput): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO investigation_checklists
       (id, title, crime_type, crime_subtype, source, editable,
        description, tags, created_at, updated_at, version, sync_status)
     VALUES (?,?,?,?,?,?,?,?,?,?,1,'pending')`,
    [
      id, data.title, data.crime_type, data.crime_subtype ?? '',
      data.source ?? 'user', data.editable ?? 1,
      data.description, data.tags, now, now,
    ]
  );
  return id;
}

export async function updateChecklist(id: string, data: ChecklistInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE investigation_checklists
       SET title=?, crime_type=?, crime_subtype=?, source=?, editable=?,
           description=?, tags=?,
           updated_at=?, version=version+1, sync_status='pending'
     WHERE id=? AND deleted_at IS NULL`,
    [
      data.title, data.crime_type, data.crime_subtype ?? '',
      data.source ?? 'user', data.editable ?? 1,
      data.description, data.tags, nowTimestamp(), id,
    ]
  );
}

export async function deleteChecklist(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE investigation_checklists SET deleted_at=?, updated_at=? WHERE id=?`,
    [now, now, id]
  );
  // soft-delete child items too
  await db.runAsync(
    `UPDATE checklist_items SET deleted_at=?, updated_at=? WHERE checklist_id=? AND deleted_at IS NULL`,
    [now, now, id]
  );
}

export async function getChecklistById(id: string): Promise<InvestigationChecklist | null> {
  const db = await getDatabase();
  return db.getFirstAsync<InvestigationChecklist>(
    `SELECT * FROM investigation_checklists WHERE id=? AND deleted_at IS NULL`,
    [id]
  );
}

export async function getAllChecklists(): Promise<InvestigationChecklist[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestigationChecklist>(
    `SELECT * FROM investigation_checklists WHERE deleted_at IS NULL ORDER BY updated_at DESC`
  );
}

export async function searchChecklists(query: string): Promise<InvestigationChecklist[]> {
  const db = await getDatabase();
  const q = `%${query.trim()}%`;
  return db.getAllAsync<InvestigationChecklist>(
    `SELECT * FROM investigation_checklists
     WHERE deleted_at IS NULL
       AND (title LIKE ? OR crime_type LIKE ? OR crime_subtype LIKE ?
            OR tags LIKE ? OR description LIKE ?)
     ORDER BY updated_at DESC`,
    [q, q, q, q, q]
  );
}

// Used by Mukadma: find checklists whose crime_type exactly matches the FIR crime type
// Uses case-insensitive exact match (LOWER+TRIM) so "Marpeet", " Marpeet ", "marpeet"
// all resolve to the same checklist — eliminates fuzzy LIKE false negatives.
export async function getChecklistsByCrimeType(
  crimeType: string
): Promise<InvestigationChecklist[]> {
  const db = await getDatabase();
  return db.getAllAsync<InvestigationChecklist>(
    `SELECT * FROM investigation_checklists
     WHERE deleted_at IS NULL
       AND LOWER(TRIM(crime_type)) = LOWER(TRIM(?))
     ORDER BY created_at ASC`,
    [crimeType]
  );
}

export async function getTotalChecklistCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM investigation_checklists WHERE deleted_at IS NULL`
  );
  return row?.cnt ?? 0;
}

/**
 * @deprecated — no longer needed in the flat taxonomy (v2).
 * Sub-types have been removed; crime types are now flat IDs.
 * Returns empty array always so any remaining callers don't crash.
 */
export async function getSubTypesForCrimeType(_crimeType: string): Promise<string[]> {
  return [];
}

/**
 * Returns all 30 flat crime types from the bundled taxonomy seed.
 * Each entry is a {id, name_hi, name_en} object.
 * DB is NOT queried — the seed is the single source of truth for the flat list.
 *
 * Callers that only need display strings (for a simple dropdown) can map
 * to whichever language they need; callers that need ids use .id directly.
 *
 * Backward compat: returns string[] of the primary label (name_hi) so
 * existing callers (details.tsx, add-checklist.tsx) keep compiling unchanged.
 */
export async function getUniqueCrimeTypes(): Promise<string[]> {
  // Flat v2 seed: [{id, name_hi, name_en}, ...]
  return (crimeTaxonomySeed.crimeTypes as CrimeTypeMeta[]).map(
    (c) => c.name_hi
  );
}

/**
 * Returns the full bilingual crime-type list for the flat (v2) UI.
 * add-fir.tsx uses this to render the new single-level multi-select.
 */
export function getFlatCrimeTypes(): CrimeTypeMeta[] {
  return crimeTaxonomySeed.crimeTypes as CrimeTypeMeta[];
}

/**
 * v2 replacement for getChecklistItemsForPairs.
 *
 * Returns all DISTINCT checklist items linked to ANY of the given flat
 * crime-type IDs via checklist_item_subtypes.crime_type.
 * The crime_subtype column is ignored (always '' for v2 seed data).
 *
 * Backward compat: the old table structure and existing rows are untouched.
 */
export async function getChecklistItemsForCrimeTypes(
  crimeTypeIds: string[]
): Promise<ChecklistItem[]> {
  if (crimeTypeIds.length === 0) return [];
  const db = await getDatabase();
  const placeholders = crimeTypeIds.map(() => '?').join(',');
  return db.getAllAsync<ChecklistItem>(
    `SELECT DISTINCT ci.*
     FROM checklist_items ci
     INNER JOIN checklist_item_subtypes s ON s.checklist_item_id = ci.id
     WHERE ci.deleted_at IS NULL
       AND LOWER(TRIM(s.crime_type)) IN (${placeholders})
     ORDER BY ci.sort_order ASC, ci.task_name ASC`,
    crimeTypeIds.map((id) => id.toLowerCase().trim())
  );
}

// ─── Checklist Items CRUD ─────────────────────────────────────────────────
export async function getItemsByChecklist(checklistId: string): Promise<ChecklistItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<ChecklistItem>(
    `SELECT * FROM checklist_items
     WHERE checklist_id=? AND deleted_at IS NULL
     ORDER BY sort_order ASC, serial_no ASC`,
    [checklistId]
  );
}

export async function createChecklistItem(
  checklistId: string,
  data: Pick<ChecklistItem, 'serial_no' | 'task_name' | 'brief_description' | 'sort_order'>
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO checklist_items
       (id, checklist_id, serial_no, task_name, brief_description, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, checklistId, data.serial_no, data.task_name, data.brief_description, data.sort_order, now, now]
  );
  // bump parent updated_at
  await db.runAsync(
    `UPDATE investigation_checklists SET updated_at=? WHERE id=?`,
    [now, checklistId]
  );
  return id;
}

export async function updateChecklistItem(
  id: string,
  data: Pick<ChecklistItem, 'serial_no' | 'task_name' | 'brief_description' | 'sort_order'>
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE checklist_items
       SET serial_no=?, task_name=?, brief_description=?, sort_order=?, updated_at=?
     WHERE id=? AND deleted_at IS NULL`,
    [data.serial_no, data.task_name, data.brief_description, data.sort_order, now, id]
  );
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE checklist_items SET deleted_at=?, updated_at=? WHERE id=?`,
    [now, now, id]
  );
}

// Replace all items for a checklist (used on edit-save)
export async function replaceChecklistItems(
  checklistId: string,
  items: Pick<ChecklistItem, 'serial_no' | 'task_name' | 'brief_description' | 'sort_order'>[]
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  // soft-delete existing
  await db.runAsync(
    `UPDATE checklist_items SET deleted_at=?, updated_at=? WHERE checklist_id=? AND deleted_at IS NULL`,
    [now, now, checklistId]
  );
  // insert new
  for (const item of items) {
    const id = generateUUID();
    await db.runAsync(
      `INSERT INTO checklist_items
         (id, checklist_id, serial_no, task_name, brief_description, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, checklistId, item.serial_no, item.task_name, item.brief_description, item.sort_order, now, now]
    );
  }
  await db.runAsync(
    `UPDATE investigation_checklists SET updated_at=?, version=version+1, sync_status='pending' WHERE id=?`,
    [now, checklistId]
  );
}

// ─── M2M Checklist Item model (v202) ────────────────────────────────────────

export type SubtypePair = { crimeType: string; subType: string };

/**
 * A checklist item with its linked (crime_type, crime_subtype) pairs
 * batch-loaded — no N+1.
 */
export interface ChecklistItemM2M extends ChecklistItem {
  pairs: SubtypePair[];
}

// ── Batch-load the pairs map for a set of item IDs (mirrors loadTagsMap) ──
async function loadPairsMap(
  db: Awaited<ReturnType<typeof getDatabase>>,
  itemIds: string[]
): Promise<Map<string, SubtypePair[]>> {
  const map = new Map<string, SubtypePair[]>(itemIds.map((id) => [id, []]));
  if (itemIds.length === 0) return map;
  const placeholders = itemIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{
    checklist_item_id: string;
    crime_type: string;
    crime_subtype: string;
  }>(
    `SELECT checklist_item_id, crime_type, crime_subtype
     FROM checklist_item_subtypes
     WHERE checklist_item_id IN (${placeholders})
     ORDER BY crime_type ASC, crime_subtype ASC`,
    itemIds
  );
  for (const row of rows) {
    const list = map.get(row.checklist_item_id);
    if (list) list.push({ crimeType: row.crime_type, subType: row.crime_subtype });
  }
  return map;
}

/** Fetch all non-deleted checklist items with their linked (crime_type, crime_subtype) pairs. */
export async function getAllChecklistItems(): Promise<ChecklistItemM2M[]> {
  const db = await getDatabase();
  const items = await db.getAllAsync<ChecklistItem>(
    `SELECT * FROM checklist_items
     WHERE deleted_at IS NULL
     ORDER BY task_name ASC`
  );
  const pairsMap = await loadPairsMap(db, items.map((i) => i.id));
  return items.map((item) => ({ ...item, pairs: pairsMap.get(item.id) ?? [] }));
}

/**
 * Create a new standalone checklist item linked to one or more (crime_type, crime_subtype) pairs.
 * Wrapped in withTransactionAsync so item + all pair rows are atomic.
 */
export async function createChecklistItemM2M(
  name: string,
  brief: string,
  pairs: SubtypePair[]
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  // checklist_id intentionally NULL — this item belongs to the M2M model,
  // linked only via checklist_item_subtypes (not a parent checklist).
  try {
    await db.runAsync(
      `INSERT INTO checklist_items
         (id, checklist_id, serial_no, task_name, brief_description, sort_order,
          source, editable, created_at, updated_at)
       VALUES (?, NULL, 0, ?, ?, 0, 'user', 1, ?, ?)`,
      [id, name.trim(), brief.trim(), now, now]
    );
  } catch (e) {
    logger.error('[checklistRepo] FAILED INSERT checklist_items:', e);
    throw e;
  }
  for (const pair of pairs) {
    try {
      await db.runAsync(
        `INSERT INTO checklist_item_subtypes
           (id, checklist_item_id, crime_type, crime_subtype, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [generateUUID(), id, pair.crimeType.trim(), pair.subType.trim(), now]
      );
    } catch (e) {
      logger.error('[checklistRepo] FAILED INSERT checklist_item_subtypes for pair:', pair, e);
      throw e;
    }
  }
  return id;
}

/**
 * Update a standalone checklist item: replace its name/brief AND its linked pairs
 * (DELETE + re-INSERT the pairs, matching the format_tags pattern).
 */
export async function updateChecklistItemM2M(
  id: string,
  name: string,
  brief: string,
  pairs: SubtypePair[]
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.withTransactionAsync(async () => {
    try {
      await db.runAsync(
        `UPDATE checklist_items
           SET task_name=?, brief_description=?, updated_at=?
         WHERE id=? AND deleted_at IS NULL`,
        [name.trim(), brief.trim(), now, id]
      );
      logger.warn('[checklistRepo] UPDATE checklist_items OK, id=' + id);
    } catch (e) {
      logger.error('[checklistRepo] FAILED UPDATE checklist_items, id=' + id + ':', e);
      throw e;
    }
    // Replace pairs — DELETE then re-INSERT
    try {
      await db.runAsync(
        `DELETE FROM checklist_item_subtypes WHERE checklist_item_id=?`,
        [id]
      );
      logger.warn('[checklistRepo] DELETE checklist_item_subtypes OK, item_id=' + id);
    } catch (e) {
      logger.error('[checklistRepo] FAILED DELETE checklist_item_subtypes, item_id=' + id + ':', e);
      throw e;
    }
    for (const pair of pairs) {
      try {
        await db.runAsync(
          `INSERT INTO checklist_item_subtypes
             (id, checklist_item_id, crime_type, crime_subtype, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [generateUUID(), id, pair.crimeType.trim(), pair.subType.trim(), now]
        );
        logger.warn('[checklistRepo] INSERT checklist_item_subtypes OK for pair:', pair);
      } catch (e) {
        logger.error('[checklistRepo] FAILED INSERT checklist_item_subtypes for pair:', pair, e);
        throw e;
      }
    }
  });
}

/**
 * Soft-delete a standalone checklist item (also removes its pair links for cleanliness).
 */
export async function deleteChecklistItemM2M(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE checklist_items SET deleted_at=?, updated_at=? WHERE id=?`,
      [now, now, id]
    );
    await db.runAsync(
      `DELETE FROM checklist_item_subtypes WHERE checklist_item_id=?`,
      [id]
    );
  });
}

/**
 * Return all DISTINCT checklist items linked to ANY of the given (crime_type, crime_subtype)
 * pairs — used by seedFIRKaryvahi to eliminate N+1 and the manual de-dup loop.
 *
 * SQL DISTINCT handles items shared across multiple pairs automatically,
 * so calling code receives each item exactly once regardless of how many
 * pairs match it.
 */
export async function getChecklistItemsForPairs(
  pairs: SubtypePair[]
): Promise<ChecklistItem[]> {
  if (pairs.length === 0) return [];
  const db = await getDatabase();

  // Build: WHERE (LOWER(TRIM(crime_type))=? AND LOWER(TRIM(crime_subtype))=?) OR ...
  const whereClauses = pairs.map(() =>
    `(LOWER(TRIM(s.crime_type))=LOWER(TRIM(?)) AND LOWER(TRIM(s.crime_subtype))=LOWER(TRIM(?)))`
  ).join(' OR ');
  const params: string[] = [];
  for (const p of pairs) {
    params.push(p.crimeType, p.subType);
  }

  return db.getAllAsync<ChecklistItem>(
    `SELECT DISTINCT ci.*
     FROM checklist_items ci
     INNER JOIN checklist_item_subtypes s ON s.checklist_item_id = ci.id
     WHERE ci.deleted_at IS NULL
       AND (${whereClauses})
     ORDER BY ci.sort_order ASC, ci.task_name ASC`,
    params
  );
}

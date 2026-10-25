/**
 * System Format Repository — v116
 * Owner-only operations: publish, archive, restore, version snapshots, audit log, stats.
 * Reuses the existing predefined_formats tables — no new format tables.
 */
import { matchesQuery, smartMatch, sqlWordFilter } from '@/lib/searchUtils';
import {
  getDatabase,
  dbRunAsync, dbGetFirstAsync, dbGetAllAsync,
  generateUUID, nowTimestamp,
} from './database';
import {
  getFormatById, getFormatKeys, getFormatTags,
  enrichFormats, loadTagsMap, SQL_IS_PUBLISHED, SQL_IS_VISIBLE,
  type PredefinedFormat, type FormatWithMeta, type FormatInput, type FormatKeyInput,
} from './predefinedFormatRepo';

// ─── Extended types ───────────────────────────────────────────────────────
export type FormatStatus = 'draft' | 'published' | 'archived';

export type SysFormatAction =
  | 'create' | 'update' | 'publish' | 'unpublish'
  | 'archive' | 'restore' | 'delete' | 'rollback' | 'duplicate';

export const SYS_CATEGORIES = [
  'GD',
  'Mukadma',
  'FIR Karyvahi',
  'Case Diary',
  'Nyayalay',
  'Prarthna Patra',
  'Narrative',
  'BNSS Karyavahi',
  'Nirodhatmak Karyvahi',
  'Knowledge Templates',
  'Reports',
  'Notices',
  'Summons',
  'Warrants',
  'Investigation Guides',
  'Custom',
] as const;
export type SysCategory = (typeof SYS_CATEGORIES)[number];

export interface SysFormatVersion {
  id: string;
  format_id: string;
  version_number: number;
  title: string;
  vivran: string;
  format_type: string;
  sys_category: string;
  sys_sub_category: string;
  keys_snapshot: string;
  tags_snapshot: string;
  change_notes: string;
  created_at: number;
  created_by: string;
}

export interface SysFormatAudit {
  id: string;
  format_id: string;
  action: string;
  details: string;
  version_number: number | null;
  created_at: number;
  created_by: string;
}

export interface SysFormatStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  recentlyUpdated: FormatWithMeta[];
  byCategory: Record<string, number>;
}

export interface SysFormatExtended extends PredefinedFormat {
  tags: string[];
  status: FormatStatus;
  sys_category: string;
  sys_sub_category: string;
  change_notes: string;
  published_at?: number;
  archived_at?: number;
  updated_by: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────

/** Map a raw PredefinedFormat row to SysFormatExtended (no tag loading). */
function _toSysExtended(f: PredefinedFormat, tags: string[]): SysFormatExtended {
  const r = f as unknown as Record<string, unknown>;
  return {
    ...f,
    tags,
    status: (r.status as FormatStatus) ?? 'published',
    sys_category:     (r.sys_category     as string) ?? '',
    sys_sub_category: (r.sys_sub_category as string) ?? '',
    change_notes:     (r.change_notes     as string) ?? '',
    published_at:     r.published_at as number | undefined,
    archived_at:      r.archived_at  as number | undefined,
    updated_by:       (r.updated_by  as string) ?? '',
  };
}

// _writeAudit is always called inside a withTransactionAsync block (or
// standalone for rollback's extra audit row). Route through dbRunAsync so
// it joins the serialization queue when called outside a transaction.
async function _writeAudit(
  formatId: string,
  action: SysFormatAction,
  details: string,
  versionNumber?: number,
  createdBy = 'owner'
): Promise<void> {
  await dbRunAsync(
    `INSERT INTO sys_format_audit
       (id, format_id, action, details, version_number, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [generateUUID(), formatId, action, details, versionNumber ?? null, nowTimestamp(), createdBy]
  );
}

// _snapshotVersion is always called inside withTransactionAsync — uses raw db.runAsync
// (safe inside an exclusive transaction lock). Exported only for createSysFormat/updateSysFormat.
async function _snapshotVersion(
  db: Awaited<ReturnType<typeof getDatabase>>,
  formatId: string,
  versionNumber: number,
  input: SysFormatInput,
  changeNotes: string,
  createdBy: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sys_format_versions
       (id, format_id, version_number, title, vivran, format_type,
        sys_category, sys_sub_category, keys_snapshot, tags_snapshot,
        change_notes, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateUUID(), formatId, versionNumber,
      input.title, input.vivran, input.format_type,
      input.sys_category ?? '', input.sys_sub_category ?? '',
      JSON.stringify(input.keys), JSON.stringify(input.tags),
      changeNotes, nowTimestamp(), createdBy,
    ]
  );
}

// ─── Read ─────────────────────────────────────────────────────────────────

export async function getSysFormats(opts?: {
  status?: FormatStatus | 'all';
  category?: string;
  query?: string;
  sortBy?: 'title' | 'updated' | 'version' | 'status';
}): Promise<SysFormatExtended[]> {
  let sql = `SELECT * FROM predefined_formats WHERE deleted_at IS NULL`;
  const params: (string | number)[] = [];

  if (opts?.status && opts.status !== 'all') {
    sql += ` AND status = ?`;
    params.push(opts.status);
  }
  if (opts?.category) {
    sql += ` AND sys_category = ?`;
    params.push(opts.category);
  }
  if (opts?.query) {
    const words = sqlWordFilter(['title', 'vivran', 'sys_category', "(SELECT GROUP_CONCAT(st.tag, ' ') FROM format_tags st WHERE st.format_id = predefined_formats.id)"], opts.query);
    sql += ` AND ${words.sql}`;
    params.push(...words.params);
  }

  const sortMap: Record<string, string> = {
    title:   'title ASC',
    updated: 'updated_at DESC',
    version: 'version DESC',
    status:  'status ASC, title ASC',
  };
  sql += ` ORDER BY ${sortMap[opts?.sortBy ?? 'updated']}`;

  const rows = await dbGetAllAsync<PredefinedFormat>(sql, params);
  // Single batch tag load — no N+1.
  const tagsMap = await loadTagsMap(rows.map((r) => r.id));
  return rows.map((f) => _toSysExtended(f, tagsMap.get(f.id) ?? []));
}

export async function getSysStats(): Promise<SysFormatStats> {
  const all = await dbGetAllAsync<{
    status: string; sys_category: string; updated_at: number;
  }>(
    `SELECT status, sys_category, updated_at FROM predefined_formats WHERE deleted_at IS NULL`
  );

  let published = 0, draft = 0, archived = 0;
  const byCategory: Record<string, number> = {};
  for (const r of all) {
    const s = r.status ?? 'published';
    if (s === 'published') published++;
    else if (s === 'draft') draft++;
    else if (s === 'archived') archived++;
    const cat = r.sys_category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }

  const recent = await dbGetAllAsync<PredefinedFormat>(
    `SELECT * FROM predefined_formats WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 8`
  );
  const recentlyUpdated = await enrichFormats(recent);

  return { total: all.length, published, draft, archived, recentlyUpdated, byCategory };
}

// ─── Status transitions ───────────────────────────────────────────────────
//
// IMPORTANT: All status values are passed as bound parameters (?) — never as
// SQL string literals (e.g. status='published').  The Web SQLite stub's UPDATE
// parser skips any SET assignment that doesn't contain a '?' placeholder, so
// literal status strings were silently dropped on Web, leaving formats permanently
// stuck in 'draft' and invisible to all published-content queries after restart.
//
// Issue 2 fix: every function now wraps its UPDATE + audit INSERT inside a single
// db.withTransactionAsync() block — matching createSysFormat/updateSysFormat.
// A crash between the two statements can no longer leave the row in a partially
// transitioned state (e.g. published with no audit trail, or vice versa).
// db.runAsync is used inside the block (raw handle is safe; transaction holds
// an exclusive lock for its duration).

export async function publishFormat(id: string, updatedBy = 'owner'): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  if (__DEV__) console.log(`[SysFormatRepo] publish id=${id} by=${updatedBy}`);
  await db.withTransactionAsync(async () => {
    // Publishing converts the row into true System Content atomically:
    //   status='published' — visible to all published-content queries
    //   source='system'    — system-owned; seeding engine respects it
    //   editable=0         — prevents accidental in-place edits from user-facing screens
    //   published_at=now   — records when it was first/last published
    await db.runAsync(
      `UPDATE predefined_formats
          SET status=?, source=?, editable=?,
              published_at=?, updated_at=?, updated_by=?, sync_status=?
        WHERE id=?`,
      ['published', 'system', 0, now, now, updatedBy, 'pending', id]
    );
    // Readback: confirm the write landed inside the transaction before it commits.
    const check = await db.getFirstAsync<{ source: string; status: string; editable: number }>(
      `SELECT source, status, editable FROM predefined_formats WHERE id=?`, [id]
    );
    if (__DEV__) console.log(
      `[SysFormatRepo] publish readback id=${id}`,
      `source=${check?.source ?? 'NULL'}`,
      `status=${check?.status ?? 'NULL'}`,
      `editable=${check?.editable ?? 'NULL'}`
    );
    await db.runAsync(
      `INSERT INTO sys_format_audit
         (id, format_id, action, details, version_number, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUUID(), id, 'publish',
       'Status → published (source=system, editable=0)', null, nowTimestamp(), updatedBy]
    );
  });
}

// Issue 3 fix: add optional `restoreAsUser` param (default false).
// When true: restores source='user', editable=1 — correct for formats that were
// originally user-created before being published. When false: source/editable are
// left unchanged — correct for system-authored formats that should stay locked.
export async function unpublishFormat(
  id: string,
  updatedBy = 'owner',
  restoreAsUser = false,
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  if (__DEV__) console.log(`[SysFormatRepo] unpublish id=${id} restoreAsUser=${restoreAsUser} by=${updatedBy}`);
  await db.withTransactionAsync(async () => {
    if (restoreAsUser) {
      await db.runAsync(
        `UPDATE predefined_formats
            SET status=?, source=?, editable=?,
                updated_at=?, updated_by=?, sync_status=?
          WHERE id=?`,
        ['draft', 'user', 1, now, updatedBy, 'pending', id]
      );
    } else {
      await db.runAsync(
        `UPDATE predefined_formats
            SET status=?, updated_at=?, updated_by=?, sync_status=?
          WHERE id=?`,
        ['draft', now, updatedBy, 'pending', id]
      );
    }
    const auditDetail = restoreAsUser
      ? 'Status → draft (source restored to user, editable=1)'
      : 'Status → draft';
    await db.runAsync(
      `INSERT INTO sys_format_audit
         (id, format_id, action, details, version_number, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUUID(), id, 'unpublish', auditDetail, null, nowTimestamp(), updatedBy]
    );
  });
}

export async function archiveFormat(id: string, updatedBy = 'owner'): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  if (__DEV__) console.log(`[SysFormatRepo] archive id=${id} by=${updatedBy}`);
  await db.withTransactionAsync(async () => {
    // Preserve published_at — archiving does not erase publication history.
    await db.runAsync(
      `UPDATE predefined_formats
          SET status=?, archived_at=?, updated_at=?, updated_by=?, sync_status=?
        WHERE id=?`,
      ['archived', now, now, updatedBy, 'pending', id]
    );
    await db.runAsync(
      `INSERT INTO sys_format_audit
         (id, format_id, action, details, version_number, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUUID(), id, 'archive', 'Status → archived', null, nowTimestamp(), updatedBy]
    );
  });
}

export async function restoreFormat(id: string, updatedBy = 'owner'): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  if (__DEV__) console.log(`[SysFormatRepo] restore id=${id} by=${updatedBy}`);
  await db.withTransactionAsync(async () => {
    // Returns row to 'draft' for review before re-publishing.
    // source='system' and editable=0 preserved — owner still controls it.
    // published_at cleared so a re-publish produces a fresh timestamp.
    await db.runAsync(
      `UPDATE predefined_formats
          SET status=?, source=?, editable=?,
              archived_at=NULL, published_at=NULL,
              updated_at=?, updated_by=?, sync_status=?
        WHERE id=?`,
      ['draft', 'system', 0, now, updatedBy, 'pending', id]
    );
    await db.runAsync(
      `INSERT INTO sys_format_audit
         (id, format_id, action, details, version_number, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUUID(), id, 'restore',
       'Status → draft (restored from archive; source=system, editable=0)',
       null, nowTimestamp(), updatedBy]
    );
  });
}

export async function softDeleteSysFormat(id: string, updatedBy = 'owner'): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE predefined_formats
          SET deleted_at=?, updated_at=?, updated_by=?, sync_status=?
        WHERE id=?`,
      [now, now, updatedBy, 'pending', id]
    );
    await db.runAsync(
      `INSERT INTO sys_format_audit
         (id, format_id, action, details, version_number, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUUID(), id, 'delete', 'Soft deleted', null, nowTimestamp(), updatedBy]
    );
  });
}

// ─── Create / Update with version snapshot ───────────────────────────────

export interface SysFormatInput extends FormatInput {
  sys_category?: string;
  sys_sub_category?: string;
  change_notes?: string;
  status?: FormatStatus;
}

export async function createSysFormat(input: SysFormatInput, createdBy = 'owner'): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  const status = input.status ?? 'draft';
  if (__DEV__) console.log(`[SysFormatRepo] create "${input.title}" status=${status} by=${createdBy}`);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO predefined_formats
         (id, title, format_type, vivran, is_favorite, created_by, created_at, updated_at,
          version, sync_status, source, editable, status, sys_category, sys_sub_category,
          change_notes, updated_by)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, 1, 'pending', 'system', 0, ?, ?, ?, ?, ?)`,
      [id, input.title.trim(), input.format_type, input.vivran, createdBy, now, now,
       status, input.sys_category ?? '', input.sys_sub_category ?? '',
       input.change_notes ?? '', createdBy]
    );

    for (let i = 0; i < input.keys.length; i++) {
      const k = input.keys[i];
      await db.runAsync(
        `INSERT INTO format_keys
           (id, format_id, key_name, label, field_type, is_required,
            default_value, dropdown_options, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [generateUUID(), id, k.key_name, k.label, k.field_type, k.is_required ? 1 : 0,
         k.default_value ?? null, k.dropdown_options ?? null, i, now, now]
      );
    }
    for (const tag of input.tags) {
      await db.runAsync(
        `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?, ?, ?, ?)`,
        [generateUUID(), id, tag, now]
      );
    }

    await _snapshotVersion(db, id, 1, input, input.change_notes ?? 'Initial creation', createdBy);
    await db.runAsync(
      `INSERT INTO sys_format_audit
         (id, format_id, action, details, version_number, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUUID(), id, 'create', `Created "${input.title}" as ${status}`, 1, nowTimestamp(), createdBy]
    );
  });

  return id;
}

export async function updateSysFormat(
  id: string, input: SysFormatInput, updatedBy = 'owner'
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  if (__DEV__) console.log(`[SysFormatRepo] update id=${id} by=${updatedBy}`);

  const existing = await getFormatById(id);
  if (!existing) throw new Error(`[SysFormatRepo] updateSysFormat: format ${id} not found`);
  const nextVersion = (existing.version ?? 0) + 1;

  await db.withTransactionAsync(async () => {
    // Editing always reverts status to 'draft' — the owner must explicitly
    // re-publish via publishFormat().  This prevents silent overwrites of
    // the live published version.  All literal-value SET columns are bound
    // params so the Web SQLite stub applies them correctly.
    await db.runAsync(
      `UPDATE predefined_formats
         SET title=?, format_type=?, vivran=?, updated_at=?, version=?,
             sync_status=?, sys_category=?, sys_sub_category=?,
             change_notes=?, updated_by=?, status=?
       WHERE id=?`,
      [input.title.trim(), input.format_type, input.vivran, now, nextVersion,
       'pending', input.sys_category ?? '', input.sys_sub_category ?? '',
       input.change_notes ?? '', updatedBy, 'draft', id]
    );

    // Soft-delete old keys — read queries (deleted_at IS NULL) never see them.
    await db.runAsync(`UPDATE format_keys SET deleted_at=? WHERE format_id=?`, [now, id]);
    for (let i = 0; i < input.keys.length; i++) {
      const k = input.keys[i];
      await db.runAsync(
        `INSERT INTO format_keys
           (id, format_id, key_name, label, field_type, is_required,
            default_value, dropdown_options, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [generateUUID(), id, k.key_name, k.label, k.field_type, k.is_required ? 1 : 0,
         k.default_value ?? null, k.dropdown_options ?? null, i, now, now]
      );
    }
    await db.runAsync(`DELETE FROM format_tags WHERE format_id=?`, [id]);
    for (const tag of input.tags) {
      await db.runAsync(
        `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?, ?, ?, ?)`,
        [generateUUID(), id, tag, now]
      );
    }

    await _snapshotVersion(db, id, nextVersion, input, input.change_notes ?? '', updatedBy);
    await db.runAsync(
      `INSERT INTO sys_format_audit
         (id, format_id, action, details, version_number, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateUUID(), id, 'update',
       `Updated to v${nextVersion}: ${input.change_notes ?? ''}`, nextVersion, nowTimestamp(), updatedBy]
    );
  });
}

// ─── Version history ──────────────────────────────────────────────────────

export async function getVersionHistory(formatId: string): Promise<SysFormatVersion[]> {
  return dbGetAllAsync<SysFormatVersion>(
    `SELECT * FROM sys_format_versions WHERE format_id = ? ORDER BY version_number DESC`,
    [formatId]
  );
}

export async function rollbackToVersion(
  formatId: string, versionId: string, updatedBy = 'owner'
): Promise<void> {
  if (__DEV__) console.log(`[SysFormatRepo] rollback formatId=${formatId} versionId=${versionId} by=${updatedBy}`);
  const snap = await dbGetFirstAsync<SysFormatVersion>(
    `SELECT * FROM sys_format_versions WHERE id = ?`, [versionId]
  );
  if (!snap) throw new Error('[SysFormatRepo] rollbackToVersion: snapshot not found');

  const keys: FormatKeyInput[] = JSON.parse(snap.keys_snapshot ?? '[]');
  const tags: string[] = JSON.parse(snap.tags_snapshot ?? '[]');

  // updateSysFormat already runs inside a transaction.
  await updateSysFormat(formatId, {
    title: snap.title,
    format_type: snap.format_type as never,
    vivran: snap.vivran,
    sys_category: snap.sys_category,
    sys_sub_category: snap.sys_sub_category,
    change_notes: `Rolled back to v${snap.version_number}`,
    keys,
    tags,
  }, updatedBy);

  // Post-rollback audit row: outside the transaction above, uses serialized wrapper.
  await _writeAudit(formatId, 'rollback',
    `Rolled back to v${snap.version_number}`, snap.version_number, updatedBy);
}

// ─── Audit log ────────────────────────────────────────────────────────────

export async function getAuditLog(formatId: string): Promise<SysFormatAudit[]> {
  return dbGetAllAsync<SysFormatAudit>(
    `SELECT * FROM sys_format_audit WHERE format_id = ? ORDER BY created_at DESC`,
    [formatId]
  );
}

// ─── Published-only queries & search (for user-facing screens) ───────────────

/**
 * Returns all formats visible to `createdBy`:
 *   • published (or legacy null-status) formats — visible to everyone
 *   • the caller's own drafts/archived — so a newly created user format
 *     appears immediately even before it is published
 *
 * `createdBy` defaults to 'me' which is the identifier written by createFormat().
 * Pass the actual user identifier if your auth context provides one.
 */
export async function getPublishedFormats(createdBy = 'me'): Promise<FormatWithMeta[]> {
  const formats = await dbGetAllAsync<PredefinedFormat>(
    `SELECT * FROM predefined_formats
     WHERE deleted_at IS NULL AND ${SQL_IS_VISIBLE}
     ORDER BY title ASC`,
    [createdBy]
  );
  return enrichFormats(formats);
}

export async function getPublishedFormatsByType(formatType: string): Promise<FormatWithMeta[]> {
  const formats = await dbGetAllAsync<PredefinedFormat>(
    `SELECT * FROM predefined_formats
     WHERE deleted_at IS NULL AND format_type = ? AND ${SQL_IS_PUBLISHED}
     ORDER BY title ASC`,
    [formatType]
  );
  return enrichFormats(formats);
}

export async function getPublishedFormatsByTypes(types: string[]): Promise<FormatWithMeta[]> {
  if (!types.length) return [];
  const placeholders = types.map(() => '?').join(', ');
  const formats = await dbGetAllAsync<PredefinedFormat>(
    `SELECT * FROM predefined_formats
     WHERE deleted_at IS NULL AND ${SQL_IS_PUBLISHED}
       AND format_type IN (${placeholders})
     ORDER BY title ASC`,
    types
  );
  return enrichFormats(formats);
}

export async function getPublishedFormatsByTag(tag: string): Promise<FormatWithMeta[]> {
  // Use EXISTS to avoid duplicate rows without DISTINCT.
  const formats = await dbGetAllAsync<PredefinedFormat>(
    `SELECT pf.* FROM predefined_formats pf
     WHERE pf.deleted_at IS NULL AND ${SQL_IS_PUBLISHED}
       AND EXISTS (SELECT 1 FROM format_tags ft WHERE ft.format_id = pf.id AND ft.tag = ?)
     ORDER BY pf.title ASC`,
    [tag]
  );
  return enrichFormats(formats);
}

// Search over title, body, type and tags — word-by-word, Hindi-aware (searchUtils).
const FORMAT_SEARCH_EXPRS = ['f.title', 'f.vivran', 'f.format_type', "(SELECT GROUP_CONCAT(st.tag, ' ') FROM format_tags st WHERE st.format_id = f.id)"];
function formatMatches(f: FormatWithMeta, query: string): boolean {
  return smartMatch(query, [f.title, f.vivran, f.format_type, (f.tags ?? []).join(' ')]);
}

export async function searchPublishedFormats(
  query: string,
  filter?: string,
  createdBy = 'me',
): Promise<FormatWithMeta[]> {
  // Empty query + no filter → delegate to optimised scan-free path.
  if (!query.trim() && (!filter || filter === 'All')) {
    return getPublishedFormats(createdBy);
  }
  if (__DEV__) console.log(`[SysFormatRepo] search query="${query}" filter="${filter ?? ''}"`);

  const FORMAT_TYPES = ['GD', 'Case Diary', 'Narrative', 'Nyayalay', 'Prarthna Patra', 'BNSS Karyavahi', 'Any'];

  // SQL_IS_VISIBLE expands to: (status='published' OR status IS NULL OR created_by = ?)
  // Its lone `?` is the first placeholder — createdBy MUST be first in params.
  let whereSql = '';
  let params: (string | number)[] = [createdBy];
  let orderBy = 'f.title ASC';
  // Whether to apply JS-side relevance sort after the DB query.
  // NOTE: We intentionally avoid SQL subqueries here because the Web SQLite
  // stub's FROM-regex only matches bare table names, not derived tables, so
  // SELECT * FROM (subquery) silently returns [].
  let useJsRanking = false;

  if (query.trim()) {
    // Word-by-word, Hindi-aware pre-filter; exact word check + ranking in JS below.
    const words = sqlWordFilter(FORMAT_SEARCH_EXPRS, query);
    whereSql += ` AND ${words.sql}`;
    params = [...params, ...words.params];
    useJsRanking = true;
    // Final sort applied in JS — DB just needs stable secondary ordering by title.
    orderBy = 'f.title ASC';
  }

  if (filter && filter !== 'All') {
    if (filter === 'Favorites') {
      whereSql += ` AND f.is_favorite = 1`;
    } else if (filter === 'Recently Used') {
      whereSql += ` AND f.last_used_at IS NOT NULL`;
      orderBy = 'f.last_used_at DESC';
      useJsRanking = false;  // recency order beats relevance
    } else if (filter === 'Recently Added') {
      orderBy = 'f.created_at DESC';
      useJsRanking = false;
    } else if (filter === 'Created By Me') {
      whereSql += ` AND f.created_by = ?`;
      params = [...params, createdBy];
    } else if (FORMAT_TYPES.includes(filter)) {
      whereSql += ` AND f.format_type = ?`;
      params = [...params, filter];
    }
  }

  const sql = `SELECT f.* FROM predefined_formats f
    WHERE f.deleted_at IS NULL AND ${SQL_IS_VISIBLE}${whereSql}
    ORDER BY ${orderBy}`;

  const rawFormats = await dbGetAllAsync<PredefinedFormat>(sql, params);
  const results = await enrichFormats(rawFormats);

  if (!useJsRanking) return results;

  // JS-side relevance sort — avoids SQL subqueries that break the Web stub.
  // Rank 1: query found in title  (shown first)
  // Rank 2: query found in a tag  (secondary)
  // Rank 3: query found in vivran / format_type (tertiary)
  const rank = (f: FormatWithMeta): number => {
    if (matchesQuery(query, f.title)) return 1;
    if (matchesQuery(query, f.title, (f.tags ?? []).join(' '))) return 2;
    return 3;
  };
  return results.filter((f) => formatMatches(f, query)).sort((a, b) => {
    const dr = rank(a) - rank(b);
    if (dr !== 0) return dr;
    return (a.title ?? '').localeCompare(b.title ?? '');
  });
}

export async function searchPublishedFormatsByTypes(
  query: string,
  types: string[],
): Promise<FormatWithMeta[]> {
  if (!types.length) return [];
  if (!query.trim()) return getPublishedFormatsByTypes(types);

  const words = sqlWordFilter(FORMAT_SEARCH_EXPRS, query);
  const placeholders = types.map(() => '?').join(', ');

  // Flat query — no subquery, so the Web SQLite stub handles it correctly.
  // Relevance ranking is applied in JS after enrichFormats loads the tags.
  const rawFormats = await dbGetAllAsync<PredefinedFormat>(
    `SELECT f.* FROM predefined_formats f
     WHERE f.deleted_at IS NULL AND ${SQL_IS_PUBLISHED}
       AND f.format_type IN (${placeholders})
       AND ${words.sql}
     ORDER BY f.title ASC`,
    [...types, ...words.params]
  );
  const results = await enrichFormats(rawFormats);

  // JS-side relevance sort: title match > tag match > vivran match.
  const rank = (f: FormatWithMeta): number => {
    if (matchesQuery(query, f.title)) return 1;
    if (matchesQuery(query, f.title, (f.tags ?? []).join(' '))) return 2;
    return 3;
  };
  return results.filter((f) => formatMatches(f, query)).sort((a, b) => {
    const dr = rank(a) - rank(b);
    if (dr !== 0) return dr;
    return (a.title ?? '').localeCompare(b.title ?? '');
  });
}

/**
 * Merges format lists: items of the earlier lists come first (best match),
 * duplicates (same id) are dropped. Used by "प्रारूप से जोड़ें" pickers to show
 * every format of the module's type with the most relevant ones on top.
 */
export function mergeFormatsFirst(...lists: FormatWithMeta[][]): FormatWithMeta[] {
  const seen = new Set<string>();
  const out: FormatWithMeta[] = [];
  for (const list of lists) {
    for (const f of list) {
      if (!seen.has(f.id)) { seen.add(f.id); out.push(f); }
    }
  }
  return out;
}

/** Client-side text filter on title + vivran (Hindi-safe, case-insensitive). */
export function filterFormatsByQuery(list: FormatWithMeta[], q: string): FormatWithMeta[] {
  if (!q.trim()) return list;
  return list.filter((f) => formatMatches(f, q));
}

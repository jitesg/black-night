import {
  getDatabase,
  dbRunAsync, dbGetFirstAsync, dbGetAllAsync,
  generateUUID, nowTimestamp,
} from './database';

// ─── Types ────────────────────────────────────────────────────────────────
export type FieldType = 'text' | 'multiline' | 'number' | 'date' | 'dropdown' | 'accused_group' | 'person_group' | 'checkbox' | 'item_group' | 'sentence';

/**
 * Layout profile for A4 rendering — controls font, margins, spacing.
 * Null on a PredefinedFormat means "use DEFAULT_LAYOUT_PROFILE".
 */
export interface LayoutProfile {
  pageSize: 'A4';
  orientation: 'portrait';
  margins: { top: number; right: number; bottom: number; left: number }; // mm
  fontFamily: string;
  fontSizeNormal: number;   // pt
  fontSizeMin: number;      // pt — hard floor, never shrink below this
  lineSpacingNormal: number;
  lineSpacingMin: number;
  paragraphSpacing: number; // pt
  alignment: 'left' | 'justify';
  overflow: 'new_page' | 'shrink_then_new_page';
}

/**
 * App-wide default layout profile — derived from रिपोर्ट चालानी अन्तर्गत धारा 126.docx.
 * Used when a PredefinedFormat has no layout_profile set.
 */
export const DEFAULT_LAYOUT_PROFILE: LayoutProfile = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 5, right: 25.4, bottom: 25.4, left: 17.5 }, // mm
  fontFamily: 'Kokila',
  fontSizeNormal: 17,
  fontSizeMin: 12,
  lineSpacingNormal: 1.15,
  lineSpacingMin: 1.0,
  paragraphSpacing: 0,
  alignment: 'justify',
  overflow: 'shrink_then_new_page',
};

export type FormatType =
  | 'GD'
  | 'Case Diary'
  | 'Narrative'
  | 'Nyayalay'
  | 'Prarthna Patra'
  | 'BNSS Karyavahi'
  | 'Any';

export interface PredefinedFormat {
  id: string;
  title: string;
  format_type: FormatType;
  vivran: string;
  is_favorite: number; // 0 | 1
  created_by: string;
  last_used_at?: number;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
  version: number;
  sync_status: string;
  // System Content Architecture (v108 + v109 Update Engine)
  source?: string;        // 'system' | 'user'
  editable?: number;      // 0 | 1
  content_type?: string;
  seed_version?: number;
  app_version?: string;
  content_hash?: string;  // djb2 hash of canonical content fields
  last_updated?: string;  // ISO-8601 date from seed bundle
  // v256: A4 rendering layout profile (null → use DEFAULT_LAYOUT_PROFILE)
  layout_profile?: LayoutProfile | null;
}

export interface FormatKey {
  id: string;
  format_id: string;
  key_name: string;
  label: string;
  field_type: FieldType;
  is_required: number; // 0 | 1
  default_value?: string;
  dropdown_options?: string; // JSON array string
  sort_order: number;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export interface FormatTag {
  id: string;
  format_id: string;
  tag: string;
  created_at: number;
}

export interface FormatUsageLog {
  id: string;
  format_id: string;
  used_at: number;
  calling_module?: string;
  generated_text?: string;
}

export interface FormatWithMeta extends PredefinedFormat {
  tags: string[];
}

export type FormatKeyInput = Omit<FormatKey, 'id' | 'format_id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type FormatInput = {
  title: string;
  format_type: FormatType;
  vivran: string;
  keys: FormatKeyInput[];
  tags: string[];
};

// ─── Internal helpers ─────────────────────────────────────────────────────

/** Load all tags for a set of format IDs in ONE query. Returns map: id → tags[]. */
export async function loadTagsMap(ids: string[]): Promise<Map<string, string[]>> {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => '?').join(',');
  // Uses serialized wrapper — no raw db object needed.
  const rows = await dbGetAllAsync<{ format_id: string; tag: string }>(
    `SELECT format_id, tag FROM format_tags WHERE format_id IN (${placeholders})`,
    ids
  );
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.format_id) ?? [];
    if (!list.includes(row.tag)) list.push(row.tag);
    map.set(row.format_id, list);
  }
  return map;
}

/**
 * Deserialise a raw DB row into a typed PredefinedFormat.
 * layout_profile is stored as JSON text — parse it back to an object.
 */
function _deserialiseFormat(row: PredefinedFormat & { layout_profile?: string | null }): PredefinedFormat {
  let layoutProfile: LayoutProfile | null = null;
  if (row.layout_profile && typeof row.layout_profile === 'string') {
    try { layoutProfile = JSON.parse(row.layout_profile) as LayoutProfile; } catch { /* keep null */ }
  } else if (row.layout_profile && typeof row.layout_profile === 'object') {
    layoutProfile = row.layout_profile as unknown as LayoutProfile;
  }
  return { ...row, layout_profile: layoutProfile };
}

/**
 * Enrich an array of raw formats with their tags in exactly 2 queries total
 * (1 format query already done by caller + 1 tags batch query here).
 * Eliminates all N+1 tag-loading patterns.
 */
export async function enrichFormats(formats: PredefinedFormat[]): Promise<FormatWithMeta[]> {
  if (!formats.length) return [];
  const tagsMap = await loadTagsMap(formats.map((f) => f.id));
  return formats.map((f) => ({ ...f, tags: tagsMap.get(f.id) ?? [] }));
}

/** Reusable SQL fragment: marks a format as published (visible to users). */
const SQL_IS_PUBLISHED = `(status = 'published' OR status IS NULL)`;

/**
 * Reusable SQL fragment: visible to a given user.
 * Returns TRUE when the row is published/null-status OR when created_by equals
 * the bound parameter.  The caller must append one extra `?` binding for `createdBy`.
 *
 * Usage:
 *   WHERE deleted_at IS NULL AND ${SQL_IS_VISIBLE}
 *   params: [...otherParams, createdBy]
 */
export const SQL_IS_VISIBLE = `(${SQL_IS_PUBLISHED} OR created_by = ?)`;

/**
 * Build the search WHERE clause and params for a full-text search across
 * title, vivran, format_type, and tags.
 * The query MUST already JOIN format_tags (alias t) or use EXISTS.
 * Returns { whereSql, params } — caller appends to existing WHERE.
 */
function buildSearchClause(query: string): { sql: string; params: string[] } {
  const q = `%${query.toLowerCase()}%`;
  return {
    sql: `(LOWER(f.title) LIKE ? OR LOWER(f.vivran) LIKE ? OR LOWER(f.format_type) LIKE ?
       OR EXISTS (SELECT 1 FROM format_tags st WHERE st.format_id = f.id AND LOWER(st.tag) LIKE ?))`,
    params: [q, q, q, q],
  };
}

/**
 * Append a filter clause and its ORDER BY to a SQL string.
 * Returns { sql, params, orderBy } where orderBy replaces the default.
 * createdBy is used for 'Created By Me' filter.
 */
function applyFilter(
  sql: string,
  params: (string | number)[],
  filter: string,
  createdBy?: string,
): { sql: string; params: (string | number)[]; orderBy: string } {
  let orderBy = 'f.created_at DESC';
  const FORMAT_TYPES = ['GD', 'Case Diary', 'Narrative', 'Nyayalay', 'Prarthna Patra', 'BNSS Karyavahi', 'Any'];

  if (filter === 'Favorites') {
    sql += ` AND f.is_favorite = 1`;
  } else if (filter === 'Recently Used') {
    sql += ` AND f.last_used_at IS NOT NULL`;
    orderBy = 'f.last_used_at DESC';
  } else if (filter === 'Recently Added') {
    orderBy = 'f.created_at DESC';
  } else if (filter === 'Created By Me') {
    // Use provided createdBy; fall back to 'me' (legacy default).
    sql += ` AND f.created_by = ?`;
    params = [...params, createdBy ?? 'me'];
  } else if (FORMAT_TYPES.includes(filter)) {
    sql += ` AND f.format_type = ?`;
    params = [...params, filter];
  }

  return { sql, params, orderBy };
}

// ─── Format CRUD ──────────────────────────────────────────────────────────

export async function getAllFormats(): Promise<FormatWithMeta[]> {
  const formats = await dbGetAllAsync<PredefinedFormat>(
    `SELECT * FROM predefined_formats WHERE deleted_at IS NULL ORDER BY created_at DESC`
  );
  return enrichFormats(formats);
}

export async function searchFormats(
  query: string,
  filter?: string,
  createdBy?: string,
): Promise<FormatWithMeta[]> {
  // When query is empty and no filter, delegate to optimised scan-free query.
  if (!query.trim() && (!filter || filter === 'All')) {
    return getAllFormats();
  }

  let sql = `SELECT DISTINCT f.* FROM predefined_formats f WHERE f.deleted_at IS NULL`;
  let params: (string | number)[] = [];

  if (query.trim()) {
    const { sql: searchSql, params: searchParams } = buildSearchClause(query);
    sql += ` AND ${searchSql}`;
    params = [...params, ...searchParams];
  }

  const activeFilter = filter && filter !== 'All' ? filter : '';
  if (activeFilter) {
    const applied = applyFilter(sql, params, activeFilter, createdBy);
    sql = applied.sql;
    params = applied.params;
    sql += ` ORDER BY ${applied.orderBy}`;
  } else {
    sql += ` ORDER BY f.created_at DESC`;
  }

  const formats = await dbGetAllAsync<PredefinedFormat>(sql, params);
  return enrichFormats(formats);
}

export async function getFormatById(id: string): Promise<PredefinedFormat | null> {
  const row = await dbGetFirstAsync<PredefinedFormat & { layout_profile: string | null }>(
    `SELECT * FROM predefined_formats WHERE id = ? AND deleted_at IS NULL`, [id]
  );
  if (!row) return null;
  return _deserialiseFormat(row);
}

/** Formats whose tag list contains the given tag (case-insensitive). */
export async function getFormatsByTag(tag: string): Promise<FormatWithMeta[]> {
  const formats = await dbGetAllAsync<PredefinedFormat>(
    `SELECT DISTINCT f.* FROM predefined_formats f
     INNER JOIN format_tags t ON t.format_id = f.id
     WHERE f.deleted_at IS NULL AND LOWER(t.tag) = LOWER(?)
     ORDER BY f.created_at DESC`,
    [tag]
  );
  return enrichFormats(formats);
}

/** Formats whose format_type is in the given list. */
export async function getFormatsByTypes(types: FormatType[]): Promise<FormatWithMeta[]> {
  if (!types.length) return [];
  const placeholders = types.map(() => '?').join(',');
  const formats = await dbGetAllAsync<PredefinedFormat>(
    `SELECT * FROM predefined_formats WHERE deleted_at IS NULL
     AND format_type IN (${placeholders})
     ORDER BY created_at DESC`,
    types
  );
  return enrichFormats(formats);
}

/** Search within formats filtered by types (for Anya). */
export async function searchFormatsByTypes(
  query: string,
  types: FormatType[]
): Promise<FormatWithMeta[]> {
  if (!types.length) return [];
  // Empty query → delegate to optimised scan-free path.
  if (!query.trim()) return getFormatsByTypes(types);

  const q = `%${query.toLowerCase()}%`;
  const placeholders = types.map(() => '?').join(',');
  // Use EXISTS subquery for tag search to avoid duplicates without DISTINCT.
  const formats = await dbGetAllAsync<PredefinedFormat>(
    `SELECT f.* FROM predefined_formats f
     WHERE f.deleted_at IS NULL
       AND f.format_type IN (${placeholders})
       AND (LOWER(f.title) LIKE ? OR LOWER(f.vivran) LIKE ? OR LOWER(f.format_type) LIKE ?
            OR EXISTS (SELECT 1 FROM format_tags st WHERE st.format_id = f.id AND LOWER(st.tag) LIKE ?))
     ORDER BY f.created_at DESC`,
    [...types, q, q, q, q]
  );
  return enrichFormats(formats);
}

export async function getFormatKeys(formatId: string): Promise<FormatKey[]> {
  return dbGetAllAsync<FormatKey>(
    `SELECT * FROM format_keys WHERE format_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC`,
    [formatId]
  );
}

export async function getFormatTags(formatId: string): Promise<string[]> {
  const rows = await dbGetAllAsync<{ tag: string }>(
    `SELECT DISTINCT tag FROM format_tags WHERE format_id = ?`, [formatId]
  );
  return rows.map((r) => r.tag);
}

export async function createFormat(input: FormatInput): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  // source='user', editable=1, status='draft' are ALWAYS explicit on user-created rows.
  // Omitting them previously caused NULL values that were inconsistently interpreted by
  // queries filtering on source or editable, producing "invisible" user formats.
  //
  // INSERT OR IGNORE: if a concurrent or retry call races to insert the same UUID
  // the second insert is silently dropped. Title uniqueness is enforced in the UI
  // layer (checkTitleExists + savingRef guard) rather than via DB UNIQUE constraint
  // so that we can give an actionable error message instead of a raw SQLite exception.
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR IGNORE INTO predefined_formats
         (id, title, format_type, vivran, is_favorite, created_by,
          source, editable, status,
          created_at, updated_at, version, sync_status)
       VALUES (?, ?, ?, ?, 0, 'me', 'user', 1, 'draft', ?, ?, 1, 'pending')`,
      [id, input.title.trim(), input.format_type, input.vivran, now, now]
    );
    for (let i = 0; i < input.keys.length; i++) {
      const k = input.keys[i];
      await db.runAsync(
        `INSERT OR IGNORE INTO format_keys
           (id, format_id, key_name, label, field_type, is_required,
            default_value, dropdown_options, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [generateUUID(), id, k.key_name, k.label, k.field_type, k.is_required ? 1 : 0,
         k.default_value ?? null, k.dropdown_options ?? null, i, now, now]
      );
    }
    for (const tag of input.tags) {
      await db.runAsync(
        `INSERT OR IGNORE INTO format_tags (id, format_id, tag, created_at) VALUES (?, ?, ?, ?)`,
        [generateUUID(), id, tag, now]
      );
    }
  });
  return id;
}

export async function updateFormat(id: string, input: FormatInput): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE predefined_formats
         SET title=?, format_type=?, vivran=?, updated_at=?, version=version+1, sync_status=?
       WHERE id=?`,
      [input.title.trim(), input.format_type, input.vivran, now, 'pending', id]
    );
    // Soft-delete old keys so read queries (deleted_at IS NULL) never return them.
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
  });
}

// Issue 4 fix: also bump updated_at, version, and sync_status so this mutation is
// consistent with every other write in this file. Previously only deleted_at was set.
export async function deleteFormat(id: string): Promise<void> {
  const now = nowTimestamp();
  await dbRunAsync(
    `UPDATE predefined_formats
       SET deleted_at=?, updated_at=?, version=version+1, sync_status=?
     WHERE id=?`,
    [now, now, 'pending', id]
  );
}

export async function toggleFavorite(id: string, current: number): Promise<void> {
  await dbRunAsync(
    `UPDATE predefined_formats SET is_favorite=?, updated_at=? WHERE id=?`,
    [current ? 0 : 1, nowTimestamp(), id]
  );
}

export async function duplicateFormat(id: string): Promise<string> {
  const original = await getFormatById(id);
  if (!original) throw new Error('Format not found');
  const [keys, tags] = await Promise.all([getFormatKeys(id), getFormatTags(id)]);
  return createFormat({
    title: `${original.title} (Copy)`,
    format_type: original.format_type,
    vivran: original.vivran,
    keys: keys.map((k) => ({
      key_name: k.key_name, label: k.label, field_type: k.field_type,
      is_required: k.is_required, default_value: k.default_value,
      dropdown_options: k.dropdown_options, sort_order: k.sort_order,
    })),
    tags,
  });
}

/**
 * Creates a user-editable copy of a System Content format.
 * The copy always gets source='user', editable=1, status='draft', created_by='me'.
 * The original system format is never modified.
 */
export async function duplicateFormatAsUser(id: string): Promise<string> {
  const original = await getFormatById(id);
  if (!original) throw new Error('Format not found');
  const [keys, tags] = await Promise.all([getFormatKeys(id), getFormatTags(id)]);
  // createFormat always sets source='user', editable=1, status='draft', created_by='me'.
  return createFormat({
    title: `${original.title} (My Copy)`,
    format_type: original.format_type,
    vivran: original.vivran,
    keys: keys.map((k) => ({
      key_name: k.key_name, label: k.label, field_type: k.field_type,
      is_required: k.is_required, default_value: k.default_value,
      dropdown_options: k.dropdown_options, sort_order: k.sort_order,
    })),
    tags,
  });
}

// Issue 5 fix: wrap INSERT + UPDATE in a single transaction so a crash between
// the two statements never leaves a usage-log row without the updated last_used_at
// (or vice versa). Uses raw db for withTransactionAsync; inner statements use the
// serialized wrappers (db.runAsync inside a transaction is safe — the transaction
// holds an exclusive lock for its duration, so no interleaving is possible).
export async function logUsage(formatId: string, callingModule?: string, generatedText?: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO format_usage_log (id, format_id, used_at, calling_module, generated_text)
       VALUES (?,?,?,?,?)`,
      [generateUUID(), formatId, now, callingModule ?? null, generatedText ?? null]
    );
    await db.runAsync(
      `UPDATE predefined_formats SET last_used_at=? WHERE id=?`,
      [now, formatId]
    );
  });
}

/** Fetch all non-deleted formats of a specific type, with their tags. */
export async function getFormatsByType(type: FormatType): Promise<FormatWithMeta[]> {
  const formats = await dbGetAllAsync<PredefinedFormat>(
    `SELECT * FROM predefined_formats WHERE deleted_at IS NULL AND format_type = ? ORDER BY title ASC`,
    [type]
  );
  return enrichFormats(formats);
}

/** Fetch all unique tags across all formats of a specific type. */
export async function getTagsByFormatType(type: FormatType): Promise<string[]> {
  const rows = await dbGetAllAsync<{ tag: string }>(
    `SELECT DISTINCT ft.tag FROM format_tags ft
     INNER JOIN predefined_formats f ON f.id = ft.format_id
     WHERE f.deleted_at IS NULL AND f.format_type = ?
     ORDER BY ft.tag ASC`,
    [type]
  );
  return rows.map((r) => r.tag);
}

export async function checkTitleExists(title: string, excludeId?: string): Promise<boolean> {
  // Use LOWER(TRIM(col))=LOWER(TRIM(?)) — the in-memory stub parser requires
  // this exact form to apply case-insensitive equality filtering correctly.
  const row = excludeId
    ? await dbGetFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM predefined_formats
         WHERE LOWER(TRIM(title))=LOWER(TRIM(?)) AND id!=? AND deleted_at IS NULL`,
        [title.trim(), excludeId])
    : await dbGetFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM predefined_formats
         WHERE LOWER(TRIM(title))=LOWER(TRIM(?)) AND deleted_at IS NULL`,
        [title.trim()]);
  return (row?.cnt ?? 0) > 0;
}

/**
 * Return the existing (non-deleted) format whose title matches case-insensitively,
 * or null if none. Used to show actionable "view existing" option in the duplicate
 * title dialog.
 *
 * IMPORTANT: uses LOWER(TRIM(col))=LOWER(TRIM(?)) form so the in-memory stub
 * parser applies the filter correctly (plain lower(col)=lower(?) is not parsed
 * by the stub and would return the first row unconditionally).
 */
export async function getFormatByTitle(title: string, excludeId?: string): Promise<PredefinedFormat | null> {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const sql = excludeId
    ? `SELECT * FROM predefined_formats
       WHERE LOWER(TRIM(title))=LOWER(TRIM(?)) AND id!=? AND deleted_at IS NULL
       LIMIT 1`
    : `SELECT * FROM predefined_formats
       WHERE LOWER(TRIM(title))=LOWER(TRIM(?)) AND deleted_at IS NULL
       LIMIT 1`;
  const params = excludeId ? [trimmed, excludeId] : [trimmed];
  const row = await dbGetFirstAsync<PredefinedFormat & { layout_profile: string | null }>(sql, params);
  if (!row) return null;
  return _deserialiseFormat(row);
}

// ─── Developer System Content helpers ─────────────────────────────────────────
// Used by devSeedStore to write developer-created content into the live DB
// immediately on Save/Edit/Delete so all screens reflect changes without a
// restart.  These are __DEV__-only call sites; they use source='system' and
// editable=0 to match the System Content Architecture contract.

/**
 * INSERT or UPDATE a developer-authored format identified by its UUID.
 * - If the UUID does not exist → INSERT.
 * - If it already exists → UPDATE all content fields.
 * Entire operation is wrapped in a transaction.
 */
export async function upsertDevFormat(fmt: {
  id: string;
  title: string;
  format_type: string;
  vivran: string;
  source: string;
  editable: number;
  seed_version?: number;
  app_version?: string;
  last_updated?: string;
  tags?: string[];
  keys?: Array<{
    key_name: string;
    label: string;
    field_type: string;
    is_required: number;
    sort_order: number;
    default_value?: string;
    dropdown_options?: string;
  }>;
}): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM predefined_formats WHERE id = ? AND deleted_at IS NULL`,
      [fmt.id]
    );

    if (!existing) {
      await db.runAsync(
        `INSERT INTO predefined_formats
           (id, title, format_type, vivran, is_favorite, created_by,
            source, editable, status,
            seed_version, app_version, last_updated,
            created_at, updated_at, version, sync_status)
         VALUES (?,?,?,?,0,'developer', ?,?,?, ?,?,?, ?,?,1,'pending')`,
        [
          fmt.id, fmt.title, fmt.format_type, fmt.vivran,
          fmt.source   ?? 'system',
          fmt.editable ?? 0,
          'draft',
          fmt.seed_version ?? 1, fmt.app_version ?? '', fmt.last_updated ?? '',
          now, now,
        ]
      );
    } else {
      await db.runAsync(
        `UPDATE predefined_formats
           SET title=?, format_type=?, vivran=?,
               source=?, editable=?, status=?,
               seed_version=?, app_version=?, last_updated=?,
               updated_at=?, version=version+1
         WHERE id=?`,
        [
          fmt.title, fmt.format_type, fmt.vivran,
          fmt.source   ?? 'system',
          fmt.editable ?? 0,
          'draft',
          fmt.seed_version ?? 1, fmt.app_version ?? '', fmt.last_updated ?? '',
          now, fmt.id,
        ]
      );
    }

    // Replace keys — soft-delete then re-insert.
    if (fmt.keys) {
      await db.runAsync(`UPDATE format_keys SET deleted_at=? WHERE format_id=?`, [now, fmt.id]);
      for (let i = 0; i < fmt.keys.length; i++) {
        const k = fmt.keys[i];
        await db.runAsync(
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

    // Replace tags.
    if (fmt.tags) {
      await db.runAsync(`DELETE FROM format_tags WHERE format_id=?`, [fmt.id]);
      for (const tag of fmt.tags) {
        await db.runAsync(
          `INSERT INTO format_tags (id, format_id, tag, created_at) VALUES (?,?,?,?)`,
          [generateUUID(), fmt.id, tag, now]
        );
      }
    }
  });
}

/**
 * Soft-delete a developer-authored format by UUID.
 * No-ops silently if the UUID does not exist in the DB.
 */
export async function deleteDevFormat(id: string): Promise<void> {
  const now = nowTimestamp();
  await dbRunAsync(
    `UPDATE predefined_formats SET deleted_at=?, updated_at=? WHERE id=?`,
    [now, now, id]
  );
}

// Re-export for use by sysFormatRepo without importing from database directly.
export { SQL_IS_PUBLISHED };

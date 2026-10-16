import { getDatabase, generateUUID, nowTimestamp } from './database';
import { fuzzyMatch } from '@/lib/searchUtils';

// ─── Types ────────────────────────────────────────────────────────────────
export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  crime_type: string;     // used by Investigation Guides sections
  description: string;
  tags: string;           // comma-separated
  attachment_uris: string; // JSON array string of { uri, name, type }
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
  // AI Simple Explanation cache
  simple_explanation?: string;
  simple_explanation_generated_at?: number;
}

export type KnowledgeAnalytics = Record<string, number>;

// ─── Create ───────────────────────────────────────────────────────────────
export async function createKnowledgeEntry(
  data: Pick<KnowledgeEntry, 'title' | 'category' | 'subcategory' | 'crime_type' | 'description' | 'tags' | 'attachment_uris'>
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO knowledge_entries
      (id, title, category, subcategory, crime_type, description, tags, attachment_uris, created_at, updated_at, version, sync_status)
     VALUES (?,?,?,?,?,?,?,?,?,?,1,'pending')`,
    [id, data.title, data.category, data.subcategory, data.crime_type ?? '',
     data.description, data.tags, data.attachment_uris, now, now]
  );
  return id;
}

// ─── Update ───────────────────────────────────────────────────────────────
export async function updateKnowledgeEntry(
  id: string,
  data: Pick<KnowledgeEntry, 'title' | 'category' | 'subcategory' | 'crime_type' | 'description' | 'tags' | 'attachment_uris'>
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE knowledge_entries
       SET title=?, category=?, subcategory=?, crime_type=?, description=?, tags=?,
           attachment_uris=?, updated_at=?, version=version+1, sync_status='pending'
     WHERE id=? AND deleted_at IS NULL`,
    [data.title, data.category, data.subcategory, data.crime_type ?? '',
     data.description, data.tags, data.attachment_uris, now, id]
  );
}

// ─── Soft Delete ──────────────────────────────────────────────────────────
export async function deleteKnowledgeEntry(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE knowledge_entries SET deleted_at=?, updated_at=? WHERE id=?`,
    [now, now, id]
  );
}

// ─── Get By ID ────────────────────────────────────────────────────────────
export async function getKnowledgeById(id: string): Promise<KnowledgeEntry | null> {
  const db = await getDatabase();
  return db.getFirstAsync<KnowledgeEntry>(
    `SELECT * FROM knowledge_entries WHERE id=? AND deleted_at IS NULL`,
    [id]
  );
}

// ─── List by Category ─────────────────────────────────────────────────────
export async function getKnowledgeByCategory(category: string): Promise<KnowledgeEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<KnowledgeEntry>(
    `SELECT * FROM knowledge_entries
     WHERE category=? AND deleted_at IS NULL
     ORDER BY updated_at DESC`,
    [category]
  );
}

// ─── Search ───────────────────────────────────────────────────────────────

export interface KnowledgeSearchOpts {
  typoTolerance?: boolean;
}

export async function searchKnowledge(
  category: string,
  query: string,
  subcategory?: string,
  crimeType?: string,
  opts?: KnowledgeSearchOpts,
): Promise<KnowledgeEntry[]> {
  const db = await getDatabase();
  const conditions: string[] = ['deleted_at IS NULL', 'category=?'];
  const params: (string | number)[] = [category];
  const trimmed = query.trim();

  if (trimmed) {
    // When typoTolerance is on, widen the LIKE to a 2-char prefix so fuzzy
    // candidates are included; post-filter below with fuzzyMatch.
    const q = opts?.typoTolerance
      ? `%${trimmed.slice(0, 2).toLowerCase()}%`
      : `%${trimmed.toLowerCase()}%`;
    conditions.push(`(LOWER(title) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(description) LIKE ? OR LOWER(crime_type) LIKE ?)`);
    params.push(q, q, q, q);
  }

  if (subcategory && subcategory !== 'All') {
    conditions.push('subcategory=?');
    params.push(subcategory);
  }

  if (crimeType && crimeType !== 'All') {
    conditions.push('LOWER(TRIM(crime_type))=LOWER(TRIM(?))');
    params.push(crimeType);
  }

  const where = conditions.join(' AND ');
  const rows = await db.getAllAsync<KnowledgeEntry>(
    `SELECT * FROM knowledge_entries WHERE ${where} ORDER BY updated_at DESC`,
    params
  );

  // Post-filter with fuzzyMatch when typoTolerance is on.
  if (trimmed && opts?.typoTolerance) {
    return rows.filter((r) =>
      fuzzyMatch(trimmed, `${r.title} ${r.tags} ${r.description ?? ''} ${r.crime_type ?? ''}`)
    );
  }

  return rows;
}

// ─── Global Search (all categories) ──────────────────────────────────────
export async function searchKnowledgeAll(
  query: string,
  opts?: KnowledgeSearchOpts,
): Promise<KnowledgeEntry[]> {
  const db = await getDatabase();
  const trimmed = query.trim();
  // When typoTolerance is on, widen the LIKE to a 2-char prefix so fuzzy
  // candidates are included; post-filter below with fuzzyMatch.
  const q = opts?.typoTolerance
    ? `%${trimmed.slice(0, 2).toLowerCase()}%`
    : `%${trimmed.toLowerCase()}%`;
  const rows = await db.getAllAsync<KnowledgeEntry>(
    `SELECT * FROM knowledge_entries
     WHERE deleted_at IS NULL AND (LOWER(title) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(description) LIKE ? OR LOWER(crime_type) LIKE ?)
     ORDER BY updated_at DESC LIMIT 500`,
    [q, q, q, q]
  );

  // Post-filter with fuzzyMatch when typoTolerance is on.
  if (trimmed && opts?.typoTolerance) {
    return rows.filter((r) =>
      fuzzyMatch(trimmed, `${r.title} ${r.tags} ${r.description ?? ''} ${r.crime_type ?? ''}`)
    );
  }

  return rows;
}

// ─── Analytics: count per category ───────────────────────────────────────
export async function getKnowledgeAnalytics(): Promise<KnowledgeAnalytics> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ category: string; cnt: number }>(
    `SELECT category, COUNT(*) as cnt FROM knowledge_entries
     WHERE deleted_at IS NULL GROUP BY category`
  );
  const result: KnowledgeAnalytics = {};
  for (const row of rows) {
    result[row.category] = row.cnt;
  }
  return result;
}

// ─── Total count ──────────────────────────────────────────────────────────
export async function getKnowledgeTotalCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM knowledge_entries WHERE deleted_at IS NULL`
  );
  return row?.cnt ?? 0;
}

/**
 * Creates a user-editable copy of a System Content knowledge entry.
 * The copy gets source='user', editable=1 and a fresh UUID.
 * The original system entry is never modified.
 */
export async function duplicateKnowledgeAsUser(id: string): Promise<string> {
  const db = await getDatabase();
  const original = await getKnowledgeById(id);
  if (!original) throw new Error('Knowledge entry not found');
  const newId = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO knowledge_entries
       (id, title, category, subcategory, crime_type, description,
        tags, attachment_uris, source, editable,
        created_at, updated_at, version, sync_status)
     VALUES (?,?,?,?,?,?, ?,?, 'user',1, ?,?,1,'pending')`,
    [
      newId,
      `${original.title} (My Copy)`,
      original.category,
      original.subcategory,
      original.crime_type ?? '',
      original.description,
      original.tags,
      original.attachment_uris,
      now, now,
    ]
  );
  return newId;
}

// ─── Update AI Simple Explanation cache ──────────────────────────────────
export async function updateSimpleExplanation(
  id: string,
  text: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE knowledge_entries
       SET simple_explanation=?, simple_explanation_generated_at=?
     WHERE id=? AND deleted_at IS NULL`,
    [text, nowTimestamp(), id]
  );
}

// ─── Update Attachments only ──────────────────────────────────────────────
export async function updateKnowledgeAttachments(
  id: string,
  attachmentUris: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE knowledge_entries
       SET attachment_uris=?, updated_at=?, version=version+1, sync_status='pending'
     WHERE id=? AND deleted_at IS NULL`,
    [attachmentUris, nowTimestamp(), id]
  );
}

// ─── Developer System Content helpers ─────────────────────────────────────────
// Used by devSeedStore to write developer-created knowledge into the live DB
// immediately on Save/Edit/Delete so all screens reflect changes without a
// restart.  __DEV__-only call sites.

/**
 * INSERT or UPDATE a developer-authored knowledge entry identified by its UUID.
 * - If UUID not present → INSERT.
 * - If already present → UPDATE all content fields.
 *
 * source='system', editable=0 to match the System Content Architecture contract.
 */
export async function upsertDevKnowledge(kn: {
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
  seed_version?: number;
  app_version?: string;
  last_updated?: string;
}): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM knowledge_entries WHERE id = ? AND deleted_at IS NULL`,
    [kn.id]
  );

  if (!existing) {
    await db.runAsync(
      `INSERT INTO knowledge_entries
         (id, title, category, subcategory, crime_type, description,
          tags, attachment_uris,
          source, editable, seed_version, app_version, last_updated,
          created_at, updated_at, version, sync_status)
       VALUES (?,?,?,?,?,?, ?,?, ?,?,?,?,?, ?,?,1,'pending')`,
      [
        kn.id, kn.title, kn.category, kn.subcategory, kn.crime_type, kn.description,
        kn.tags, kn.attachment_uris,
        kn.source ?? 'system', kn.editable ?? 0,
        kn.seed_version ?? 1, kn.app_version ?? '', kn.last_updated ?? '',
        now, now,
      ]
    );
  } else {
    await db.runAsync(
      `UPDATE knowledge_entries
         SET title=?, category=?, subcategory=?, crime_type=?,
             description=?, tags=?, attachment_uris=?,
             seed_version=?, app_version=?, last_updated=?,
             updated_at=?, version=version+1
       WHERE id=?`,
      [
        kn.title, kn.category, kn.subcategory, kn.crime_type,
        kn.description, kn.tags, kn.attachment_uris,
        kn.seed_version ?? 1, kn.app_version ?? '', kn.last_updated ?? '',
        now, kn.id,
      ]
    );
  }
}

/**
 * Soft-delete a developer-authored knowledge entry by UUID.
 * No-ops silently if the UUID does not exist.
 */
export async function deleteDevKnowledge(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE knowledge_entries SET deleted_at=?, updated_at=? WHERE id=?`,
    [now, now, id]
  );
}

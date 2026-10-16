/**
 * System Knowledge Repository — v121
 *
 * Owner-only operations for System Knowledge Management.
 * REUSES the existing `knowledge_entries` table (source='system', editable=0).
 * Does NOT duplicate any existing repo, service, or table.
 *
 * Adds:
 *   - Publish / Archive / Restore lifecycle
 *   - Version snapshots (sys_knowledge_versions)
 *   - Audit trail (sys_knowledge_audit)
 *   - Bulk import / export helpers
 *   - Dashboard stats
 *   - Custom category management (sys_knowledge_custom_categories)
 */
import { getDatabase, generateUUID, nowTimestamp } from './database';
import type { KnowledgeEntry } from './knowledgeRepo';

// ─── Status type ──────────────────────────────────────────────────────────────
export type KnowledgeStatus = 'draft' | 'published' | 'archived';

export type SysKnowledgeAction =
  | 'create' | 'update' | 'publish' | 'unpublish'
  | 'archive' | 'restore' | 'delete' | 'rollback' | 'duplicate' | 'bulk_import';

// ─── Extended article type ────────────────────────────────────────────────────
export interface SysKnowledgeArticle extends KnowledgeEntry {
  subtitle: string;
  keywords: string;          // comma-separated
  content: string;           // full rich body (markdown-flavoured plain text)
  status: KnowledgeStatus;
  bns_sections: string;      // comma-separated
  bnss_sections: string;
  crime_type: string;
  investigation_stage: string;
  evidence_type: string;
  related_sop: string;
  related_circular: string;
  related_format: string;
  related_checklist: string;
  related_judgment: string;
  related_knowledge: string;
  author: string;
  published_at: number | null;
  archived_at: number | null;
  change_notes: string;
}

export interface SysKnowledgeVersion {
  id: string;
  article_id: string;
  version_number: number;
  title: string;
  subtitle: string;
  category: string;
  subcategory: string;
  content: string;
  tags_snapshot: string;
  keywords_snapshot: string;
  metadata_snapshot: string;
  change_notes: string;
  created_at: number;
  created_by: string;
}

export interface SysKnowledgeAudit {
  id: string;
  article_id: string;
  action: string;
  details: string;
  version_number: number | null;
  created_at: number;
  created_by: string;
}

export interface SysKnowledgeStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  byCategory: Record<string, number>;
  recentlyUpdated: SysKnowledgeArticle[];
  mostTagged: SysKnowledgeArticle[];
}

export interface SysCustomCategory {
  id: string;
  label: string;
  color: string;
  icon_name: string;
  subcategories: string; // JSON array
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _auditRow(
  articleId: string,
  action: SysKnowledgeAction,
  details: string,
  versionNumber?: number,
): [string, string, string, string, number | null, number, string] {
  return [
    generateUUID(), articleId, action, details,
    versionNumber ?? null, nowTimestamp(), 'owner',
  ];
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
export async function createSysKnowledgeArticle(
  data: Pick<
    SysKnowledgeArticle,
    | 'title' | 'subtitle' | 'category' | 'subcategory' | 'crime_type'
    | 'description' | 'content' | 'tags' | 'keywords' | 'attachment_uris'
    | 'bns_sections' | 'bnss_sections' | 'investigation_stage' | 'evidence_type'
    | 'related_sop' | 'related_circular' | 'related_format' | 'related_checklist'
    | 'related_judgment' | 'related_knowledge' | 'author' | 'change_notes'
  >,
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();

  await db.runAsync(
    `INSERT INTO knowledge_entries
      (id, title, category, subcategory, crime_type, description, tags,
       attachment_uris, source, editable, created_at, updated_at, version, sync_status,
       subtitle, keywords, content, status,
       bns_sections, bnss_sections, investigation_stage, evidence_type,
       related_sop, related_circular, related_format, related_checklist,
       related_judgment, related_knowledge, author, change_notes)
     VALUES (?,?,?,?,?,?,?,?, 'system',0, ?,?,1,'pending',
             ?,?,?,'draft',
             ?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, data.title, data.category, data.subcategory, data.crime_type ?? '',
      data.description, data.tags, data.attachment_uris, now, now,
      data.subtitle ?? '', data.keywords ?? '', data.content ?? '',
      data.bns_sections ?? '', data.bnss_sections ?? '',
      data.investigation_stage ?? '', data.evidence_type ?? '',
      data.related_sop ?? '', data.related_circular ?? '',
      data.related_format ?? '', data.related_checklist ?? '',
      data.related_judgment ?? '', data.related_knowledge ?? '',
      data.author ?? 'Owner', data.change_notes ?? '',
    ],
  );

  // Version snapshot
  await _snapshotVersion(id, 1, data, db);

  // Audit
  await db.runAsync(
    `INSERT INTO sys_knowledge_audit (id,article_id,action,details,version_number,created_at,created_by)
     VALUES (?,?,?,?,?,?,?)`,
    _auditRow(id, 'create', `Created "${data.title}"`, 1),
  );

  return id;
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
export async function updateSysKnowledgeArticle(
  id: string,
  data: Partial<SysKnowledgeArticle> & { change_notes?: string },
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();

  const fields: string[] = [];
  const vals: (string | number | null)[] = [];

  const push = (col: string, val: string | number | null | undefined) => {
    if (val !== undefined) { fields.push(`${col}=?`); vals.push(val ?? null); }
  };

  push('title',              data.title);
  push('subtitle',           data.subtitle);
  push('category',           data.category);
  push('subcategory',        data.subcategory);
  push('crime_type',         data.crime_type);
  push('description',        data.description);
  push('content',            data.content);
  push('tags',               data.tags);
  push('keywords',           data.keywords);
  push('attachment_uris',    data.attachment_uris);
  push('bns_sections',       data.bns_sections);
  push('bnss_sections',      data.bnss_sections);
  push('investigation_stage',data.investigation_stage);
  push('evidence_type',      data.evidence_type);
  push('related_sop',        data.related_sop);
  push('related_circular',   data.related_circular);
  push('related_format',     data.related_format);
  push('related_checklist',  data.related_checklist);
  push('related_judgment',   data.related_judgment);
  push('related_knowledge',  data.related_knowledge);
  push('author',             data.author);
  push('change_notes',       data.change_notes);

  if (!fields.length) return;

  fields.push('updated_at=?', 'version=version+1', 'sync_status=?');
  vals.push(now, 'pending', id);

  await db.runAsync(
    `UPDATE knowledge_entries SET ${fields.join(',')} WHERE id=?`,
    vals,
  );

  // Snapshot updated version
  const article = await getSysKnowledgeById(id);
  if (article) {
    await _snapshotVersion(id, article.version, article, db);
    await db.runAsync(
      `INSERT INTO sys_knowledge_audit (id,article_id,action,details,version_number,created_at,created_by)
       VALUES (?,?,?,?,?,?,?)`,
      _auditRow(id, 'update', `Updated v${article.version}: ${data.change_notes ?? ''}`, article.version),
    );
  }
}

// ─── PUBLISH / UNPUBLISH / ARCHIVE / RESTORE ──────────────────────────────────
//
// IMPORTANT: All status values are passed as bound parameters (?) — never as
// SQL string literals (e.g. status='published').  The Web SQLite stub's UPDATE
// parser skips any SET assignment that lacks a '?' placeholder, so literal status
// strings were silently dropped on Web, leaving entries permanently stuck in
// 'draft' and invisible to all published-content queries after every restart.
//
// WHERE clauses use only a single "id = ?" condition (no compound AND).  The stub
// regex required WHERE col=?$ at end-of-string; extra AND conditions (e.g.
// AND deleted_at IS NULL) caused the entire UPDATE to be dropped silently.
// The deleted_at guard is enforced by the JS-side fetch before calling these
// functions, so the SQL-level guard is redundant.

export async function publishSysKnowledge(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE knowledge_entries
        SET status=?, published_at=?, updated_at=?, sync_status=?
      WHERE id=?`,
    ['published', now, now, 'pending', id],
  );
  await db.runAsync(
    `INSERT INTO sys_knowledge_audit (id,article_id,action,details,version_number,created_at,created_by)
     VALUES (?,?,?,?,?,?,?)`,
    _auditRow(id, 'publish', 'Article published'),
  );
}

export async function unpublishSysKnowledge(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE knowledge_entries
        SET status=?, updated_at=?, sync_status=?
      WHERE id=?`,
    ['draft', now, 'pending', id],
  );
  await db.runAsync(
    `INSERT INTO sys_knowledge_audit (id,article_id,action,details,version_number,created_at,created_by)
     VALUES (?,?,?,?,?,?,?)`,
    _auditRow(id, 'unpublish', 'Moved back to draft'),
  );
}

export async function archiveSysKnowledge(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE knowledge_entries
        SET status=?, archived_at=?, updated_at=?, sync_status=?
      WHERE id=?`,
    ['archived', now, now, 'pending', id],
  );
  await db.runAsync(
    `INSERT INTO sys_knowledge_audit (id,article_id,action,details,version_number,created_at,created_by)
     VALUES (?,?,?,?,?,?,?)`,
    _auditRow(id, 'archive', 'Article archived'),
  );
}

export async function restoreSysKnowledge(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE knowledge_entries
        SET status=?, archived_at=NULL, updated_at=?, sync_status=?
      WHERE id=?`,
    ['draft', now, 'pending', id],
  );
  await db.runAsync(
    `INSERT INTO sys_knowledge_audit (id,article_id,action,details,version_number,created_at,created_by)
     VALUES (?,?,?,?,?,?,?)`,
    _auditRow(id, 'restore', 'Restored from archive'),
  );
}

// ─── SOFT DELETE ──────────────────────────────────────────────────────────────
export async function deleteSysKnowledge(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  // WHERE uses only "id=?" — source guard is enforced by the caller.
  // Compound AND source='system' broke the Web stub UPDATE regex.
  await db.runAsync(
    `UPDATE knowledge_entries SET deleted_at=?, updated_at=? WHERE id=?`,
    [now, now, id],
  );
  await db.runAsync(
    `INSERT INTO sys_knowledge_audit (id,article_id,action,details,version_number,created_at,created_by)
     VALUES (?,?,?,?,?,?,?)`,
    _auditRow(id, 'delete', 'Article deleted'),
  );
}

// ─── DUPLICATE ────────────────────────────────────────────────────────────────
export async function duplicateSysKnowledge(id: string): Promise<string> {
  const db = await getDatabase();
  const original = await getSysKnowledgeById(id);
  if (!original) throw new Error('Article not found');
  const newId = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO knowledge_entries
      (id, title, category, subcategory, crime_type, description, content, tags, keywords,
       attachment_uris, source, editable, created_at, updated_at, version, sync_status,
       subtitle, status, bns_sections, bnss_sections, investigation_stage, evidence_type,
       related_sop, related_circular, related_format, related_checklist,
       related_judgment, related_knowledge, author, change_notes)
     SELECT ?,title||' (Copy)',category,subcategory,crime_type,description,content,tags,keywords,
       attachment_uris,'system',0,?,?,1,'pending',
       subtitle,'draft',bns_sections,bnss_sections,investigation_stage,evidence_type,
       related_sop,related_circular,related_format,related_checklist,
       related_judgment,related_knowledge,author,'Duplicated from '||id
     FROM knowledge_entries WHERE id=?`,
    [newId, now, now, id],
  );
  await _snapshotVersion(newId, 1, original, db);
  await db.runAsync(
    `INSERT INTO sys_knowledge_audit (id,article_id,action,details,version_number,created_at,created_by)
     VALUES (?,?,?,?,?,?,?)`,
    _auditRow(newId, 'duplicate', `Duplicated from ${id}`, 1),
  );
  return newId;
}

// ─── ROLLBACK ─────────────────────────────────────────────────────────────────
export async function rollbackSysKnowledge(
  articleId: string,
  versionId: string,
): Promise<void> {
  const db = await getDatabase();
  const v = await db.getFirstAsync<SysKnowledgeVersion>(
    `SELECT * FROM sys_knowledge_versions WHERE id=? AND article_id=?`,
    [versionId, articleId],
  );
  if (!v) throw new Error('Version not found');
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE knowledge_entries
     SET title=?,subtitle=?,category=?,subcategory=?,content=?,tags=?,keywords=?,
         change_notes=?,updated_at=?,version=version+1,sync_status=?
     WHERE id=?`,
    [v.title, v.subtitle, v.category, v.subcategory, v.content,
     JSON.parse(v.tags_snapshot).join(','),
     JSON.parse(v.keywords_snapshot).join(','),
     `Rolled back to v${v.version_number}`, now, 'pending', articleId],
  );
  await db.runAsync(
    `INSERT INTO sys_knowledge_audit (id,article_id,action,details,version_number,created_at,created_by)
     VALUES (?,?,?,?,?,?,?)`,
    _auditRow(articleId, 'rollback', `Rolled back to v${v.version_number}`, v.version_number),
  );
}

// ─── GET BY ID ────────────────────────────────────────────────────────────────
export async function getSysKnowledgeById(id: string): Promise<SysKnowledgeArticle | null> {
  const db = await getDatabase();
  return db.getFirstAsync<SysKnowledgeArticle>(
    `SELECT *,
       COALESCE(status,'draft') as status,
       COALESCE(subtitle,'') as subtitle,
       COALESCE(content,'') as content,
       COALESCE(keywords,'') as keywords,
       COALESCE(bns_sections,'') as bns_sections,
       COALESCE(bnss_sections,'') as bnss_sections,
       COALESCE(investigation_stage,'') as investigation_stage,
       COALESCE(evidence_type,'') as evidence_type,
       COALESCE(related_sop,'') as related_sop,
       COALESCE(related_circular,'') as related_circular,
       COALESCE(related_format,'') as related_format,
       COALESCE(related_checklist,'') as related_checklist,
       COALESCE(related_judgment,'') as related_judgment,
       COALESCE(related_knowledge,'') as related_knowledge,
       COALESCE(author,'Owner') as author,
       COALESCE(change_notes,'') as change_notes
     FROM knowledge_entries
     WHERE id=? AND source='system' AND deleted_at IS NULL`,
    [id],
  );
}

// ─── LIST ─────────────────────────────────────────────────────────────────────
export async function getSysKnowledgeList(opts?: {
  status?: KnowledgeStatus | 'all';
  category?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<SysKnowledgeArticle[]> {
  const db = await getDatabase();
  const conditions = ["source='system'", 'deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (opts?.status && opts.status !== 'all') {
    conditions.push('COALESCE(status,\'draft\')=?');
    params.push(opts.status);
  }
  if (opts?.category && opts.category !== 'all') {
    conditions.push('category=?');
    params.push(opts.category);
  }
  if (opts?.query?.trim()) {
    const q = `%${opts.query.trim().toLowerCase()}%`;
    conditions.push('(LOWER(title) LIKE ? OR LOWER(COALESCE(description,\'\')) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(COALESCE(keywords,\'\')) LIKE ?)');
    params.push(q, q, q, q);
  }

  const limit  = opts?.limit  ?? 9999;
  const offset = opts?.offset ?? 0;
  params.push(limit, offset);

  return db.getAllAsync<SysKnowledgeArticle>(
    `SELECT *,
       COALESCE(status,'draft') as status,
       COALESCE(subtitle,'') as subtitle,
       COALESCE(content,'') as content,
       COALESCE(keywords,'') as keywords,
       COALESCE(bns_sections,'') as bns_sections,
       COALESCE(bnss_sections,'') as bnss_sections,
       COALESCE(investigation_stage,'') as investigation_stage,
       COALESCE(evidence_type,'') as evidence_type,
       COALESCE(author,'Owner') as author,
       COALESCE(change_notes,'') as change_notes,
       COALESCE(related_sop,'') as related_sop,
       COALESCE(related_circular,'') as related_circular,
       COALESCE(related_format,'') as related_format,
       COALESCE(related_checklist,'') as related_checklist,
       COALESCE(related_judgment,'') as related_judgment,
       COALESCE(related_knowledge,'') as related_knowledge
     FROM knowledge_entries
     WHERE ${conditions.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    params,
  );
}

// ─── VERSION HISTORY ─────────────────────────────────────────────────────────
export async function getSysKnowledgeVersions(articleId: string): Promise<SysKnowledgeVersion[]> {
  const db = await getDatabase();
  return db.getAllAsync<SysKnowledgeVersion>(
    `SELECT * FROM sys_knowledge_versions WHERE article_id=? ORDER BY version_number DESC`,
    [articleId],
  );
}

// ─── AUDIT TRAIL ─────────────────────────────────────────────────────────────
export async function getSysKnowledgeAudit(articleId: string): Promise<SysKnowledgeAudit[]> {
  const db = await getDatabase();
  return db.getAllAsync<SysKnowledgeAudit>(
    `SELECT * FROM sys_knowledge_audit WHERE article_id=? ORDER BY created_at DESC`,
    [articleId],
  );
}

export async function getAllSysKnowledgeAudit(limit = 100): Promise<SysKnowledgeAudit[]> {
  const db = await getDatabase();
  return db.getAllAsync<SysKnowledgeAudit>(
    `SELECT * FROM sys_knowledge_audit ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
}

// ─── STATS ────────────────────────────────────────────────────────────────────
export async function getSysKnowledgeStats(): Promise<SysKnowledgeStats> {
  const db = await getDatabase();

  const counts = await db.getFirstAsync<{
    total: number; published: number; draft: number; archived: number;
  }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN COALESCE(status,'draft')='published' THEN 1 ELSE 0 END) as published,
       SUM(CASE WHEN COALESCE(status,'draft')='draft'     THEN 1 ELSE 0 END) as draft,
       SUM(CASE WHEN COALESCE(status,'draft')='archived'  THEN 1 ELSE 0 END) as archived
     FROM knowledge_entries WHERE source='system' AND deleted_at IS NULL`,
  ) ?? { total: 0, published: 0, draft: 0, archived: 0 };

  const catRows = await db.getAllAsync<{ category: string; cnt: number }>(
    `SELECT category, COUNT(*) as cnt FROM knowledge_entries
     WHERE source='system' AND deleted_at IS NULL GROUP BY category`,
  );
  const byCategory: Record<string, number> = {};
  for (const r of catRows) byCategory[r.category] = r.cnt;

  const recentlyUpdated = await getSysKnowledgeList({ limit: 5 });
  const mostTagged = await getSysKnowledgeList({ limit: 5 });

  return {
    total:          counts.total,
    published:      counts.published,
    draft:          counts.draft,
    archived:       counts.archived,
    byCategory,
    recentlyUpdated,
    mostTagged,
  };
}

// ─── BULK EXPORT ─────────────────────────────────────────────────────────────
export async function exportSysKnowledgeJSON(): Promise<string> {
  const articles = await getSysKnowledgeList({ limit: 9999 });
  return JSON.stringify({ version: 1, exported_at: new Date().toISOString(), articles }, null, 2);
}

// ─── BULK IMPORT ─────────────────────────────────────────────────────────────
export async function importSysKnowledgeJSON(jsonStr: string): Promise<{ imported: number; skipped: number }> {
  const db = await getDatabase();
  let parsed: { articles?: Partial<SysKnowledgeArticle>[] };
  try { parsed = JSON.parse(jsonStr); } catch { throw new Error('Invalid JSON'); }

  const articles = parsed.articles ?? [];
  let imported = 0; let skipped = 0;

  for (const a of articles) {
    if (!a.title || !a.category) { skipped++; continue; }
    try {
      await createSysKnowledgeArticle({
        title:              a.title ?? '',
        subtitle:           a.subtitle ?? '',
        category:           a.category ?? '',
        subcategory:        a.subcategory ?? '',
        crime_type:         a.crime_type ?? '',
        description:        a.description ?? '',
        content:            a.content ?? '',
        tags:               a.tags ?? '',
        keywords:           a.keywords ?? '',
        attachment_uris:    a.attachment_uris ?? '[]',
        bns_sections:       a.bns_sections ?? '',
        bnss_sections:      a.bnss_sections ?? '',
        investigation_stage: a.investigation_stage ?? '',
        evidence_type:      a.evidence_type ?? '',
        related_sop:        a.related_sop ?? '',
        related_circular:   a.related_circular ?? '',
        related_format:     a.related_format ?? '',
        related_checklist:  a.related_checklist ?? '',
        related_judgment:   a.related_judgment ?? '',
        related_knowledge:  a.related_knowledge ?? '',
        author:             a.author ?? 'Owner',
        change_notes:       a.change_notes ?? 'Bulk import',
      });
      imported++;
    } catch { skipped++; }
  }

  await db.runAsync(
    `INSERT INTO sys_knowledge_audit (id,article_id,action,details,version_number,created_at,created_by)
     VALUES (?,?,?,?,?,?,?)`,
    [generateUUID(), 'bulk', 'bulk_import', `Imported ${imported}, skipped ${skipped}`, null, nowTimestamp(), 'owner'],
  );

  return { imported, skipped };
}

// ─── CUSTOM CATEGORIES ────────────────────────────────────────────────────────
export async function getCustomCategories(): Promise<SysCustomCategory[]> {
  const db = await getDatabase();
  return db.getAllAsync<SysCustomCategory>(
    `SELECT * FROM sys_knowledge_custom_categories WHERE deleted_at IS NULL ORDER BY created_at ASC`,
  );
}

export async function createCustomCategory(
  label: string,
  color: string,
  subcategories: string[],
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO sys_knowledge_custom_categories (id,label,color,icon_name,subcategories,created_at,updated_at)
     VALUES (?,?,?,'FolderOpen',?,?,?)`,
    [id, label.trim(), color, JSON.stringify(subcategories), now, now],
  );
  return id;
}

export async function updateCustomCategory(
  id: string,
  label: string,
  color: string,
  subcategories: string[],
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sys_knowledge_custom_categories SET label=?,color=?,subcategories=?,updated_at=? WHERE id=?`,
    [label.trim(), color, JSON.stringify(subcategories), nowTimestamp(), id],
  );
}

export async function deleteCustomCategory(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sys_knowledge_custom_categories SET deleted_at=? WHERE id=?`,
    [nowTimestamp(), id],
  );
}

// ─── Internal: version snapshot ──────────────────────────────────────────────
async function _snapshotVersion(
  articleId: string,
  versionNumber: number,
  data: Partial<SysKnowledgeArticle>,
  db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<void> {
  const id = generateUUID();
  const metadata = {
    bns_sections:        data.bns_sections        ?? '',
    bnss_sections:       data.bnss_sections        ?? '',
    investigation_stage: data.investigation_stage  ?? '',
    evidence_type:       data.evidence_type        ?? '',
    crime_type:          data.crime_type           ?? '',
    author:              data.author               ?? 'Owner',
  };
  await db.runAsync(
    `INSERT INTO sys_knowledge_versions
      (id,article_id,version_number,title,subtitle,category,subcategory,content,
       tags_snapshot,keywords_snapshot,metadata_snapshot,change_notes,created_at,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, articleId, versionNumber,
      data.title ?? '', data.subtitle ?? '',
      data.category ?? '', data.subcategory ?? '',
      data.content ?? '',
      JSON.stringify((data.tags ?? '').split(',').filter(Boolean)),
      JSON.stringify((data.keywords ?? '').split(',').filter(Boolean)),
      JSON.stringify(metadata),
      data.change_notes ?? '',
      nowTimestamp(), 'owner',
    ],
  );
}

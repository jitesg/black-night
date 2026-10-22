import { getDatabase, generateUUID, nowTimestamp } from './database';
import { recordFirstKnowledgeCountQueryTime } from './seedManager';
import { fuzzyMatch } from '@/lib/searchUtils';
import { getCanonicalCategory, getCategoryVariants } from '@/lib/knowledgeConstants';
import { logger } from '@/lib/logger';
import { getAllKnowledgeNotesMap } from './knowledgeNotesRepo';

export {
  getKnowledgeNote,
  saveKnowledgeNote,
  getAllKnowledgeNotesMap,
  searchKnowledgeNoteEntryIds,
} from './knowledgeNotesRepo';
import knowledgeSeedData from '../../../assets/seed/knowledge_seed.json';
import circularsSeedData from '../../../assets/seed/circulars_seed.json';
import circularsSeed2Data from '../../../assets/seed/circulars_seed_2.json';
import circularsSeed3Data from '../../../assets/seed/circulars_seed_3.json';
import circularsSeed4Data from '../../../assets/seed/circulars_seed_4.json';
import circularsSeed5Data from '../../../assets/seed/circulars_seed_5.json';
import circularsSeed6Data from '../../../assets/seed/circulars_seed_6.json';
import circularsSeed7Data from '../../../assets/seed/circulars_seed_7.json';
import circularsSeed8Data from '../../../assets/seed/circulars_seed_8.json';
import sopSeed1Data from '../../../assets/seed/sop_seed_1.json';
import sopSeed2Data from '../../../assets/seed/sop_seed_2.json';
import { REG_SEED_ROWS } from '@/lib/regulations/regSeedFiles';
import { BNS_REF_SEED_FILE } from '@/lib/bnsRef/bnsRefSeed';

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

// ─── Bundled Static Seed Index (Read-through fallback) ─────────────────────
interface SeedKnowledgeRaw {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  crime_type?: string;
  description?: string;
  tags?: string | string[];
  attachment_uris?: string | any[];
  source?: string;
  editable?: number;
  content_type?: string;
  seed_version?: number;
  app_version?: string;
  last_updated?: string;
}

const RAW_KNOWLEDGE_SEED = ((knowledgeSeedData as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).filter(
  (k) => !(k.source === 'system' && (k.category === 'Law' || k.category === 'Laws & Sections'))
);

const RAW_CIRCULARS_SEED = ((circularsSeedData as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    category: k.category || 'Circular',
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const RAW_CIRCULARS_2_SEED = ((circularsSeed2Data as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    category: k.category || 'Circular',
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const RAW_CIRCULARS_3_SEED = ((circularsSeed3Data as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    category: k.category || 'Circular',
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const RAW_CIRCULARS_4_SEED = ((circularsSeed4Data as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    category: k.category || 'Circular',
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const RAW_CIRCULARS_5_SEED = ((circularsSeed5Data as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    category: k.category || 'Circular',
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const RAW_CIRCULARS_6_SEED = ((circularsSeed6Data as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    category: k.category || 'Circular',
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const RAW_CIRCULARS_7_SEED = ((circularsSeed7Data as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    category: k.category || 'Circular',
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const RAW_CIRCULARS_8_SEED = ((circularsSeed8Data as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    category: k.category || 'Circular',
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'circular',
  })
);

const RAW_SOP_1_SEED = ((sopSeed1Data as unknown as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    category: k.category || 'SOP',
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'sop',
  })
);

const RAW_SOP_2_SEED = ((sopSeed2Data as unknown as { knowledge?: SeedKnowledgeRaw[] })?.knowledge ?? []).map(
  (k) => ({
    ...k,
    category: k.category || 'SOP',
    source: 'system',
    editable: 0,
    content_type: k.content_type || 'sop',
  })
);

function normalizeBundledEntry(raw: SeedKnowledgeRaw, defaultContentType = 'knowledge'): KnowledgeEntry {
  const tagsStr = typeof raw.tags === 'string'
    ? raw.tags
    : Array.isArray(raw.tags)
      ? (raw.tags as string[]).join(',')
      : '';
  const attachmentUris = typeof raw.attachment_uris === 'string'
    ? raw.attachment_uris
    : JSON.stringify(raw.attachment_uris ?? []);
  const lastUpdated = raw.last_updated ?? '';
  const parsedTime = lastUpdated ? Date.parse(lastUpdated) : NaN;
  const itemTimestamp = isNaN(parsedTime) ? 0 : Math.floor(parsedTime / 1000);

  return {
    id: raw.id,
    title: raw.title,
    category: raw.category,
    subcategory: raw.subcategory ?? '',
    crime_type: raw.crime_type ?? '',
    description: raw.description ?? '',
    tags: tagsStr,
    attachment_uris: attachmentUris,
    created_at: itemTimestamp,
    updated_at: itemTimestamp,
    version: 1,
    sync_status: 'synced',
    source: 'system',
    editable: 0,
    content_type: raw.content_type || (raw.category === 'Circular' ? 'circular' : defaultContentType),
    seed_version: raw.seed_version ?? 1,
    app_version: raw.app_version ?? '',
    last_updated: lastUpdated,
  };
}

let _bundledKnowledgeIndex: Map<string, KnowledgeEntry> | null = null;
function getBundledKnowledgeMap(): Map<string, KnowledgeEntry> {
  if (_bundledKnowledgeIndex) return _bundledKnowledgeIndex;
  const map = new Map<string, KnowledgeEntry>();
  try {
    for (const raw of RAW_KNOWLEDGE_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'knowledge'));
    }
    for (const raw of RAW_CIRCULARS_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'circular'));
    }
    for (const raw of RAW_CIRCULARS_2_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'circular'));
    }
    for (const raw of RAW_CIRCULARS_3_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'circular'));
    }
    for (const raw of RAW_CIRCULARS_4_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'circular'));
    }
    for (const raw of RAW_CIRCULARS_5_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'circular'));
    }
    for (const raw of RAW_CIRCULARS_6_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'circular'));
    }
    for (const raw of RAW_CIRCULARS_7_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'circular'));
    }
    for (const raw of RAW_CIRCULARS_8_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'circular'));
    }
    for (const raw of RAW_SOP_1_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'sop'));
    }
    for (const raw of RAW_SOP_2_SEED) {
      map.set(raw.id, normalizeBundledEntry(raw, 'sop'));
    }
    // UP Police Regulations (reg_seed_*.json)
    for (const raw of REG_SEED_ROWS) {
      map.set(raw.id, normalizeBundledEntry(raw as SeedKnowledgeRaw, 'regulation'));
    }
    // BNS संदर्भ (bns_ref_seed.json)
    for (const raw of BNS_REF_SEED_FILE.rows) {
      map.set(raw.id, normalizeBundledEntry(raw as SeedKnowledgeRaw, 'bns_ref'));
    }
  } catch (err) {
    logger.warn('[knowledgeRepo] Error initializing bundled knowledge map:', err);
  }
  _bundledKnowledgeIndex = map;
  return map;
}

// ─── Hidden System Knowledge IDs (Stored in app_settings) ───────────────────
export async function getHiddenSystemKnowledgeIds(): Promise<Set<string>> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'hidden_system_knowledge_ids'`
    );
    if (!row?.value) return new Set<string>();
    const parsed = JSON.parse(row.value);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch (err) {
    logger.warn('[knowledgeRepo] Failed to read hidden_system_knowledge_ids:', err);
    return new Set<string>();
  }
}

export async function hideSystemKnowledgeId(id: string): Promise<void> {
  try {
    const hidden = await getHiddenSystemKnowledgeIds();
    hidden.add(id);
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('hidden_system_knowledge_ids', ?)`,
      [JSON.stringify(Array.from(hidden))]
    );
  } catch (err) {
    logger.warn(`[knowledgeRepo] Failed to hide system knowledge id ${id}:`, err);
  }
}

export async function unhideSystemKnowledgeId(id: string): Promise<void> {
  try {
    const hidden = await getHiddenSystemKnowledgeIds();
    hidden.delete(id);
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, value) VALUES ('hidden_system_knowledge_ids', ?)`,
      [JSON.stringify(Array.from(hidden))]
    );
    await db.runAsync(
      `UPDATE knowledge_entries SET deleted_at = NULL WHERE id = ?`,
      [id]
    ).catch(() => {});
  } catch (err) {
    logger.warn(`[knowledgeRepo] Failed to unhide system knowledge id ${id}:`, err);
  }
}

/**
 * Merged View = Bundled seed entries ∪ knowledge_entries rows
 * DB row wins by id; soft-deleted DB rows or user-hidden system ids are excluded.
 */
export async function getMergedKnowledgeList(category?: string): Promise<KnowledgeEntry[]> {
  try {
    const hiddenIds = await getHiddenSystemKnowledgeIds();
    const bundledMap = getBundledKnowledgeMap();

    let dbRows: KnowledgeEntry[] = [];
    try {
      const db = await getDatabase();
      if (category) {
        const variants = getCategoryVariants(category);
        const placeholders = variants.map(() => '?').join(',');
        dbRows = await db.getAllAsync<KnowledgeEntry>(
          `SELECT * FROM knowledge_entries WHERE category IN (${placeholders})`,
          variants
        );
      } else {
        dbRows = await db.getAllAsync<KnowledgeEntry>(
          `SELECT * FROM knowledge_entries`
        );
      }
    } catch (err) {
      logger.warn('[knowledgeRepo] Failed to fetch DB knowledge rows, falling back to bundled:', err);
    }

    const merged = new Map<string, KnowledgeEntry>();

    // 1. Add bundled entries
    for (const [id, item] of bundledMap) {
      if (hiddenIds.has(id)) continue;
      if (category) {
        const variants = getCategoryVariants(category);
        if (!variants.some((v) => v.toLowerCase() === item.category.toLowerCase())) {
          continue;
        }
      }
      merged.set(id, item);
    }

    // 2. DB rows win
    for (const dbRow of dbRows) {
      if (hiddenIds.has(dbRow.id)) {
        merged.delete(dbRow.id);
        continue;
      }
      if (dbRow.deleted_at != null) {
        merged.delete(dbRow.id);
        continue;
      }
      merged.set(dbRow.id, dbRow);
    }

    return Array.from(merged.values());
  } catch (outerErr) {
    logger.warn('[knowledgeRepo] getMergedKnowledgeList outer error:', outerErr);
    return [];
  }
}

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
  try {
    await db.runAsync(
      `UPDATE knowledge_entries SET deleted_at=?, updated_at=? WHERE id=?`,
      [now, now, id]
    );
  } catch (err) {
    logger.warn('[knowledgeRepo] deleteKnowledgeEntry DB update failed:', err);
  }

  // If system row (or present in bundled static seed), record in hidden_system_knowledge_ids
  try {
    const entry = await getKnowledgeById(id);
    if (!entry || entry.source === 'system' || getBundledKnowledgeMap().has(id)) {
      await hideSystemKnowledgeId(id);
    }
  } catch (err) {
    logger.warn('[knowledgeRepo] deleteKnowledgeEntry hideSystemKnowledgeId error:', err);
  }
}

// ─── Get By ID ────────────────────────────────────────────────────────────
export async function getKnowledgeById(id: string): Promise<KnowledgeEntry | null> {
  try {
    const hiddenIds = await getHiddenSystemKnowledgeIds();
    if (hiddenIds.has(id)) return null;

    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<KnowledgeEntry>(
        `SELECT * FROM knowledge_entries WHERE id=? AND deleted_at IS NULL`,
        [id]
      );
      if (row) return row;
    } catch (dbErr) {
      logger.warn(`[knowledgeRepo] getKnowledgeById DB read failed for ${id}:`, dbErr);
    }

    // Fall back to bundled entry
    const bundled = getBundledKnowledgeMap().get(id);
    if (bundled && !hiddenIds.has(id)) {
      return bundled;
    }
    return null;
  } catch (err) {
    logger.warn(`[knowledgeRepo] getKnowledgeById error for ${id}:`, err);
    return null;
  }
}

// ─── List by Category ─────────────────────────────────────────────────────
export async function getKnowledgeByCategory(category: string): Promise<KnowledgeEntry[]> {
  try {
    const merged = await getMergedKnowledgeList(category);
    const isCircular = getCanonicalCategory(category) === 'Circular';
    merged.sort((a, b) => {
      if (isCircular) {
        const aDate = a.last_updated || '';
        const bDate = b.last_updated || '';
        if (aDate !== bDate) return bDate.localeCompare(aDate);
      }
      return (b.updated_at || 0) - (a.updated_at || 0);
    });
    return merged;
  } catch (err) {
    logger.warn('[knowledgeRepo] getKnowledgeByCategory failed:', err);
    return [];
  }
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
  try {
    const items = await getKnowledgeByCategory(category);
    const notesMap = await getAllKnowledgeNotesMap();
    const trimmed = query.trim().toLowerCase();

    let filtered = items;

    if (subcategory && subcategory !== 'All') {
      filtered = filtered.filter((r) => r.subcategory === subcategory);
    }

    if (crimeType && crimeType !== 'All') {
      const ctTarget = crimeType.trim().toLowerCase();
      filtered = filtered.filter((r) => (r.crime_type ?? '').trim().toLowerCase() === ctTarget);
    }

    if (trimmed) {
      filtered = filtered.filter((r) => {
        const note = notesMap.get(r.id) ?? '';
        const text = `${r.title} ${r.tags} ${r.description ?? ''} ${r.crime_type ?? ''} ${note}`.toLowerCase();
        if (text.includes(trimmed)) return true;
        if (opts?.typoTolerance) {
          return fuzzyMatch(trimmed, text);
        }
        return false;
      });
    }

    return filtered;
  } catch (err) {
    logger.warn('[knowledgeRepo] searchKnowledge failed:', err);
    return [];
  }
}

// ─── Global Search (all categories) ──────────────────────────────────────
export async function searchKnowledgeAll(
  query: string,
  opts?: KnowledgeSearchOpts,
): Promise<KnowledgeEntry[]> {
  try {
    const items = await getMergedKnowledgeList();
    const notesMap = await getAllKnowledgeNotesMap();
    const trimmed = query.trim().toLowerCase();

    let filtered = items;
    if (trimmed) {
      filtered = filtered.filter((r) => {
        const note = notesMap.get(r.id) ?? '';
        const text = `${r.title} ${r.tags} ${r.description ?? ''} ${r.crime_type ?? ''} ${note}`.toLowerCase();
        if (text.includes(trimmed)) return true;
        if (opts?.typoTolerance) {
          return fuzzyMatch(trimmed, text);
        }
        return false;
      });
    }

    filtered.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
    return filtered.slice(0, 500);
  } catch (err) {
    logger.warn('[knowledgeRepo] searchKnowledgeAll failed:', err);
    return [];
  }
}

// ─── Smart Knowledge Search (keyword extraction, stopwords & relevance) ───
export async function searchKnowledgeSmart(
  query: string,
  limit = 8,
): Promise<KnowledgeEntry[]> {
  try {
    const STOPWORDS = new Set([
      'का','के','की','है','हैं','में','से','को','पर','और','या','यह','वह',
      'क्या','कैसे','कब','कौन','कहाँ','मुझे','हो','सकता','सकती',
      'a','an','the','is','are','in','on','at','of','to','for','and','or',
      'what','how','when','who','where','can','could','do','does','my',
    ]);
    const words = Array.from(new Set(
      query.toLowerCase().split(/[\s,.।?!]+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    ));
    if (words.length === 0) return [];

    const items = await getMergedKnowledgeList();
    const notesMap = await getAllKnowledgeNotesMap();
    const scored = items.map((r) => {
      const note = notesMap.get(r.id) ?? '';
      const hay = `${r.title} ${r.tags} ${r.description ?? ''} ${r.crime_type ?? ''} ${note}`.toLowerCase();
      const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
      return { row: r, score };
    }).filter((s) => s.score > 0);

    scored.sort((a, b) => b.score - a.score || (b.row.updated_at || 0) - (a.row.updated_at || 0));
    return scored.slice(0, limit).map((s) => s.row);
  } catch (err) {
    logger.warn('[knowledgeRepo] searchKnowledgeSmart failed:', err);
    return [];
  }
}

// ─── Analytics: count per category ───────────────────────────────────────
export async function getKnowledgeAnalytics(): Promise<KnowledgeAnalytics> {
  recordFirstKnowledgeCountQueryTime();
  try {
    const merged = await getMergedKnowledgeList();
    const result: KnowledgeAnalytics = {};
    for (const item of merged) {
      const canonical = getCanonicalCategory(item.category);
      result[canonical] = (result[canonical] ?? 0) + 1;
      if (item.category && item.category !== canonical) {
        result[item.category] = (result[item.category] ?? 0) + 1;
      }
    }
    return result;
  } catch (err) {
    logger.warn('[knowledgeRepo] getKnowledgeAnalytics failed:', err);
    return {};
  }
}

// ─── Total count ──────────────────────────────────────────────────────────
export async function getKnowledgeTotalCount(): Promise<number> {
  try {
    const merged = await getMergedKnowledgeList();
    return merged.length;
  } catch {
    return 0;
  }
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

/**
 * UP Police Regulations rows (content_type 'regulation'), DB ∪ bundled seed,
 * without hidden / deleted rows. Light shape for lists and search.
 */
/** Police case notes (L39, content_type 'case_note'), merged with user edits/hidden ids like other Law rows. */
export async function getCaseNoteRows(): Promise<{ id: string; title: string; tags: string; subcategory: string; description: string }[]> {
  const rows = await getMergedKnowledgeList('Law');
  return rows
    .filter((r) => r.content_type === 'case_note' || r.id.startsWith('sys-case-'))
    .map((r) => ({ id: r.id, title: r.title, tags: r.tags ?? '', subcategory: r.subcategory ?? '', description: r.description ?? '' }));
}

export async function getRegulationRows(): Promise<{ id: string; title: string; tags: string; subcategory: string }[]> {
  const rows = await getMergedKnowledgeList('Law');
  return rows
    .filter((r) => r.content_type === 'regulation' || r.id.startsWith('sys-reg-'))
    .map((r) => ({ id: r.id, title: r.title, tags: r.tags ?? '', subcategory: r.subcategory ?? '' }));
}

import { getDatabase, generateUUID, nowTimestamp } from './database';
import { fuzzyMatch } from '@/lib/searchUtils';

// ─── Types ────────────────────────────────────────────────────────────────
export type GdType = 'रवानगी' | 'वापसी' | 'तस्करा' | 'अन्य';

export const GD_TYPES: GdType[] = ['रवानगी', 'वापसी', 'तस्करा', 'अन्य'];

export interface GdEntry {
  id: string;
  preparation_date: string; // 'YYYY-MM-DD'
  ta_da_flag: number;        // 0 | 1
  gd_type: GdType;
  vivran_content: string;
  format_id?: string;
  is_favorite: number;       // 0 | 1
  created_at: number;
  updated_at: number;
  deleted_at?: number;
  version: number;
  sync_status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(dateStr: string): number {
  return Math.floor(new Date(dateStr + 'T00:00:00').getTime() / 1000);
}

function endOfDay(dateStr: string): number {
  return Math.floor(new Date(dateStr + 'T23:59:59').getTime() / 1000);
}

// ─── Create ───────────────────────────────────────────────────────────────
export async function createGdEntry(
  data: Pick<GdEntry, 'preparation_date' | 'ta_da_flag' | 'gd_type' | 'vivran_content' | 'format_id'>
): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO gd_entries
      (id, preparation_date, ta_da_flag, gd_type, vivran_content, format_id,
       is_favorite, created_at, updated_at, version, sync_status)
     VALUES (?,?,?,?,?,?,0,?,?,1,'pending')`,
    [id, data.preparation_date, data.ta_da_flag, data.gd_type,
     data.vivran_content, data.format_id ?? null, now, now]
  );
  return id;
}

// ─── Update ───────────────────────────────────────────────────────────────
export async function updateGdEntry(
  id: string,
  data: Pick<GdEntry, 'preparation_date' | 'ta_da_flag' | 'gd_type' | 'vivran_content' | 'format_id'>
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE gd_entries
       SET preparation_date=?, ta_da_flag=?, gd_type=?,
           vivran_content=?, format_id=?,
           updated_at=?, version=version+1, sync_status='pending'
     WHERE id=? AND deleted_at IS NULL`,
    [data.preparation_date, data.ta_da_flag, data.gd_type,
     data.vivran_content, data.format_id ?? null, now, id]
  );
}

// ─── Soft Delete ──────────────────────────────────────────────────────────
export async function deleteGdEntry(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE gd_entries SET deleted_at=?, updated_at=? WHERE id=?`,
    [now, now, id]
  );
}

// ─── Get By ID ────────────────────────────────────────────────────────────
export async function getGdById(id: string): Promise<GdEntry | null> {
  const db = await getDatabase();
  return db.getFirstAsync<GdEntry>(
    `SELECT * FROM gd_entries WHERE id=? AND deleted_at IS NULL`,
    [id]
  );
}

// ─── Get All ──────────────────────────────────────────────────────────────
export async function getAllGdEntries(): Promise<GdEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<GdEntry>(
    `SELECT * FROM gd_entries WHERE deleted_at IS NULL ORDER BY preparation_date DESC, created_at DESC`
  );
}

// ─── Toggle Favorite ──────────────────────────────────────────────────────
export async function toggleGdFavorite(id: string, current: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE gd_entries SET is_favorite=?, updated_at=? WHERE id=?`,
    [current ? 0 : 1, nowTimestamp(), id]
  );
}

// ─── Duplicate ────────────────────────────────────────────────────────────
export async function duplicateGdEntry(id: string): Promise<string> {
  const db = await getDatabase();
  const original = await getGdById(id);
  if (!original) throw new Error('GD entry not found');
  const newId = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO gd_entries
      (id, preparation_date, ta_da_flag, gd_type, vivran_content, format_id,
       is_favorite, created_at, updated_at, version, sync_status)
     VALUES (?,?,?,?,?,?,0,?,?,1,'pending')`,
    [newId, todayString(), original.ta_da_flag, original.gd_type,
     original.vivran_content, original.format_id ?? null, now, now]
  );
  return newId;
}

// ─── Search & Filter ──────────────────────────────────────────────────────

export interface GdSearchOpts {
  typoTolerance?: boolean;
}

export async function searchGdEntries(
  query: string,
  filter: string,
  opts?: GdSearchOpts,
): Promise<GdEntry[]> {
  const db = await getDatabase();
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];
  const trimmed = query.trim();

  // Text search
  if (trimmed) {
    // When typoTolerance is on, widen the LIKE to a 2-char prefix so fuzzy
    // candidates are included; post-filter below with fuzzyMatch.
    const q = opts?.typoTolerance
      ? `%${trimmed.slice(0, 2).toLowerCase()}%`
      : `%${trimmed.toLowerCase()}%`;
    conditions.push(
      `(LOWER(gd_type) LIKE ? OR LOWER(vivran_content) LIKE ? OR LOWER(preparation_date) LIKE ?)`
    );
    params.push(q, q, q);
  }

  // Type filter
  const TYPE_FILTERS: GdType[] = GD_TYPES;
  if (TYPE_FILTERS.includes(filter as GdType)) {
    conditions.push('gd_type=?');
    params.push(filter);
  }

  // Date filters
  const today = todayString();
  if (filter === 'Today') {
    conditions.push('preparation_date=?');
    params.push(today);
  } else if (filter === 'This Week') {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const monStr = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
    conditions.push('preparation_date >= ?');
    params.push(monStr);
  } else if (filter === 'This Month') {
    const m = today.slice(0, 7); // 'YYYY-MM'
    conditions.push("preparation_date LIKE ?");
    params.push(`${m}%`);
  } else if (filter === 'Favorites') {
    conditions.push('is_favorite=1');
  } else if (filter === 'Recently Added') {
    // no extra condition, just order by created_at
  }

  const where = conditions.join(' AND ');
  const order = filter === 'Recently Added'
    ? 'created_at DESC'
    : 'preparation_date DESC, created_at DESC';

  const rows = await db.getAllAsync<GdEntry>(
    `SELECT * FROM gd_entries WHERE ${where} ORDER BY ${order}`,
    params
  );

  // Post-filter with fuzzyMatch when typoTolerance is on.
  if (trimmed && opts?.typoTolerance) {
    return rows.filter((r) =>
      fuzzyMatch(trimmed, `${r.gd_type} ${r.vivran_content} ${r.preparation_date}`)
    );
  }

  return rows;
}

import { getDatabase, generateUUID, nowTimestamp } from './database';
import { isTypoTolerant, smartMatch, sqlWordFilter } from '@/lib/searchUtils';
import { logger } from '../logger';

export interface FIR {
  id: string;
  fir_number: string;
  section: string;
  complainant_name: string;
  complainant_address?: string;
  complainant_mobile?: string;
  complainant_alt_mobile?: string;
  complainant_jati?: string;
  complainant_age?: string;
  ghatnasthal?: string;
  crime_type: string;
  date_of_occurrence?: string;
  time_of_occurrence?: string;
  date_of_information?: string;
  time_of_information?: string;
  nakal_chick?: string;
  nakal_rapat?: string;
  mukadma_saransh?: string;
  unknown_accused_count: number;
  status: 'Pending' | 'Finished';
  /** Latest case diary date — only filled by the list queries (getAllFIRs / searchFIRs). */
  last_diary_date?: string | null;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
  version: number;
}

export type FIRInput = Omit<FIR, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'version' | 'status' | 'last_diary_date'>;

/** FIR added / changed / deleted → move the "केस डायरी लंबित" alerts (lazy import). */
function resyncCdAlerts(): void {
  import('@/lib/caseDiaryGapService').then((m) => m.resyncCaseDiaryAlertsSoon()).catch(() => {});
}

export async function getAllFIRs(): Promise<FIR[]> {
  const db = await getDatabase();
  return db.getAllAsync<FIR>(
    'SELECT *, (SELECT MAX(d.preparation_date) FROM case_diaries d WHERE d.fir_id = firs.id AND d.deleted_at IS NULL) AS last_diary_date FROM firs WHERE deleted_at IS NULL ORDER BY created_at DESC'
  );
}

const FIR_SEARCH_COLS = ['fir_number', 'complainant_name', 'crime_type', 'section', 'complainant_address', 'complainant_mobile', 'ghatnasthal'] as const;

/** Word-by-word, Hindi-aware search (see searchUtils); typo tolerance from Settings. */
export async function searchFIRs(query: string, statusFilter?: string): Promise<FIR[]> {
  const db = await getDatabase();
  const typo = isTypoTolerant();
  // With typo tolerance the SQL pre-filter would drop near-misses, so filter in JS only.
  const words = typo ? { sql: '1=1', params: [] as string[] } : sqlWordFilter([...FIR_SEARCH_COLS], query);
  const status = statusFilter && statusFilter !== 'All';
  const rows = await db.getAllAsync<FIR>(
    `SELECT *, (SELECT MAX(d.preparation_date) FROM case_diaries d WHERE d.fir_id = firs.id AND d.deleted_at IS NULL) AS last_diary_date
       FROM firs WHERE deleted_at IS NULL ${status ? 'AND status = ?' : ''} AND ${words.sql}
      ORDER BY created_at DESC`,
    [...(status ? [statusFilter as string] : []), ...words.params],
  );
  return rows.filter((f) => smartMatch(query, FIR_SEARCH_COLS.map((c) => (f as unknown as Record<string, string | null>)[c]), typo));
}

export async function getFIRById(id: string): Promise<FIR | null> {
  const db = await getDatabase();
  return db.getFirstAsync<FIR>(
    'SELECT * FROM firs WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

export async function createFIR(input: FIRInput): Promise<FIR> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO firs (id, fir_number, section, complainant_name, complainant_address,
      complainant_mobile, complainant_alt_mobile, complainant_jati, complainant_age,
      ghatnasthal, crime_type, date_of_occurrence, time_of_occurrence,
      date_of_information, time_of_information, nakal_chick, nakal_rapat, mukadma_saransh,
      unknown_accused_count, status, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, 1)`,
    [
      id, input.fir_number, input.section, input.complainant_name,
      input.complainant_address ?? null, input.complainant_mobile ?? null,
      input.complainant_alt_mobile ?? null, input.complainant_jati ?? null,
      input.complainant_age ?? null, input.ghatnasthal ?? null,
      input.crime_type, input.date_of_occurrence ?? null,
      input.time_of_occurrence ?? null, input.date_of_information ?? null,
      input.time_of_information ?? null, input.nakal_chick ?? null,
      input.nakal_rapat ?? null, input.mukadma_saransh ?? null,
      input.unknown_accused_count ?? 0,
      now, now,
    ]
  );
  resyncCdAlerts();
  return { id, ...input, status: 'Pending', created_at: now, updated_at: now, version: 1 };
}

export async function updateFIR(id: string, input: Partial<FIRInput & { status: string }>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const allowed = [
    'fir_number', 'section', 'complainant_name', 'complainant_address',
    'complainant_mobile', 'complainant_alt_mobile', 'complainant_jati',
    'complainant_age', 'ghatnasthal', 'crime_type', 'date_of_occurrence',
    'time_of_occurrence', 'date_of_information', 'time_of_information',
    'nakal_chick', 'nakal_rapat', 'mukadma_saransh', 'unknown_accused_count', 'status',
  ];
  const entries = Object.entries(input).filter(([k]) => allowed.includes(k));
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const vals = entries.map(([, v]) => v);
  await db.runAsync(
    `UPDATE firs SET ${sets}, updated_at = ?, version = version + 1 WHERE id = ?`,
    [...vals, now, id]
  );  resyncCdAlerts();
}

export async function updateFIRStatus(firId: string): Promise<void> {
  const db = await getDatabase();
  const pending = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fir_karyvahi WHERE fir_id = ? AND deleted_at IS NULL AND is_completed = 0`,
    [firId]
  );
  const total = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fir_karyvahi WHERE fir_id = ? AND deleted_at IS NULL`,
    [firId]
  );
  const status = (total?.cnt ?? 0) > 0 && (pending?.cnt ?? 0) === 0 ? 'Finished' : 'Pending';
  const now = nowTimestamp();
  await db.runAsync('UPDATE firs SET status = ?, updated_at = ? WHERE id = ?', [status, now, firId]);
  resyncCdAlerts();
}

export async function deleteFIR(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();

  // ── PROBE: snapshot child rows BEFORE the cascade delete ──────────────────
  // Shows every fir_karyvahi row that belongs to this FIR at deletion time,
  // including its deleted_at value, so we can confirm whether orphaned rows
  // existed before this call and whether the cascade is working.
  try {
    const childrenBefore = await db.getAllAsync<{
      id: string; name: string; deleted_at: number | null;
    }>(
      'SELECT id, name, deleted_at FROM fir_karyvahi WHERE fir_id = ?',
      [id]
    );
    logger.warn(
      `[PROBE] deleteFIR BEFORE-CASCADE` +
      ` firId="${id}"` +
      ` child_rows=${childrenBefore.length}` +
      ` t=${Date.now()}`
    );
    childrenBefore.forEach((r, i) => {
      logger.warn(
        `[PROBE] deleteFIR child[${i}]` +
        ` id="${r.id}"` +
        ` name="${r.name}"` +
        ` deleted_at=${r.deleted_at ?? 'NULL'}`
      );
    });
  } catch (e) {
    logger.warn('[PROBE] deleteFIR child snapshot failed:', e);
  }

  // Cascade soft-delete to all child karyvahi rows first, then delete the parent.
  await db.runAsync(
    'UPDATE fir_karyvahi SET deleted_at = ? WHERE fir_id = ? AND deleted_at IS NULL',
    [now, id]
  );
  await db.runAsync('UPDATE fir_accused SET deleted_at = ? WHERE fir_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE case_diaries SET deleted_at = ? WHERE fir_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync(
    `UPDATE case_diary_karyvahi SET deleted_at = ? WHERE diary_id IN (
      SELECT id FROM case_diaries WHERE fir_id = ?
    ) AND deleted_at IS NULL`,
    [now, id]
  );
  await db.runAsync('UPDATE firs SET deleted_at = ? WHERE id = ?', [now, id]);

  // ── PROBE: snapshot child rows AFTER the cascade delete ───────────────────
  try {
    const childrenAfter = await db.getAllAsync<{
      id: string; name: string; deleted_at: number | null;
    }>(
      'SELECT id, name, deleted_at FROM fir_karyvahi WHERE fir_id = ?',
      [id]
    );
    logger.warn(
      `[PROBE] deleteFIR AFTER-CASCADE` +
      ` firId="${id}"` +
      ` child_rows=${childrenAfter.length}` +
      ` still_active=${childrenAfter.filter((r) => r.deleted_at == null).length}` +
      ` t=${Date.now()}`
    );
    childrenAfter.forEach((r, i) => {
      logger.warn(
        `[PROBE] deleteFIR child-after[${i}]` +
        ` id="${r.id}"` +
        ` name="${r.name}"` +
        ` deleted_at=${r.deleted_at ?? 'NULL'}`
      );
    });
  } catch (e) {
    logger.warn('[PROBE] deleteFIR after-cascade snapshot failed:', e);
  }
  resyncCdAlerts();
}

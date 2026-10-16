import { getDatabase, generateUUID, nowTimestamp } from './database';

export interface CaseDiary {
  id: string;
  fir_id: string;
  preparation_date: string;
  start_time?: string;
  end_time?: string;
  /** JSON-serialised string array of visited places */
  places_visited?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export interface CaseDiaryKaryvahi {
  id: string;
  diary_id: string;
  fir_karyvahi_id?: string;
  karyvahi_name: string;
  vivran?: string;
  format_used?: string;
  sort_order: number;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export type CaseDiaryInput = Omit<CaseDiary, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type CaseDiaryKaryvahiInput = Omit<CaseDiaryKaryvahi, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Serialise places array → JSON string stored in DB */
export function serializePlaces(places: string[]): string {
  return JSON.stringify(places.filter(Boolean));
}

/** Deserialise JSON string → places array (safe) */
export function deserializePlaces(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

// ── Case Diary CRUD ────────────────────────────────────────────────────────────

export async function getCaseDiariesByFIR(firId: string): Promise<CaseDiary[]> {
  const db = await getDatabase();
  return db.getAllAsync<CaseDiary>(
    'SELECT * FROM case_diaries WHERE fir_id = ? AND deleted_at IS NULL ORDER BY preparation_date DESC, created_at DESC',
    [firId]
  );
}

// ── Next-diary-number helper ───────────────────────────────────────────────

/**
 * Returns the next sequential diary number for a FIR (1-based).
 * Non-deleted diaries are counted regardless of order, matching the
 * numbering display logic in add-case-diary.tsx.
 */
export async function getNextDiaryNumber(firId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM case_diaries WHERE fir_id = ? AND deleted_at IS NULL`,
    [firId]
  );
  return (row?.count ?? 0) + 1;
}

export async function getCaseDiaryById(id: string): Promise<CaseDiary | null> {
  const db = await getDatabase();
  return db.getFirstAsync<CaseDiary>(
    'SELECT * FROM case_diaries WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

export async function createCaseDiary(input: CaseDiaryInput): Promise<CaseDiary> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO case_diaries (id, fir_id, preparation_date, start_time, end_time, places_visited, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.fir_id, input.preparation_date, input.start_time ?? null, input.end_time ?? null,
     input.places_visited ?? null, now, now]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

export async function updateCaseDiary(id: string, input: Partial<CaseDiaryInput>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const allowed = ['preparation_date', 'start_time', 'end_time', 'places_visited'];
  const entries = Object.entries(input).filter(([k]) => allowed.includes(k));
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const vals = entries.map(([, v]) => v);
  await db.runAsync(
    `UPDATE case_diaries SET ${sets}, updated_at = ? WHERE id = ?`,
    [...vals, now, id]
  );
}

export async function deleteCaseDiary(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync('UPDATE case_diary_karyvahi SET deleted_at = ? WHERE diary_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE case_diary_entries SET deleted_at = ? WHERE case_diary_id = ? AND deleted_at IS NULL', [now, id]);
  await db.runAsync('UPDATE case_diaries SET deleted_at = ? WHERE id = ?', [now, id]);
}

/** Duplicate a diary: create a new diary with same header fields, copy all karyvahi entries */
export async function duplicateCaseDiary(diaryId: string): Promise<CaseDiary> {
  const original = await getCaseDiaryById(diaryId);
  if (!original) throw new Error(`CaseDiary not found: ${diaryId}`);
  const newDiary = await createCaseDiary({
    fir_id:           original.fir_id,
    preparation_date: original.preparation_date,
    start_time:       original.start_time,
    end_time:         original.end_time,
    places_visited:   original.places_visited,
  });
  const entries = await getKaryvahiByDiary(diaryId);
  for (const e of entries) {
    await addKaryvahiToDiary({
      diary_id:        newDiary.id,
      fir_karyvahi_id: e.fir_karyvahi_id,
      karyvahi_name:   e.karyvahi_name,
      vivran:          e.vivran,
      format_used:     e.format_used,
      sort_order:      e.sort_order,
    });
  }
  return newDiary;
}

// ── Case Diary Karyvahi ────────────────────────────────────────────────────────

export async function getKaryvahiByDiary(diaryId: string): Promise<CaseDiaryKaryvahi[]> {
  const db = await getDatabase();
  return db.getAllAsync<CaseDiaryKaryvahi>(
    'SELECT * FROM case_diary_karyvahi WHERE diary_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC',
    [diaryId]
  );
}

export async function addKaryvahiToDiary(input: CaseDiaryKaryvahiInput): Promise<CaseDiaryKaryvahi> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO case_diary_karyvahi (id, diary_id, fir_karyvahi_id, karyvahi_name, vivran, format_used, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.diary_id, input.fir_karyvahi_id ?? null, input.karyvahi_name,
     input.vivran ?? null, input.format_used ?? null, input.sort_order ?? 0, now, now]
  );
  return { id, ...input, sort_order: input.sort_order ?? 0, created_at: now, updated_at: now };
}

export async function updateKaryvahiInDiary(id: string, input: Partial<Pick<CaseDiaryKaryvahi, 'vivran' | 'format_used' | 'karyvahi_name'>>): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const allowed = ['vivran', 'format_used', 'karyvahi_name'];
  const entries = Object.entries(input).filter(([k]) => allowed.includes(k));
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const vals = entries.map(([, v]) => v);
  await db.runAsync(`UPDATE case_diary_karyvahi SET ${sets}, updated_at = ? WHERE id = ?`, [...vals, now, id]);
}

export async function deleteKaryvahiFromDiary(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync('UPDATE case_diary_karyvahi SET deleted_at = ? WHERE id = ?', [now, id]);
}

// ── Synchronisation: save diary → sync FIR karyvahi completion ────────────────

/**
 * Called after saving a Case Diary.
 * 1. Marks every fir_karyvahi referenced in diaryKaryvahiIds as completed,
 *    setting completed_by_diary_id = diaryId for traceability.
 * 2. Reverts completion for karyvahi that were removed from the diary
 *    (prev - current) IF they are not completed by another diary.
 * 3. Updates FIR status.
 */
/** @deprecated v250: use addExecution/recalcExecutionCount instead. Kept for legacy callers. */
export async function syncDiaryKaryvahiCompletion(
  firId: string,
  diaryId: string,
  currentFirKaryvahiIds: string[],
  prevFirKaryvahiIds: string[],
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();

  // Mark new/retained karyvahi as completed
  for (const kId of currentFirKaryvahiIds) {
    await db.runAsync(
      'UPDATE fir_karyvahi SET is_completed = 1, completed_by_diary_id = ?, updated_at = ? WHERE id = ? AND fir_id = ?',
      [diaryId, now, kId, firId]
    );
  }

  // Revert karyvahi that were removed from this diary
  const removedIds = prevFirKaryvahiIds.filter((id) => !currentFirKaryvahiIds.includes(id));
  for (const kId of removedIds) {
    // Only revert if no other diary has completed this karyvahi
    const row = await db.getFirstAsync<{ completed_by_diary_id: string | null }>(
      'SELECT completed_by_diary_id FROM fir_karyvahi WHERE id = ?', [kId]
    );
    if (row?.completed_by_diary_id === diaryId) {
      await db.runAsync(
        'UPDATE fir_karyvahi SET is_completed = 0, completed_by_diary_id = NULL, updated_at = ? WHERE id = ?',
        [now, kId]
      );
    }
  }

  // Refresh FIR status (pending/finished) based on karyvahi completion
  const { updateFIRStatus } = await import('./firRepo');
  await updateFIRStatus(firId);
}

// ── Case Diary Entries (v250 — unified timeline) ──────────────────────────────

export type EntryType = 'karyvahi' | 'narrative';

export interface CaseDiaryEntry {
  id: string;
  case_diary_id: string;
  entry_type: EntryType;
  sequence_order: number;
  // karyvahi-type
  linked_execution_id?: string;
  fir_karyvahi_id?: string;
  karyvahi_name?: string;
  vivran?: string;
  format_used?: string;
  // narrative-type
  narrative_text?: string;
  narrative_template?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
}

export type CaseDiaryEntryInput = Omit<CaseDiaryEntry, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;

/** Returns all timeline entries for a diary in sequence_order. */
export async function getEntriesByDiary(diaryId: string): Promise<CaseDiaryEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<CaseDiaryEntry>(
    `SELECT * FROM case_diary_entries
     WHERE case_diary_id = ? AND deleted_at IS NULL
     ORDER BY sequence_order ASC, created_at ASC`,
    [diaryId]
  );
}

/** Returns the next sequence_order for a diary (max + 1, or 0 if empty). */
export async function getNextSequenceOrder(diaryId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ mx: number | null }>(
    'SELECT MAX(sequence_order) as mx FROM case_diary_entries WHERE case_diary_id = ? AND deleted_at IS NULL',
    [diaryId]
  );
  return (row?.mx ?? -1) + 1;
}

/** Adds one timeline entry (karyvahi or narrative) at the end of the sequence. */
export async function addEntry(input: CaseDiaryEntryInput): Promise<CaseDiaryEntry> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO case_diary_entries
       (id, case_diary_id, entry_type, sequence_order,
        linked_execution_id, fir_karyvahi_id, karyvahi_name, vivran, format_used,
        narrative_text, narrative_template,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.case_diary_id, input.entry_type, input.sequence_order,
      input.linked_execution_id ?? null, input.fir_karyvahi_id ?? null,
      input.karyvahi_name ?? null, input.vivran ?? null, input.format_used ?? null,
      input.narrative_text ?? null, input.narrative_template ?? null,
      now, now,
    ]
  );
  return { id, ...input, created_at: now, updated_at: now };
}

/** Soft-deletes a timeline entry. */
export async function deleteEntry(entryId: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    'UPDATE case_diary_entries SET deleted_at = ? WHERE id = ?',
    [now, entryId]
  );
}

// ── Diary timeline for karyvahi tab ──────────────────────────────────────────

export interface KaryvahiTimelineEntry {
  id: string;               // case_diary_entries.id
  karyvahi_name: string;
  vivran?: string;
  priority?: string;        // from fir_karyvahi (may be null if unlinked)
  preparation_date: string; // from case_diaries
  case_diary_id: string;
  fir_karyvahi_id?: string;
  sequence_order?: number;  // for chronological sorting within a diary
}

/**
 * Returns all karyvahi-type case_diary_entries for a FIR, joined with their
 * parent diary header and optionally the fir_karyvahi row (for priority).
 * Ordered newest diary first, then by sequence_order desc within each diary.
 */
export async function getKaryvahiTimelineForFIR(
  firId: string,
): Promise<KaryvahiTimelineEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<KaryvahiTimelineEntry>(
    `SELECT
       e.id,
       COALESCE(e.karyvahi_name, '') AS karyvahi_name,
       e.vivran,
       k.priority,
       d.preparation_date,
       e.case_diary_id,
       e.fir_karyvahi_id,
       e.sequence_order
     FROM case_diary_entries e
     INNER JOIN case_diaries d ON d.id = e.case_diary_id
     LEFT  JOIN fir_karyvahi k ON k.id = e.fir_karyvahi_id
     WHERE d.fir_id = ?
       AND d.deleted_at IS NULL
       AND e.deleted_at IS NULL
       AND e.entry_type = 'karyvahi'
     ORDER BY d.preparation_date DESC, e.sequence_order DESC`,
    [firId],
  );
}

/** Updates vivran/narrative_text/format_used on an existing entry. */
export async function updateEntry(
  entryId: string,
  patch: Partial<Pick<CaseDiaryEntry, 'vivran' | 'format_used' | 'karyvahi_name' | 'narrative_text' | 'narrative_template'>>
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const allowed = ['vivran', 'format_used', 'karyvahi_name', 'narrative_text', 'narrative_template'];
  const entries = Object.entries(patch).filter(([k]) => allowed.includes(k));
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const vals = entries.map(([, v]) => v);
  await db.runAsync(
    `UPDATE case_diary_entries SET ${sets}, updated_at = ? WHERE id = ?`,
    [...vals, now, entryId]
  );
}

import { getDatabase, generateUUID, nowTimestamp } from './database';
import { isTypoTolerant, smartMatch, sqlWordFilter } from '@/lib/searchUtils';

// ─── Constants ────────────────────────────────────────────────────────────
export type NirodhatmakType =
  | 'बीट सूचना'
  | 'मुकदमा'
  | 'प्रार्थनापत्र'
  | 'जमीनी विवाद'
  | 'अन्य';

export const NIRODHATMAK_TYPES: NirodhatmakType[] = [
  'बीट सूचना',
  'मुकदमा',
  'प्रार्थनापत्र',
  'जमीनी विवाद',
  'अन्य',
];

// ─── Types ────────────────────────────────────────────────────────────────
export interface NirodhatmakKaryvahi {
  id: string;
  // v97 fields
  proceeding_date: string;    // 'YYYY-MM-DD'
  village_id: string;
  village_name: string;
  proceeding_type: NirodhatmakType;
  editor_content: string;     // free-text editor (may include format-generated content)
  status: string;             // 'Active' | 'Closed'
  /** Simple checklist ticks: { prashit, notice, tamil } (see KARYVAHI_CHECKLIST). */
  checklist_json?: string;
  // legacy fields (preserved, nullable for old rows)
  format_id: string;
  format_title: string;
  report_text: string;
  values_json: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number;
  version: number;
}

export interface NirodhatmakKaryvahiInput {
  proceeding_date: string;
  village_id: string;
  village_name: string;
  proceeding_type: NirodhatmakType;
  editor_content: string;
  status?: string;
  // optional legacy / format reference
  format_id?: string;
  format_title?: string;
  /** Filled format key values as JSON (e.g. {"Matter": "…"}). */
  values_json?: string;
}

export interface NirodhatmakKaryvahiUpdateInput {
  proceeding_date: string;
  village_id: string;
  village_name: string;
  proceeding_type: NirodhatmakType;
  editor_content: string;
  status?: string;
  format_id?: string;
  format_title?: string;
  /** Omitted → the saved values stay as they are. */
  values_json?: string;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────
export async function getAllNirodhatmakKaryvahi(): Promise<NirodhatmakKaryvahi[]> {
  const db = await getDatabase();
  return db.getAllAsync<NirodhatmakKaryvahi>(
    `SELECT * FROM nirodhatmak_karyvahi WHERE deleted_at IS NULL ORDER BY proceeding_date DESC, created_at DESC`
  );
}

export async function getNirodhatmakById(id: string): Promise<NirodhatmakKaryvahi | null> {
  const db = await getDatabase();
  return db.getFirstAsync<NirodhatmakKaryvahi>(
    `SELECT * FROM nirodhatmak_karyvahi WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}

/**
 * Search + filter with combined text and type filter.
 * Searches: village_name, proceeding_type, editor_content, format_title, report_text.
 */
const NK_SEARCH_COLS = ['village_name', 'proceeding_type', 'editor_content', 'format_title', 'report_text'] as const;

export async function searchNirodhatmakKaryvahi(
  query: string,
  typeFilter?: NirodhatmakType | null
): Promise<NirodhatmakKaryvahi[]> {
  const db = await getDatabase();
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];

  // Word-by-word, Hindi-aware (searchUtils); typo tolerance → JS filter only.
  const typo = isTypoTolerant();
  if (query.trim() && !typo) {
    const words = sqlWordFilter([...NK_SEARCH_COLS], query);
    conditions.push(words.sql);
    params.push(...words.params);
  }

  if (typeFilter) {
    conditions.push('proceeding_type = ?');
    params.push(typeFilter);
  }

  const where = conditions.join(' AND ');
  const rows = await db.getAllAsync<NirodhatmakKaryvahi>(
    `SELECT * FROM nirodhatmak_karyvahi WHERE ${where} ORDER BY proceeding_date DESC, created_at DESC`,
    params
  );
  if (!query.trim()) return rows;
  return rows.filter((r) => smartMatch(query, NK_SEARCH_COLS.map((c) => (r as unknown as Record<string, string | null>)[c]), typo));
}

export async function createNirodhatmakKaryvahi(
  input: NirodhatmakKaryvahiInput
): Promise<NirodhatmakKaryvahi> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO nirodhatmak_karyvahi
       (id, proceeding_date, village_id, village_name, proceeding_type,
        editor_content, status, format_id, format_title, report_text,
        values_json, created_at, updated_at, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, 1)`,
    [
      id,
      input.proceeding_date,
      input.village_id,
      input.village_name,
      input.proceeding_type,
      input.editor_content,
      input.status ?? 'Active',
      input.format_id ?? '',
      input.format_title ?? '',
      input.values_json ?? '{}',
      now,
      now,
    ]
  );
  resyncNkAlerts();
  return {
    id,
    proceeding_date: input.proceeding_date,
    village_id: input.village_id,
    village_name: input.village_name,
    proceeding_type: input.proceeding_type,
    editor_content: input.editor_content,
    status: input.status ?? 'Active',
    format_id: input.format_id ?? '',
    format_title: input.format_title ?? '',
    report_text: '',
    values_json: '{}',
    created_at: now,
    updated_at: now,
    version: 1,
  };
}

export async function updateNirodhatmakKaryvahi(
  id: string,
  input: NirodhatmakKaryvahiUpdateInput
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE nirodhatmak_karyvahi
       SET proceeding_date=?, village_id=?, village_name=?, proceeding_type=?,
           editor_content=?, status=?, format_id=?, format_title=?,
           values_json=COALESCE(?, values_json),
           updated_at=?, version=version+1
     WHERE id=? AND deleted_at IS NULL`,
    [
      input.proceeding_date,
      input.village_id,
      input.village_name,
      input.proceeding_type,
      input.editor_content,
      input.status ?? 'Active',
      input.format_id ?? '',
      input.format_title ?? '',
      input.values_json ?? null,
      now,
      id,
    ]
  );
}

// ─── Checklist (चलानी प्रेषित → नोटिस प्राप्त → तामील) ─────────────────────
export const KARYVAHI_CHECKLIST = [
  { key: 'prashit', label: 'चलानी प्रेषित की जा चुकी है' },
  { key: 'notice', label: 'मजिस्ट्रेट से नोटिस प्राप्त हुआ' },
  { key: 'tamil', label: 'नोटिस तामील करा दिया गया' },
] as const;
export type KaryvahiChecklistKey = (typeof KARYVAHI_CHECKLIST)[number]['key'];
export type KaryvahiChecklist = Partial<Record<KaryvahiChecklistKey, boolean>>;

export function parseKaryvahiChecklist(json: string | null | undefined): KaryvahiChecklist {
  try { const v = JSON.parse(json || '{}'); return v && typeof v === 'object' ? v as KaryvahiChecklist : {}; } catch { return {}; }
}

/** Saves the ticks only (does not touch the report or updated_at ordering). */
export async function setKaryvahiChecklist(id: string, checklist: KaryvahiChecklist): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE nirodhatmak_karyvahi SET checklist_json = ? WHERE id = ?`, [JSON.stringify(checklist), id]);
  resyncNkAlerts();
}

/** चलानी प्रेषण लंबित alerts follow the ticks / new / deleted rows (lazy import). */
function resyncNkAlerts(): void {
  import('@/lib/nkChalaniService').then((m) => m.resyncNkChalaniAlertsSoon()).catch(() => {});
}

export async function deleteNirodhatmakKaryvahi(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE nirodhatmak_karyvahi SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [nowTimestamp(), nowTimestamp(), id]
  );
  resyncNkAlerts();
}

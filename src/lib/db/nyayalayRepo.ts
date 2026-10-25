import { getDatabase, generateUUID, nowTimestamp } from './database';
import { isTypoTolerant, smartMatch, sqlWordFilter } from '@/lib/searchUtils';

// ── Types ──────────────────────────────────────────────────────────────────

export type DocType =
  | 'NBW'
  | 'Summons'
  | 'Bail_Lower_Court'
  | 'High_Court_Documents'
  | 'Anya';

export type SubType = 'Bail' | 'Writ';
export type WritType = 'MB' | 'CRLP' | 'Anya';
export type NyayalayStatus = 'Pending' | 'Finished';
export type PersonType = 'accused' | 'appellant';

export const DOC_TYPES: DocType[] = [
  'NBW',
  'Summons',
  'Bail_Lower_Court',
  'High_Court_Documents',
  'Anya',
];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  NBW: 'NBW',
  Summons: 'Summons',
  Bail_Lower_Court: 'Bail (Lower Court)',
  High_Court_Documents: 'High Court Documents',
  Anya: 'Anya',
};

export const WRIT_TYPES: WritType[] = ['MB', 'CRLP', 'Anya'];

export interface NyayalayDocument {
  id: string;
  registration_number: string;
  doc_type: DocType;
  sub_type: SubType | null;
  court_name: string;
  vad_sankhya: string;
  apradh_sankhya: string;
  applicable_sections: string;
  fir_number: string;
  fir_year: string;
  fir_ps: string;
  matter: string;
  document_title: string;
  writ_type: WritType | null;
  deadline_date: string;
  status: NyayalayStatus;
  checklist_json: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version: number;
  sync_status: string;
}

export interface NyayalayPerson {
  id: string;
  doc_id: string;
  person_type: PersonType;
  name: string;
  father_name: string;
  mobile: string;
  address: string;
  remarks: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface NyayalayChecklistItem {
  id: string;
  doc_id: string;
  label: string;
  is_done: boolean;
  is_optional: boolean;
  sort_order: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface NyayalayDocWithDetails extends NyayalayDocument {
  persons: NyayalayPerson[];
  checklist: NyayalayChecklistItem[];
}

export interface NyayalayTypeAnalytics {
  total: number;
  pending: number;
  finished: number;
  overdue: number;
}

export interface NyayalayAnalytics {
  overall: NyayalayTypeAnalytics;
  byType: Record<DocType, NyayalayTypeAnalytics>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns today as YYYY-MM-DD in local time. */
export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string as a LOCAL midnight Date.
 * `new Date('YYYY-MM-DD')` parses as UTC midnight which shifts the date
 * by the local timezone offset (e.g. IST UTC+5:30 → one day earlier).
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight, no timezone shift
}

/** Add N calendar days to a YYYY-MM-DD string (local time). */
export function addDaysNyl(dateStr: string, days: number): string {
  // BUG-2 fix: use parseLocalDate to avoid UTC-midnight timezone shift
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns days remaining (positive) or overdue (negative, 0 = due today). */
export function nylDaysUntilDeadline(deadlineDate: string, status: NyayalayStatus): number {
  if (status === 'Finished') return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // BUG-2 fix: parse deadline as local midnight so timezone offset doesn't shift the date
  const deadline = parseLocalDate(deadlineDate);
  return Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Registration Number ────────────────────────────────────────────────────

async function generateRegistrationNumber(): Promise<string> {
  const db = await getDatabase();
  const year = new Date().getFullYear();
  const prefix = `NYL/${year}/`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = await db.getAllAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM nyayalay_documents
       WHERE registration_number LIKE ? AND deleted_at IS NULL`,
      [`${prefix}%`]
    );
    const count = (rows[0]?.cnt ?? 0) + attempt + 1;
    const candidate = `${prefix}${String(count).padStart(3, '0')}`;
    const existing = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM nyayalay_documents WHERE registration_number = ?`,
      [candidate]
    );
    if (!existing.length) return candidate;
  }
  return `${prefix}${Date.now()}`;
}

// ── CREATE ─────────────────────────────────────────────────────────────────

interface CreateNyayalayInput {
  doc_type: DocType;
  sub_type?: SubType | null;
  court_name?: string;
  vad_sankhya?: string;
  apradh_sankhya?: string;
  applicable_sections?: string;
  fir_number?: string;
  fir_year?: string;
  fir_ps?: string;
  matter?: string;
  document_title?: string;
  writ_type?: WritType | null;
  deadline_date: string;
  checklist_json?: string | null;
  persons: {
    person_type: PersonType;
    name: string;
    father_name: string;
    mobile: string;
    address: string;
    remarks: string;
  }[];
}

/** Deadline / status changed → move the न्यायालय / प्रार्थना पत्र phone alerts (lazy import). */
function resyncDeadlineAlerts(): void {
  import('@/lib/deadlineAlertService').then((m) => m.resyncDeadlineAlertsSoon()).catch(() => {});
}

export async function createNyayalayDocument(input: CreateNyayalayInput): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const reg = await generateRegistrationNumber();
  const now = nowTimestamp();

  await db.runAsync(
    `INSERT INTO nyayalay_documents
     (id, registration_number, doc_type, sub_type, court_name, vad_sankhya,
      apradh_sankhya, applicable_sections, fir_number, fir_year, fir_ps,
      matter, document_title, writ_type, deadline_date, status,
      checklist_json, created_at, updated_at, deleted_at, version, sync_status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Pending',?,?,?,NULL,1,'pending')`,
    [
      id, reg,
      input.doc_type, input.sub_type ?? null,
      input.court_name ?? '', input.vad_sankhya ?? '',
      input.apradh_sankhya ?? '', input.applicable_sections ?? '',
      input.fir_number ?? '', input.fir_year ?? '', input.fir_ps ?? '',
      input.matter ?? '', input.document_title ?? '',
      input.writ_type ?? null, input.deadline_date,
      input.checklist_json ?? null, now, now,
    ]
  );

  for (let i = 0; i < input.persons.length; i++) {
    const p = input.persons[i];
    await db.runAsync(
      `INSERT INTO nyayalay_persons
       (id, doc_id, person_type, name, father_name, mobile, address, remarks,
        created_at, updated_at, deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,NULL)`,
      [generateUUID(), id, p.person_type, p.name, p.father_name,
       p.mobile, p.address, p.remarks, now, now]
    );
  }

  resyncDeadlineAlerts();
  return id;
}

// ── READ ──────────────────────────────────────────────────────────────────

export async function getAllNyayalayDocuments(): Promise<NyayalayDocument[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<NyayalayDocument>(
    `SELECT * FROM nyayalay_documents WHERE deleted_at IS NULL
     ORDER BY created_at DESC`
  );
  return rows;
}

export async function getNyayalayDocWithDetails(id: string): Promise<NyayalayDocWithDetails | null> {
  const db = await getDatabase();
  const docs = await db.getAllAsync<NyayalayDocument>(
    `SELECT * FROM nyayalay_documents WHERE id = ? AND deleted_at IS NULL`, [id]
  );
  if (!docs.length) return null;
  const doc = docs[0];

  const persons = await db.getAllAsync<NyayalayPerson>(
    `SELECT * FROM nyayalay_persons WHERE doc_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`, [id]
  );

  const rawChecklist = await db.getAllAsync<{
    id: string; doc_id: string; label: string;
    is_done: number; is_optional: number; sort_order: number;
    created_at: number; updated_at: number; deleted_at: number | null;
  }>(
    `SELECT * FROM nyayalay_checklist_items WHERE doc_id = ? AND deleted_at IS NULL
     ORDER BY sort_order ASC`, [id]
  );
  const checklist: NyayalayChecklistItem[] = rawChecklist.map((r) => ({
    id: r.id, doc_id: r.doc_id, label: r.label,
    is_done: !!r.is_done,
    is_optional: !!r.is_optional,
    sort_order: r.sort_order,
    created_at: r.created_at, updated_at: r.updated_at, deleted_at: r.deleted_at,
  }));

  return { ...doc, persons, checklist };
}

// ── UPDATE ────────────────────────────────────────────────────────────────

interface UpdateNyayalayInput extends Omit<CreateNyayalayInput, 'persons'> {
  persons: {
    id?: string;
    person_type: PersonType;
    name: string;
    father_name: string;
    mobile: string;
    address: string;
    remarks: string;
  }[];
}

export async function updateNyayalayDocument(
  id: string,
  input: UpdateNyayalayInput
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();

  await db.runAsync(
    `UPDATE nyayalay_documents SET
     doc_type=?, sub_type=?, court_name=?, vad_sankhya=?, apradh_sankhya=?,
     applicable_sections=?, fir_number=?, fir_year=?, fir_ps=?,
     matter=?, document_title=?, writ_type=?, deadline_date=?,
     checklist_json=?, updated_at=?, version=version+1, sync_status='pending'
     WHERE id=? AND deleted_at IS NULL`,
    [
      input.doc_type, input.sub_type ?? null,
      input.court_name ?? '', input.vad_sankhya ?? '',
      input.apradh_sankhya ?? '', input.applicable_sections ?? '',
      input.fir_number ?? '', input.fir_year ?? '', input.fir_ps ?? '',
      input.matter ?? '', input.document_title ?? '',
      input.writ_type ?? null, input.deadline_date,
      input.checklist_json ?? null, now, id,
    ]
  );

  // Soft-delete all old persons, re-insert
  await db.runAsync(
    `UPDATE nyayalay_persons SET deleted_at=? WHERE doc_id=?`, [now, id]
  );
  for (const p of input.persons) {
    await db.runAsync(
      `INSERT INTO nyayalay_persons
       (id, doc_id, person_type, name, father_name, mobile, address, remarks,
        created_at, updated_at, deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,NULL)`,
      [p.id ?? generateUUID(), id, p.person_type,
       p.name, p.father_name, p.mobile, p.address, p.remarks, now, now]
    );
  }
  resyncDeadlineAlerts();
}

// ── DELETE ────────────────────────────────────────────────────────────────

export async function deleteNyayalayDocument(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  // BUG-3 fix: cascade soft-delete to persons and reports so they no longer
  // surface in search joins or future reads for this document.
  await db.runAsync(
    `UPDATE nyayalay_documents SET deleted_at=?, sync_status='pending' WHERE id=?`,
    [now, id]
  );
  await db.runAsync(
    `UPDATE nyayalay_persons SET deleted_at=? WHERE doc_id=? AND deleted_at IS NULL`,
    [now, id]
  );
  await db.runAsync(
    `UPDATE nyayalay_checklist_items SET deleted_at=? WHERE doc_id=? AND deleted_at IS NULL`,
    [now, id]
  );
  await db.runAsync(
    `UPDATE nyayalay_reports SET deleted_at=? WHERE doc_id=? AND deleted_at IS NULL`,
    [now, id]
  );
  resyncDeadlineAlerts();
}

// ── ANALYTICS ────────────────────────────────────────────────────────────
// Computed client-side from the same docs array that drives the list.
// Pure integer arithmetic (+=1 only) — NaN is structurally impossible.
// Guarantees SSOT and instant sync after every add/edit/delete.

export function computeAnalyticsFromDocs(docs: NyayalayDocument[]): NyayalayAnalytics {
  const today = todayStr();
  const emptyType = (): NyayalayTypeAnalytics => ({ total: 0, pending: 0, finished: 0, overdue: 0 });
  const overall = emptyType();
  const byType: Record<DocType, NyayalayTypeAnalytics> = {
    NBW: emptyType(),
    Summons: emptyType(),
    Bail_Lower_Court: emptyType(),
    High_Court_Documents: emptyType(),
    Anya: emptyType(),
  };

  for (const doc of docs) {
    // Defensive: skip rows with unrecognised doc_type so arithmetic stays clean
    if (!byType[doc.doc_type]) continue;

    const t = byType[doc.doc_type];
    t.total += 1;
    overall.total += 1;

    if (doc.status === 'Finished') {
      t.finished += 1;
      overall.finished += 1;
    } else {
      t.pending += 1;
      overall.pending += 1;
      // overdue = Pending AND deadline strictly before today
      if (doc.deadline_date && doc.deadline_date < today) {
        t.overdue += 1;
        overall.overdue += 1;
      }
    }
  }

  return { overall, byType };
}

/** @deprecated Use computeAnalyticsFromDocs(docs) — kept for any external callers. */
export async function getNyayalayAnalytics(): Promise<NyayalayAnalytics> {
  const docs = await getAllNyayalayDocuments();
  return computeAnalyticsFromDocs(docs);
}

// ── Report ────────────────────────────────────────────────────────────────

export interface NyayalayReport {
  id: string;
  doc_id: string;
  report_content: string;
  report_date: string;
  format_title: string;
  format_id: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version: number;
}

export async function getNyayalayReport(docId: string): Promise<NyayalayReport | null> {
  const db = await getDatabase();
  return db.getFirstAsync<NyayalayReport>(
    `SELECT * FROM nyayalay_reports WHERE doc_id = ? AND deleted_at IS NULL`, [docId]
  );
}

export async function saveNyayalayReport(
  docId: string,
  reportContent: string,
  reportDate: string,
  formatTitle: string,
  formatId: string | null
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM nyayalay_reports WHERE doc_id = ? AND deleted_at IS NULL`, [docId]
  );
  if (existing) {
    await db.runAsync(
      `UPDATE nyayalay_reports
       SET report_content=?, report_date=?, format_title=?, format_id=?,
           updated_at=?, version=version+1
       WHERE id=?`,
      [reportContent, reportDate, formatTitle, formatId ?? null, now, existing.id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO nyayalay_reports
       (id, doc_id, report_content, report_date, format_title, format_id,
        created_at, updated_at, deleted_at, version)
       VALUES (?,?,?,?,?,?,?,?,NULL,1)`,
      [generateUUID(), docId, reportContent, reportDate, formatTitle, formatId ?? null, now, now]
    );
  }
}

// ── Mark Finished (report workflows: NBW, Summons, Anya) ──────────────────

export async function markNyayalayFinished(docId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE nyayalay_documents
     SET status='Finished', updated_at=?, sync_status='pending', version=version+1
     WHERE id=? AND deleted_at IS NULL`,
    [nowTimestamp(), docId]
  );
  resyncDeadlineAlerts();
}

// ── Checklist Update (High Court Documents) ───────────────────────────────

export async function updateChecklistItems(
  items: { id: string; is_done: boolean }[]
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  for (const item of items) {
    await db.runAsync(
      `UPDATE nyayalay_checklist_items SET is_done=?, updated_at=? WHERE id=?`,
      [item.is_done ? 1 : 0, now, item.id]
    );
  }
}

// ── Reminder helpers (computed from deadline, no separate engine) ─────────

export interface NyayalayReminderInfo {
  category: string;
  statusLabel: string;
  isActive: boolean;
  daysInfo: string;
}

export function computeReminderInfo(
  docType: DocType,
  subType: SubType | null,
  deadlineDate: string,
  status: NyayalayStatus
): NyayalayReminderInfo {
  const days = nylDaysUntilDeadline(deadlineDate, status);
  const isFinished = status === 'Finished';

  const categoryMap: Record<string, string> = {
    NBW: 'NBW Due',
    Summons: 'Summons Compliance',
    Bail_Lower_Court: 'Bail Compliance Pending',
    High_Court_Documents_Bail: 'HC Bail Due',
    High_Court_Documents_Writ: 'Writ Due',
    Anya: 'Anya Document Due',
  };
  const key = docType === 'High_Court_Documents'
    ? `High_Court_Documents_${subType ?? 'Bail'}`
    : docType;
  const category = categoryMap[key] ?? 'Court Document Due';

  const isActive = !isFinished;
  const daysInfo = isFinished
    ? 'Completed'
    : days > 0 ? `Due in ${days} day${days !== 1 ? 's' : ''} (${deadlineDate})`
    : days === 0 ? `Due today (${deadlineDate})`
    : `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} (${deadlineDate})`;

  const statusLabel = isFinished ? 'Completed' : (days < 0 ? 'Overdue' : 'Active');
  return { category, statusLabel, isActive, daysInfo };
}

export interface NyayalaySearchOpts {
  typoTolerance?: boolean;
}

const NYL_PERSONS_EXPR = "(SELECT GROUP_CONCAT(np.name, ' ') FROM nyayalay_persons np WHERE np.doc_id = nd.id AND np.deleted_at IS NULL)";
const NYL_REPORT_EXPR = "(SELECT GROUP_CONCAT(r.report_content, ' ') FROM nyayalay_reports r WHERE r.doc_id = nd.id AND r.deleted_at IS NULL)";
const NYL_SEARCH_COLS = [
  'nd.court_name', 'nd.vad_sankhya', 'nd.apradh_sankhya', 'nd.fir_number', 'nd.doc_type',
  'nd.document_title', 'nd.matter', 'nd.registration_number', 'nd.applicable_sections', NYL_PERSONS_EXPR, NYL_REPORT_EXPR,
];

/** Word-by-word, Hindi-aware search (searchUtils); person names included. */
export async function searchNyayalayDocuments(
  query: string,
  opts?: NyayalaySearchOpts,
): Promise<NyayalayDocument[]> {
  const db = await getDatabase();
  const trimmed = query.trim();
  const typo = opts?.typoTolerance ?? isTypoTolerant();
  // With typo tolerance the SQL pre-filter would drop near-misses, so filter in JS only.
  const words = typo ? { sql: '1=1', params: [] as string[] } : sqlWordFilter(NYL_SEARCH_COLS, trimmed);
  const docs = await db.getAllAsync<NyayalayDocument & { _persons: string | null; _report: string | null }>(
    `SELECT nd.*, ${NYL_PERSONS_EXPR} AS _persons, ${NYL_REPORT_EXPR} AS _report FROM nyayalay_documents nd
     WHERE nd.deleted_at IS NULL AND ${words.sql}
     ORDER BY nd.created_at DESC`,
    words.params,
  );
  return docs
    .filter((d) => !trimmed || smartMatch(trimmed, [
      d.court_name, d.vad_sankhya, d.apradh_sankhya, d.fir_number, d.doc_type,
      d.document_title, d.matter, d.registration_number, d.applicable_sections, d._persons,
      (d._report ?? '').replace(/<[^>]+>/g, ' '),
    ], typo))
    .map(({ _persons: _p, _report: _r, ...d }) => d as NyayalayDocument);
}

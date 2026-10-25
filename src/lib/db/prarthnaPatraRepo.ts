import { getDatabase, generateUUID, nowTimestamp } from './database';

// ── Self-healing column migration ─────────────────────────────────────────
// On devices that were first opened before age/gender were added to the
// CREATE TABLE, those columns may be absent even after a JS bundle update
// (because _openDatabase / initializeSchema only runs on cold start, not
// hot-reload).  If an INSERT fails with "no column named <col>", we run an
// inline ALTER TABLE ADD COLUMN and retry once — making every session
// self-healing without requiring a cold start.
async function _ensureComplainantColumns(db: Awaited<ReturnType<typeof getDatabase>>): Promise<void> {
  for (const col of ["age TEXT DEFAULT ''", "gender TEXT DEFAULT ''"]) {
    try {
      await db.execAsync(`ALTER TABLE prarthna_patra_complainants ADD COLUMN ${col};`);
    } catch { /* duplicate column — already present, ignore */ }
  }
}
async function _ensureAccusedColumns(db: Awaited<ReturnType<typeof getDatabase>>): Promise<void> {
  for (const col of ["jati TEXT DEFAULT ''", "age TEXT DEFAULT ''", "gender TEXT DEFAULT ''"]) {
    try {
      await db.execAsync(`ALTER TABLE prarthna_patra_accused ADD COLUMN ${col};`);
    } catch { /* duplicate column — already present, ignore */ }
  }
}
import { isTypoTolerant, smartMatch, sqlWordFilter } from '@/lib/searchUtils';

// ── Types ──────────────────────────────────────────────────────────────────

export type PetitionType =
  | 'RL'
  | 'जनता दर्शन'
  | 'CO पेशी'
  | 'SDM'
  | 'DM'
  | 'RTI'
  | 'अन्य'
  | 'बीट सूचना'
  | 'NCR'
  | 'थाना प्रार्थना पत्र';

export const PETITION_TYPES: PetitionType[] = [
  'RL',
  'जनता दर्शन',
  'CO पेशी',
  'SDM',
  'DM',
  'RTI',
  'अन्य',
  'बीट सूचना',
  'NCR',
  'थाना प्रार्थना पत्र',
];

export const PETITION_TYPE_LABELS: Record<PetitionType, string> = {
  RL: 'Registry Letter (RL)',
  'जनता दर्शन': 'जनता दर्शन',
  'CO पेशी': 'CO पेशी',
  SDM: 'SDM',
  DM: 'DM',
  RTI: 'RTI',
  अन्य: 'अन्य',
  'बीट सूचना': 'बीट सूचना (Beat Information)',
  NCR: 'NCR (Non-Cognizable Report)',
  'थाना प्रार्थना पत्र': 'थाना प्रार्थना पत्र',
};

/** Petition types that use the "Take Action" workflow instead of the Report workflow */
export const ACTION_WORKFLOW_TYPES: PetitionType[] = ['बीट सूचना', 'NCR'];

/**
 * Petition types that have deadline-based overdue tracking.
 * Both Beat and Thana petition types auto-calculate deadline = receipt + 10 days.
 */
export const DEADLINE_TRACKING_TYPES: PetitionType[] = ['बीट सूचना', 'थाना प्रार्थना पत्र'];

/** Returns true if this petition type uses the action (Beat/NCR) workflow */
export function isActionWorkflow(type: PetitionType): boolean {
  return ACTION_WORKFLOW_TYPES.includes(type);
}

export type PPStatus = 'Pending' | 'Nistarit' | 'Finished';

export interface PrarthnaPatra {
  id: string;
  registration_number: string;
  petition_type: PetitionType;
  date_of_receipt: string;   // YYYY-MM-DD
  deadline_date: string;     // YYYY-MM-DD
  matter: string;
  investigator_name: string;
  status: PPStatus;
  disposal_date: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version: number;
  sync_status: string;
}

export interface PPComplainant {
  id: string;
  prarthna_patra_id: string;
  name: string;
  father_husband_name: string;
  mobile: string;
  alternate_mobile: string;
  full_address: string;
  village: string;
  police_station: string;
  district: string;
  age: string;
  gender: string;
  jati: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface PPAccused {
  id: string;
  prarthna_patra_id: string;
  name: string;
  father_name: string;
  mobile: string;
  alternate_mobile: string;
  full_address: string;
  village: string;
  police_station: string;
  district: string;
  jati: string;
  age: string;
  gender: string;
  remarks: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface PPReport {
  id: string;
  prarthna_patra_id: string;
  report_preparation_date: string;  // YYYY-MM-DD
  report_content: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version: number;
}

export interface PPWithDetails extends PrarthnaPatra {
  complainants: PPComplainant[];
  accused: PPAccused[];
  report: PPReport | null;
  actions: PPAction[];
}

// Analytics for a single category or overall
export interface PPAnalytics {
  total: number;
  pending: number;
  nistarit: number;    // standard workflow
  finished: number;    // action workflow (Beat / NCR)
  dueToday?: number;   // Beat only
  overdue?: number;    // Beat only
}

export interface PPDashboardAnalytics {
  overall: PPAnalytics;
  byType: Record<PetitionType, PPAnalytics>;
}

// ── PPAction ───────────────────────────────────────────────────────────────

export type NCRActionType = 'सुलह-समझौता' | 'BNSS Karyavahi';
export const NCR_ACTION_TYPES: NCRActionType[] = ['सुलह-समझौता', 'BNSS Karyavahi'];

export interface PPAction {
  id: string;
  prarthna_patra_id: string;
  action_type: string;
  action_date: string;       // YYYY-MM-DD
  action_content: string;
  is_complete: number;       // 0 | 1
  format_id: string | null;
  format_title: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version: number;
  sync_status: string;
}

// ── Registration Number ────────────────────────────────────────────────────

/** Deadline / status changed → move the न्यायालय / प्रार्थना पत्र phone alerts (lazy import). */
function resyncDeadlineAlerts(): void {
  import('@/lib/deadlineAlertService').then((m) => m.resyncDeadlineAlertsSoon()).catch(() => {});
}

/**
 * Bug 4 fix — Atomic registration number generation.
 *
 * The previous COUNT → generate → INSERT sequence had a race window: two
 * concurrent calls could both COUNT the same value, derive the same candidate,
 * and both INSERT it before either could see the other's row.
 *
 * Fix: the entire COUNT + uniqueness check + INSERT is performed inside a
 * single SQLite EXCLUSIVE transaction via withExclusiveTransactionAsync so
 * that concurrent callers are serialised at the database level.  The INSERT
 * itself is done here (not in createPrarthnaPatra) only when generating
 * inside the transaction context; createPrarthnaPatra passes the id and
 * registration_number that were resolved atomically.
 *
 * For callers that only need the number string (tests, previews) a separate
 * exported helper is retained — see generateRegistrationNumber below.
 */
export async function createPrarthnaPatraAtomic(
  input: CreatePPInput
): Promise<PrarthnaPatra> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  const year = new Date().getFullYear();
  const prefix = `PP/${year}/`;

  // Deadline fallback: if deadline_date is blank/empty, auto-calculate as
  // date_of_receipt + 10 days. Applies to ALL petition types on create only.
  const effectiveDeadline =
    input.deadline_date.trim() !== ''
      ? input.deadline_date
      : addDays(input.date_of_receipt, 10);

  let registration_number = '';

  await db.withExclusiveTransactionAsync(async () => {
    // Count all rows (including deleted) to seed the sequence
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM prarthna_patra WHERE registration_number LIKE ?`,
      [`${prefix}%`]
    );
    let seq = (row?.n ?? 0) + 1;

    // Find the first unused candidate within the transaction lock
    let candidate = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      candidate = `${prefix}${String(seq).padStart(3, '0')}`;
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM prarthna_patra WHERE registration_number = ?',
        [candidate]
      );
      if (!existing) break;
      seq++;
    }
    if (!candidate) candidate = `${prefix}${Date.now()}`;
    registration_number = candidate;

    // INSERT the header row atomically while holding the lock
    await db.runAsync(
      `INSERT INTO prarthna_patra
         (id, registration_number, petition_type, date_of_receipt, deadline_date, matter,
          investigator_name, status, disposal_date, created_at, updated_at, deleted_at,
          version, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', NULL, ?, ?, NULL, 1, 'pending')`,
      [id, registration_number, input.petition_type,
       input.date_of_receipt, effectiveDeadline, input.matter,
       input.investigator_name, now, now]
    );
  });

  // Insert related rows outside the exclusive lock (they reference the now-committed id)
  for (const c of input.complainants) {
    await _insertComplainant(db, generateUUID(), id, c, now);
  }
  for (const a of input.accused) {
    await _insertAccused(db, generateUUID(), id, a, now);
  }

  const created = await getPPById(id);
  if (!created) throw new Error('[PP] Failed to load created PrarthnaPatra');
  resyncDeadlineAlerts();
  return created;
}

/**
 * Generates a registration number string only (no INSERT).
 * Kept for backward-compat; prefer createPrarthnaPatraAtomic for real inserts.
 */
export async function generateRegistrationNumber(): Promise<string> {
  const db = await getDatabase();
  const year = new Date().getFullYear();
  const prefix = `PP/${year}/`;

  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM prarthna_patra WHERE registration_number LIKE ?`,
    [`${prefix}%`]
  );
  let seq = (row?.n ?? 0) + 1;

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${prefix}${String(seq).padStart(3, '0')}`;
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM prarthna_patra WHERE registration_number = ?',
      [candidate]
    );
    if (!existing) return candidate;
    seq++;
  }
  return `${prefix}${Date.now()}`;
}

// ── CRUD — PrarthnaPatra ──────────────────────────────────────────────────

export interface CreatePPInput {
  petition_type: PetitionType;
  date_of_receipt: string;
  deadline_date: string;
  matter: string;
  investigator_name: string;
  complainants: Omit<PPComplainant, 'id' | 'prarthna_patra_id' | 'created_at' | 'updated_at' | 'deleted_at'>[];
  accused: Omit<PPAccused, 'id' | 'prarthna_patra_id' | 'created_at' | 'updated_at' | 'deleted_at'>[];
}

export async function createPrarthnaPatra(input: CreatePPInput): Promise<PrarthnaPatra> {
  // Bug 4 fix: delegate to the atomic helper that holds an exclusive lock while
  // generating the registration number and inserting the header row together.
  return createPrarthnaPatraAtomic(input);
}

export async function updatePrarthnaPatra(
  id: string,
  input: Omit<CreatePPInput, 'complainants' | 'accused'> & {
    complainants: Omit<PPComplainant, 'prarthna_patra_id' | 'created_at' | 'updated_at' | 'deleted_at'>[];
    accused: Omit<PPAccused, 'prarthna_patra_id' | 'created_at' | 'updated_at' | 'deleted_at'>[];
  }
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();

  await db.runAsync(
    `UPDATE prarthna_patra
     SET petition_type=?, date_of_receipt=?, deadline_date=?, matter=?,
         investigator_name=?,
         updated_at=?, version=version+1, sync_status='pending'
     WHERE id=?`,
    [input.petition_type, input.date_of_receipt, input.deadline_date,
     input.matter, input.investigator_name, now, id]
  );

  // Bug 2 fix — differential update for complainants.
  // Previous code soft-deleted ALL existing rows then re-inserted all of them,
  // which destroyed id/created_at history and created unnecessary deleted rows.
  // New logic: UPDATE changed existing rows, INSERT genuinely new rows,
  // soft-delete only rows that were removed by the user.
  await _diffUpdateComplainants(db, id, input.complainants, now);

  // Bug 2 fix — same differential update for accused.
  await _diffUpdateAccused(db, id, input.accused, now);
  resyncDeadlineAlerts();
}

export async function deletePrarthnaPatra(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    'UPDATE prarthna_patra SET deleted_at=?, updated_at=?, sync_status=? WHERE id=?',
    [now, now, 'pending', id]
  );
  resyncDeadlineAlerts();
}

export async function getPPById(id: string): Promise<PrarthnaPatra | null> {
  const db = await getDatabase();
  return db.getFirstAsync<PrarthnaPatra>(
    'SELECT * FROM prarthna_patra WHERE id=? AND deleted_at IS NULL',
    [id]
  );
}

export async function getPPWithDetails(id: string): Promise<PPWithDetails | null> {
  const db = await getDatabase();
  const pp = await db.getFirstAsync<PrarthnaPatra>(
    'SELECT * FROM prarthna_patra WHERE id=? AND deleted_at IS NULL',
    [id]
  );
  if (!pp) return null;
  const complainants = await db.getAllAsync<PPComplainant>(
    'SELECT * FROM prarthna_patra_complainants WHERE prarthna_patra_id=? AND deleted_at IS NULL ORDER BY created_at ASC',
    [id]
  );
  const accused = await db.getAllAsync<PPAccused>(
    'SELECT * FROM prarthna_patra_accused WHERE prarthna_patra_id=? AND deleted_at IS NULL ORDER BY created_at ASC',
    [id]
  );
  const report = await db.getFirstAsync<PPReport>(
    'SELECT * FROM prarthna_patra_reports WHERE prarthna_patra_id=? AND deleted_at IS NULL',
    [id]
  ) ?? null;
  const actions = await db.getAllAsync<PPAction>(
    'SELECT * FROM pp_actions WHERE prarthna_patra_id=? AND deleted_at IS NULL ORDER BY created_at DESC',
    [id]
  );
  return { ...pp, complainants, accused, report, actions };
}

export async function getAllPrarthnaPatra(): Promise<PrarthnaPatra[]> {
  const db = await getDatabase();
  return db.getAllAsync<PrarthnaPatra>(
    'SELECT * FROM prarthna_patra WHERE deleted_at IS NULL ORDER BY created_at DESC'
  );
}

// ── Actions (Beat Information / NCR) ──────────────────────────────────────

export interface SaveActionInput {
  prarthna_patra_id: string;
  action_type: string;
  action_date: string;
  action_content: string;
  is_complete: boolean;
  format_id?: string | null;
  format_title?: string | null;
}

/**
 * Upsert a Take Action record for a Beat / NCR petition.
 * If the petition already has an action, it is updated; otherwise a new one is inserted.
 * The petition's status is updated to 'Finished' when is_complete=true, else 'Pending'.
 */
export async function saveAction(input: SaveActionInput): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();

  const existing = await db.getFirstAsync<PPAction>(
    'SELECT * FROM pp_actions WHERE prarthna_patra_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
    [input.prarthna_patra_id]
  );

  if (existing) {
    await db.runAsync(
      `UPDATE pp_actions
       SET action_type=?, action_date=?, action_content=?, is_complete=?,
           format_id=?, format_title=?, updated_at=?, version=version+1, sync_status='pending'
       WHERE id=?`,
      [
        input.action_type, input.action_date, input.action_content,
        input.is_complete ? 1 : 0,
        input.format_id ?? null, input.format_title ?? null,
        now, existing.id,
      ]
    );
  } else {
    await db.runAsync(
      `INSERT INTO pp_actions
         (id, prarthna_patra_id, action_type, action_date, action_content, is_complete,
          format_id, format_title, created_at, updated_at, deleted_at, version, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 'pending')`,
      [
        generateUUID(), input.prarthna_patra_id,
        input.action_type, input.action_date, input.action_content,
        input.is_complete ? 1 : 0,
        input.format_id ?? null, input.format_title ?? null,
        now, now,
      ]
    );
  }

  const newStatus: PPStatus = input.is_complete ? 'Finished' : 'Pending';
  await db.runAsync(
    `UPDATE prarthna_patra
     SET status=?, updated_at=?, version=version+1, sync_status='pending'
     WHERE id=?`,
    [newStatus, now, input.prarthna_patra_id]
  );
  resyncDeadlineAlerts();
}

export async function getLatestAction(ppId: string): Promise<PPAction | null> {
  const db = await getDatabase();
  return db.getFirstAsync<PPAction>(
    'SELECT * FROM pp_actions WHERE prarthna_patra_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
    [ppId]
  ) ?? null;
}

// ── Report ─────────────────────────────────────────────────────────────────

export async function saveReport(
  ppId: string,
  reportPreparationDate: string,
  reportContent: string
): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();

  // Upsert: if report exists update it, else insert
  const existing = await db.getFirstAsync<PPReport>(
    'SELECT * FROM prarthna_patra_reports WHERE prarthna_patra_id=? AND deleted_at IS NULL',
    [ppId]
  );
  if (existing) {
    await db.runAsync(
      `UPDATE prarthna_patra_reports
       SET report_preparation_date=?, report_content=?, updated_at=?, version=version+1
       WHERE id=?`,
      [reportPreparationDate, reportContent, now, existing.id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO prarthna_patra_reports
         (id, prarthna_patra_id, report_preparation_date, report_content,
          created_at, updated_at, deleted_at, version)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 1)`,
      [generateUUID(), ppId, reportPreparationDate, reportContent, now, now]
    );
  }

  // Bug 8 fix: use reportPreparationDate (the user-entered date) as disposal_date
  // instead of _todayString(). The old local `const todayStr` variable is removed.
  await db.runAsync(
    `UPDATE prarthna_patra
     SET status='Nistarit', disposal_date=?, updated_at=?,
         version=version+1, sync_status='pending'
     WHERE id=?`,
    [reportPreparationDate, now, ppId]
  );
  resyncDeadlineAlerts();
}

// ── Analytics ──────────────────────────────────────────────────────────────

export async function getDashboardAnalytics(): Promise<PPDashboardAnalytics> {
  const all = await getAllPrarthnaPatra();
  const today = _todayString();

  const zero = (): PPAnalytics => ({ total: 0, pending: 0, nistarit: 0, finished: 0 });
  const byType: Record<PetitionType, PPAnalytics> = {
    RL: zero(), 'जनता दर्शन': zero(), 'CO पेशी': zero(),
    SDM: zero(), DM: zero(), RTI: zero(), अन्य: zero(),
    'बीट सूचना': { ...zero(), dueToday: 0, overdue: 0 },
    NCR: zero(),
    'थाना प्रार्थना पत्र': { ...zero(), dueToday: 0, overdue: 0 },
  };
  const overall = zero();

  for (const pp of all) {
    overall.total++;
    if (pp.status === 'Pending') overall.pending++;
    else if (pp.status === 'Finished') overall.finished++;
    else overall.nistarit++;

    const t = pp.petition_type as PetitionType;
    if (byType[t]) {
      byType[t].total++;
      if (pp.status === 'Pending') byType[t].pending++;
      else if (pp.status === 'Finished') byType[t].finished++;
      else byType[t].nistarit++;

      // Deadline tracking for Beat and Thana petition types
      if (DEADLINE_TRACKING_TYPES.includes(t) && pp.status === 'Pending') {
        const days = daysUntilDeadline(pp.deadline_date, pp.status);
        if (days === 0) byType[t].dueToday = (byType[t].dueToday ?? 0) + 1;
        if (days < 0) byType[t].overdue = (byType[t].overdue ?? 0) + 1;
      }
    }
  }

  return { overall, byType };
}

// ── Search ─────────────────────────────────────────────────────────────────

export interface PPSearchResult extends PrarthnaPatra {
  complainants: PPComplainant[];
  accused: PPAccused[];
}

export interface PPSearchOpts {
  typoTolerance?: boolean;
}

// Report (आख्या) and action (कार्यवाही) text of a petition.
const PP_LINKED_TEXT_EXPR = "(COALESCE((SELECT GROUP_CONCAT(r.report_content, ' ') FROM prarthna_patra_reports r WHERE r.prarthna_patra_id = p.id AND r.deleted_at IS NULL), '') || ' ' || COALESCE((SELECT GROUP_CONCAT(a.action_content, ' ') FROM pp_actions a WHERE a.prarthna_patra_id = p.id AND a.deleted_at IS NULL), ''))";
const PP_SEARCH_EXPRS = [
  'p.registration_number', 'p.petition_type', 'p.matter', 'p.date_of_receipt', 'p.investigator_name',
  "(SELECT GROUP_CONCAT(c.name || ' ' || c.mobile || ' ' || c.alternate_mobile || ' ' || c.village, ' ') FROM prarthna_patra_complainants c WHERE c.prarthna_patra_id = p.id AND c.deleted_at IS NULL)",
  "(SELECT GROUP_CONCAT(x.name, ' ') FROM prarthna_patra_accused x WHERE x.prarthna_patra_id = p.id AND x.deleted_at IS NULL)",
  PP_LINKED_TEXT_EXPR,
];

export async function searchPrarthnaPatra(
  query: string,
  opts?: PPSearchOpts,
): Promise<PPSearchResult[]> {
  const db = await getDatabase();
  const trimmed = query.trim();
  // Word-by-word, Hindi-aware SQL pre-filter (searchUtils) over the petition and
  // its complainants / accused; the exact check runs on the assembled rows below.
  const typo = opts?.typoTolerance ?? isTypoTolerant();
  const words = typo || !trimmed ? { sql: '1=1', params: [] as string[] } : sqlWordFilter(PP_SEARCH_EXPRS, trimmed);
  const matched = await db.getAllAsync<{ id: string; _linked: string | null }>(
    `SELECT p.id, ${PP_LINKED_TEXT_EXPR} AS _linked FROM prarthna_patra p WHERE p.deleted_at IS NULL AND ${words.sql}`,
    words.params,
  );
  const ids = new Set<string>(matched.map((r) => r.id));
  const linkedText = new Map(matched.map((r) => [r.id, (r._linked ?? '').replace(/<[^>]+>/g, ' ')]));
  if (ids.size === 0) return [];

  // Bug 6 fix — replace N+1 per-id SELECTs with three bulk IN() queries.
  // Previously: for each matched id → SELECT pp, SELECT complainants, SELECT accused
  //   = 3 × N round-trips for N results.
  // Now: one SELECT per table with a single IN() clause = always 3 round-trips total.
  const idList = Array.from(ids);
  const placeholders = idList.map(() => '?').join(',');

  const ppRows = await db.getAllAsync<PrarthnaPatra>(
    `SELECT * FROM prarthna_patra WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    idList
  );
  const complainantRows = await db.getAllAsync<PPComplainant>(
    `SELECT * FROM prarthna_patra_complainants
     WHERE prarthna_patra_id IN (${placeholders}) AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    idList
  );
  const accusedRows = await db.getAllAsync<PPAccused>(
    `SELECT * FROM prarthna_patra_accused
     WHERE prarthna_patra_id IN (${placeholders}) AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    idList
  );

  // Group related rows by prarthna_patra_id for O(1) lookup during assembly
  const complainantsByPP = new Map<string, PPComplainant[]>();
  for (const c of complainantRows) {
    const arr = complainantsByPP.get(c.prarthna_patra_id) ?? [];
    arr.push(c);
    complainantsByPP.set(c.prarthna_patra_id, arr);
  }
  const accusedByPP = new Map<string, PPAccused[]>();
  for (const a of accusedRows) {
    const arr = accusedByPP.get(a.prarthna_patra_id) ?? [];
    arr.push(a);
    accusedByPP.set(a.prarthna_patra_id, arr);
  }

  let results: PPSearchResult[] = ppRows.map((pp) => ({
    ...pp,
    complainants: complainantsByPP.get(pp.id) ?? [],
    accused:      accusedByPP.get(pp.id) ?? [],
  }));

  if (trimmed) {
    results = results.filter((pp) => smartMatch(trimmed, [
      pp.registration_number, pp.petition_type, pp.matter, pp.date_of_receipt, pp.investigator_name,
      ...pp.complainants.map((c) => `${c.name} ${c.mobile} ${c.alternate_mobile} ${c.village}`),
      ...pp.accused.map((x) => x.name),
      linkedText.get(pp.id),
    ], typo));
  }

  // Sort by created_at desc — same order as before
  return results.sort((a, b) => b.created_at - a.created_at);
}

// ── Helpers ────────────────────────────────────────────────────────────────

// ── Differential update helpers (Bug 2 fix) ────────────────────────────────
//
// Previous updatePrarthnaPatra soft-deleted ALL existing complainants/accused
// and re-inserted them, destroying their original id and created_at values,
// creating unnecessary deleted rows, and inflating sync conflicts.
//
// These helpers implement the correct three-way merge:
//   existing + unchanged → leave untouched (no DB write)
//   existing + changed   → UPDATE (preserves id, created_at; bumps updated_at)
//   new item (no id)     → INSERT with fresh id and created_at
//   removed item         → soft-delete (sets deleted_at, leaves the row in place)

type ComplainantInput = Omit<PPComplainant, 'prarthna_patra_id' | 'created_at' | 'updated_at' | 'deleted_at'>;
type AccusedInput     = Omit<PPAccused,     'prarthna_patra_id' | 'created_at' | 'updated_at' | 'deleted_at'>;

async function _diffUpdateComplainants(
  db: Awaited<ReturnType<typeof getDatabase>>,
  ppId: string,
  incoming: ComplainantInput[],
  now: number
): Promise<void> {
  const existing = await db.getAllAsync<PPComplainant>(
    'SELECT * FROM prarthna_patra_complainants WHERE prarthna_patra_id=? AND deleted_at IS NULL',
    [ppId]
  );
  const existingById = new Map(existing.map((c) => [c.id, c]));
  const incomingIds  = new Set(incoming.map((c) => c.id).filter(Boolean) as string[]);

  // Soft-delete rows that were removed
  for (const row of existing) {
    if (!incomingIds.has(row.id)) {
      await db.runAsync(
        'UPDATE prarthna_patra_complainants SET deleted_at=?, updated_at=? WHERE id=?',
        [now, now, row.id]
      );
    }
  }

  for (const c of incoming) {
    if (c.id && existingById.has(c.id)) {
      // Row exists — check if anything actually changed before writing
      const prev = existingById.get(c.id)!;
      const changed =
        prev.name               !== c.name ||
        prev.father_husband_name !== c.father_husband_name ||
        prev.mobile             !== c.mobile ||
        prev.alternate_mobile   !== c.alternate_mobile ||
        prev.full_address       !== c.full_address ||
        prev.village            !== c.village ||
        prev.police_station     !== c.police_station ||
        prev.district           !== c.district ||
        prev.age                !== c.age ||
        prev.gender             !== c.gender ||
        prev.jati               !== c.jati;
      if (changed) {
        await db.runAsync(
          `UPDATE prarthna_patra_complainants
           SET name=?, father_husband_name=?, mobile=?, alternate_mobile=?,
               full_address=?, village=?, police_station=?, district=?,
               age=?, gender=?, jati=?, updated_at=?
           WHERE id=?`,
          [
            c.name, c.father_husband_name, c.mobile, c.alternate_mobile,
            c.full_address, c.village, c.police_station, c.district,
            c.age, c.gender, c.jati, now, c.id,
          ]
        );
      }
      // unchanged → no-op
    } else {
      // New item — INSERT with a fresh id
      await _insertComplainant(db, generateUUID(), ppId, c, now);
    }
  }
}

async function _diffUpdateAccused(
  db: Awaited<ReturnType<typeof getDatabase>>,
  ppId: string,
  incoming: AccusedInput[],
  now: number
): Promise<void> {
  const existing = await db.getAllAsync<PPAccused>(
    'SELECT * FROM prarthna_patra_accused WHERE prarthna_patra_id=? AND deleted_at IS NULL',
    [ppId]
  );
  const existingById = new Map(existing.map((a) => [a.id, a]));
  const incomingIds  = new Set(incoming.map((a) => a.id).filter(Boolean) as string[]);

  // Soft-delete rows that were removed
  for (const row of existing) {
    if (!incomingIds.has(row.id)) {
      await db.runAsync(
        'UPDATE prarthna_patra_accused SET deleted_at=?, updated_at=? WHERE id=?',
        [now, now, row.id]
      );
    }
  }

  for (const a of incoming) {
    if (a.id && existingById.has(a.id)) {
      const prev = existingById.get(a.id)!;
      const changed =
        prev.name             !== a.name ||
        prev.father_name      !== a.father_name ||
        prev.mobile           !== a.mobile ||
        prev.alternate_mobile !== a.alternate_mobile ||
        prev.full_address     !== a.full_address ||
        prev.village          !== a.village ||
        prev.police_station   !== a.police_station ||
        prev.district         !== a.district ||
        prev.jati             !== a.jati ||
        prev.age              !== a.age ||
        prev.gender           !== a.gender ||
        prev.remarks          !== a.remarks;
      if (changed) {
        await db.runAsync(
          `UPDATE prarthna_patra_accused
           SET name=?, father_name=?, mobile=?, alternate_mobile=?,
               full_address=?, village=?, police_station=?, district=?,
               jati=?, age=?, gender=?, remarks=?, updated_at=?
           WHERE id=?`,
          [
            a.name, a.father_name, a.mobile, a.alternate_mobile,
            a.full_address, a.village, a.police_station, a.district,
            a.jati, a.age, a.gender, a.remarks, now, a.id,
          ]
        );
      }
      // unchanged → no-op
    } else {
      await _insertAccused(db, generateUUID(), ppId, a, now);
    }
  }
}

async function _insertComplainant(
  db: Awaited<ReturnType<typeof getDatabase>>,
  id: string,
  ppId: string,
  c: Partial<PPComplainant>,
  now: number
): Promise<void> {
  const sql = `INSERT INTO prarthna_patra_complainants
       (id, prarthna_patra_id, name, father_husband_name, mobile, alternate_mobile,
        full_address, village, police_station, district, age, gender, jati,
        created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`;
  const params = [
    id, ppId,
    c.name ?? '', c.father_husband_name ?? '', c.mobile ?? '', c.alternate_mobile ?? '',
    c.full_address ?? '', c.village ?? '', c.police_station ?? '', c.district ?? '',
    c.age ?? '', c.gender ?? '', c.jati ?? '',
    now, now,
  ];
  try {
    await db.runAsync(sql, params);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (msg.includes('no column named') || msg.includes('table has no column')) {
      // Self-heal: add missing columns then retry once
      await _ensureComplainantColumns(db);
      await db.runAsync(sql, params);
    } else {
      throw e;
    }
  }
}

async function _insertAccused(
  db: Awaited<ReturnType<typeof getDatabase>>,
  id: string,
  ppId: string,
  a: Partial<PPAccused>,
  now: number
): Promise<void> {
  const sql = `INSERT INTO prarthna_patra_accused
       (id, prarthna_patra_id, name, father_name, mobile, alternate_mobile,
        full_address, village, police_station, district, jati, age, gender, remarks,
        created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`;
  const params = [
    id, ppId,
    a.name ?? '', a.father_name ?? '', a.mobile ?? '', a.alternate_mobile ?? '',
    a.full_address ?? '', a.village ?? '', a.police_station ?? '', a.district ?? '',
    a.jati ?? '', a.age ?? '', a.gender ?? '', a.remarks ?? '',
    now, now,
  ];
  try {
    await db.runAsync(sql, params);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (msg.includes('no column named') || msg.includes('table has no column')) {
      // Self-heal: add missing columns then retry once
      await _ensureAccusedColumns(db);
      await db.runAsync(sql, params);
    } else {
      throw e;
    }
  }
}

/** Returns today as YYYY-MM-DD using local time (never UTC). */
export function _todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Bug 3 fix — local-safe date parsing.
 *
 * new Date("YYYY-MM-DD") is parsed as UTC midnight by the JS spec, which
 * causes a date-shift of ±1 day depending on the device's UTC offset.
 * This helper constructs the Date from local year/month/day components,
 * so the result is always local midnight regardless of timezone.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  // monthIndex is 0-based; provide explicit time components to avoid
  // any platform-specific defaulting behaviour.
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

/**
 * Calculates days remaining (positive) or overdue (negative) for a petition.
 * Returns 0 for Nistarit and Finished petitions.
 */
export function daysUntilDeadline(deadlineDate: string, status: PPStatus): number {
  if (status === 'Nistarit' || status === 'Finished') return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Bug 3 fix: use parseLocalDate instead of new Date(string) to avoid UTC shift.
  const deadline = parseLocalDate(deadlineDate);
  deadline.setHours(0, 0, 0, 0);
  return Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Add N calendar days to a YYYY-MM-DD string using local time.
 */
export function addDays(dateStr: string, days: number): string {
  // Bug 3 fix: use parseLocalDate instead of new Date(string) to avoid UTC shift.
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

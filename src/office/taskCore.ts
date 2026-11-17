/**
 * InvestSuite कार्यालय — कागज़ (tasks): kinds, प्रकार lists (same as InvestSuite), form → fields, statuses, counts.
 * Pure — tests: scripts/test_office_tasks.ts
 * One कागज़ = one अधिकारी (owner). A cancelled कागज़ = tasks.closed (owner: office can edit and cancel).
 * fields keys follow InvestSuite's columns so step ग can drop them straight into प्रार्थना पत्र / न्यायालय.
 */

export type TaskKind = 'petition' | 'court';
export type AssigneeStatus = 'sent' | 'received' | 'seen' | 'done' | 'not_done' | 'returned' | 'removed';

/** प्रार्थना पत्र प्रकार — the same values as InvestSuite's PetitionType. */
export const PETITION_SUBTYPES = ['RL', 'जनता दर्शन', 'CO पेशी', 'SDM', 'DM', 'RTI', 'बीट सूचना', 'NCR', 'थाना प्रार्थना पत्र', 'अन्य'] as const;

/** न्यायालय प्रकार — value = InvestSuite DocType, label = its Hindi name. */
export const COURT_SUBTYPES: { value: string; label: string }[] = [
  { value: 'NBW', label: 'NBW' },
  { value: 'Summons', label: 'सम्मन' },
  { value: 'Bail_Lower_Court', label: 'जमानत (निचली अदालत)' },
  { value: 'High_Court_Documents', label: 'उच्च न्यायालय' },
  { value: 'Anya', label: 'अन्य' },
];

export function subtypeLabel(kind: TaskKind, subtype: string): string {
  if (kind === 'court') return COURT_SUBTYPES.find((s) => s.value === subtype)?.label ?? subtype;
  return subtype === 'RL' ? 'Registry Letter (RL)' : subtype;
}

export const KIND_LABEL: Record<TaskKind, string> = { petition: 'प्रार्थना पत्र', court: 'न्यायालय' };

export const STATUS_LABEL: Record<AssigneeStatus | 'cancelled', string> = {
  sent: 'भेजा', received: 'मिला', seen: 'देखा', done: 'निस्तारित ✓', not_done: 'नहीं हुआ', returned: 'वापस',
  removed: 'फ़ोन से हटाया', cancelled: 'रद्द',
};

// ── dates (YYYY-MM-DD ↔ dd/mm/yyyy) ──────────────────────────────────────────

export function isoToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return isoToday(dt);
}

export function showDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Whole days from today to `iso` (negative = passed). */
export function daysUntil(iso: string | null | undefined, today = isoToday()): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function daysLabel(n: number | null): string {
  if (n === null) return '';
  if (n > 0) return `${n} दिन शेष`;
  if (n === 0) return 'आज अंतिम दिन';
  return `${-n} दिन ऊपर`;
}

// ── the form ──────────────────────────────────────────────────────────────────

/**
 * One person on a कागज़ (owner: the InvestSuite group card — lib/personCard.ts). `address` always holds the full printed address
 * (built from the parts on new cards), so older phones and titles keep working; the parts travel too.
 */
export interface TaskPerson {
  name: string; relation: string; father: string; address: string; mobile: string;
  gender?: string; age?: string;
  addrMode?: 'parts' | 'free'; house?: string; village?: string; villageKind?: string; thana?: string; district?: string;
  altMobile?: string; idType?: string; idNumber?: string; email?: string; remarks?: string;
}

export const emptyPerson = (): TaskPerson => ({ name: '', relation: '', father: '', address: '', mobile: '' });

export interface TaskForm {
  kind: TaskKind;
  subtype: string;
  received_on: string;        // YYYY-MM-DD
  due_on: string;             // अंतिम / नियत तिथि
  matter: string;             // विषय (छोटा)
  applicants: TaskPerson[];   // प्रार्थना पत्र आवेदक
  opponents: TaskPerson[];    // प्रार्थना पत्र विपक्षी / आरोपी
  court_name: string;
  vad_sankhya: string;
  apradh_sankhya: string;     // मु0अ0सं0
  applicable_sections: string;
  document_title: string;     // न्यायालय "अन्य"
  accused: TaskPerson[];      // न्यायालय अभियुक्त
  note: string;               // कार्यालय की टिप्पणी
}

export function newTaskForm(kind: TaskKind = 'petition', today = isoToday()): TaskForm {
  return {
    kind, subtype: '', received_on: today, due_on: kind === 'petition' ? addDaysIso(today, 10) : '',
    matter: '', applicants: [emptyPerson()], opponents: [], court_name: '', vad_sankhya: '', apradh_sankhya: '',
    applicable_sections: '', document_title: '', accused: [], note: '',
  };
}

const named = (list: TaskPerson[]) => list.filter((p) => p.name.trim());
const EXTRA_KEYS = ['gender', 'age', 'addrMode', 'house', 'village', 'villageKind', 'thana', 'district', 'altMobile', 'idType', 'idNumber', 'email', 'remarks'] as const;
const cleanPeople = (list: TaskPerson[]) => named(list).map((p) => {
  const out: TaskPerson = {
    name: p.name.trim(), relation: p.relation, father: p.father.trim(), address: p.address.trim(), mobile: p.mobile.replace(/\D/g, '').slice(-10),
  };
  for (const k of EXTRA_KEYS) {
    const v = (p[k] ?? '').toString().trim();
    if (v) (out as unknown as Record<string, string>)[k] = k === 'altMobile' ? v.replace(/\D/g, '').slice(-10) : v;
  }
  return out;
});

/** Hindi error for step 1, or '' when it can go on. */
export function taskFormError(f: TaskForm): string {
  if (!f.subtype) return 'प्रकार चुनें';
  if (!f.due_on) return f.kind === 'court' ? 'नियत तिथि चुनें' : 'अंतिम तिथि चुनें';
  if (f.kind === 'petition' && !named(f.applicants).length) return 'कम से कम एक आवेदक का नाम लिखें';
  if (f.kind === 'court' && !f.court_name.trim() && !f.vad_sankhya.trim() && !f.apradh_sankhya.trim()) {
    return 'न्यायालय का नाम, वाद सं0 या मु0अ0सं0 में से कुछ लिखें';
  }
  if (f.kind === 'court' && f.subtype === 'Anya' && !f.document_title.trim()) return 'कागज़ का नाम लिखें';
  for (const p of [...f.applicants, ...f.opponents, ...f.accused]) {
    const m = p.mobile.replace(/\D/g, '');
    if (m && m.length !== 10 && !(m.length === 12 && m.startsWith('91'))) return `${p.name || 'व्यक्ति'} का मोबाइल 10 अंकों का लिखें`;
    const a = (p.altMobile ?? '').replace(/\D/g, '');
    if (a && a.length !== 10) return `${p.name || 'व्यक्ति'} का दूसरा मोबाइल 10 अंकों का लिखें`;
  }
  return '';
}

/** The short line on lists: "जनता दर्शन — रेनू पत्नी धीरज" / "NBW — वाद सं0 412/2026". */
export function taskTitle(f: Pick<TaskForm, 'kind' | 'subtype' | 'applicants' | 'vad_sankhya' | 'apradh_sankhya' | 'court_name' | 'document_title' | 'matter'>): string {
  const head = f.kind === 'court' && f.subtype === 'Anya' && f.document_title.trim() ? f.document_title.trim() : subtypeLabel(f.kind, f.subtype);
  let who = '';
  if (f.kind === 'petition') {
    const a = named(f.applicants)[0];
    who = a ? `${a.name.trim()}${a.father.trim() ? ` ${a.relation || 'पुत्र'} ${a.father.trim()}` : ''}` : f.matter.trim();
  } else {
    who = f.vad_sankhya.trim() ? `वाद सं0 ${f.vad_sankhya.trim()}` : f.apradh_sankhya.trim() ? `मु0अ0सं0 ${f.apradh_sankhya.trim()}` : f.court_name.trim();
  }
  return who ? `${head} — ${who}` : head;
}

/** Form → the row for public.tasks (fields keeps everything the officer's app needs). */
export function formToTaskRow(f: TaskForm): { kind: TaskKind; subtype: string; title: string; received_on: string | null; due_on: string | null; fields: Record<string, unknown> } {
  const fields: Record<string, unknown> = { matter: f.matter.trim(), note: f.note.trim() };
  if (f.kind === 'petition') {
    fields.applicants = cleanPeople(f.applicants);
    fields.opponents = cleanPeople(f.opponents);
  } else {
    Object.assign(fields, {
      court_name: f.court_name.trim(), vad_sankhya: f.vad_sankhya.trim(), apradh_sankhya: f.apradh_sankhya.trim(),
      applicable_sections: f.applicable_sections.trim(), document_title: f.document_title.trim(), accused: cleanPeople(f.accused),
    });
  }
  return { kind: f.kind, subtype: f.subtype, title: taskTitle(f), received_on: f.received_on || null, due_on: f.due_on || null, fields };
}

/** A saved task back into the form (edit). */
export function taskRowToForm(t: { kind: string; subtype: string; received_on: string | null; due_on: string | null; fields: Record<string, unknown> | null }): TaskForm {
  const f = (t.fields ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof f[k] === 'string' ? (f[k] as string) : '');
  const ppl = (k: string): TaskPerson[] => (Array.isArray(f[k]) ? (f[k] as Partial<TaskPerson>[]) : []).map((p) => ({ ...emptyPerson(), ...p } as TaskPerson));
  const kind: TaskKind = t.kind === 'court' ? 'court' : 'petition';
  const base = newTaskForm(kind);
  return {
    ...base, subtype: t.subtype, received_on: t.received_on ?? '', due_on: t.due_on ?? '', matter: s('matter'), note: s('note'),
    applicants: kind === 'petition' ? (ppl('applicants').length ? ppl('applicants') : [emptyPerson()]) : [],
    opponents: ppl('opponents'), court_name: s('court_name'), vad_sankhya: s('vad_sankhya'), apradh_sankhya: s('apradh_sankhya'),
    applicable_sections: s('applicable_sections'), document_title: s('document_title'), accused: ppl('accused'),
  };
}

// ── list / dashboard ──────────────────────────────────────────────────────────

export interface TaskListRow {
  id: string;
  kind: TaskKind;
  subtype: string;
  title: string;
  received_on: string | null;
  due_on: string | null;
  created_at: string;
  updated_at?: string;
  closed: boolean;
  fields: Record<string, unknown> | null;
  assignee: { member_id: string; status: AssigneeStatus; status_note?: string | null; updated_at?: string } | null;
  fileCount: number;
}

export type TaskState = AssigneeStatus | 'cancelled';

export function taskState(t: Pick<TaskListRow, 'closed' | 'assignee'>): TaskState {
  if (t.closed) return 'cancelled';
  return t.assignee?.status ?? 'sent';
}

export const isDone = (t: Pick<TaskListRow, 'closed' | 'assignee'>) => taskState(t) === 'done';
export const isPending = (t: Pick<TaskListRow, 'closed' | 'assignee'>) => !['done', 'cancelled'].includes(taskState(t));

export function isOverdue(t: Pick<TaskListRow, 'closed' | 'assignee' | 'due_on'>, today = isoToday()): boolean {
  const d = daysUntil(t.due_on, today);
  return isPending(t) && d !== null && d < 0;
}

/** Monday of this week (YYYY-MM-DD). */
export function weekStart(today = isoToday()): string {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const back = (dt.getDay() + 6) % 7;
  return addDaysIso(today, -back);
}

/** "इस हफ़्ते आए" = created this week (Mon–today). */
export function isThisWeek(t: Pick<TaskListRow, 'created_at'>, today = isoToday()): boolean {
  const c = (t.created_at ?? '').slice(0, 10);
  return c >= weekStart(today) && c <= today;
}

export interface TaskFilter {
  kind: 'all' | TaskKind;
  state: 'all' | 'pending' | 'done' | 'overdue' | 'cancelled';
  subtype: string;       // '' = all
  memberId: string;      // '' = all
  range: 'all' | 'week' | 'month';
}

export const NO_FILTER: TaskFilter = { kind: 'all', state: 'all', subtype: '', memberId: '', range: 'all' };

export function matchesFilter(t: TaskListRow, f: TaskFilter, today = isoToday()): boolean {
  if (f.kind !== 'all' && t.kind !== f.kind) return false;
  if (f.subtype && t.subtype !== f.subtype) return false;
  if (f.memberId && t.assignee?.member_id !== f.memberId) return false;
  if (f.range === 'week' && !isThisWeek(t, today)) return false;
  if (f.range === 'month' && (t.created_at ?? '').slice(0, 7) !== today.slice(0, 7)) return false;
  if (f.state === 'pending' && !isPending(t)) return false;
  if (f.state === 'done' && !isDone(t)) return false;
  if (f.state === 'overdue' && !isOverdue(t, today)) return false;
  if (f.state === 'cancelled' && taskState(t) !== 'cancelled') return false;
  return true;
}

/** Newest first; overdue pending float to the top. */
export function sortTasks(list: TaskListRow[], today = isoToday()): TaskListRow[] {
  return [...list].sort((a, b) => Number(isOverdue(b, today)) - Number(isOverdue(a, today)) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

export interface Dashboard {
  thisWeek: number;
  pending: number;
  overdue: number;
  done: number;
  weekBySubtype: { kind: TaskKind; subtype: string; label: string; n: number }[];
  byOfficer: { memberId: string; pending: number; overdue: number; done: number }[];
  overdueList: TaskListRow[];
}

export function dashboard(list: TaskListRow[], today = isoToday()): Dashboard {
  const live = list.filter((t) => !t.closed);
  const week = live.filter((t) => isThisWeek(t, today));
  const sub = new Map<string, { kind: TaskKind; subtype: string; label: string; n: number }>();
  for (const t of week) {
    const k = `${t.kind}|${t.subtype}`;
    const e = sub.get(k) ?? { kind: t.kind, subtype: t.subtype, label: subtypeLabel(t.kind, t.subtype), n: 0 };
    e.n += 1; sub.set(k, e);
  }
  const off = new Map<string, { memberId: string; pending: number; overdue: number; done: number }>();
  for (const t of live) {
    const id = t.assignee?.member_id;
    if (!id) continue;
    const e = off.get(id) ?? { memberId: id, pending: 0, overdue: 0, done: 0 };
    if (isDone(t)) e.done += 1; else if (isPending(t)) e.pending += 1;
    if (isOverdue(t, today)) e.overdue += 1;
    off.set(id, e);
  }
  const overdueList = live.filter((t) => isOverdue(t, today)).sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? ''));
  return {
    thisWeek: week.length,
    pending: live.filter(isPending).length,
    overdue: overdueList.length,
    done: live.filter(isDone).length,
    weekBySubtype: [...sub.values()].sort((a, b) => b.n - a.n),
    byOfficer: [...off.values()].sort((a, b) => b.pending - a.pending),
    overdueList,
  };
}

/** Pending count per officer (for "अधिकारी चुनें"). */
export function pendingByOfficer(list: TaskListRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of list) if (isPending(t) && t.assignee) out[t.assignee.member_id] = (out[t.assignee.member_id] ?? 0) + 1;
  return out;
}

// ── files ─────────────────────────────────────────────────────────────────────

/** Storage path: <thana_id>/<task_id>/<time>_<safe name> (004 policies read the first two parts). */
export function storagePath(thanaId: string, taskId: string, name: string, now = Date.now()): string {
  const safe = name.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-60) || 'file';
  return `${thanaId}/${taskId}/${now}_${safe}`;
}

/** Base64 → bytes without Node's Buffer (works on the phone). */
export function b64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const map = new Uint8Array(128);
  for (let i = 0; i < chars.length; i++) map[chars.charCodeAt(i)] = i;
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = map[clean.charCodeAt(i)], b = map[clean.charCodeAt(i + 1)];
    const c = map[clean.charCodeAt(i + 2)] ?? 0, d = map[clean.charCodeAt(i + 3)] ?? 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < len) out[o++] = (n >> 16) & 255;
    if (o < len && i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (o < len && i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

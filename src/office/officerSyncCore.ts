/**
 * InvestSuite side of चरण ग (owner): a कागज़ the थाना कार्यालय sent → the officer's प्रार्थना पत्र / न्यायालय row, and the status that
 * goes back (मिला / देखा / निस्तारित / फ़ोन से हटाया). Pure — tests: scripts/test_officer_sync.ts
 * Only the status goes back to the office, never the आख्या text (owner).
 */
import type { AssigneeStatus, TaskPerson } from './taskCore';

export type OfficeModule = 'pp' | 'court';

/** What the officer's phone keeps about the office side (column office_json). */
export interface OfficeMeta {
  from: string;            // "संजय (CM)"
  sentAt: string;          // ISO (task created_at)
  updatedAt: string;       // task.updated_at last applied
  note: string;            // कार्यालय की टिप्पणी
  cancelled: boolean;      // office cancelled it (tasks.closed)
  files: string[];         // task_files ids already downloaded
  status: AssigneeStatus | '';   // last status sent back
}

export function parseMeta(raw: string | null | undefined): OfficeMeta | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<OfficeMeta>;
    return {
      from: v.from ?? '', sentAt: v.sentAt ?? '', updatedAt: v.updatedAt ?? '', note: v.note ?? '',
      cancelled: !!v.cancelled, files: Array.isArray(v.files) ? v.files : [], status: (v.status ?? '') as OfficeMeta['status'],
    };
  } catch { return null; }
}

export interface RemoteTask {
  id: string;
  kind: string;
  subtype: string;
  title: string;
  received_on: string | null;
  due_on: string | null;
  created_at: string;
  updated_at: string;
  closed: boolean;
  created_by: string | null;
  fields: Record<string, unknown> | null;
  status: AssigneeStatus;       // my task_assignees row
}

export function moduleOf(kind: string): OfficeModule | null {
  return kind === 'petition' ? 'pp' : kind === 'court' ? 'court' : null;
}

const str = (f: Record<string, unknown> | null, k: string) => (f && typeof f[k] === 'string' ? (f[k] as string).trim() : '');
const people = (f: Record<string, unknown> | null, k: string): TaskPerson[] =>
  (f && Array.isArray(f[k]) ? (f[k] as Partial<TaskPerson>[]) : [])
    .filter((p) => (p.name ?? '').trim())
    .map((p) => ({ name: (p.name ?? '').trim(), relation: p.relation ?? '', father: p.father ?? '', address: p.address ?? '', mobile: p.mobile ?? '' }));

const genderOf = (rel: string) => (rel === 'पुत्र' ? 'पुरुष' : rel === 'पुत्री' || rel === 'पत्नी' ? 'महिला' : '');

/** Task → the प्रार्थना पत्र create input (InvestSuite repo shape). */
export function taskToPetition(t: RemoteTask, investigator: string) {
  const matter = str(t.fields, 'matter') || t.title;
  return {
    petition_type: t.subtype,
    date_of_receipt: t.received_on ?? t.created_at.slice(0, 10),
    deadline_date: t.due_on ?? '',
    matter,
    investigator_name: investigator,
    complainants: people(t.fields, 'applicants').map((p) => ({
      name: p.name, father_husband_name: p.father, mobile: p.mobile, alternate_mobile: '', full_address: p.address,
      village: '', police_station: '', district: '', age: '', gender: genderOf(p.relation), jati: '', relation: p.relation,
    })),
    accused: people(t.fields, 'opponents').map((p) => ({
      name: p.name, father_name: p.father, mobile: p.mobile, alternate_mobile: '', full_address: p.address,
      village: '', police_station: '', district: '', jati: '', age: '', gender: genderOf(p.relation), remarks: '', relation: p.relation,
    })),
  };
}

/** Task → the न्यायालय create input. */
export function taskToCourt(t: RemoteTask) {
  return {
    doc_type: t.subtype,
    court_name: str(t.fields, 'court_name'),
    vad_sankhya: str(t.fields, 'vad_sankhya'),
    apradh_sankhya: str(t.fields, 'apradh_sankhya'),
    applicable_sections: str(t.fields, 'applicable_sections'),
    matter: str(t.fields, 'matter'),
    document_title: str(t.fields, 'document_title'),
    deadline_date: t.due_on ?? '',
    persons: people(t.fields, 'accused').map((p) => ({
      person_type: 'accused' as const, name: p.name, father_name: p.father, mobile: p.mobile, address: p.address, remarks: '',
    })),
  };
}

export function newMeta(t: RemoteTask, from: string): OfficeMeta {
  return { from, sentAt: t.created_at, updatedAt: t.updated_at, note: str(t.fields, 'note'), cancelled: t.closed, files: [], status: '' };
}

/** The office changed the कागज़ after we last took it. */
export function officeEdited(meta: OfficeMeta, t: RemoteTask): boolean {
  return !!t.updated_at && t.updated_at > meta.updatedAt;
}

export interface LocalState { exists: boolean; deleted: boolean; done: boolean; isNew: boolean }

/** What the office should see for this officer. */
export function desiredStatus(l: LocalState): AssigneeStatus {
  if (!l.exists || l.deleted) return 'removed';
  if (l.done) return 'done';
  return l.isNew ? 'received' : 'seen';
}

export type SyncAction =
  | { type: 'create' }
  | { type: 'restore' }          // office pressed "दोबारा भेजें" after the officer removed it
  | { type: 'skip' }             // cancelled before it ever reached this phone / removed for good
  | { type: 'keep' };

/** What to do with one task on this phone. */
export function planTask(t: RemoteTask, local: { exists: boolean; deleted: boolean } | null, meta: OfficeMeta | null): SyncAction {
  if (!local?.exists) return t.closed || t.status === 'removed' ? { type: 'skip' } : { type: 'create' };
  if (local.deleted) return t.status === 'sent' && meta?.status === 'removed' && !t.closed ? { type: 'restore' } : { type: 'keep' };
  return { type: 'keep' };
}

/** Phone notification text. */
export function newPaperNotice(t: RemoteTask): { title: string; body: string } {
  const parts = [t.title];
  if (t.due_on) parts.push(`${t.kind === 'court' ? 'नियत' : 'अंतिम'} तिथि ${t.due_on.slice(8, 10)}/${t.due_on.slice(5, 7)}/${t.due_on.slice(0, 4)}`);
  return { title: '📥 कार्यालय से नया कागज़', body: parts.join(' · ') };
}

export function editedNotice(t: RemoteTask): { title: string; body: string } {
  return { title: t.closed ? '✖ कार्यालय ने कागज़ रद्द किया' : '✏️ कार्यालय ने कागज़ बदला', body: t.title };
}

export function routeFor(module: OfficeModule, id: string): string {
  return module === 'pp' ? `/(app)/prarthna-patra/${id}` : `/(app)/nyayalay/${id}`;
}

/** "16/11/2026 10:42" from an ISO time (phone's local time). */
export function showSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

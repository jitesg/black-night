/**
 * noticeRepo.ts — loads the data for the "सूचनाएँ" screen, the bell / app-icon badge
 * and the alert schedulers. Rules live in src/lib/noticeCards.ts (pure).
 */
import { getDatabase } from './database';
import { getUpcomingReminders } from './reminderRepo';
import type { CdFirRow } from '@/lib/caseDiaryGap';
import type { NkPendingRow } from '@/lib/nkChalani';
import { extractKaryvahiFacts } from '@/lib/nirodhatmak/extractKaryvahi';
import { buildNoticeCards, type CourtDocRow, type NoticeCard, type PetitionRow, type ReminderRow } from '@/lib/noticeCards';

export interface NoticeInput { firs: CdFirRow[]; courtDocs: CourtDocRow[]; petitions: PetitionRow[]; reminders: ReminderRow[]; nkPending: NkPendingRow[] }

/** Pending FIRs with the date of their latest case diary. */
export async function getPendingFirsWithLastDiary(): Promise<CdFirRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CdFirRow>(
    `SELECT f.id, f.fir_number, f.section, f.date_of_information, f.created_at,
            (SELECT MAX(d.preparation_date) FROM case_diaries d
              WHERE d.fir_id = f.id AND d.deleted_at IS NULL) AS last_diary_date
       FROM firs f
      WHERE f.deleted_at IS NULL AND f.status = 'Pending'`,
  );
}

export async function getPendingCourtDocs(): Promise<CourtDocRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CourtDocRow>(
    `SELECT id, registration_number, doc_type, sub_type, writ_type, deadline_date
       FROM nyayalay_documents WHERE deleted_at IS NULL AND status = 'Pending'`,
  );
}

export async function getPendingPetitions(): Promise<PetitionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<PetitionRow>(
    `SELECT id, registration_number, petition_type, deadline_date
       FROM prarthna_patra WHERE deleted_at IS NULL AND status = 'Pending'`,
  );
}

/** निरोधात्मक कार्यवाही whose "चलानी प्रेषित की जा चुकी है" tick is not set. */
export async function getPendingNkChalani(): Promise<NkPendingRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string; village_name: string | null; proceeding_type: string | null; proceeding_date: string | null;
    created_at: number | null; checklist_json: string | null; editor_content: string | null; report_text: string | null;
  }>(
    `SELECT id, village_name, proceeding_type, proceeding_date, created_at, checklist_json, editor_content, report_text
       FROM nirodhatmak_karyvahi WHERE deleted_at IS NULL`,
  );
  const out: NkPendingRow[] = [];
  for (const r of rows) {
    let sent = false;
    try { sent = !!(JSON.parse(r.checklist_json || '{}') as { prashit?: boolean }).prashit; } catch { /* bad json = not sent */ }
    if (sent) continue;
    const raw = (extractKaryvahiFacts(r.editor_content || r.report_text || '').village || r.village_name || '').trim();
    out.push({
      id: r.id,
      village: raw && !/^ग्राम/.test(raw) ? `ग्राम ${raw}` : raw,
      proceeding_type: r.proceeding_type, proceeding_date: r.proceeding_date, created_at: r.created_at,
    });
  }
  return out;
}

export async function loadNoticeInput(): Promise<NoticeInput> {
  const [firs, courtDocs, petitions, reminders, nkPending] = await Promise.all([
    getPendingFirsWithLastDiary().catch(() => [] as CdFirRow[]),
    getPendingCourtDocs().catch(() => [] as CourtDocRow[]),
    getPendingPetitions().catch(() => [] as PetitionRow[]),
    getUpcomingReminders().catch(() => []),
    getPendingNkChalani().catch(() => [] as NkPendingRow[]),
  ]);
  return {
    firs, courtDocs, petitions, nkPending,
    // A snoozed reminder counts from its snooze time.
    reminders: reminders.map((r) => ({
      id: r.id, title: r.title, fir_label: r.fir_label,
      due_at: r.snooze_until && r.snooze_until > r.due_at ? r.snooze_until : r.due_at,
    })),
  };
}

export async function loadNoticeCards(now: Date = new Date()): Promise<NoticeCard[]> {
  return buildNoticeCards(await loadNoticeInput(), now);
}

/**
 * noticeRepo.ts — loads the data for the "सूचनाएँ" screen, the bell / app-icon badge
 * and the alert schedulers. Rules live in src/lib/noticeCards.ts (pure).
 */
import { getDatabase } from './database';
import { getUpcomingReminders } from './reminderRepo';
import type { CdFirRow } from '@/lib/caseDiaryGap';
import { buildNoticeCards, type CourtDocRow, type NoticeCard, type PetitionRow, type ReminderRow } from '@/lib/noticeCards';

export interface NoticeInput { firs: CdFirRow[]; courtDocs: CourtDocRow[]; petitions: PetitionRow[]; reminders: ReminderRow[] }

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

export async function loadNoticeInput(): Promise<NoticeInput> {
  const [firs, courtDocs, petitions, reminders] = await Promise.all([
    getPendingFirsWithLastDiary().catch(() => [] as CdFirRow[]),
    getPendingCourtDocs().catch(() => [] as CourtDocRow[]),
    getPendingPetitions().catch(() => [] as PetitionRow[]),
    getUpcomingReminders().catch(() => []),
  ]);
  return {
    firs, courtDocs, petitions,
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

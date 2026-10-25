/**
 * noticeRepo.ts — loads the data for the "सूचनाएँ" screen and the home bell badge.
 * Rules live in src/lib/noticeCards.ts (pure).
 */
import { getDatabase } from './database';
import { getPendingFirsWithLastDiary } from '@/lib/caseDiaryGapService';
import { getUpcomingReminders } from './reminderRepo';
import { buildNoticeCards, type CourtDocRow, type NoticeCard, type PetitionRow } from '@/lib/noticeCards';

export async function loadNoticeCards(now: Date = new Date()): Promise<NoticeCard[]> {
  const db = await getDatabase();
  const [firs, courtDocs, petitions, reminders] = await Promise.all([
    getPendingFirsWithLastDiary().catch(() => []),
    db.getAllAsync<CourtDocRow>(
      `SELECT id, registration_number, doc_type, sub_type, writ_type, deadline_date
         FROM nyayalay_documents WHERE deleted_at IS NULL AND status = 'Pending'`,
    ).catch(() => [] as CourtDocRow[]),
    db.getAllAsync<PetitionRow>(
      `SELECT id, registration_number, petition_type, deadline_date
         FROM prarthna_patra WHERE deleted_at IS NULL AND status = 'Pending'`,
    ).catch(() => [] as PetitionRow[]),
    getUpcomingReminders().catch(() => []),
  ]);
  return buildNoticeCards({
    firs, courtDocs, petitions,
    // A snoozed reminder counts from its snooze time.
    reminders: reminders.map((r) => ({
      id: r.id, title: r.title, fir_label: r.fir_label,
      due_at: r.snooze_until && r.snooze_until > r.due_at ? r.snooze_until : r.due_at,
    })),
  }, now);
}

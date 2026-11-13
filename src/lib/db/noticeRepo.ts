/**
 * noticeRepo.ts — loads the data for the "सूचनाएँ" screen, the bell / app-icon badge
 * and the alert schedulers. Rules live in src/lib/noticeCards.ts (pure).
 */
import { getDatabase } from './database';
import { getUpcomingReminders } from './reminderRepo';
import type { CdFirRow } from '@/lib/caseDiaryGap';
import type { NkPendingRow } from '@/lib/nkChalani';
import type { PmBayanRow } from '@/lib/pmBayan';
import type { SceneRow } from '@/lib/sceneAlert';
import { isPmKaryvahi, isSceneKaryvahi } from '@/lib/karyvahiSubSteps';
import { extractKaryvahiFacts } from '@/lib/nirodhatmak/extractKaryvahi';
import { buildNoticeCards, type CourtDocRow, type NoticeCard, type PetitionRow, type ReminderRow } from '@/lib/noticeCards';

export interface NoticeInput { firs: CdFirRow[]; courtDocs: CourtDocRow[]; petitions: PetitionRow[]; reminders: ReminderRow[]; nkPending: NkPendingRow[]; pmBayan: PmBayanRow[]; scene: SceneRow[] }

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

/** पंचनामा व पोस्टमार्टम karyvahis of open FIRs (rules decide which are pending — pmBayan.ts). */
export async function getPmBayanRows(): Promise<PmBayanRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    firId: string; fir_number: string; name: string; step_code: string | null; sub_steps_json: string | null; last_values_json: string | null;
  }>(
    `SELECT k.fir_id AS firId, f.fir_number, k.name, k.step_code, k.sub_steps_json, k.last_values_json
       FROM fir_karyvahi k JOIN firs f ON f.id = k.fir_id
      WHERE k.deleted_at IS NULL AND f.deleted_at IS NULL AND COALESCE(f.status, 'Pending') = 'Pending'
        AND k.sub_steps_json LIKE '%"pan"%'`,
  );
  return rows.filter((r) => isPmKaryvahi(r)).map(({ firId, fir_number, sub_steps_json, last_values_json }) => ({ firId, fir_number, sub_steps_json, last_values_json }));
}

/** घटनास्थल निरीक्षण cards of open FIRs from the last 31 days (rules decide which are pending — sceneAlert.ts). */
export async function getSceneRows(): Promise<SceneRow[]> {
  const db = await getDatabase();
  const since = Math.floor(Date.now() / 1000) - 31 * 86400;
  const rows = await db.getAllAsync<{
    firId: string; fir_number: string; date_of_information: string | null; created_at: number | null;
    name: string; step_code: string | null; sub_steps_json: string | null;
  }>(
    `SELECT k.fir_id AS firId, f.fir_number, f.date_of_information, f.created_at, k.name, k.step_code, k.sub_steps_json
       FROM fir_karyvahi k JOIN firs f ON f.id = k.fir_id
      WHERE k.deleted_at IS NULL AND f.deleted_at IS NULL AND COALESCE(f.status, 'Pending') = 'Pending'
        AND (f.created_at IS NULL OR f.created_at >= ? OR f.created_at >= ? * 1000)`,
    [since, since],
  );
  const seen = new Set<string>();
  const out: SceneRow[] = [];
  for (const r of rows) {
    if (!isSceneKaryvahi(r) || seen.has(r.firId)) continue; // one card per FIR
    seen.add(r.firId);
    out.push({ firId: r.firId, fir_number: r.fir_number, date_of_information: r.date_of_information, created_at: r.created_at, sub_steps_json: r.sub_steps_json });
  }
  return out;
}

export async function loadNoticeInput(): Promise<NoticeInput> {
  const [firs, courtDocs, petitions, reminders, nkPending, pmBayan, scene] = await Promise.all([
    getPendingFirsWithLastDiary().catch(() => [] as CdFirRow[]),
    getPendingCourtDocs().catch(() => [] as CourtDocRow[]),
    getPendingPetitions().catch(() => [] as PetitionRow[]),
    getUpcomingReminders().catch(() => []),
    getPendingNkChalani().catch(() => [] as NkPendingRow[]),
    getPmBayanRows().catch(() => [] as PmBayanRow[]),
    getSceneRows().catch(() => [] as SceneRow[]),
  ]);
  return {
    firs, courtDocs, petitions, nkPending, pmBayan, scene,
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

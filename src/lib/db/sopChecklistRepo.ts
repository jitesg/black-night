/**
 * Repository for SOP Checklist persistence (Task L30).
 * Backed by table:
 * sop_checklist(id PK, sop_id, case_id NULLABLE, step_id, done INTEGER 0/1, note TEXT, updated_at)
 * Unique per (sop_id, case_id, step_id) through the id "<sop>__<case|none>__<step>" (ON CONFLICT(id)).
 */

import { getDatabase } from './database';

export interface SopChecklistEntry {
  id: string;
  sop_id: string;
  case_id: string | null;
  step_id: string;
  done: number; // 0 or 1
  note: string | null;
  updated_at: number;
}

export interface SopCaseChecklistSummary {
  sop_id: string;
  done_count: number;
  total_count: number;
  updated_at: number;
}

/**
 * Normalise case_id: empty string is treated as null ("बिना केस (सामान्य)")
 */
function normCaseId(caseId: string | null | undefined): string | null {
  if (!caseId || caseId.trim() === '' || caseId === 'none' || caseId === 'general') {
    return null;
  }
  return caseId.trim();
}

/**
 * Retrieve checklist state for a given (sop_id, case_id).
 * Returns map of step_id -> { done: boolean, note: string | null }
 */
export async function getChecklist(
  sopId: string,
  caseId: string | null | undefined
): Promise<Record<string, { done: boolean; note: string | null }>> {
  const db = await getDatabase();
  const cId = normCaseId(caseId);

  let rows: SopChecklistEntry[] = [];
  if (cId === null) {
    rows = await db.getAllAsync<SopChecklistEntry>(
      `SELECT * FROM sop_checklist WHERE sop_id = ? AND (case_id IS NULL OR case_id = '')`,
      [sopId]
    );
  } else {
    rows = await db.getAllAsync<SopChecklistEntry>(
      `SELECT * FROM sop_checklist WHERE sop_id = ? AND case_id = ?`,
      [sopId, cId]
    );
  }

  const result: Record<string, { done: boolean; note: string | null }> = {};
  for (const r of rows) {
    result[r.step_id] = {
      done: r.done === 1,
      note: r.note || null,
    };
  }
  return result;
}

/**
 * Set a single step done/undone for (sop_id, case_id).
 */
export async function setStepDone(
  sopId: string,
  caseId: string | null | undefined,
  stepId: string,
  done: boolean
): Promise<void> {
  const db = await getDatabase();
  const cId = normCaseId(caseId);
  const now = Date.now();
  const doneVal = done ? 1 : 0;
  const id = `${sopId}__${cId || 'none'}__${stepId}`;

  await db.runAsync(
    `INSERT INTO sop_checklist (id, sop_id, case_id, step_id, done, note, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?)
     ON CONFLICT(id)
     DO UPDATE SET done = excluded.done, updated_at = excluded.updated_at`,
    [id, sopId, cId, stepId, doneVal, now]
  );
}

/**
 * Set or update a short note for a step.
 */
export async function setStepNote(
  sopId: string,
  caseId: string | null | undefined,
  stepId: string,
  note: string | null
): Promise<void> {
  const db = await getDatabase();
  const cId = normCaseId(caseId);
  const now = Date.now();
  const cleanNote = note && note.trim().length > 0 ? note.trim() : null;
  const id = `${sopId}__${cId || 'none'}__${stepId}`;

  await db.runAsync(
    `INSERT INTO sop_checklist (id, sop_id, case_id, step_id, done, note, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(id)
     DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at`,
    [id, sopId, cId, stepId, cleanNote, now]
  );
}

/**
 * Reset all steps and notes for a (sop_id, case_id) pair.
 */
export async function resetChecklist(
  sopId: string,
  caseId: string | null | undefined
): Promise<void> {
  const db = await getDatabase();
  const cId = normCaseId(caseId);

  if (cId === null) {
    await db.runAsync(
      `DELETE FROM sop_checklist WHERE sop_id = ? AND (case_id IS NULL OR case_id = '')`,
      [sopId]
    );
  } else {
    await db.runAsync(
      `DELETE FROM sop_checklist WHERE sop_id = ? AND case_id = ?`,
      [sopId, cId]
    );
  }
}

/**
 * Get all SOP checklists started for a specific case, with done count and total steps count.
 */
export async function getCaseChecklists(
  caseId: string
): Promise<Array<{ sop_id: string; done_count: number; updated_at: number }>> {
  const cId = normCaseId(caseId);
  if (!cId) return [];

  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    sop_id: string;
    done_count: number;
    updated_at: number;
  }>(
    `SELECT sop_id,
            SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) as done_count,
            MAX(updated_at) as updated_at
     FROM sop_checklist
     WHERE case_id = ?
     GROUP BY sop_id
     ORDER BY updated_at DESC`,
    [cId]
  );

  return rows || [];
}

/**
 * Ticked steps per SOP — the best of its general checklist and each case's (owner, ज्ञानकोष new layout part 5: "जारी हैं").
 * Returns sop_id → done count; any error → empty map (the list just shows no "जारी हैं" block).
 */
export async function getSopDoneCounts(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ sop_id: string; d: number }>(
      `SELECT sop_id, COALESCE(case_id, '') AS c, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS d
         FROM sop_checklist GROUP BY sop_id, COALESCE(case_id, '')`,
    );
    for (const r of rows) out.set(r.sop_id, Math.max(out.get(r.sop_id) ?? 0, Number(r.d) || 0));
  } catch { /* table missing / read error — no progress shown */ }
  return out;
}

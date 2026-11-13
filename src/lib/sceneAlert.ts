/**
 * sceneAlert.ts — pure rules for "घटनास्थल की कार्यवाही लंबित" (owner).
 *
 * The "घटनास्थल निरीक्षण" card is complete when its two required parts are done — ई-साक्ष्य से फोटो-वीडियोग्राफी and
 * नक्शा नजरी (written by the case diary format "निरीक्षण घटना स्थल"). From day 3 after the FIR date it shows a card in
 * सूचनाएँ (bell count) and ONE summary phone alert at 9 AM every day until done. FIRs older than 30 days are left out
 * (old cases whose scene work was done on paper must not flood the bell).
 *
 * No React Native imports — tests: node --experimental-strip-types --test scripts/test_scene_alert.ts
 */
import { CD_ALERT_HOUR, CD_DAYS_AHEAD, daysBetween, fmtDate, parseLocalDate } from './caseDiaryGap';
import { SCENE_DEF, parseSubSteps, remainingText, subStepProgress } from './karyvahiSubSteps';

export const SCENE_ALERT_AFTER_DAYS = 3;
/** red card from this day */
export const SCENE_OVER_DAYS = 7;
/** FIRs older than this are not alerted */
export const SCENE_MAX_AGE_DAYS = 30;

export interface SceneRow {
  firId: string;
  fir_number: string;
  date_of_information?: string | null;
  created_at?: number | null;
  sub_steps_json?: string | null;
}

export interface ScenePending {
  row: SceneRow;
  base: Date;
  done: number;
  total: number;
  remaining: string; // "बाकी: ई-साक्ष्य से फोटो-वीडियोग्राफी, नक्शा नजरी"
}

export interface SceneAlert { at: Date; title: string; body: string; route: string }

function firDate(r: SceneRow): Date | null {
  const d = parseLocalDate(r.date_of_information);
  if (d) return d;
  if (r.created_at) {
    const x = new Date(r.created_at < 10000000000 ? r.created_at * 1000 : r.created_at);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
  }
  return null;
}

/** Required parts not all done → FIR date + progress; else null. */
export function scenePending(r: SceneRow): ScenePending | null {
  const map = parseSubSteps(r.sub_steps_json, SCENE_DEF);
  const p = subStepProgress(map, SCENE_DEF);
  if (p.complete) return null;
  const base = firDate(r);
  if (!base) return null;
  return { row: r, base, done: p.done, total: p.total, remaining: remainingText(map, SCENE_DEF) };
}

export function sceneRoute(firId: string): string {
  return `/(app)/mukadma/${firId}/karyvahi`;
}

/** Due on `day`: day 3 … day 30 after the FIR. */
export function sceneDue(rows: SceneRow[], day: Date): ScenePending[] {
  const out: ScenePending[] = [];
  for (const r of rows) {
    const p = scenePending(r);
    if (!p) continue;
    const days = daysBetween(p.base, day);
    if (days >= SCENE_ALERT_AFTER_DAYS && days <= SCENE_MAX_AGE_DAYS) out.push(p);
  }
  return out;
}

/** Phone text (मु0अ0सं0 only — no names on the lock screen). */
export function sceneAlertText(due: ScenePending[], day: Date): { title: string; body: string; route: string } {
  if (due.length === 1) {
    const p = due[0];
    const days = daysBetween(p.base, day);
    return {
      title: `घटनास्थल की कार्यवाही लंबित — मु0अ0सं0 ${p.row.fir_number}`,
      body: `मुकदमा (${fmtDate(p.base)}) को ${days} दिन हो गये, घटनास्थल निरीक्षण की केस डायरी अभी पूरी नहीं। ${p.remaining}`,
      route: sceneRoute(p.row.firId),
    };
  }
  const nums = due.slice(0, 3).map((p) => p.row.fir_number).join(', ');
  return {
    title: `घटनास्थल की कार्यवाही लंबित (${due.length})`,
    body: `${due.length} मुकदमों में ई-साक्ष्य / नक्शा नजरी अभी केस डायरी में नहीं लिखे गये — मु0अ0सं0 ${nums}${due.length > 3 ? ' …' : ''}`,
    route: '/(app)/notifications',
  };
}

/** One summary alert at 9 AM for each of the next days. */
export function planSceneAlerts(rows: SceneRow[], now: Date = new Date()): SceneAlert[] {
  const out: SceneAlert[] = [];
  let first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CD_ALERT_HOUR);
  if (first.getTime() <= now.getTime()) first = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 1, CD_ALERT_HOUR);
  for (let i = 0; i < CD_DAYS_AHEAD; i++) {
    const at = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, CD_ALERT_HOUR);
    const due = sceneDue(rows, at);
    if (due.length) out.push({ at, ...sceneAlertText(due, at) });
  }
  return out;
}

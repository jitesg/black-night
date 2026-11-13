/**
 * pmBayan.ts — pure rules for "पंचनामा के बयान लंबित" (owner, चरण 6).
 *
 * A "मृतक का पंचनामा व पोस्टमार्टम" karyvahi whose अवलोकन पंचायतनामा is done but not all 6 parts:
 * from day 7 after the पंचायतनामा date it shows a card in सूचनाएँ (bell count) and ONE summary phone alert
 * at 9 AM every day until 6/6. Base date = PanDate typed in the format (dd.mm.yyyy), else the day the
 * पंचायतनामा part was ticked.
 *
 * No React Native imports — tests: node --experimental-strip-types --test scripts/test_pm_bayan.ts
 */
import { CD_ALERT_HOUR, CD_DAYS_AHEAD, daysBetween, fmtDate, parseLocalDate } from './caseDiaryGap';
import { parseSubSteps, remainingText, subStepProgress } from './karyvahiSubSteps';

export const PM_BAYAN_AFTER_DAYS = 7;
/** after this many days the card turns red */
export const PM_BAYAN_OVER_DAYS = 15;

export interface PmBayanRow {
  firId: string;
  fir_number: string;
  sub_steps_json?: string | null;
  last_values_json?: string | null;
}

export interface PmBayanPending {
  row: PmBayanRow;
  base: Date;
  done: number;
  total: number;
  remaining: string; // "बाकी: बयान आरक्षी, …"
}

export interface PmBayanAlert { at: Date; title: string; body: string; route: string }

function dayOf(ms: number): Date {
  const x = new Date(ms < 10000000000 ? ms * 1000 : ms);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

/** पंचायतनामा done but not 6/6 → base date + progress; else null. */
export function pmBayanPending(r: PmBayanRow): PmBayanPending | null {
  const map = parseSubSteps(r.sub_steps_json);
  const pan = map.pan;
  if (!pan?.done || pan.by === 'old') return null;
  const p = subStepProgress(map);
  if (p.complete) return null;
  let base: Date | null = null;
  try {
    const v = JSON.parse(r.last_values_json || '{}') as Record<string, string>;
    base = parseLocalDate(v?.PanDate);
  } catch { /* no values */ }
  if (!base && pan.at) base = dayOf(pan.at);
  if (!base) return null;
  return { row: r, base, done: p.done, total: p.total, remaining: remainingText(map) };
}

export function pmBayanRoute(firId: string): string {
  return `/(app)/mukadma/${firId}/karyvahi`;
}

/** Due on `day`: day 7 or later after the पंचायतनामा. */
export function pmBayanDue(rows: PmBayanRow[], day: Date): PmBayanPending[] {
  const out: PmBayanPending[] = [];
  for (const r of rows) {
    const p = pmBayanPending(r);
    if (p && daysBetween(p.base, day) >= PM_BAYAN_AFTER_DAYS) out.push(p);
  }
  return out;
}

/** Phone text for one or many FIRs (मु0अ0सं0 only — no names on the lock screen). */
export function pmBayanAlertText(due: PmBayanPending[], day: Date): { title: string; body: string; route: string } {
  if (due.length === 1) {
    const p = due[0];
    const days = daysBetween(p.base, day);
    return {
      title: `पंचनामा के बयान लंबित — मु0अ0सं0 ${p.row.fir_number}`,
      body: `पंचायतनामा (${fmtDate(p.base)}) को ${days} दिन हो गये, अभी ${p.done}/${p.total} पूरे। ${p.remaining}`,
      route: pmBayanRoute(p.row.firId),
    };
  }
  const nums = due.slice(0, 3).map((p) => p.row.fir_number).join(', ');
  return {
    title: `पंचनामा के बयान लंबित (${due.length})`,
    body: `${due.length} मुकदमों में पंचायतनामा के 7 दिन बाद भी बयान बाकी हैं — मु0अ0सं0 ${nums}${due.length > 3 ? ' …' : ''}`,
    route: '/(app)/notifications',
  };
}

/** One summary alert at 9 AM for each of the next days. */
export function planPmBayanAlerts(rows: PmBayanRow[], now: Date = new Date()): PmBayanAlert[] {
  const out: PmBayanAlert[] = [];
  let first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CD_ALERT_HOUR);
  if (first.getTime() <= now.getTime()) first = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 1, CD_ALERT_HOUR);
  for (let i = 0; i < CD_DAYS_AHEAD; i++) {
    const at = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, CD_ALERT_HOUR);
    const due = pmBayanDue(rows, at);
    if (due.length) out.push({ at, ...pmBayanAlertText(due, at) });
  }
  return out;
}

/**
 * nkChalani.ts — pure rules for "चलानी प्रेषण लंबित" (निरोधात्मक कार्यवाही).
 *
 * A karyvahi is pending until its checklist tick "चलानी प्रेषित की जा चुकी है"
 * is set. Pending ones show a card in सूचनाएँ (counts on the bell) and, from the
 * day after the karyvahi date, ONE summary notification at 9 AM every day.
 *
 * No React Native imports — tests: node --experimental-strip-types --test scripts/test_nk_chalani.ts
 */
import { CD_ALERT_HOUR, CD_DAYS_AHEAD, daysBetween, fmtDate, parseLocalDate } from './caseDiaryGap';

export interface NkPendingRow {
  id: string;
  village: string;          // "ग्राम …" or ''
  proceeding_type?: string | null;
  proceeding_date?: string | null;
  created_at?: number | null;
}

export interface NkAlert { at: Date; title: string; body: string }

/** Date of the karyvahi: proceeding_date, else created_at (seconds or ms). */
export function nkDate(r: NkPendingRow): Date | null {
  const d = parseLocalDate(r.proceeding_date);
  if (d) return d;
  if (r.created_at) {
    const ms = r.created_at < 10000000000 ? r.created_at * 1000 : r.created_at;
    const x = new Date(ms);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
  }
  return null;
}

export function nkPlace(r: NkPendingRow): string {
  return r.village?.trim() || 'निरोधात्मक कार्यवाही';
}

/** Text for one or many pending karyvahis (village only — no names on the lock screen). */
export function nkAlertText(rows: NkPendingRow[]): { title: string; body: string } {
  if (rows.length === 1) {
    const r = rows[0];
    const d = nkDate(r);
    return {
      title: `चलानी प्रेषण लंबित — ${nkPlace(r)}`,
      body: `${nkPlace(r)} की निरोधात्मक कार्यवाही${d ? ` (दिनांक ${fmtDate(d)})` : ''} की चलानी अभी मजिस्ट्रेट को प्रेषित नहीं की गई है।`,
    };
  }
  const places = rows.slice(0, 3).map(nkPlace).join(', ');
  return {
    title: `चलानी प्रेषण लंबित (${rows.length})`,
    body: `${rows.length} निरोधात्मक कार्यवाहियों की चलानी अभी मजिस्ट्रेट को प्रेषित नहीं की गई — ${places}${rows.length > 3 ? ' …' : ''}`,
  };
}

/**
 * One summary alert at 9 AM for each of the next days, counting the karyvahis
 * dated before that day (so a karyvahi made today first alerts tomorrow).
 */
export function planNkAlerts(rows: NkPendingRow[], now: Date = new Date()): NkAlert[] {
  const out: NkAlert[] = [];
  let first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CD_ALERT_HOUR);
  if (first.getTime() <= now.getTime()) first = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 1, CD_ALERT_HOUR);
  for (let i = 0; i < CD_DAYS_AHEAD; i++) {
    const at = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, CD_ALERT_HOUR);
    const due = rows.filter((r) => { const d = nkDate(r); return !d || daysBetween(d, at) >= 1; });
    if (due.length) out.push({ at, ...nkAlertText(due) });
  }
  return out;
}

/** Days since the karyvahi (for the card label). */
export function nkPendingDays(r: NkPendingRow, now: Date = new Date()): number {
  const d = nkDate(r);
  return d ? Math.max(0, daysBetween(d, now)) : 0;
}

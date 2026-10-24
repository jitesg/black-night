/**
 * caseDiaryGap.ts — pure rules for the "केस डायरी (पर्चा) लंबित" alert.
 *
 * Two case diaries should not be more than 15 days apart, so the officer is warned
 * from day 7 after the last diary (or after the FIR date when no diary exists yet):
 * one notification at 9 AM every day until the next diary is written.
 *
 * No React Native imports — tested with
 *   node --experimental-strip-types --test scripts/test_case_diary_gap.ts
 */

export const CD_ALERT_AFTER_DAYS = 7;   // first alert on day 7
export const CD_MAX_GAP_DAYS = 15;      // gap that should never be crossed
export const CD_ALERT_HOUR = 9;         // 9 AM
export const CD_DAYS_AHEAD = 5;         // daily alerts scheduled ahead per FIR (refreshed on app open)
export const CD_MAX_TOTAL = 60;         // stay well under Android's limit of scheduled alarms

export interface CdFirRow {
  id: string;
  fir_number: string;
  section?: string | null;
  date_of_information?: string | null;
  created_at?: number | null;          // seconds (or ms) — fallback FIR date
  last_diary_date?: string | null;     // latest case_diaries.preparation_date
}

export interface CdAlert {
  firId: string;
  at: Date;
  title: string;
  body: string;
  days: number;
}

/** "2026-10-24", "2026-10-24T…", "24.10.2026", "24/10/2026", "24-10-2026" → local midnight. */
export function parseLocalDate(s?: string | null): Date | null {
  const t = String(s ?? '').trim();
  if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(t);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days from `from` to `to` (DST-safe). */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

export function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** Date the gap is counted from: last diary, else FIR information date, else FIR created_at. */
export function gapBase(f: CdFirRow): { date: Date; hasDiary: boolean } | null {
  const last = parseLocalDate(f.last_diary_date);
  if (last) return { date: last, hasDiary: true };
  const info = parseLocalDate(f.date_of_information);
  if (info) return { date: info, hasDiary: false };
  if (f.created_at) {
    const ms = f.created_at < 10000000000 ? f.created_at * 1000 : f.created_at;
    return { date: startOfDay(new Date(ms)), hasDiary: false };
  }
  return null;
}

/** Days since the last diary today (null when the FIR has no usable date). */
export function cdGapDays(f: CdFirRow, now: Date = new Date()): number | null {
  const b = gapBase(f);
  return b ? daysBetween(b.date, now) : null;
}

/** Notification text. No names — only the FIR number (lock-screen privacy rule). */
export function cdAlertText(f: CdFirRow, base: { date: Date; hasDiary: boolean }, days: number): { title: string; body: string } {
  const fir = `मु0अ0सं0 ${f.fir_number}`;
  const over = days > CD_MAX_GAP_DAYS;
  const title = over
    ? `⚠ केस डायरी ${days} दिन से लंबित — ${fir}`
    : `केस डायरी लंबित (${days} दिन) — ${fir}`;
  const first = base.hasDiary
    ? `मुकदमे में आखिरी केस डायरी दिनांक ${fmtDate(base.date)} को कटी है, अगला पर्चा अभी तक नहीं काटा गया है।`
    : `मुकदमे में दिनांक ${fmtDate(base.date)} से अभी तक कोई केस डायरी (पर्चा) नहीं काटी गई है।`;
  const limit = over ? ` दो पर्चों के बीच ${CD_MAX_GAP_DAYS} दिन की सीमा पार हो चुकी है।` : '';
  return { title, body: `${first}${limit} जांच से बचने के लिए नियमित तौर पर पर्चा काटकर भेजते रहें।` };
}

/**
 * Alerts to schedule now: for each pending FIR, 9 AM on every day from day 7
 * (or the next 9 AM that is still ahead) for CD_DAYS_AHEAD days. Earliest first,
 * capped at CD_MAX_TOTAL.
 */
export function planCdAlerts(firs: CdFirRow[], now: Date = new Date()): CdAlert[] {
  const out: CdAlert[] = [];
  for (const f of firs) {
    const base = gapBase(f);
    if (!base) continue;
    const due = new Date(base.date.getFullYear(), base.date.getMonth(), base.date.getDate() + CD_ALERT_AFTER_DAYS, CD_ALERT_HOUR);
    let first = due;
    if (first.getTime() <= now.getTime()) {
      first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CD_ALERT_HOUR);
      if (first.getTime() <= now.getTime()) first = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 1, CD_ALERT_HOUR);
    }
    for (let i = 0; i < CD_DAYS_AHEAD; i++) {
      const at = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, CD_ALERT_HOUR);
      const days = daysBetween(base.date, at);
      out.push({ firId: f.id, at, days, ...cdAlertText(f, base, days) });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, CD_MAX_TOTAL);
}

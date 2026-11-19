/**
 * Home "मेरी उत्पादकता" (owner, design P1): only मुकदमा, न्यायालय, प्रार्थना पत्र — per period (इस हफ़्ते / इस महीने):
 *   got  = मिले / दर्ज in the period    (मुकदमा + न्यायालय: created_at; प्रार्थना पत्र: date_of_receipt)
 *   done = निस्तारित / ख़त्म in the period (प्रार्थना पत्र: disposal_date; मुकदमा + न्यायालय: finished_at — written by a DB trigger
 *          when the status turns Finished; older rows without it fall back to updated_at)
 * Productivity % = done / got of the three together (0 when nothing came in). Pure — tests scripts/test_productivity.ts.
 */

export interface ProdRow { got: number; done: number }
export interface ProdPeriod { fir: ProdRow; court: ProdRow; pp: ProdRow; got: number; done: number; pct: number }
export interface ProdStats { week: ProdPeriod; month: ProdPeriod }

export interface FirLike { created_at: number; status: string; finished_at?: number | null; updated_at?: number | null }
export interface CourtLike { created_at: number; status: string; finished_at?: number | null; updated_at?: number | null }
export interface PPLike { date_of_receipt?: string | null; created_at: number; status: string; disposal_date?: string | null; updated_at?: number | null }

/** Local midnight (unix seconds) of a YYYY-MM-DD string; null when not a date. */
export function dayStart(ymd: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  if (!m) return null;
  return Math.floor(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() / 1000);
}

const isDone = (s: string) => s === 'Finished' || s === 'Nistarit';
const pctOf = (done: number, got: number) => (got > 0 ? Math.min(100, Math.round((done / got) * 100)) : 0);

function period(from: number, firs: readonly FirLike[], courts: readonly CourtLike[], pps: readonly PPLike[]): ProdPeriod {
  const finishedTime = (r: { finished_at?: number | null; updated_at?: number | null }) => r.finished_at ?? r.updated_at ?? 0;
  const fir = {
    got: firs.filter((f) => f.created_at >= from).length,
    done: firs.filter((f) => isDone(f.status) && finishedTime(f) >= from).length,
  };
  const court = {
    got: courts.filter((c) => c.created_at >= from).length,
    done: courts.filter((c) => isDone(c.status) && finishedTime(c) >= from).length,
  };
  const pp = {
    got: pps.filter((p) => (dayStart(p.date_of_receipt) ?? p.created_at) >= from).length,
    done: pps.filter((p) => isDone(p.status) && (dayStart(p.disposal_date) ?? p.updated_at ?? 0) >= from).length,
  };
  const got = fir.got + court.got + pp.got;
  const done = fir.done + court.done + pp.done;
  return { fir, court, pp, got, done, pct: pctOf(done, got) };
}

/** `weekStart` / `monthStart` = unix seconds of the period starts (Monday 00:00 / the 1st 00:00). */
export function computeProductivity(
  firs: readonly FirLike[], courts: readonly CourtLike[], pps: readonly PPLike[], weekStart: number, monthStart: number,
): ProdStats {
  return { week: period(weekStart, firs, courts, pps), month: period(monthStart, firs, courts, pps) };
}

/** One row's % (for its ring): done / got, 0 when nothing came in. */
export function rowPct(r: ProdRow): number { return pctOf(r.done, r.got); }

/**
 * निरोधात्मक list filters (design C sheet): प्रकार, तारीख (आज / इस हफ़्ते / इस महीने / से – तक), स्थिति (चलानी लंबित /
 * चेकलिस्ट अधूरी / पूरी). Pure — tests: scripts/test_nk_filter.ts
 */
export interface NkFilterRow {
  proceeding_type?: string | null;
  proceeding_date?: string | null;
  created_at?: number | null;
  checklist_json?: string | null;
}
export interface NkFilterValues {
  type?: string | null; date?: string | null; status?: string | null;
  /** date 'range': YYYY-MM-DD; only से = that day up to today, only तक = everything up to that day. */
  from?: string | null; to?: string | null;
}
function ymd(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function rowDate(r: NkFilterRow): Date | null {
  const raw = (r.proceeding_date ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(raw);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  if (r.created_at) {
    const x = new Date(r.created_at < 10000000000 ? r.created_at * 1000 : r.created_at);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
  }
  return null;
}

function ticks(json: string | null | undefined): { prashit: boolean; all: boolean } {
  let v: Record<string, unknown> = {};
  try { const p = JSON.parse(json || '{}'); if (p && typeof p === 'object') v = p as Record<string, unknown>; } catch { /* none */ }
  return { prashit: !!v.prashit, all: !!v.prashit && !!v.notice && !!v.tamil };
}

export function nkMatchesFilters(r: NkFilterRow, f: NkFilterValues, now: Date = new Date()): boolean {
  if (f.type && r.proceeding_type !== f.type) return false;
  if (f.date) {
    const d = rowDate(r);
    if (!d) return false;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (f.date === 'today' && d.getTime() !== today.getTime()) return false;
    if (f.date === 'week') {
      const from = new Date(today); from.setDate(from.getDate() - 6);
      if (d < from || d > today) return false;
    }
    if (f.date === 'month' && (d.getFullYear() !== today.getFullYear() || d.getMonth() !== today.getMonth())) return false;
    if (f.date === 'range') {
      let from = ymd(f.from); let to = ymd(f.to);
      if (from && to && from > to) [from, to] = [to, from];
      if (from && !to) to = today;
      if (from && d < from) return false;
      if (to && d > to) return false;
    }
  }
  if (f.status) {
    const t = ticks(r.checklist_json);
    if (f.status === 'pending' && t.prashit) return false;
    if (f.status === 'incomplete' && t.all) return false;
    if (f.status === 'done' && !t.all) return false;
  }
  return true;
}

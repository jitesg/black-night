/**
 * ज्ञानकोष new layout part 8 (owner): परिपत्र grouped by month (newest first, date from the seed's last_updated = the circular's date;
 * user rows without one → their created date), पुलिस प्रारूप grouped by उप-श्रेणी. Pure — tests scripts/test_knowledge_visits.ts.
 */
const MONTHS_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितम्बर', 'अक्टूबर', 'नवम्बर', 'दिसम्बर'];
const MONTHS_SHORT = ['जन0', 'फ़र0', 'मार्च', 'अप्रै0', 'मई', 'जून', 'जुला0', 'अग0', 'सित0', 'अक्टू0', 'नव0', 'दिस0'];

export interface DatedEntry { last_updated?: string | null; created_at?: number | null }

/** The circular's date as {y, m (0-11), d}; null when unknown. */
export function circularDate(e: DatedEntry): { y: number; m: number; d: number } | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(e.last_updated ?? ''));
  if (iso) return { y: +iso[1], m: +iso[2] - 1, d: +iso[3] };
  const ts = Number(e.created_at);
  if (Number.isFinite(ts) && ts > 0) {
    const dt = new Date(ts < 1e12 ? ts * 1000 : ts);
    return { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() };
  }
  return null;
}

export const monthLabel = (y: number, m: number) => `${MONTHS_HI[m] ?? ''} ${y}`;
export const shortMonth = (m: number) => MONTHS_SHORT[m] ?? '';

/** "नया" = dated within the last `days` days (default 7). */
export function isRecent(e: DatedEntry, now = Date.now(), days = 7): boolean {
  const d = circularDate(e);
  if (!d) return false;
  const t = new Date(d.y, d.m, d.d).getTime();
  return t <= now && now - t <= days * 86400000;
}

export type GroupRow<T> = { kind: 'head'; key: string; label: string; count: number } | { kind: 'item'; key: string; item: T };

/** Items with a header row before each group, in the given group order. */
export function withGroupHeads<T extends { id: string }>(items: readonly T[], groupOf: (i: T) => { key: string; label: string }): GroupRow<T>[] {
  const order: string[] = [];
  const map = new Map<string, { label: string; items: T[] }>();
  for (const it of items) {
    const g = groupOf(it);
    if (!map.has(g.key)) { map.set(g.key, { label: g.label, items: [] }); order.push(g.key); }
    map.get(g.key)!.items.push(it);
  }
  const out: GroupRow<T>[] = [];
  for (const k of order) {
    const g = map.get(k)!;
    out.push({ kind: 'head', key: `h-${k}`, label: g.label, count: g.items.length });
    for (const it of g.items) out.push({ kind: 'item', key: it.id, item: it });
  }
  return out;
}

/** परिपत्र newest first, grouped by month ("तारीख नहीं" last). */
export function circularRows<T extends { id: string } & DatedEntry>(items: readonly T[]): GroupRow<T>[] {
  const keyOf = (e: T) => { const d = circularDate(e); return d ? d.y * 10000 + d.m * 100 + d.d : -1; };
  const sorted = [...items].sort((a, b) => keyOf(b) - keyOf(a));
  return withGroupHeads(sorted, (e) => {
    const d = circularDate(e);
    return d ? { key: `${d.y}-${d.m}`, label: monthLabel(d.y, d.m) } : { key: 'none', label: 'तारीख नहीं' };
  });
}

/**
 * ज्ञानकोष "🕘 हाल में देखा" + "⭐ सहेजे गए" (owner, new layouts — part 1). Pure list rules; storage in knowledgeVisits.ts.
 * An item = one screen of the module (धारा, SOP, निर्णय, फर्द …) identified by its route. Tests scripts/test_knowledge_visits.ts.
 */
export interface KnowledgeVisit {
  /** expo-router path that opens it again, e.g. "/(app)/knowledge/law/BNS/103" */
  route: string;
  /** short chip / row text, e.g. "BNS 103" */
  label: string;
  /** longer title, e.g. "हत्या के लिए दंड" ('' when none) */
  title: string;
  /** colour of its module tile / Act */
  color: string;
  /** ms */
  at: number;
}

export const RECENT_MAX = 12;
export const SAVED_MAX = 100;

function clean(v: unknown): KnowledgeVisit | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.route !== 'string' || !o.route.startsWith('/') || typeof o.label !== 'string' || !o.label.trim()) return null;
  return {
    route: o.route,
    label: o.label.trim().slice(0, 60),
    title: typeof o.title === 'string' ? o.title.trim().slice(0, 120) : '',
    color: typeof o.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(o.color) ? o.color : '#0F766E',
    at: typeof o.at === 'number' && Number.isFinite(o.at) ? o.at : 0,
  };
}

/** A stored JSON string → valid items only (bad / old data never breaks the screen). */
export function parseVisits(raw: string | null | undefined): KnowledgeVisit[] {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v.map(clean).filter((x): x is KnowledgeVisit => !!x) : [];
  } catch { return []; }
}

/** Newest first, one entry per route, at most `max`. */
export function addVisit(list: readonly KnowledgeVisit[], item: KnowledgeVisit, max = RECENT_MAX): KnowledgeVisit[] {
  const c = clean(item);
  if (!c) return list.slice(0, max);
  return [c, ...list.filter((x) => x.route !== c.route)].slice(0, max);
}

export function isSaved(list: readonly KnowledgeVisit[], route: string): boolean {
  return list.some((x) => x.route === route);
}

/** ⭐ tap: saved → removed, else added on top. */
export function toggleSaved(list: readonly KnowledgeVisit[], item: KnowledgeVisit): KnowledgeVisit[] {
  return isSaved(list, item.route) ? list.filter((x) => x.route !== item.route) : addVisit(list, item, SAVED_MAX);
}

/** SOPs whose checklist is started but not finished, most done first (ज्ञानकोष new layout part 5 "जारी हैं"). */
export function sopsInProgress<T extends { id: string }>(
  items: readonly T[], stepsOf: (item: T) => { sopId: string; total: number } | null, done: ReadonlyMap<string, number>,
): { item: T; done: number; total: number }[] {
  const out: { item: T; done: number; total: number }[] = [];
  for (const it of items) {
    const s = stepsOf(it);
    if (!s || s.total <= 0) continue;
    const d = Math.min(done.get(s.sopId) ?? 0, s.total);
    if (d > 0 && d < s.total) out.push({ item: it, done: d, total: s.total });
  }
  return out.sort((a, b) => b.done / b.total - a.done / a.total);
}

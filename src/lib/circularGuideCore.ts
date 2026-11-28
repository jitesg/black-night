/**
 * परिपत्र गाइड — the base layout for every DGP परिपत्र (owner: 70/2013 sample approved as the base — theme + structure).
 * One JSON per परिपत्र in assets/circular-guides/<entry id>.json (registry circularGuide.ts); the screen is
 * components/knowledge/CircularGuideView.tsx. Pure rules here — tests scripts/test_circular_guide.ts.
 *
 * Sections (each optional, shown only when present, the top buttons follow): 1 विवरण (details k/v + आज की धाराएँ from `laws`),
 * 2 समस्या (problem), 3 निर्देश (directions.points, "see" → related परिपत्र tag), related परिपत्र (red box), 4 DGP (dgp),
 * 5 वाद (case.lines + orders tabs), चेकलिस्ट (checklist.items, one may be `optional` = counted only when its switch is on).
 * Text may hold **bold**.
 */
export interface GuideKV { k: string; v: string; accent?: boolean }
/** `h` = a sub-heading shown above this point (2012 परिपत्र: उद्देश्य, समय-सीमाएँ, लागू शर्तें … inside निर्देश) */
export interface GuidePoint { h?: string; t?: string; b: string; see?: string }
export interface GuideRelated { id: string; title: string; text: string }
export interface GuideOrder { tab: string; points: string[] }
export interface GuideCheckItem { t: string; s?: string; optional?: boolean }
export interface CircularGuide {
  v: number;
  short: string;
  kicker?: string;
  details?: GuideKV[];
  laws?: string[];
  problem?: string;
  /** heading of the problem box (default "मुख्य समस्या") and its top-button word (default "समस्या") — converted परिपत्र use "सार" */
  problemTitle?: string;
  problemNav?: string;
  directions?: { title?: string; intro?: string; points: GuidePoint[] };
  related?: GuideRelated[];
  dgp?: string;
  /** संदर्भित वाद / पृष्ठभूमि: k/v lines, plain bullet points and / or order tabs; `nav` = its top-button word (default "वाद") */
  case?: { title?: string; nav?: string; intro?: string; lines?: GuideKV[]; points?: string[]; orders?: GuideOrder[] };
  checklist?: {
    title?: string; intro?: string; items: GuideCheckItem[]; optionalLabel?: string; optionalHint?: string;
    doneText?: string; pendingText?: string; footer?: string;
  };
  foot?: string;
}

const str = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');
const kvList = (x: unknown): GuideKV[] => (Array.isArray(x) ? x : [])
  .map((r) => ({ k: str(r?.k), v: str(r?.v), ...(r?.accent ? { accent: true } : {}) }))
  .filter((r) => r.k && r.v);

/** A guide JSON → a clean guide (bad parts dropped); null when it has no title or no section at all. */
export function parseGuide(raw: unknown): CircularGuide | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  const short = str(r.short);
  if (!short) return null;
  const g: CircularGuide = { v: Number(r.v) || 1, short };
  if (str(r.kicker)) g.kicker = str(r.kicker);
  const details = kvList(r.details); if (details.length) g.details = details;
  const laws = (Array.isArray(r.laws) ? r.laws : []).map(str).filter(Boolean); if (laws.length) g.laws = laws;
  if (str(r.problem)) g.problem = str(r.problem);
  if (str(r.problemTitle)) g.problemTitle = str(r.problemTitle);
  if (str(r.problemNav)) g.problemNav = str(r.problemNav);
  const points = (Array.isArray(r.directions?.points) ? r.directions.points : [])
    .map((p: any) => ({ ...(str(p?.h) ? { h: str(p.h) } : {}), ...(str(p?.t) ? { t: str(p.t) } : {}), b: str(p?.b), ...(str(p?.see) ? { see: str(p.see) } : {}) }))
    .filter((p: GuidePoint) => p.b);
  if (points.length) g.directions = { ...(str(r.directions?.title) ? { title: str(r.directions.title) } : {}), ...(str(r.directions?.intro) ? { intro: str(r.directions.intro) } : {}), points };
  const related = (Array.isArray(r.related) ? r.related : []).map((x: any) => ({ id: str(x?.id), title: str(x?.title), text: str(x?.text) }))
    .filter((x: GuideRelated) => x.id && x.title);
  if (related.length) g.related = related;
  if (str(r.dgp)) g.dgp = str(r.dgp);
  if (r.case && typeof r.case === 'object') {
    const lines = kvList(r.case.lines);
    const orders = (Array.isArray(r.case.orders) ? r.case.orders : [])
      .map((o: any) => ({ tab: str(o?.tab), points: (Array.isArray(o?.points) ? o.points : []).map(str).filter(Boolean) }))
      .filter((o: GuideOrder) => o.tab && o.points.length);
    const cpoints = (Array.isArray(r.case.points) ? r.case.points : []).map(str).filter(Boolean);
    if (lines.length || orders.length || cpoints.length) {
      g.case = { ...(str(r.case.title) ? { title: str(r.case.title) } : {}), ...(str(r.case.nav) ? { nav: str(r.case.nav) } : {}),
        ...(str(r.case.intro) ? { intro: str(r.case.intro) } : {}),
        ...(lines.length ? { lines } : {}), ...(cpoints.length ? { points: cpoints } : {}), ...(orders.length ? { orders } : {}) };
    }
  }
  const items = (Array.isArray(r.checklist?.items) ? r.checklist.items : [])
    .map((i: any) => ({ t: str(i?.t), ...(str(i?.s) ? { s: str(i.s) } : {}), ...(i?.optional ? { optional: true } : {}) }))
    .filter((i: GuideCheckItem) => i.t);
  if (items.length) {
    const c = r.checklist;
    g.checklist = { items };
    for (const k of ['title', 'intro', 'optionalLabel', 'optionalHint', 'doneText', 'pendingText', 'footer'] as const) if (str(c[k])) g.checklist[k] = str(c[k]);
  }
  if (str(r.foot)) g.foot = str(r.foot);
  return guideSections(g).length ? g : null;
}

export type GuideSectionKey = 'details' | 'problem' | 'directions' | 'dgp' | 'case' | 'checklist';
const SECTION_LABEL: Record<GuideSectionKey, string> = {
  details: 'विवरण', problem: 'समस्या', directions: 'निर्देश', dgp: 'DGP', case: 'वाद', checklist: 'चेकलिस्ट',
};

/** Sections this guide has, in screen order, with their top-button label and number ("1." …). */
export function guideSections(g: CircularGuide): { key: GuideSectionKey; label: string; no: number }[] {
  const keys: GuideSectionKey[] = [];
  if (g.details?.length || g.laws?.length) keys.push('details');
  if (g.problem) keys.push('problem');
  if (g.directions?.points.length) keys.push('directions');
  if (g.dgp) keys.push('dgp');
  if (g.case) keys.push('case');
  if (g.checklist?.items.length) keys.push('checklist');
  const label = (k: GuideSectionKey) => (k === 'problem' && g.problemNav) || (k === 'case' && g.case?.nav) || SECTION_LABEL[k];
  return keys.map((key, i) => ({ key, label: label(key), no: i + 1 }));
}

export type OldAct = 'IPC' | 'CrPC' | 'IEA';
type RevMap = Partial<Record<OldAct, Record<string, [string, string][]>>>;

/** "IPC 363" / "CrPC 161" / "Cr.P.C. 164" → {act, sec}; null for anything else. */
export function parseOldLaw(s: string): { act: OldAct; sec: string } | null {
  const m = /^\s*(IPC|Cr\.?\s?P\.?\s?C\.?|IEA)\s*(\d+[A-Z]?)\s*$/i.exec(String(s ?? ''));
  if (!m) return null;
  const a = m[1].replace(/[.\s]/g, '').toUpperCase();
  return { act: a === 'IPC' ? 'IPC' : a === 'IEA' ? 'IEA' : 'CrPC', sec: m[2].toUpperCase() };
}

/** "आज की धाराएँ": each old section with its new BNS / BNSS / BSA section(s) from law_map.json `rev` (unknown → no new). */
export function lawPairs(laws: readonly string[], rev: RevMap | null | undefined): { old: string; news: { act: string; n: number }[] }[] {
  const out: { old: string; news: { act: string; n: number }[] }[] = [];
  for (const l of laws) {
    const p = parseOldLaw(l);
    if (!p) continue;
    const list = rev?.[p.act]?.[p.sec] ?? [];
    const news = list.map(([act, n]) => ({ act, n: parseInt(n, 10) })).filter((x) => x.act && x.n > 0);
    out.push({ old: `${p.act} ${p.sec}`, news });
  }
  return out;
}

/** Checklist count: optional items count only while `optionalOn`. */
export function checklistProgress(items: readonly GuideCheckItem[], done: ReadonlySet<number>, optionalOn: boolean): { done: number; total: number; complete: boolean } {
  let total = 0; let d = 0;
  items.forEach((it, i) => {
    if (it.optional && !optionalOn) return;
    total += 1;
    if (done.has(i)) d += 1;
  });
  return { done: d, total, complete: total > 0 && d === total };
}

/** "a **b** c" → [{text:'a ',bold:false},{text:'b',bold:true},{text:' c',bold:false}] */
export function boldParts(text: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  String(text ?? '').split(/(\*\*[^*]+\*\*)/).forEach((p) => {
    if (!p) return;
    const b = /^\*\*([^*]+)\*\*$/.exec(p);
    out.push(b ? { text: b[1], bold: true } : { text: p, bold: false });
  });
  return out;
}

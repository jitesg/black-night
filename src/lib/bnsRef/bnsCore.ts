/**
 * bnsCore.ts — pure helpers for "BNS संदर्भ" (IPC ↔ BNS finder) built on the
 * Delhi Police Academy BNS Handbook table (assets/ref/bns_compare.json).
 *
 * No React Native imports: unit-tested with plain Node
 * (node --experimental-strip-types --test scripts/test_bns_ref.ts).
 */

export interface BnsRow {
  ipc?: string;
  bns?: string;
  h?: string;
  fl?: string[];
  p?: string;
  pg?: number;
  st?: string;
  dep?: number;
}

export interface BnsText { annex?: string; no?: string; h?: string; t?: string }

export interface BnsCompareData {
  src?: string;
  note?: string;
  rows: BnsRow[];
  text: Record<string, BnsText[]>;
}

export type BnsMode = 'ipc' | 'bns' | 'title';

export const BNS_SOURCE_NOTE =
  'स्रोत: Delhi Police Academy BNS Handbook (Ed. II, मई 2024). संज्ञेय/जमानती स्थिति हैंडबुक के अनुसार — अंतिम प्रमाण BNSS प्रथम अनुसूची है; कोर्ट-उपयोग से पहले मिलान करें।';

export const NOT_IN_BNS = 'BNS में नहीं (हटाई/समाहित)';

const DEV = '०१२३४५६७८९';
function ascii(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(DEV.indexOf(d)));
}

/** "498 A" / "498-A" / "498a" → "498a"; "351 (2)" → "351(2)". */
export function normSec(s: string | null | undefined): string {
  return ascii(String(s ?? '')).toLowerCase().replace(/[\s-]+/g, '').trim();
}

/** Section number without a trailing sub-clause: "351(2)" → "351", "8(6)(a)" → "8". */
export function baseSec(s: string): string {
  return normSec(s).replace(/\(.*$/, '');
}

/**
 * Tokens of a cell: "20 21" → ["20","21"], "142 to 143" → ["142","143"],
 * "161 to 165- A" → ["161","165a"], "498-A" → ["498a"].
 */
export function secTokens(cell: string | null | undefined): string[] {
  const raw = ascii(String(cell ?? ''))
    .replace(/(\d)\s*-\s*([a-zA-Z])\b/g, '$1$2') // "498-A", "165- A" → "498A"
    .replace(/\bto\b/gi, ' ')
    .split(/[\s,/&]+/)
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t && t !== '-' && /\d/.test(t));
  return raw;
}

export function isNA(v: string | null | undefined): boolean {
  return /(^|[^a-z])na([^a-z]|$)/i.test(String(v ?? '')) || !String(v ?? '').trim();
}

/** Removed / merged rows: IPC "NA", BNS "NA" or a BNS cell containing NA. */
export function isRemoved(row: BnsRow): boolean {
  return /(^|[^a-z])na([^a-z]|$)/i.test(String(row.bns ?? '')) || /(^|[^a-z])na([^a-z]|$)/i.test(String(row.ipc ?? ''));
}

export type BnsFlag = 'C' | 'N' | 'B' | 'NB';
export const FLAG_LABEL: Record<BnsFlag, string> = {
  C: 'संज्ञेय', N: 'असंज्ञेय', B: 'जमानती', NB: 'गैर-जमानती',
};
export const DEPENDS_LABEL = 'संज्ञेय/जमानती: अपराध पर निर्भर';

/** ["C/NB"] → ["C","NB"]; ["C","N"] → ["C","N"]; unknown tokens dropped; unique, ordered. */
export function parseFlags(fl: string[] | null | undefined): BnsFlag[] {
  const out: BnsFlag[] = [];
  for (const f of fl ?? []) {
    for (const t of String(f).toUpperCase().split(/[\s/,]+/)) {
      if ((t === 'C' || t === 'N' || t === 'B' || t === 'NB') && !out.includes(t)) out.push(t);
    }
  }
  return out;
}

/** Show the "depends on the offence" chip instead of flags. */
export function flagsDepend(row: BnsRow): boolean {
  return !!row.dep || parseFlags(row.fl).length === 0;
}

function cellMatches(cell: string | undefined, q: string): 0 | 1 | 2 {
  const want = normSec(q);
  if (!want) return 0;
  const wantBase = want.replace(/\(.*$/, '');
  let best: 0 | 1 | 2 = 0;
  for (const tok of secTokens(cell)) {
    if (tok === want) return 2;
    // "(2)" suffix optional both ways: 351 ↔ 351(2)
    if (tok.replace(/\(.*$/, '') === wantBase) best = 1;
  }
  return best;
}

/** True for queries that look like a section number ("302", "498A", "351(2)"). */
export function isSectionQuery(q: string): boolean {
  return /^\d{1,3}\s*-?\s*[a-zA-Z]{0,2}(\s*\(\s*\w+\s*\))*$/.test(ascii(q.trim()));
}

/**
 * Finds rows. Number modes match any token of rows[].ipc / rows[].bns
 * (exact first, then the same base number). Title mode matches words of
 * the heading (and punishment). Max `limit` results.
 */
export function findBns(rows: BnsRow[], query: string, mode: BnsMode, limit = 50): BnsRow[] {
  const q = query.trim();
  if (!q || !Array.isArray(rows)) return [];
  if (mode === 'title') {
    // Hindi spelling variants folded (nukta, ँ/ं) like searchUtils.searchNormalize.
    const fold = (x: string) => x.normalize('NFD').replace(/\u093C/g, '').replace(/\u0901/g, '\u0902').toLowerCase();
    const words = fold(q).split(/\s+/).filter((w) => w.length > 1);
    if (!words.length) return [];
    const scored: { r: BnsRow; s: number }[] = [];
    for (const r of rows) {
      const head = fold(String(r.h ?? ''));
      const hay = `${head} ${fold(String(r.p ?? ''))}`;
      let s = 0;
      for (const w of words) if (hay.includes(w)) s += head.includes(w) ? 2 : 1;
      if (s > 0) scored.push({ r, s });
    }
    return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.r);
  }
  const key = mode === 'ipc' ? 'ipc' : 'bns';
  const exact: BnsRow[] = [];
  const near: BnsRow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const m = cellMatches(r[key], q);
    if (!m) continue;
    const id = `${r.ipc}|${r.bns}|${r.h}`;
    if (seen.has(id)) continue; // the table repeats a few rows
    seen.add(id);
    (m === 2 ? exact : near).push(r);
  }
  return [...exact, ...near].slice(0, limit);
}

/** Handbook "मूल पाठ" entries for a BNS cell: "351(2)" → text["351"]. */
export function textFor(data: BnsCompareData | null, bns: string | null | undefined): BnsText[] {
  if (!data?.text || !bns) return [];
  const out: BnsText[] = [];
  const seen = new Set<string>();
  for (const tok of secTokens(bns)) {
    const b = tok.replace(/\(.*$/, '').toUpperCase();
    for (const k of [b, b.toLowerCase()]) {
      if (seen.has(k)) continue;
      seen.add(k);
      const list = data.text[k];
      if (Array.isArray(list)) out.push(...list);
    }
  }
  return out;
}

export function annexLabel(annex: string | undefined): string {
  if (annex === 'V') return 'अनुलग्नक-V (3–7 वर्ष)';
  if (annex === 'VI') return 'अनुलग्नक-VI (7+ वर्ष)';
  return annex ? `अनुलग्नक-${annex}` : 'हैंडबुक';
}

/** "IPC 302 → BNS 103" (or "IPC 124A → BNS में नहीं (हटाई/समाहित)"). */
export function rowTitle(r: BnsRow): string {
  const ipc = String(r.ipc ?? '').trim();
  const bns = String(r.bns ?? '').trim();
  const left = ipc && !isNA(ipc) ? `IPC ${ipc}` : 'IPC —';
  const right = isRemoved(r) && (isNA(bns) || /na/i.test(bns)) ? NOT_IN_BNS : `BNS ${bns || '—'}`;
  return `${left} → ${right}`;
}

/** Clean placeholder cells ("---", "--- ---"). */
export function clean(s: string | null | undefined): string {
  const t = String(s ?? '').trim();
  return /^[-\s]*$/.test(t) ? '' : t;
}

// ─── Copilot ────────────────────────────────────────────────────────────────

/** "IPC 302", "BNS 103", "धारा 103 BNS", "BNS धारा 69" → [{mode, no}]. */
export function parseCopilotRefs(message: string): { mode: 'ipc' | 'bns'; no: string }[] {
  const m = ascii(message);
  const out: { mode: 'ipc' | 'bns'; no: string }[] = [];
  const num = '(\\d{1,3}\\s*-?\\s*[a-zA-Z]?(?![a-zA-Z]))';
  const push = (mode: 'ipc' | 'bns', no: string) => {
    const n = no.replace(/\s|-/g, '').toUpperCase();
    if (!out.some((x) => x.mode === mode && x.no === n)) out.push({ mode, no: n });
  };
  for (const r of m.matchAll(new RegExp(`\\b(ipc|bns)\\s*(?:धारा|section|sec\\.?)?\\s*${num}`, 'gi'))) push(r[1].toLowerCase() as 'ipc' | 'bns', r[2]);
  for (const r of m.matchAll(new RegExp(`(?:धारा|section)\\s*${num}\\s*(ipc|bns)\\b`, 'gi'))) push(r[2].toLowerCase() as 'ipc' | 'bns', r[1]);
  return out;
}

export function copilotMatches(rows: BnsRow[], message: string, limit = 3): BnsRow[] {
  const out: BnsRow[] = [];
  for (const ref of parseCopilotRefs(message)) {
    for (const r of findBns(rows, ref.no, ref.mode, limit)) {
      if (!out.includes(r)) out.push(r);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function flagText(r: BnsRow): string {
  if (flagsDepend(r)) return clean(r.st) || DEPENDS_LABEL;
  return parseFlags(r.fl).map((f) => FLAG_LABEL[f]).join(', ');
}

/** Context block for the online model. */
export function copilotContext(hits: BnsRow[]): string {
  if (!hits.length) return '';
  return [
    'BNS संदर्भ (Delhi Police Academy BNS Handbook, Ed. II, मई 2024) — मिलती पंक्तियाँ:',
    ...hits.map((r) => `- ${rowTitle(r)} | शीर्षक: ${clean(r.h) || '—'} | स्थिति: ${flagText(r) || '—'} | सज़ा: ${clean(r.p) || '—'} | हैंडबुक पृ. ${r.pg ?? '—'}`),
    'निर्देश: उत्तर में बताएँ कि यह जानकारी Delhi Police हैंडबुक से है, और संज्ञेय/जमानती स्थिति BNSS प्रथम अनुसूची से पुष्टि करनी होगी।',
  ].join('\n');
}

/** Short offline block appended to Copilot answers. */
export function copilotOffline(hits: BnsRow[]): string {
  if (!hits.length) return '';
  return [
    '\n**📗 BNS संदर्भ (Delhi Police हैंडबुक):**',
    ...hits.map((r) => `- ${rowTitle(r)}${clean(r.h) ? ` — ${clean(r.h)}` : ''} · ${flagText(r) || '—'}${clean(r.p) ? ` · ${clean(r.p)}` : ''} · पृ. ${r.pg ?? '—'}`),
    '_संज्ञेय/जमानती स्थिति हैंडबुक के अनुसार — अंतिम प्रमाण BNSS प्रथम अनुसूची है।_',
  ].join('\n');
}

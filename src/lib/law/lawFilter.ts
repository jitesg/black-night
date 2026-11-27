/**
 * Filters on an Act's section list (owner): "सामग्री" (सरल व्याख्या / विस्तृत विश्लेषण / न्यायिक निर्णय वाली) and, for BNS only,
 * the offence classification from the BNSS First Schedule (संज्ञेय / असंज्ञेय, जमानतीय / अजमानतीय).
 * A BNS section counts as संज्ञेय when ANY of its schedule rows is cognizable (and as असंज्ञेय when any row is non-cognizable),
 * so a mixed section shows under both; "According as the offence abetted is…" rows say neither.
 * Pure — tests: scripts/test_law_filter.ts
 */

export interface ClassFlags { cog: boolean; noncog: boolean; bail: boolean; nonbail: boolean }

/** Flags of one schedule column value ("Cognizable.", "Non-cognizable.", "Cognizable. Non-cognizable.", "According as …"). */
export function readClassText(text: string | null | undefined, word: 'cognizable' | 'bailable'): { yes: boolean; no: boolean } {
  const t = String(text ?? '').toLowerCase();
  if (!t || /according as/.test(t)) return { yes: false, no: false };
  const no = new RegExp(`non-?\\s*${word}`).test(t);
  const yes = new RegExp(`(^|[^-a-z])${word}`).test(t.replace(new RegExp(`non-?\\s*${word}`, 'g'), ''));
  return { yes, no };
}

/** Section number → flags, from the schedule rows ({ sec: "103(1)", cognizable, bailable, variants? }). */
export function classFlagsBySection(rows: { sec?: string; cognizable?: string; bailable?: string; variants?: { cognizable?: string; bailable?: string }[] }[]): Map<number, ClassFlags> {
  const map = new Map<number, ClassFlags>();
  for (const r of rows) {
    const m = /^\s*(\d+)/.exec(String(r.sec ?? ''));
    if (!m) continue;
    const n = Number(m[1]);
    const f = map.get(n) ?? { cog: false, noncog: false, bail: false, nonbail: false };
    for (const v of [r, ...(r.variants ?? [])]) {
      const c = readClassText(v.cognizable, 'cognizable');
      const b = readClassText(v.bailable, 'bailable');
      f.cog ||= c.yes; f.noncog ||= c.no; f.bail ||= b.yes; f.nonbail ||= b.no;
    }
    map.set(n, f);
  }
  return map;
}

export interface SectionFacts { simple: boolean; detailed: boolean; cases: boolean; cls?: ClassFlags }
export type LawFilterValues = { have?: string | null; cog?: string | null; bail?: string | null };

/** Does a section pass the chosen filters? (missing / null value = सभी) */
export function passesLawFilters(f: SectionFacts, v: LawFilterValues): boolean {
  if (v.have === 'simple' && !f.simple) return false;
  if (v.have === 'detailed' && !f.detailed) return false;
  if (v.have === 'cases' && !f.cases) return false;
  if (v.cog === 'cog' && !f.cls?.cog) return false;
  if (v.cog === 'noncog' && !f.cls?.noncog) return false;
  if (v.bail === 'bail' && !f.cls?.bail) return false;
  if (v.bail === 'nonbail' && !f.cls?.nonbail) return false;
  return true;
}

/** Number-range groups for an Act's section list (owner, new layout part 3): 1–100, 101–200 … up to the last section. */
export function sectionRanges(last: number, size = 100): { from: number; to: number; label: string }[] {
  const out: { from: number; to: number; label: string }[] = [];
  const n = Math.max(0, Math.floor(Number(last) || 0));
  for (let from = 1; from <= n; from += size) {
    const to = Math.min(n, from + size - 1);
    out.push({ from, to, label: `${from}–${to}` });
  }
  return out;
}

export type ClassTone = 'strict' | 'mild' | 'mixed';
/** The two small dots on a BNS row: संज्ञेय / असंज्ञेय and जमानतीय / अजमानतीय (mixed sections say both; none → []). */
export function classDots(f: ClassFlags | undefined): { label: string; tone: ClassTone }[] {
  if (!f) return [];
  const out: { label: string; tone: ClassTone }[] = [];
  if (f.cog && f.noncog) out.push({ label: 'संज्ञेय / असंज्ञेय', tone: 'mixed' });
  else if (f.cog) out.push({ label: 'संज्ञेय', tone: 'strict' });
  else if (f.noncog) out.push({ label: 'असंज्ञेय', tone: 'mild' });
  if (f.bail && f.nonbail) out.push({ label: 'जमानतीय / अजमानतीय', tone: 'mixed' });
  else if (f.nonbail) out.push({ label: 'अजमानतीय', tone: 'strict' });
  else if (f.bail) out.push({ label: 'जमानतीय', tone: 'mild' });
  return out;
}

/**
 * "न्यायालय से लंबित काग़ज़ चुनें" (owner, sample approved) — a format dropdown key may carry
 *   {"courtPick": {"<choice>": ["NBW", "Summons", …], …}, "courtFill": {"<FormatKey>": "court" | "vad" | "fir" | "sections" | "person"}}
 * e.g. GD रवानगी `WType`: NBW / सम्मन → लंबित NBW + सम्मन; मृत्यु आख्या → लंबित मृत्यु आख्या first, then NBW + सम्मन.
 * Picking a paper fills the courtFill keys (court name, वाद सं0, मु0अ0सं0, धारा, the person card). Pure — tests
 * scripts/test_court_pick.ts; data from nyayalayRepo `getPendingCourtPapersForPick`, UI components/formats/CourtPaperPick.tsx.
 */
import { cardFromCourtRow, type CourtPersonRow } from './personCard';
import { smartMatch } from './searchUtils';

export type CourtFillField = 'court' | 'vad' | 'fir' | 'sections' | 'person';

export interface CourtPickSpec {
  /** dropdown value → न्यायालय doc_types to list, in this order */
  types: Record<string, string[]>;
  /** format key → what to put in it */
  fill: Record<string, CourtFillField>;
}

export interface PickPaper {
  id: string;
  doc_type: string;
  court_name: string;
  vad_sankhya: string;
  apradh_sankhya: string;
  applicable_sections: string;
  fir_number: string;
  fir_year: string;
  deadline_date: string;
  /** first person on the paper (accused / व्यक्ति), if any */
  person: CourtPersonRow | null;
}

const FILL_FIELDS: CourtFillField[] = ['court', 'vad', 'fir', 'sections', 'person'];

/** The spec from a key's dropdown_options (JSON string or object); null when the key has none. */
export function courtPickSpecOf(raw: unknown): CourtPickSpec | null {
  let o: unknown = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  const t = r.courtPick; const f = r.courtFill;
  if (!t || typeof t !== 'object' || !f || typeof f !== 'object') return null;
  const types: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(t as Record<string, unknown>)) {
    if (Array.isArray(v)) types[k] = v.filter((x): x is string => typeof x === 'string' && !!x);
  }
  const fill: Record<string, CourtFillField> = {};
  for (const [k, v] of Object.entries(f as Record<string, unknown>)) {
    if (typeof v === 'string' && (FILL_FIELDS as string[]).includes(v)) fill[k] = v as CourtFillField;
  }
  return Object.keys(types).length && Object.keys(fill).length ? { types, fill } : null;
}

/** doc_types to list for the chosen dropdown value ([] = no strip). */
export function typesFor(spec: CourtPickSpec, choice: string): string[] {
  return spec.types[(choice ?? '').trim()] ?? [];
}

/** Only the wanted types, grouped in the spec's order, nearest deadline first inside a type. */
export function orderPapers(papers: readonly PickPaper[], types: readonly string[]): PickPaper[] {
  const rank = new Map(types.map((t, i) => [t, i]));
  return papers
    .filter((p) => rank.has(p.doc_type))
    .slice()
    .sort((a, b) => (rank.get(a.doc_type)! - rank.get(b.doc_type)!) || (a.deadline_date || '9999').localeCompare(b.deadline_date || '9999'));
}

/** मु0अ0सं0 as printed: अपराध सं0 of the court form, else "fir/year". */
export function paperFir(p: PickPaper): string {
  const a = (p.apradh_sankhya ?? '').trim();
  if (a) return a;
  const n = (p.fir_number ?? '').trim();
  const y = (p.fir_year ?? '').trim();
  return n ? (y && !n.includes('/') ? `${n}/${y}` : n) : '';
}

/** "रामू पुत्र श्याम" for the list card. */
export function paperPersonLine(p: PickPaper): string {
  const r = p.person;
  if (!r?.name?.trim()) return '';
  const c = cardFromCourtRow(r);
  const rel = (c.relationType || '').trim();
  const fa = (c.fatherOrHusbandName || '').trim();
  return fa ? `${c.name.trim()} ${rel || 'पुत्र'} ${fa}` : c.name.trim();
}

/** Search across court, वाद सं0, मु0अ0सं0, धारा, person (every word, any order). */
export function matchPaper(p: PickPaper, query: string): boolean {
  if (!query.trim()) return true;
  return smartMatch(query, [p.court_name, p.vad_sankhya, paperFir(p), p.applicable_sections, paperPersonLine(p), p.person?.address ?? '']);
}

/** Values to put into the form (only the courtFill keys; empty paper parts → ''). */
export function fillValuesFrom(p: PickPaper, fill: Record<string, CourtFillField>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, what] of Object.entries(fill)) {
    if (what === 'court') out[key] = (p.court_name ?? '').trim();
    else if (what === 'vad') out[key] = (p.vad_sankhya ?? '').trim();
    else if (what === 'fir') out[key] = paperFir(p);
    else if (what === 'sections') out[key] = (p.applicable_sections ?? '').trim();
    else if (what === 'person') out[key] = p.person?.name?.trim() ? JSON.stringify([cardFromCourtRow(p.person)]) : '';
  }
  return out;
}

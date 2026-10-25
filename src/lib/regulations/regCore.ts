/**
 * regCore.ts — pure helpers for UP Police Regulations (Task L35).
 *
 * No React Native / database imports: unit-tested with plain Node
 * (scripts/test_regulations.ts). Data loading lives in regIndex.ts.
 */

// ─── Sidecar types (assets/reg/reg_index.json) ───────────────────────────────

export interface RegLaw { old: string; new: string[]; n?: string; u?: number }
export interface RegCase { n: string; c?: string; p?: string; u?: number }

export interface RegPara {
  no: string;
  ch: string;
  chT: string;
  part: string;
  t: string;
  en: string;
  done: boolean;
  /** Case notes (L39): fact-checked against the source. */
  verified?: boolean;
  law?: RegLaw[];
  sop?: string[];
  circ?: string[];
  cases?: RegCase[];
}

export interface RegChapter { ch: string; part: string; from: number; t: string }

export interface RegIndexData {
  version?: number | string;
  note?: string;
  paras: Record<string, RegPara>;
  chapters: RegChapter[];
}

// ─── Section parser ──────────────────────────────────────────────────────────

export const PENDING_TEXT = '(यह भाग तैयार किया जा रहा है — अगले अपडेट में।)';

export interface RegSection {
  heading: string;
  body: string;
  /** Body is the "being prepared" placeholder (or empty). */
  pending: boolean;
}

export interface RegSections {
  title: string;        // from "# पैरा N — title"
  breadcrumb: string;   // second line, without surrounding brackets
  original: RegSection; // ## 1.
  simple: RegSection;   // ## 2.
  examples: RegSection; // ## 3.
  related: RegSection;  // ## 4.
}

function isPendingBody(body: string): boolean {
  const b = body.trim();
  return b.length === 0 || b === PENDING_TEXT || b.startsWith('(यह भाग तैयार किया जा रहा है');
}

function emptySection(): RegSection {
  return { heading: '', body: '', pending: true };
}

/**
 * Splits a regulation description into its 4 sections by "## " headings.
 * Tolerant: sections may be missing, out of order or unnumbered (matched by
 * keyword); text before the first heading is ignored except the title lines.
 */
export function parseRegSections(description: string | null | undefined): RegSections {
  const out: RegSections = {
    title: '', breadcrumb: '',
    original: emptySection(), simple: emptySection(), examples: emptySection(), related: emptySection(),
  };
  if (!description) return out;
  const lines = description.replace(/\r\n?/g, '\n').split('\n');

  // Title + breadcrumb (lines before the first "## ")
  let i = 0;
  const pre: string[] = [];
  while (i < lines.length && !lines[i].startsWith('## ')) {
    pre.push(lines[i]);
    i++;
  }
  const preNonEmpty = pre.map((l) => l.trim()).filter(Boolean);
  const titleLine = preNonEmpty.find((l) => l.startsWith('# '));
  if (titleLine) out.title = titleLine.replace(/^#\s+/, '').trim();
  const crumb = preNonEmpty.find((l) => !l.startsWith('#'));
  if (crumb) out.breadcrumb = crumb.replace(/^\(\s*/, '').replace(/\s*\)$/, '').trim();

  // Sections
  type Key = 'original' | 'simple' | 'examples' | 'related';
  const order: Key[] = ['original', 'simple', 'examples', 'related'];
  let current: { key: Key | null; heading: string; body: string[] } | null = null;
  const flush = () => {
    if (current && current.key) {
      const body = current.body.join('\n').replace(/^\n+|\n+$/g, '');
      out[current.key] = { heading: current.heading, body, pending: isPendingBody(body) };
    }
  };
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      flush();
      const heading = line.slice(3).trim();
      const num = /^(\d)\s*[.)]/.exec(heading);
      let key: Key | null = num ? order[Number(num[1]) - 1] ?? null : null;
      if (!key) {
        if (/मूल\s*पाठ|original/i.test(heading)) key = 'original';
        else if (/सरल|simple/i.test(heading)) key = 'simple';
        else if (/उदाहरण|example/i.test(heading)) key = 'examples';
        else if (/संबंधित|related|कानून/i.test(heading)) key = 'related';
      }
      current = { key, heading, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  flush();
  return out;
}

// ─── Section 2: simple Hindi items ──────────────────────────────────────────

export type SimpleItem =
  | { kind: 'bullet'; text: string }
  | { kind: 'do'; text: string }      // "✔ …" (green)
  | { kind: 'dont'; text: string }    // "✘ …" (red)
  | { kind: 'heading'; text: string } // "मामला:", "न्यायालय ने क्या कहा:" …
  | { kind: 'update'; text: string; label?: string }
  | { kind: 'tip'; text: string }
  | { kind: 'text'; text: string };

// Case-note sub-headings (L39): a whole line such as "पुलिस के लिए — क्या करें:".
const SUB_HEADING = /^(मामला|न्यायालय ने क्या कहा|पुलिस के लिए\s*[—-]\s*क्या करें|क्या न करें)\s*[:：]\s*$/;

export function parseSimpleItems(body: string): SimpleItem[] {
  const items: SimpleItem[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('- ')) items.push({ kind: 'bullet', text: line.slice(2).trim() });
    else if (/^[✔✓]/.test(line)) items.push({ kind: 'do', text: line.replace(/^[✔✓]\uFE0F?\s*/, '') });
    else if (/^[✘✗]/.test(line)) items.push({ kind: 'dont', text: line.replace(/^[✘✗]\uFE0F?\s*/, '') });
    else if (SUB_HEADING.test(line)) items.push({ kind: 'heading', text: line.replace(/\s*[:：]\s*$/, '') });
    else if (/^⚠\s*अद्यतन/.test(line)) {
      // "⚠ अद्यतन: …" or "⚠ अद्यतन (2019 संशोधन): …"
      const m = /^⚠\s*अद्यतन\s*(\([^)]*\))?\s*[:：]?\s*/.exec(line)!;
      items.push({ kind: 'update', text: line.slice(m[0].length), label: m[1] ? `अद्यतन ${m[1]}` : undefined });
    }
    else if (/^टिप\s*[:：]/.test(line)) items.push({ kind: 'tip', text: line.replace(/^टिप\s*[:：]\s*/, '') });
    else if (items.length > 0) items[items.length - 1].text += ` ${line}`; // wrapped line
    else items.push({ kind: 'text', text: line });
  }
  return items;
}

// ─── Section 3: examples ────────────────────────────────────────────────────

export interface RegExample {
  label: string;
  scenario: string;
  /** Number from a numbered list ("1. …"), when present. */
  num?: number;
  /** "[वास्तविक मामला]" — a real decided case (else an illustrative scenario). */
  real: boolean;
}

const REAL_CASE_TAG = /\[\s*वास्तविक\s*मामला\s*\]\s*/;

/**
 * Example blocks are separated by blank lines. First line ending with ":" is
 * the label. L37 rows are numbered ("1. [वास्तविक मामला] label:"); the number
 * and the real-case tag are taken off the label.
 */
export function parseExamples(body: string): RegExample[] {
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => {
    const [first, ...rest] = b.split('\n');
    let f = first.trim();
    let num: number | undefined;
    const nm = /^(\d{1,3})\s*[.)]\s+/.exec(f);
    if (nm) { num = Number(nm[1]); f = f.slice(nm[0].length); }
    const real = REAL_CASE_TAG.test(f);
    f = f.replace(REAL_CASE_TAG, '').trim();
    if (rest.length > 0 && /[:：]$/.test(f)) {
      return { label: f.replace(/[:：]$/, '').trim(), scenario: rest.join('\n').trim(), num, real };
    }
    // No label line: keep the whole block as the scenario (minus number/tag).
    const scenario = nm || real ? [f, ...rest].join('\n').trim() : b;
    return { label: '', scenario, num, real };
  });
}

// ─── Section 4: human-readable labels ──────────────────────────────────────

/**
 * Lines under a "परिपत्र:" / "SOP:" style heading in section 4, in order.
 * Used to label sidecar ids that are not in the app.
 */
export function relatedLabels(body: string, heading: RegExp): string[] {
  const out: string[] = [];
  let on = false;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (!line.startsWith('- ') && /[:：]\s*$/.test(line.replace(/\(.*\)/, ''))) {
      on = heading.test(line);
      continue;
    }
    if (on && line.startsWith('- ')) out.push(line.slice(2).trim());
  }
  return out;
}

// ─── Para numbers ───────────────────────────────────────────────────────────

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

function toAsciiDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

/** "104a" / "104 A" / "104-A" → "104-A"; "97" → "97". Null if not a para number. */
export function normalizeParaNo(input: string): string | null {
  const m = /^(\d{1,3})\s*-?\s*([a-zA-Z])?$/.exec(toAsciiDigits(input.trim()));
  if (!m) return null;
  return m[2] ? `${Number(m[1])}-${m[2].toUpperCase()}` : String(Number(m[1]));
}

/**
 * Pulls a para number out of a query like "97", "पैरा 154", "para 104-A",
 * "reg 104-A", "regulation 97", "UPPR पैरा 12". Null when there is none.
 */
export function extractParaNo(query: string): string | null {
  const q = toAsciiDigits(query.trim());
  const withWord = /(?:पैरा|पैराग्राफ|para(?:graph)?|reg(?:ulation)?|रेगुलेशन|uppr|नियम|धारा|dhara|section|sec)\.?\s*(?:no\.?|नं\.?|संख्या)?\s*(\d{1,3}(?:\s*-?\s*[a-zA-Z](?![a-zA-Z]))?)/i.exec(q);
  if (withWord) return normalizeParaNo(withWord[1]);
  return normalizeParaNo(q);
}

/** Row id for a para / section number ("104-A" → sys-reg-up-104-a, POCSO "42A" → sys-reg-pocso-42a). */
export function paraIdFromNo(no: string, act: RegAct = 'uppr'): string {
  return act === 'uppr'
    ? `sys-reg-up-${no.toLowerCase()}`
    : `${ACT_META[act].idPrefix}${canonNo(no).toLowerCase()}`;
}

/** "42-A" / "42 a" / "42A" → "42A" (for comparing numbers across styles). */
export function canonNo(no: string): string {
  return no.toUpperCase().replace(/[\s-]/g, '');
}

// ─── Acts (UP Police Regulations, POCSO Act, women-protection Acts …) ────────

export type RegAct = 'uppr' | 'pocso' | 'pwdva' | 'posh' | 'itpa' | 'dowry' | 'irwa' | 'case';

/** The five "महिला संरक्षण कानून" Acts (L37), in display order. */
export const WOMEN_ACTS: RegAct[] = ['pwdva', 'posh', 'itpa', 'dowry', 'irwa'];

export function isWomenAct(act: RegAct): boolean {
  return WOMEN_ACTS.includes(act);
}

export interface ActMeta {
  /** "पैरा" (UPPR) or "धारा" (Acts). */
  unit: string;
  /** Short cite prefix: "UPPR पैरा 12", "DV Act धारा 12". */
  prefix: string;
  name: string;
  /** Hindi Act name (cards / headers). */
  hindi: string;
  year?: string;
  idPrefix: string;
  /** Sidecar chapter `ch` for this Act (women Acts: one chapter per Act). */
  ch?: string;
  /** Sensitive subject: title-only previews, confidential share prefix. */
  sensitive: boolean;
  /** Rows expected once all data runs are in (diagnostics). */
  expected?: number;
}

export const ACT_META: Record<RegAct, ActMeta> = {
  uppr: { unit: 'पैरा', prefix: 'UPPR', name: 'UP Police Regulations', hindi: 'यूपी पुलिस रेगुलेशन', idPrefix: 'sys-reg-up-', sensitive: false },
  pocso: { unit: 'धारा', prefix: 'POCSO', name: 'POCSO Act 2012', hindi: 'पॉक्सो अधिनियम 2012', year: '2012', idPrefix: 'sys-reg-pocso-', sensitive: true },
  pwdva: { unit: 'धारा', prefix: 'DV Act', name: 'Protection of Women from Domestic Violence Act, 2005', hindi: 'घरेलू हिंसा अधिनियम 2005', year: '2005', idPrefix: 'sys-reg-pwdva-', ch: 'DV Act 2005', sensitive: true, expected: 38 },
  posh: { unit: 'धारा', prefix: 'POSH Act', name: 'Sexual Harassment of Women at Workplace Act, 2013', hindi: 'कार्यस्थल यौन उत्पीड़न अधिनियम 2013', year: '2013', idPrefix: 'sys-reg-posh-', ch: 'POSH Act 2013', sensitive: true, expected: 31 },
  itpa: { unit: 'धारा', prefix: 'ITPA', name: 'Immoral Traffic (Prevention) Act, 1956', hindi: 'अनैतिक व्यापार (निवारण) अधिनियम 1956', year: '1956', idPrefix: 'sys-reg-itpa-', ch: 'ITPA 1956', sensitive: true, expected: 30 },
  dowry: { unit: 'धारा', prefix: 'दहेज प्रतिषेध अधिनियम', name: 'Dowry Prohibition Act, 1961', hindi: 'दहेज प्रतिषेध अधिनियम 1961', year: '1961', idPrefix: 'sys-reg-dowry-', ch: 'Dowry Prohibition Act 1961', sensitive: true, expected: 14 },
  // Police case notes (न्यायिक निर्णय): rows sys-case-<slug>, sidecar part 'CASE'.
  case: { unit: 'निर्णय', prefix: 'न्यायिक निर्णय', name: 'न्यायिक निर्णय (पुलिस)', hindi: 'न्यायिक निर्णय (पुलिस)', idPrefix: 'sys-case-', sensitive: false },
  irwa: { unit: 'धारा', prefix: 'IRWA', name: 'Indecent Representation of Women (Prohibition) Act, 1986', hindi: 'स्त्री अशिष्ट रूपण (प्रतिषेध) अधिनियम 1986', year: '1986', idPrefix: 'sys-reg-irwa-', ch: 'IRWA 1986', sensitive: true, expected: 11 },
};

const ACT_ORDER: RegAct[] = ['pocso', 'pwdva', 'posh', 'itpa', 'dowry', 'irwa', 'case'];

export function actOfId(id: string): RegAct {
  for (const a of ACT_ORDER) if (id.startsWith(ACT_META[a].idPrefix)) return a;
  return 'uppr';
}

/** Parses an "act" route param; unknown values fall back to UPPR. */
export function parseAct(v: unknown): RegAct {
  return typeof v === 'string' && v in ACT_META ? (v as RegAct) : 'uppr';
}

/** Rows of a sensitive Act (POCSO, women Acts): title only in lists/previews. */
export function isSensitiveId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('sys-reg-') && ACT_META[actOfId(id)].sensitive;
}

export const CONFIDENTIAL_PREFIX = 'गोपनीय — केवल विधिक/विभागीय उपयोग हेतु';

/** "धारा 12", "पैरा 97", and "अधिनियम एक नज़र में" for a women-Act overview row (no 0). */
export function sectionLabel(act: RegAct, no: string): string {
  if (act === 'case') return 'न्यायिक निर्णय';
  if (no === '0' && act !== 'uppr') return 'अधिनियम एक नज़र में';
  return `${ACT_META[act].unit} ${no}`;
}

/** Section order: 1, 2, …, 42, 42A, 43 (letters after the plain number). */
export function compareSectionNo(a: string, b: string): number {
  const pa = /^(\d+)\s*-?\s*([A-Za-z]*)$/.exec(a.trim());
  const pb = /^(\d+)\s*-?\s*([A-Za-z]*)$/.exec(b.trim());
  if (!pa || !pb) return a.localeCompare(b);
  const d = Number(pa[1]) - Number(pb[1]);
  if (d !== 0) return d;
  return pa[2].toUpperCase().localeCompare(pb[2].toUpperCase());
}

/** Merges several sidecars into one map keyed by row id. */
export function mergeIndexes(...parts: (RegIndexData | null | undefined)[]): RegIndexData {
  const out: RegIndexData = { paras: {}, chapters: [] };
  for (const p of parts) {
    if (!p) continue;
    Object.assign(out.paras, p.paras);
    out.chapters.push(...p.chapters);
  }
  return out;
}

// ─── Sidecar join / order ───────────────────────────────────────────────────

/** Sidecar entry for a knowledge row id (null when missing). */
export function joinSidecar(index: RegIndexData | null, rowId: string): RegPara | null {
  if (!index || !rowId) return null;
  return index.paras[rowId] ?? null;
}

/**
 * Row ids of one Act in reading order. UP Regulations keep the book order of
 * the sidecar; Acts (POCSO, women Acts) are sorted by section number (… 42, 42A, 43 …).
 * Without `act`, all ids in sidecar order.
 */
export function orderedIds(index: RegIndexData | null, act?: RegAct): string[] {
  if (!index) return [];
  const ids = Object.keys(index.paras);
  if (!act) return ids;
  const mine = ids.filter((id) => actOfId(id) === act);
  // UPPR keeps the book order; Acts sort by section (0 overview first, 4 < 4A < 5).
  return act === 'uppr' || act === 'case'
    ? mine
    : mine.sort((x, y) => compareSectionNo(index.paras[x].no, index.paras[y].no));
}

/** Previous / next row inside the same Act. */
export function neighbours(index: RegIndexData | null, rowId: string): { prev: string | null; next: string | null } {
  const ids = orderedIds(index, actOfId(rowId));
  const i = ids.indexOf(rowId);
  if (i < 0) return { prev: null, next: null };
  return { prev: i > 0 ? ids[i - 1] : null, next: i < ids.length - 1 ? ids[i + 1] : null };
}

export function progress(index: RegIndexData | null, act?: RegAct): { done: number; total: number } {
  const all = orderedIds(index, act).map((id) => index!.paras[id]);
  return { done: all.filter((p) => p.done).length, total: all.length };
}

// ─── Search ─────────────────────────────────────────────────────────────────

export interface RegSearchItem {
  id: string;
  no: string;
  title: string;   // Hindi/English title (row title or sidecar t)
  en?: string;     // English heading
  tags?: string;
}

function norm(s: string): string {
  // Hindi spelling variants: nukta dropped, ँ → ं (same rules as searchUtils.searchNormalize)
  return toAsciiDigits(s.normalize('NFD').replace(/\u093C/g, '').replace(/\u0901/g, '\u0902'))
    .toLowerCase().replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim();
}

/**
 * Ranks paragraphs for a query. A para-number query puts the exact para
 * first, then other paras starting with that number (e.g. 104, 104-A).
 */
// Hindi words people type → words used in English/Hindi headings.
const QUERY_SYNONYMS: [RegExp, string][] = [
  [/पोर्नोग्राफी|पोर्न|अश्लील/i, 'pornographic अश्लील'],
  [/रिपोर्टिंग|रिपोर्ट/i, 'reporting रिपोर्टिंग'],
  [/बयान/i, 'statement बयान'],
  [/मेडिकल|चिकित्सा/i, 'medical मेडिकल'],
  [/विशेष\s*न्यायालय|स्पेशल\s*कोर्ट/i, 'special court विशेष न्यायालय'],
  [/सज़ा|सजा/i, 'punishment सजा'],
  [/मीडिया/i, 'media मीडिया'],
  // Women-protection Acts (L37)
  [/शेल्टर|आश्रय/i, 'shelter'],
  [/संरक्षण\s*अधिकारी|प्रोटेक्शन\s*ऑफिसर/i, 'protection officer'],
  [/\bicc\b|आंतरिक\s*(शिकायत\s*)?समिति/i, 'internal complaints committee icc'],
  [/\blcc\b|स्थानीय\s*समिति/i, 'local committee'],
  [/brothel|कोठा|वेश्यालय/i, 'brothel कोठा'],
  [/दहेज\s*मृत्यु|dowry\s*death/i, '304b'],
  [/भरण[-\s]*पोषण|maintenance/i, 'maintenance monetary'],
];

/** Adds heading words for common Hindi query words. */
export function expandQuery(query: string): string {
  let q = query;
  for (const [re, add] of QUERY_SYNONYMS) if (re.test(query)) q += ` ${add}`;
  return q;
}

export function searchParas(items: RegSearchItem[], query: string, limit = 50, minScore = 1): RegSearchItem[] {
  const q = norm(query);
  if (!q) return items.slice(0, limit);
  const paraNo = extractParaNo(query);
  const scored: { item: RegSearchItem; score: number }[] = [];
  const tokens = norm(expandQuery(query)).split(' ').filter((t) => t.length > 1 && !/^(पैरा|para|reg|regulation|uppr|धारा|section|pocso|पॉक्सो|act|अधिनियम|का|की|के|में|है|क्या)$/.test(t));
  for (const item of items) {
    let score = 0;
    if (paraNo) {
      const want = canonNo(paraNo);
      const have = canonNo(item.no);
      const wantBase = want.replace(/[A-Z]+$/, '');
      const haveBase = have.replace(/[A-Z]+$/, '');
      if (have === want) score += 1000;
      else if (haveBase === wantBase && want === wantBase) score += 400; // "104" → also 104-A
      else if (haveBase === wantBase) score += 300;
    }
    const hay = norm(`${item.title} ${item.en ?? ''} ${item.tags ?? ''}`);
    if (hay.includes(q)) score += 120;
    for (const t of tokens) {
      // Latin words must match whole words ("fir" ≠ "firing"); a plural "s" is fine ("officer" = "officers").
      const hit = /^[a-z0-9-]+$/.test(t)
        ? new RegExp(`(^|[^a-z0-9])${t.replace(/[-]/g, '\\-')}s?([^a-z0-9]|$)`).test(hay)
        : hay.includes(t);
      if (hit) score += 20;
    }
    if (score >= minScore) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}

// ─── Plain-text export (share) ──────────────────────────────────────────────

export function sectionsToPlainText(title: string, s: RegSections): string {
  const part = (h: string, sec: RegSection) => `${h}\n${sec.pending ? 'जल्द उपलब्ध' : sec.body}`;
  return [
    title,
    s.breadcrumb,
    '',
    part('1. मूल पाठ (Original — English)', s.original),
    '',
    part('2. सरल हिंदी', s.simple),
    '',
    part('3. असली ज़िंदगी के उदाहरण', s.examples),
    '',
    part('4. संबंधित कानून, SOP, परिपत्र, निर्णय', s.related),
  ].filter((x) => x !== undefined).join('\n').trim();
}

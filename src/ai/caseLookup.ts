/**
 * caseLookup.ts — Copilot CASE_LOOKUP (L39): questions that name a police
 * ruling ("Joginder Kumar", "D.K. Basu", "Arnesh"…) or ask "कौन सा फ़ैसला …".
 * Searches the bundled case notes (sys-case-*) and builds the offline answer
 * and the context block for the online model.
 */
import { REG_SEED_ROWS, type RegSeedRow } from '@/lib/regulations/regSeedFiles';
import { getRegPara } from '@/lib/regulations/regIndex';
import { parseRegSections, parseSimpleItems, type RegPara } from '@/lib/regulations/regCore';
import { parseCaseMeta, type CaseMeta } from '@/lib/cases/caseCore';

export interface CaseLookupResult { content: string; suggestedActions: string[]; matchedIds: string[] }

interface CaseCand {
  id: string;
  row: RegSeedRow;
  para: RegPara | null;
  meta: CaseMeta;
  names: string[];       // party names of this ruling ("joginder kumar", "d k basu")
  laterNames: string[];  // names of later rulings listed in the sidecar (Arnesh Kumar …)
  hay: string;
}

const ASK = /(कौन\s*स(?:ा|े)\s*(?:फ़ैसल|फैसल|निर्णय)|किस\s*(?:फ़ैसले|फैसले|निर्णय)|कौन\s*सी\s*(?:नज़ीर|नजीर|रूलिंग)|which\s+(?:case|judg(?:e)?ment|ruling)|case\s*law|landmark\s*(?:case|judg)|नज़ीर|नजीर|रूलिंग)/i;
const GENERIC_PARTY = /^(state|union|commissioner|the state|govt|government|superintendent|director|secretary|district|collector|registrar|chief|municipal|central bureau|cbi|in re|re)\b/i;

function norm(s: string): string {
  // NFC: "ड़" typed as one code point or as "ड" + nukta compares equal.
  return s.normalize('NFC').toLowerCase().replace(/[.,()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function partyNames(caseName: string): string[] {
  const parts = caseName.split(/\s+(?:v\.?|vs\.?|versus)\s+/i).map((p) => p.replace(/\band others?\b|\band ors\.?\b|\bors\.?\b|\bothers\b/gi, '').trim());
  return parts.filter((p) => p && !GENERIC_PARTY.test(p)).map(norm).filter((p) => p.length >= 5);
}

let _cands: CaseCand[] | null = null;
function candidates(): CaseCand[] {
  if (_cands) return _cands;
  _cands = REG_SEED_ROWS.filter((r) => r.id.startsWith('sys-case-')).map((row) => {
    const para = getRegPara(row.id);
    const meta = parseCaseMeta(row.description, row.tags ?? '', para?.en ?? '');
    const names = partyNames(meta.caseName || para?.en || '');
    const laterNames = (para?.cases ?? []).flatMap((cs) => partyNames(cs.n.split(/\s*\(/)[0]));
    return {
      id: row.id, row, para, meta, names, laterNames,
      hay: norm(`${row.title} ${row.tags ?? ''} ${para?.t ?? ''} ${meta.caseName} ${meta.citation} ${para?.chT ?? ''}`),
    };
  });
  return _cands;
}

// Distinctive single words that name a ruling on their own.
const ALIASES = /(^|\s)(basu|arnesh|joginder|antil|nilabati|puttaswamy|paramvir|lalita kumari|prem shankar|sheela barse|hussainara)(\s|$)/;
// A single name word (e.g. "Bhutto") counts only next to a "ruling" cue, so ordinary names
// in investigation questions ("Ramesh ki FIR") never route here.
const CUE = /(case|केस|फ़ैसल|फैसल|निर्णय|judg(?:e)?ment|ruling|guideline|गाइडलाइन|निर्देश|सुप्रीम|हाई\s*कोर्ट|high court|supreme court|\bv\.?\s|\bvs\.?\s|बनाम)/i;
const COMMON = new Set(['state', 'kumar', 'singh', 'union', 'india', 'others', 'another', 'pradesh', 'maharashtra', 'delhi', 'gujarat', 'bombay',
  'police', 'court', 'supreme', 'civil', 'legal', 'judicial', 'inspector', 'through', 'victim', 'welfare', 'association', 'committee',
  'department', 'administration', 'additional', 'assistant', 'alias', 'families', 'incident', 'execution', 'extra', 'restaurant',
  'youth', 'council', 'community', 'citizens', 'democracy', 'liberties', 'customs', 'enforcement', 'directorate', 'infrastructure',
  'circle', 'christian', 'secretary', 'collector', 'president', 'maidan', 'kumari', 'patel', 'yadav', 'mishra', 'reddy', 'shukla',
  'srivastava', 'chandra', 'krishna', 'prakash', 'ramesh', 'suresh', 'sunil', 'mukesh', 'deepak', 'dinesh', 'rakesh', 'vikas',
  'vikash', 'vijay', 'mohan', 'gopal', 'shankar', 'mahender', 'inder', 'chand', 'vinay', 'jagdish', 'laxman', 'baldev', 'balbir',
  'kartar', 'madhu', 'megha', 'priyanka', 'vandana', 'anuradha', 'mohammed', 'hussain', 'abbas', 'tahir', 'usman', 'irshad']);

/** Does the message name one of the rulings (or a later ruling they cite)? */
function nameHit(q: string, names: string[]): boolean {
  const n = norm(q);
  return names.some((name) => {
    if (name.includes(' ') && n.includes(name)) return true; // full name: "joginder kumar", "d k basu"
    if (!CUE.test(q)) return false;
    return name.split(' ').some((w) => w.length >= 5 && !COMMON.has(w) && new RegExp(`(^|\\s)${w}(\\s|$)`).test(n));
  });
}

export function isCaseQuery(q: string): boolean {
  if (!q?.trim()) return false;
  if (ASK.test(q) || ALIASES.test(norm(q))) return true;
  return candidates().some((c) => nameHit(q, c.names) || nameHit(q, c.laterNames));
}

const STOP = new Set(['कौन', 'सा', 'से', 'की', 'का', 'के', 'में', 'है', 'क्या', 'फ़ैसला', 'फैसला', 'निर्णय', 'case', 'judgment', 'ruling', 'which', 'पर', 'और', 'को', 'था', 'हैं', 'बताओ', 'बताइए']);

export function rankCases(q: string, limit = 3): CaseCand[] {
  const n = norm(q);
  const words = n.split(' ').filter((w) => w.length > 1 && !STOP.has(w));
  const alias = ALIASES.exec(n)?.[2] ?? '';
  const scored = candidates().map((c) => {
    let s = 0;
    if (nameHit(q, c.names) || (alias && c.names.some((nm) => nm.includes(alias)))) s += 100;
    if (nameHit(q, c.laterNames) || (alias && c.laterNames.some((nm) => nm.includes(alias)))) s += 40;
    for (const w of words) if (c.hay.includes(w)) s += 10;
    return { c, s };
  }).filter((x) => x.s >= (ASK.test(q) ? 10 : 20)); // "हथकड़ी पर कौन सा फ़ैसला" — one topic word is enough
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.c);
}

function trim(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n).trim()}…` : t;
}

function cite(c: CaseCand): string {
  return [c.meta.caseName || c.para?.en, c.meta.citation].filter(Boolean).join(' — ');
}

export async function lookupCases(query: string): Promise<CaseLookupResult> {
  const hits = rankCases(query, 3);
  if (!hits.length) {
    return {
      content: 'इस विषय पर कोई पुलिस-संबंधी निर्णय नोट नहीं मिला। केस का नाम (जैसे "Joginder Kumar", "D.K. Basu") या विषय (गिरफ़्तारी, FIR, हथकड़ी) लिखकर पूछें, या विधि पुस्तकालय → न्यायिक निर्णय खोलें।',
      suggestedActions: ['Joginder Kumar का फ़ैसला', 'D.K. Basu के निर्देश'],
      matchedIds: [],
    };
  }
  const [first, ...rest] = hits;
  const s = parseRegSections(first.row.description);
  const items = parseSimpleItems(s.simple.body);
  // Section 2 blocks: "न्यायालय ने क्या कहा" bullets, ✔ / ✘ lines, ⚠ updates
  const held: string[] = [];
  let inHeld = false;
  for (const it of items) {
    if (it.kind === 'heading') inHeld = it.text.startsWith('न्यायालय');
    else if (inHeld && it.kind === 'bullet') held.push(it.text);
  }
  const dos = items.filter((x) => x.kind === 'do').slice(0, 4);
  const donts = items.filter((x) => x.kind === 'dont').slice(0, 3);
  const updates = items.filter((x) => x.kind === 'update').slice(0, 3);
  const out: string[] = [
    `### ⚖️ ${s.title || first.para?.t || first.row.title}`,
    `**${cite(first)}**${first.meta.courtName ? ` · ${first.meta.courtName}` : ''}\n`,
  ];
  if (held.length) { out.push('**न्यायालय ने क्या कहा:**'); for (const h of held.slice(0, 5)) out.push(`- ${h}`); }
  if (dos.length) { out.push('\n**पुलिस के लिए — क्या करें:**'); for (const d of dos) out.push(`✔ ${d.text}`); }
  if (donts.length) { out.push('\n**क्या न करें:**'); for (const d of donts) out.push(`✘ ${d.text}`); }
  if (updates.length) { out.push('\n**आज की स्थिति (अद्यतन):**'); for (const u of updates) out.push(`⚠ ${u.text}`); }
  out.push(`\n[📖 पूरा नोट खोलें](${first.id})`);
  if (rest.length) {
    out.push('\n**मिलते-जुलते निर्णय:**');
    for (const r of rest) out.push(`- [${cite(r)}](${r.id})`);
  }
  out.push('\n⚠️ सिटेशन मूल निर्णय से मिलाएँ — यह 1990 के दशक के संकलन पर आधारित अध्ययन नोट है।');
  return {
    content: out.join('\n'),
    suggestedActions: rest.slice(0, 2).map((r) => `${(r.meta.caseName || r.para?.en || '').split(/\s+v\.?\s+/i)[0]} का फ़ैसला`).filter((x) => x.length > 5),
    matchedIds: hits.map((h) => h.id),
  };
}

export const CASE_ANSWER_RULES = [
  'न्यायिक निर्णय (पुलिस) — उत्तर के नियम:',
  '1. सरल हिंदी में उत्तर दें; हर निर्णय का नाम और सिटेशन (नीचे दिए पाठ से) लिखें।',
  '2. अलग रखें: मामला/न्यायालय ने क्या कहा, पुलिस के लिए क्या करें/क्या न करें, और "⚠ अद्यतन" (आज BNSS/नए फ़ैसलों से स्थिति)।',
  '3. कोई केस नाम, सिटेशन या धारा अपने मन से न बनाएँ — केवल नीचे दिए नोट्स से।',
  '4. उत्तर के अंत में लिखें: "सिटेशन मूल निर्णय से मिलाएँ"।',
].join('\n');

/** Context for the online model: rules + sections 2 and 4 of the top 3 notes. */
export function buildCaseContext(query: string): string {
  const hits = rankCases(query, 3);
  if (!hits.length) return `${CASE_ANSWER_RULES}\n\n(कोई मिलता निर्णय नोट नहीं मिला — अपने मन से निर्णय न बताएँ।)`;
  const blocks = hits.map((c) => {
    const s = parseRegSections(c.row.description);
    return [
      `=== ${cite(c)} — ${s.title || c.para?.t || ''}`,
      `सरल हिंदी:\n${trim(s.simple.body, 2200)}`,
      `संबंधित:\n${trim(s.related.body, 1200)}`,
    ].join('\n');
  });
  return `${CASE_ANSWER_RULES}\n\n${blocks.join('\n\n')}`;
}

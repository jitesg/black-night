/**
 * regLookup.ts — Copilot REG_LOOKUP: answers questions about UP Police
 * Regulations from the bundled paragraphs (offline) and builds the context
 * block + answer rules for the online model (Task L35).
 */
import { REG_SEED_ROWS, type RegSeedRow } from '@/lib/regulations/regSeedFiles';
import { getRegIndex, getRegPara, getRegProgress } from '@/lib/regulations/regIndex';
import {
  extractParaNo, paraIdFromNo, parseRegSections, parseSimpleItems, searchParas,
  type RegPara, type RegSearchItem,
} from '@/lib/regulations/regCore';

export interface RegLookupResult {
  content: string;
  suggestedActions: string[];
  matchedIds: string[];
}

const EXPLICIT = /(regulation|रेगुलेशन|रेग्युलेशन|पुलिस\s*रेगुलेशन|police\s*reg|\buppr\b|पैरा\s*[०-९\d]|\bpara\s*\d|\breg\.?\s*\d)/i;

// Topics that live in the Regulations (checked only after SOP / circular).
const TOPICS = /(malkhana|मालखाना|माल\s*खाना|inquest|पंचायतनामा|panchayatnama|बदमाश\s*रजिस्टर|badmash|history\s*sheet|हिस्ट्री\s*शीट|हिस्ट्रीशीट|fir\s*entry|चेक\s*रसीद|check\s*receipt|form\s*341|general\s*diary|जी\.?डी\.?\s*(?:नियम|लिखने)|रोजनामचा|surveillance|निगरानी\s*रजिस्टर|village\s*crime|ग्राम\s*अपराध|चौकीदार|beat\s*book|बीट\s*बुक|case\s*diary\s*rule|हवालात|lock[\s-]?up|शव\s*परीक्षण|post[\s-]?mortem)/i;

const HELP_FIND = /^(पैरा\s*खोजें|para\s*khoje[nm]?|find\s*para)$/i;
const HELP_ASK = /^(रेगुलेशन\s*में\s*पूछें|regulation\s*me\s*puchhe[nm]?|ask\s*regulations?)$/i;

/** Explicit regulation questions (checked before SOP / circular). */
export function isExplicitRegQuery(q: string): boolean {
  if (!q) return false;
  const t = q.trim();
  return HELP_FIND.test(t) || HELP_ASK.test(t) || EXPLICIT.test(t);
}

/** Topic-only regulation questions (checked after SOP / circular). */
export function isRegTopicQuery(q: string): boolean {
  return !!q && TOPICS.test(q);
}

interface Candidate extends RegSearchItem { row: RegSeedRow; para: RegPara | null }

let _candidates: Candidate[] | null = null;
function candidates(): Candidate[] {
  if (_candidates) return _candidates;
  _candidates = REG_SEED_ROWS.map((row) => {
    const para = getRegPara(row.id);
    return {
      id: row.id,
      no: para?.no ?? (row.title.match(/पैरा\s*([\w-]+)/)?.[1] ?? ''),
      title: `${row.title} ${para?.t ?? ''}`,
      en: para?.en ?? '',
      tags: row.tags ?? '',
      row,
      para,
    };
  });
  return _candidates;
}

// Hindi topic words → words used in the English titles of the book.
const SYNONYMS: [RegExp, string][] = [
  [/मालखाना|माल\s*खाना/i, 'malkhana property'],
  [/पंचायतनामा|panchayatnama|शव/i, 'inquest'],
  [/बदमाश|हिस्ट्री\s*शीट|हिस्ट्रीशीट/i, 'history sheet'],
  [/निगरानी/i, 'surveillance'],
  [/चौकीदार/i, 'chaukidar'],
  [/रोजनामचा|जी\.?डी/i, 'general diary'],
  [/हवालात/i, 'lock-up'],
  [/बरामद\s*माल/i, 'property recovered'],
];

function expand(query: string): string {
  let q = query;
  for (const [re, add] of SYNONYMS) if (re.test(query)) q += ` ${add}`;
  return q;
}

function cleanQuery(query: string): string {
  // Strip trigger words so they do not dominate the score.
  const cleaned = query
    .replace(/(up\s*police\s*regulations?|regulations?|रेगुलेशन्?स?|पुलिस|uppr|क्या\s*कहता\s*है|kya\s*kehta\s*hai|बताइए|बताओ|\sमें\s|नियम)/gi, ' ')
    .trim();
  return expand(cleaned || query);
}

export interface RankedPara { id: string; no: string; t: string; cand: Candidate | null }

/**
 * Ranks all 509 paragraphs (book order index) for a question. Paragraphs
 * whose text is in the app carry `cand`; others are listed as "coming".
 * A para number in the question returns just that paragraph.
 */
export function rankParas(query: string, limit = 3): RankedPara[] {
  const list = candidates();
  const byId = new Map(list.map((c) => [c.id, c]));
  const idx = getRegIndex();
  const no = extractParaNo(query);
  if (no) {
    const id = paraIdFromNo(no);
    const p = idx?.paras[id];
    const cand = byId.get(id) ?? null;
    if (cand || p) return [{ id, no: p?.no ?? no, t: p?.t ?? cand?.title ?? '', cand }];
  }
  const pool: RegSearchItem[] = idx
    ? Object.entries(idx.paras).map(([id, p]) => {
        const cand = byId.get(id);
        return { id, no: p.no, title: cand ? cand.title : p.t, en: p.en, tags: cand?.tags ?? '' };
      })
    : list;
  return searchParas(pool, cleanQuery(query), limit, 20).map((x) => ({
    id: x.id,
    no: x.no,
    t: idx?.paras[x.id]?.t ?? x.title,
    cand: byId.get(x.id) ?? null,
  }));
}

/** Paragraphs with text in the app, best first (for answers and context). */
export function retrieveParas(query: string, limit = 3): Candidate[] {
  return rankParas(query, limit + 3).map((r) => r.cand).filter((c): c is Candidate => !!c).slice(0, limit);
}

function trim(s: string, n: number): string {
  const t = s.replace(/\s+\n/g, '\n').trim();
  return t.length > n ? `${t.slice(0, n).trim()}…` : t;
}

function lawLine(p: RegPara | null): string[] {
  if (!p?.law?.length) return [];
  return p.law.map((l) => `- ${l.old} → ${l.new.join(', ')}${l.n ? ` — ${l.n}` : ''}${l.u ? ' (सत्यापित करें)' : ''}`);
}

function formatPara(c: Candidate): string {
  const s = parseRegSections(c.row.description);
  const p = c.para;
  const out: string[] = [];
  out.push(`### 📘 UPPR पैरा ${c.no} — ${p?.t ?? s.title}`);
  if (s.breadcrumb) out.push(`${s.breadcrumb}\n`);

  if (!p?.done || s.simple.pending) {
    out.push('ℹ️ इस पैरा की सरल हिंदी व्याख्या अभी तैयार नहीं है (केवल मूल पाठ)। नीचे मूल अंग्रेज़ी पाठ दिया है:\n');
    out.push(`> ${trim(s.original.body, 600).replace(/\n/g, '\n> ')}`);
  } else {
    const items = parseSimpleItems(s.simple.body);
    const bullets = items.filter((i) => i.kind === 'bullet').slice(0, 8);
    const updates = items.filter((i) => i.kind === 'update');
    out.push('**Regulation क्या कहता है:**');
    for (const b of bullets) out.push(`- ${b.text}`);
    const laws = lawLine(p);
    if (laws.length || updates.length) {
      out.push('\n**नया कानून (BNSS / BNS / BSA):**');
      out.push(...laws);
      for (const u of updates) out.push(`⚠ ${u.text}`);
    }
    if (p.cases?.length) {
      out.push('\n**न्यायिक निर्णय** (न्यायालय में उपयोग से पहले मूल निर्णय से मिलान करें):');
      for (const cs of p.cases) out.push(`- ${cs.n}${cs.c ? ` ${cs.c}` : ''}${cs.p ? ` — ${cs.p}` : ''}${cs.u ? ' **(verify before use / सत्यापित करें)**' : ''}`);
    }
  }
  out.push(`\n[📖 पैरा ${c.no} खोलें](${c.id})`);
  return out.join('\n');
}

export async function lookupRegulations(query: string): Promise<RegLookupResult> {
  const q = query.trim();
  const prog = getRegProgress();
  if (HELP_FIND.test(q) || HELP_ASK.test(q)) {
    return {
      content: [
        '### 📘 UP Police Regulations',
        `ऐप में ${prog.total} पैरा की सूची है; ${REG_SEED_ROWS.length} पैरा का पाठ उपलब्ध है (हिंदी तैयार: ${prog.done})।\n`,
        'ऐसे पूछें:',
        '- **पैरा 97 क्या कहता है** — पैरा नंबर से',
        '- **मालखाना के नियम** / **पंचायतनामा** — विषय से',
        '- **UPPR पैरा 104** — सीधे पैरा',
        '\nपूरी सूची: ज्ञान → विधि पुस्तकालय → UP Police Regulations।',
      ].join('\n'),
      suggestedActions: ['पैरा 97 क्या कहता है', 'पैरा 104 क्या कहता है', 'मालखाना रेगुलेशन'],
      matchedIds: [],
    };
  }

  const ranked = rankParas(q, 4);
  const matches = ranked.map((r) => r.cand).filter((c): c is Candidate => !!c).slice(0, 3);
  const later = ranked.filter((r) => !r.cand).slice(0, 3);
  // Best match is a paragraph whose text has not arrived yet: say so first,
  // and only link the weaker matches we do have.
  if (ranked[0] && !ranked[0].cand && matches.length > 0) {
    return {
      content: [
        '📘 इस विषय के मुख्य पैरा UP Police Regulations में हैं, पर इनका पाठ अगले अपडेट में ऐप में आएगा:',
        ...later.map((x) => `- UPPR पैरा ${x.no} — ${x.t}`),
        '\n**ऐप में उपलब्ध, कुछ हद तक संबंधित पैरा:**',
        ...matches.map((m) => `- [UPPR पैरा ${m.no} — ${m.para?.t ?? m.row.title}](${m.id})${m.para?.done ? '' : ' (केवल मूल पाठ)'}`),
        '\nमुख्य पैरा का पाठ आने तक मैं उसका विवरण अनुमान से नहीं बताऊँगा।',
      ].join('\n'),
      suggestedActions: matches.slice(0, 2).map((m) => `पैरा ${m.no} क्या कहता है`),
      matchedIds: matches.map((m) => m.id),
    };
  }

  if (matches.length === 0) {
    let content: string;
    if (later.length === 1 && extractParaNo(q)) {
      const k = later[0];
      content = `📘 **UPPR पैरा ${k.no} — ${k.t}**\n\nइस पैरा का पाठ अभी ऐप में नहीं आया है (अगले अपडेट में)। मैं इसका कोई पाठ अनुमान से नहीं बताऊँगा।`;
    } else if (later.length) {
      content = [
        '📘 इस विषय के ये पैरा UP Police Regulations में हैं, पर इनका पाठ अगले अपडेट में ऐप में आएगा:',
        ...later.map((x) => `- UPPR पैरा ${x.no} — ${x.t}`),
        '\nपाठ आने तक मैं इनका विवरण अनुमान से नहीं बताऊँगा।',
      ].join('\n');
    } else {
      content = 'UP Police Regulations में इससे मिलता पैरा नहीं मिला। पैरा नंबर (जैसे "पैरा 97") या विषय (मालखाना, पंचायतनामा) लिखकर पूछें।';
    }
    return { content, suggestedActions: ['पैरा खोजें', 'पैरा 97 क्या कहता है'], matchedIds: [] };
  }

  const [first, ...rest] = matches;
  const parts = [formatPara(first)];
  if (rest.length) {
    parts.push('\n---\n**मिलते-जुलते पैरा:**');
    for (const r of rest) parts.push(`- [UPPR पैरा ${r.no} — ${r.para?.t ?? r.row.title}](${r.id})${r.para?.done ? '' : ' (केवल मूल पाठ)'}`);
  }
  if (later.length) {
    parts.push('\n**ये पैरा भी संबंधित हैं (पाठ अगले अपडेट में):**');
    for (const x of later) parts.push(`- UPPR पैरा ${x.no} — ${x.t}`);
  }
  parts.push('\n⚠️ यह उत्तर ऐप के रेगुलेशन पाठ से है; आदेश/GO के लिए मूल स्रोत देखें।');
  return {
    content: parts.join('\n'),
    suggestedActions: [`पैरा ${first.no} खोलें`, ...rest.map((r) => `पैरा ${r.no} क्या कहता है`)].slice(0, 3),
    matchedIds: matches.map((m) => m.id),
  };
}

export const REG_ANSWER_RULES = [
  'UP POLICE REGULATIONS — उत्तर के नियम:',
  '1. सरल हिंदी में उत्तर दें और हर बात के साथ "UPPR पैरा N" लिखें।',
  '2. दो भाग अलग रखें: "Regulation क्या कहता है" और "नया कानून (BNSS/BNS/BSA)"।',
  '3. जिस पैरा पर "केवल मूल पाठ" लिखा है, उसके लिए बताएँ कि हिंदी व्याख्या अभी तैयार नहीं है और केवल अंग्रेज़ी मूल पाठ से उत्तर दें।',
  '4. कोई पैरा नंबर, GO नंबर या केस साइटेशन अपने मन से न बनाएँ — केवल नीचे दिए पाठ से।',
  '5. जिन निर्णयों पर "सत्यापित करें" लिखा है, उन्हें "verify before use" कहें।',
].join('\n');

/** Context block for the online model: rules + top 3 paragraphs. */
export function buildRegContext(query: string): string {
  const matches = retrieveParas(query, 3);
  if (matches.length === 0) return `${REG_ANSWER_RULES}\n\n(कोई मिलता पैरा नहीं मिला — पाठ से बाहर का पैरा न बताएँ।)`;
  const blocks = matches.map((c) => {
    const s = parseRegSections(c.row.description);
    const ready = !!c.para?.done && !s.simple.pending;
    const cases = (c.para?.cases ?? []).map((cs) => `${cs.n} ${cs.c ?? ''}${cs.u ? ' [सत्यापित करें]' : ''}`).join('; ');
    return [
      `=== UPPR पैरा ${c.no} — ${c.para?.t ?? s.title} ${ready ? '' : '[केवल मूल पाठ]'}`,
      `मूल पाठ (अंश): ${trim(s.original.body, 600)}`,
      ready ? `सरल हिंदी:\n${s.simple.body}` : '',
      !s.related.pending ? `संबंधित:\n${s.related.body}` : '',
      cases ? `निर्णय: ${cases}` : '',
    ].filter(Boolean).join('\n');
  });
  return `${REG_ANSWER_RULES}\n\n${blocks.join('\n\n')}`;
}

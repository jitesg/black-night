/**
 * regLookup.ts — Copilot REG_LOOKUP: answers questions about UP Police
 * Regulations (L35) and the POCSO Act 2012 (L36) from the bundled text
 * (offline) and builds the context block + answer rules for the online model.
 */
import { REG_SEED_ROWS, type RegSeedRow } from '@/lib/regulations/regSeedFiles';
import { getRegIndex, getRegPara, getRegProgress } from '@/lib/regulations/regIndex';
import { getById as getSopIndexById } from '@/ai/sopIndex';
import {
  ACT_META, actOfId, compareSectionNo, extractParaNo, paraIdFromNo, parseRegSections, parseSimpleItems, searchParas,
  type RegAct, type RegPara, type RegSearchItem,
} from '@/lib/regulations/regCore';

export interface RegLookupResult {
  content: string;
  suggestedActions: string[];
  matchedIds: string[];
}

const POCSO_WORDS = /(pocso|पॉक्सो|पोक्सो|बाल\s*यौन|child\s*sexual|बाल\s*अपराध\s*यौन)/i;

const EXPLICIT = /(regulation|रेगुलेशन|रेग्युलेशन|पुलिस\s*रेगुलेशन|police\s*reg|\buppr\b|पैरा\s*[०-९\d]|\bpara\s*\d|\breg\.?\s*\d|pocso|पॉक्सो|पोक्सो|बाल\s*यौन|child\s*sexual)/i;

// Topics that live in the Regulations (checked only after SOP / circular).
const TOPICS = /(malkhana|मालखाना|माल\s*खाना|inquest|पंचायतनामा|panchayatnama|बदमाश\s*रजिस्टर|badmash|history\s*sheet|हिस्ट्री\s*शीट|हिस्ट्रीशीट|fir\s*entry|चेक\s*रसीद|check\s*receipt|form\s*341|general\s*diary|जी\.?डी\.?\s*(?:नियम|लिखने)|रोजनामचा|surveillance|निगरानी\s*रजिस्टर|village\s*crime|ग्राम\s*अपराध|चौकीदार|beat\s*book|बीट\s*बुक|case\s*diary\s*rule|हवालात|lock[\s-]?up|शव\s*परीक्षण|post[\s-]?mortem)/i;

// A child victim is involved (→ also show the UP SOP for rape).
const CHILD_VICTIM = /(pocso|पॉक्सो|पोक्सो|बच्च|बालक|बालिका|नाबालिग|child|minor|किशोरी)/i;
const RAPE_SOP_ID = 'sys-sop-up-b2-19';

const HELP_FIND = /^(पैरा\s*खोजें|para\s*khoje[nm]?|find\s*para)$/i;
const HELP_ASK = /^(रेगुलेशन\s*में\s*पूछें|regulation\s*me\s*puchhe[nm]?|ask\s*regulations?)$/i;

/** Explicit regulation / POCSO questions (checked before SOP / circular). */
export function isExplicitRegQuery(q: string): boolean {
  if (!q) return false;
  const t = q.trim();
  return HELP_FIND.test(t) || HELP_ASK.test(t) || EXPLICIT.test(t);
}

/** Topic-only regulation questions (checked after SOP / circular). */
export function isRegTopicQuery(q: string): boolean {
  return !!q && TOPICS.test(q);
}

/** Which Act a question is about. */
export function queryAct(q: string): RegAct {
  return POCSO_WORDS.test(q) ? 'pocso' : 'uppr';
}

interface Candidate extends RegSearchItem { row: RegSeedRow; para: RegPara | null; act: RegAct }

let _candidates: Candidate[] | null = null;
function candidates(): Candidate[] {
  if (_candidates) return _candidates;
  _candidates = REG_SEED_ROWS.map((row) => {
    const para = getRegPara(row.id);
    return {
      id: row.id,
      no: para?.no ?? (row.title.match(/(?:पैरा|धारा)\s*([\w-]+)/)?.[1] ?? ''),
      title: `${row.title} ${para?.t ?? ''}`,
      en: para?.en ?? '',
      tags: row.tags ?? '',
      row,
      para,
      act: actOfId(row.id),
    };
  });
  return _candidates;
}

function label(act: RegAct, no: string): string {
  const m = ACT_META[act];
  return `${m.prefix} ${m.unit} ${no}`;
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
  [/\bfir\b|एफआईआर|प्राथमिकी/i, 'reporting रिपोर्टिंग'],
];

function expand(query: string): string {
  let q = query;
  for (const [re, add] of SYNONYMS) if (re.test(query)) q += ` ${add}`;
  return q;
}

function cleanQuery(query: string): string {
  // Strip trigger words so they do not dominate the score.
  const cleaned = query
    .replace(/(up\s*police\s*regulations?|regulations?|रेगुलेशन्?स?|पुलिस|uppr|pocso|पॉक्सो|पोक्सो|act|अधिनियम|क्या\s*कहता\s*है|क्या\s*कहती\s*है|kya\s*kehta\s*hai|बताइए|बताओ|\sमें\s|नियम|कब|ज़रूरी|जरूरी|है)/gi, ' ')
    .trim();
  return expand(cleaned || query);
}

export interface RankedPara { id: string; no: string; t: string; act: RegAct; cand: Candidate | null }

/**
 * Ranks the rows of one Act for a question. Rows whose text is in the app
 * carry `cand`; others are listed as "coming". A para / section number in
 * the question returns just that row.
 */
export function rankParas(query: string, limit = 3): RankedPara[] {
  const act = queryAct(query);
  const list = candidates().filter((c) => c.act === act);
  const byId = new Map(list.map((c) => [c.id, c]));
  const idx = getRegIndex();
  const no = extractParaNo(query);
  if (no) {
    const id = paraIdFromNo(no, act);
    const p = idx?.paras[id];
    const cand = byId.get(id) ?? null;
    if (cand || p) return [{ id, no: p?.no ?? no, t: p?.t ?? cand?.title ?? '', act, cand }];
  }
  const pool: RegSearchItem[] = idx
    ? Object.entries(idx.paras)
        .filter(([id]) => actOfId(id) === act)
        .map(([id, p]) => {
          const cand = byId.get(id);
          return { id, no: p.no, title: cand ? cand.title : p.t, en: p.en, tags: cand?.tags ?? '' };
        })
    : list;
  return searchParas(pool, cleanQuery(query), limit, 20).map((x) => ({
    id: x.id,
    no: x.no,
    t: idx?.paras[x.id]?.t ?? x.title,
    act,
    cand: byId.get(x.id) ?? null,
  }));
}

/** Rows with text in the app, best first (for answers and context). */
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

function casesLines(p: RegPara | null): string[] {
  if (!p?.cases?.length) return [];
  return [
    '\n**न्यायिक निर्णय** (न्यायालय में उपयोग से पहले मूल निर्णय से मिलान करें):',
    ...p.cases.map((cs) => `- ${cs.n}${cs.c ? ` ${cs.c}` : ''}${cs.p ? ` — ${cs.p}` : ''}${cs.u ? ' **(verify before use / सत्यापित करें)**' : ''}`),
  ];
}

function formatPara(c: Candidate): string {
  const s = parseRegSections(c.row.description);
  const p = c.para;
  const out: string[] = [];
  const unit = ACT_META[c.act].unit;
  out.push(`### 📘 ${label(c.act, c.no)} — ${p?.t ?? s.title}`);
  if (s.breadcrumb) out.push(`${s.breadcrumb}\n`);

  if (!p?.done || s.simple.pending) {
    out.push(`ℹ️ इस ${unit} की सरल हिंदी व्याख्या अभी तैयार नहीं है (केवल मूल पाठ)। नीचे मूल अंग्रेज़ी पाठ दिया है:\n`);
    out.push(`> ${trim(s.original.body, 600).replace(/\n/g, '\n> ')}`);
  } else if (c.act === 'pocso') {
    const items = parseSimpleItems(s.simple.body);
    const bullets = items.filter((i) => i.kind === 'bullet').slice(0, 8);
    const updates = items.filter((i) => i.kind === 'update');
    out.push('**(क) मूल 2012 पाठ क्या कहता है:**');
    for (const b of bullets) out.push(`- ${b.text}`);
    if (updates.length) {
      out.push('\n**(ख) 2019 संशोधन / POCSO Rules 2020 — अद्यतन:**');
      for (const u of updates) out.push(`⚠ ${u.label ? `${u.label}: ` : ''}${u.text}`);
    }
    const laws = lawLine(p);
    if (laws.length) {
      out.push('\n**(ग) BNS / BNSS mapping:**');
      out.push(...laws);
    }
    out.push(...casesLines(p));
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
    out.push(...casesLines(p));
  }
  out.push(`\n[📖 ${unit} ${c.no} खोलें](${c.id})`);
  return out.join('\n');
}

/** POCSO extras: statement reminder + rape SOP link for child victims. */
function pocsoExtras(query: string, first: Candidate | undefined): string[] {
  const out: string[] = [];
  const sec = first?.para?.no ?? '';
  const aboutStatement = /(बयान|statement|पीड़ित|पीड़िता|victim|fir|एफआईआर|रिपोर्ट|report)/i.test(query)
    || (sec && compareSectionNo(sec, '19') >= 0 && compareSectionNo(sec, '27') <= 0);
  if (aboutStatement) {
    out.push('\n📝 **याद रखें:** बच्चे का बयान POCSO धारा 24–26 के अनुसार दर्ज करें — बच्चे के घर या उसकी पसंद की जगह, महिला पुलिस अधिकारी (उप-निरीक्षक से कम नहीं), वर्दी में नहीं, भरोसेमंद व्यक्ति की उपस्थिति में, और आरोपी से कोई संपर्क न हो।');
  }
  if (CHILD_VICTIM.test(query)) {
    const sop = getSopIndexById(RAPE_SOP_ID);
    if (sop) out.push(`\n📋 **संबंधित SOP (UP पुलिस):** [${sop.title}](sop:${RAPE_SOP_ID})`);
  }
  out.push('\n🔒 पीड़ित की पहचान (नाम, पता, स्कूल, फोटो) किसी भी दस्तावेज़/संदेश में उजागर न करें — POCSO धारा 23, BNS 72।');
  return out;
}

export async function lookupRegulations(query: string): Promise<RegLookupResult> {
  const q = query.trim();
  if (HELP_FIND.test(q) || HELP_ASK.test(q)) {
    const prog = getRegProgress('uppr');
    const pp = getRegProgress('pocso');
    return {
      content: [
        '### 📘 UP Police Regulations · POCSO Act 2012',
        `UP Regulations: ${prog.total} पैरा की सूची (हिंदी तैयार: ${prog.done})। POCSO: ${pp.total} धाराएँ (हिंदी तैयार: ${pp.done})।\n`,
        'ऐसे पूछें:',
        '- **पैरा 97 क्या कहता है** — पैरा नंबर से',
        '- **मालखाना के नियम** / **पंचायतनामा** — विषय से',
        '- **POCSO धारा 19** / **POCSO में बयान कैसे लें** — POCSO से',
        '\nपूरी सूची: ज्ञान → विधि पुस्तकालय → "UP Police Regulations" या "POCSO" card।',
      ].join('\n'),
      suggestedActions: ['पैरा 97 क्या कहता है', 'POCSO धारा 19', 'मालखाना रेगुलेशन'],
      matchedIds: [],
    };
  }

  const act = queryAct(q);
  const name = ACT_META[act].name;
  const ranked = rankParas(q, 4);
  const matches = ranked.map((r) => r.cand).filter((c): c is Candidate => !!c).slice(0, 3);
  const later = ranked.filter((r) => !r.cand).slice(0, 3);
  // Best match is a row whose text has not arrived yet: say so first,
  // and only link the weaker matches we do have.
  if (ranked[0] && !ranked[0].cand && matches.length > 0) {
    return {
      content: [
        `📘 इस विषय के मुख्य अंश ${name} में हैं, पर इनका पाठ अगले अपडेट में ऐप में आएगा:`,
        ...later.map((x) => `- ${label(x.act, x.no)} — ${x.t}`),
        '\n**ऐप में उपलब्ध, कुछ हद तक संबंधित:**',
        ...matches.map((m) => `- [${label(m.act, m.no)} — ${m.para?.t ?? m.row.title}](${m.id})${m.para?.done ? '' : ' (केवल मूल पाठ)'}`),
        '\nमुख्य पाठ आने तक मैं उसका विवरण अनुमान से नहीं बताऊँगा।',
      ].join('\n'),
      suggestedActions: matches.slice(0, 2).map((m) => `${label(m.act, m.no)} क्या कहता है`),
      matchedIds: matches.map((m) => m.id),
    };
  }

  if (matches.length === 0) {
    let content: string;
    if (later.length === 1 && extractParaNo(q)) {
      const k = later[0];
      content = `📘 **${label(k.act, k.no)} — ${k.t}**\n\nइसका पाठ अभी ऐप में नहीं आया है (अगले अपडेट में)। मैं इसका कोई पाठ अनुमान से नहीं बताऊँगा।`;
    } else if (later.length) {
      content = [
        `📘 इस विषय के ये अंश ${name} में हैं, पर इनका पाठ अगले अपडेट में ऐप में आएगा:`,
        ...later.map((x) => `- ${label(x.act, x.no)} — ${x.t}`),
        '\nपाठ आने तक मैं इनका विवरण अनुमान से नहीं बताऊँगा।',
      ].join('\n');
    } else {
      content = act === 'pocso'
        ? 'POCSO Act में इससे मिलती धारा नहीं मिली। धारा नंबर (जैसे "POCSO धारा 19") या विषय (रिपोर्टिंग, बयान, मेडिकल, विशेष न्यायालय) लिखकर पूछें।'
        : 'UP Police Regulations में इससे मिलता पैरा नहीं मिला। पैरा नंबर (जैसे "पैरा 97") या विषय (मालखाना, पंचायतनामा) लिखकर पूछें।';
    }
    return { content, suggestedActions: ['पैरा खोजें', act === 'pocso' ? 'POCSO धारा 19' : 'पैरा 97 क्या कहता है'], matchedIds: [] };
  }

  const [first, ...rest] = matches;
  const parts = [formatPara(first)];
  if (rest.length) {
    parts.push(`\n**${act === 'pocso' ? 'मिलती-जुलती धाराएँ' : 'मिलते-जुलते पैरा'}:**`);
    for (const r of rest) parts.push(`- [${label(r.act, r.no)} — ${r.para?.t ?? r.row.title}](${r.id})${r.para?.done ? '' : ' (केवल मूल पाठ)'}`);
  }
  if (later.length) {
    parts.push('\n**ये भी संबंधित हैं (पाठ अगले अपडेट में):**');
    for (const x of later) parts.push(`- ${label(x.act, x.no)} — ${x.t}`);
  }
  if (act === 'pocso') parts.push(...pocsoExtras(q, first));
  parts.push(act === 'pocso'
    ? '\n⚠️ यह उत्तर ऐप के POCSO पाठ (2012 मूल + अद्यतन पंक्तियाँ) से है; न्यायालय में उपयोग से पहले India Code का नवीनतम पाठ देखें।'
    : '\n⚠️ यह उत्तर ऐप के रेगुलेशन पाठ से है; आदेश/GO के लिए मूल स्रोत देखें।');
  const unit = ACT_META[act].unit;
  return {
    content: parts.join('\n'),
    suggestedActions: [`${act === 'pocso' ? 'POCSO ' : ''}${unit} ${first.no} खोलें`, ...rest.map((r) => `${label(r.act, r.no)} क्या कहता है`)].slice(0, 3),
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

export const POCSO_ANSWER_RULES = [
  'POCSO ACT 2012 — उत्तर के नियम:',
  '1. सरल हिंदी में उत्तर दें और हर बात के साथ "POCSO धारा N" लिखें।',
  '2. हमेशा तीन भाग अलग रखें: (क) मूल 2012 पाठ, (ख) 2019 संशोधन / POCSO Rules 2020 वाला अद्यतन, (ग) BNS/BNSS mapping।',
  '3. कोई धारा नंबर, GO नंबर या केस साइटेशन अपने मन से न बनाएँ — केवल नीचे दिए पाठ से।',
  '4. जिन निर्णयों पर "सत्यापित करें" लिखा है, उन्हें "verify before use" कहें।',
  '5. पीड़ित की पहचान वाली कोई जानकारी (नाम, पता, स्कूल, रिश्तेदार, फोटो) उत्तर में न लिखें।',
  '6. जहाँ प्रासंगिक हो, याद दिलाएँ कि बच्चे का बयान POCSO धारा 24–26 के अनुसार दर्ज करना है।',
].join('\n');

/** Context block for the online model: rules + top 3 rows. */
export function buildRegContext(query: string): string {
  const act = queryAct(query);
  const rules = act === 'pocso' ? POCSO_ANSWER_RULES : REG_ANSWER_RULES;
  const matches = retrieveParas(query, 3);
  if (matches.length === 0) return `${rules}\n\n(कोई मिलता अंश नहीं मिला — पाठ से बाहर की धारा/पैरा न बताएँ।)`;
  const blocks = matches.map((c) => {
    const s = parseRegSections(c.row.description);
    const ready = !!c.para?.done && !s.simple.pending;
    const cases = (c.para?.cases ?? []).map((cs) => `${cs.n} ${cs.c ?? ''}${cs.u ? ' [सत्यापित करें]' : ''}`).join('; ');
    return [
      `=== ${label(c.act, c.no)} — ${c.para?.t ?? s.title} ${ready ? '' : '[केवल मूल पाठ]'}`,
      `मूल पाठ (अंश): ${trim(s.original.body, 600)}`,
      ready ? `सरल हिंदी:\n${s.simple.body}` : '',
      !s.related.pending ? `संबंधित:\n${s.related.body}` : '',
      cases ? `निर्णय: ${cases}` : '',
    ].filter(Boolean).join('\n');
  });
  let extra = '';
  if (act === 'pocso' && CHILD_VICTIM.test(query)) {
    const sop = getSopIndexById(RAPE_SOP_ID);
    if (sop) extra = `\n\n=== संबंधित UP SOP: ${sop.title} (${RAPE_SOP_ID})`;
  }
  return `${rules}\n\n${blocks.join('\n\n')}${extra}`;
}

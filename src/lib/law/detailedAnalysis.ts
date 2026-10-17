/**
 * Detailed Law Analysis Loader & Suggester ("विस्तृत विश्लेषण")
 * Merges assets/law/explain_1.json, explain_2.json, explain_3.json, explain_4.json, and explain_5.json lazily in memory.
 * Offline only, try/catch safe, never throws.
 */

import { type ActId } from './lawLibrary';

declare const require: any;

export interface ClarifyingQuestion {
  q: string;
  y: string;
  n: string;
}

export interface ExampleScenario {
  t: 'o' | 'h'; // 'o' = official illustration printed in bare act, 'h' = helper scenario written by us
  q: string;   // situation / facts
  a: string;   // legal analysis
}

export interface DetailedExplainEntry {
  t?: string; // tier e.g. "A"
  s?: string; // summary
  k?: string[]; // key points
  el?: string[]; // essential elements / ingredients
  fir?: string[]; // what to write in FIR
  ev?: string[]; // evidence to collect
  df?: string[]; // differences from nearby sections
  mist?: string[]; // common mistakes
  p?: string; // police practical note
  q?: ClarifyingQuestion[]; // clarifying questions
  ex?: ExampleScenario[]; // examples
  kw?: string[]; // keywords in Hindi / Hinglish / English
}

export interface SectionSuggestion {
  act: ActId;
  n: number;
  title: string;
  summary: string;
  score: number;
  matchedKeywords: string[];
  entry: DetailedExplainEntry;
  relatedSection?: string;
}

export interface RankedSuggestionsResult {
  primary: SectionSuggestion[];
  secondary: SectionSuggestion[];
  all: SectionSuggestion[];
  isWeakQuery: boolean;
  weakDetailChips: string[];
}

let cachedMergedData: Record<string, Record<string, DetailedExplainEntry>> | null = null;

/**
 * Lazy load and merge explain_1.json, explain_2.json, explain_3.json, explain_4.json, and explain_5.json into one in-memory map.
 */
export function getAllDetailedExplainData(): Record<string, Record<string, DetailedExplainEntry>> {
  if (cachedMergedData) return cachedMergedData;

  try {
    let data1: any = null;
    let data2: any = null;
    let data3: any = null;
    let data4: any = null;
    let data5: any = null;
    try { data1 = require('../../../assets/law/explain_1.json'); } catch {}
    try { data2 = require('../../../assets/law/explain_2.json'); } catch {}
    try { data3 = require('../../../assets/law/explain_3.json'); } catch {}
    try { data4 = require('../../../assets/law/explain_4.json'); } catch {}
    try { data5 = require('../../../assets/law/explain_5.json'); } catch {}

    const merged: Record<string, Record<string, DetailedExplainEntry>> = {};

    for (const dataset of [data1, data2, data3, data4, data5]) {
      if (!dataset || typeof dataset !== 'object') continue;
      for (const act of Object.keys(dataset)) {
        if (!merged[act]) merged[act] = {};
        const actEntries = dataset[act];
        if (actEntries && typeof actEntries === 'object') {
          for (const [secNum, entry] of Object.entries(actEntries)) {
            merged[act][secNum] = entry as DetailedExplainEntry;
          }
        }
      }
    }

    cachedMergedData = merged;
    return cachedMergedData;
  } catch {
    cachedMergedData = {};
    return cachedMergedData;
  }
}

/**
 * Get detailed explanation for a given act and section number.
 */
export function getDetailedExplain(act: ActId, n: number): DetailedExplainEntry | null {
  const data = getAllDetailedExplainData();
  const actEntries = data[act];
  if (!actEntries) return null;
  return actEntries[String(n)] || null;
}

/**
 * Check if a detailed explanation exists for an act and section number.
 */
export function hasDetailedExplain(act: ActId, n: number): boolean {
  const data = getAllDetailedExplainData();
  return Boolean(data[act]?.[String(n)]);
}

/**
 * Tokenize and normalize text for typo-tolerant matching
 */
export function tokenizeAndNormalize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\u0900-\u097Fa-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

// ── Stop-words for Section Suggester (Hindi / Hinglish / English) ─────────────
export const STOP_WORDS = new Set([
  // Hindi grammatical markers & postpositions
  'ne', 'ka', 'ki', 'ke', 'ko', 'se', 'me', 'mein', 'par', 'pe',
  'hai', 'hain', 'ho', 'tha', 'thi', 'the', 'thii', 'thaa',
  'kiya', 'kar', 'kare', 'karein', 'karta', 'karti', 'karte', 'kiye',
  'hua', 'hui', 'hue', 'gaya', 'gayi', 'gaye', 'raha', 'rahi', 'rahe',
  'liya', 'diya', 'le', 'de', 'di', 'hoga', 'hogi',
  'aur', 'ya', 'bhi', 'to', 'tak', 'parantu',
  // Generic nouns & pronouns
  'ek', 'aadmi', 'vyakti', 'person', 'log', 'logon', 'man', 'woman',
  'kisi', 'kisko', 'kise', 'usne', 'unhone', 'unhe', 'use', 'unka', 'unke', 'unki',
  'uska', 'uske', 'uski', 'mera', 'meri', 'mere', 'apna', 'apne', 'apni',
  'yeh', 'ye', 'voh', 'woh', 'wo',
  'kuch', 'koi', 'kya', 'kyon', 'kyun', 'kaha', 'kahan', 'kaise', 'kab',
  'ghar', 'jagah', 'sthan', 'chiz', 'cheez', 'mamla', 'matter', 'incident',
  'jhagda', 'ladai', 'vivad', 'lafda', 'kalesh', 'baat',
  'dhara', 'section', 'act', 'kanoon', 'law', 'batao', 'suggest', 'fir', 'likhun', 'likhe',
  // English common stop-words
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from',
  'is', 'was', 'were', 'are', 'been', 'has', 'have', 'had', 'do', 'does', 'did'
]);

let cachedKwRarity: Map<string, number> | null = null;

/**
 * Compute keyword rarity once across all explanation datasets and cache.
 * Returns map of lowercase keyword -> count of sections it appears in.
 */
export function getKwRarityMap(): Map<string, number> {
  if (cachedKwRarity) return cachedKwRarity;
  const data = getAllDetailedExplainData();
  const rarity = new Map<string, number>();

  for (const act of Object.keys(data)) {
    const actEntries = data[act as ActId];
    if (!actEntries) continue;
    for (const [, entry] of Object.entries(actEntries)) {
      const kws = entry.kw || [];
      const seen = new Set<string>();
      for (const kw of kws) {
        const norm = kw.toLowerCase().trim();
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        rarity.set(norm, (rarity.get(norm) || 0) + 1);
      }
    }
  }

  cachedKwRarity = rarity;
  return cachedKwRarity;
}

/**
 * Phonetic normalization for typo and spelling variations in Hinglish/Hindi
 */
export function normalizeHinglishToken(t: string): string {
  return t
    .toLowerCase()
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/jh/g, 'j')
    .replace(/ch+/g, 'ch')
    .replace(/sh/g, 's')
    .replace(/([a-z])\1+/g, '$1');
}

/**
 * Extract root offence stem from title for family grouping / deduplication
 */
function getTitleOffenceStem(title: string): string {
  const norm = title
    .toLowerCase()
    .replace(/\b(punishment for|voluntarily causing|by dangerous weapons|by means|giving|fabricating|in dwelling house|etc|of valuable security|by clerk or servant|by personation|wrongfully concealing or keeping in confinement|attempt to)\b/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();
  const stems = [
    'false evidence', 'snatching', 'theft', 'robbery', 'dacoity',
    'cheating', 'forgery', 'hurt', 'grievous hurt', 'assault',
    'kidnapping', 'abduction', 'rape', 'sexual harassment', 'modesty',
    'cruelty', 'dowry death', 'murder', 'unlawful assembly', 'rioting',
    'trespass', 'mischief', 'breach of trust', 'extortion'
  ];
  for (const s of stems) {
    if (norm.includes(s)) return s;
  }
  return norm.split(/\s+/).slice(0, 2).join(' ');
}

/**
 * Check if two sections belong to the same offence family (definition + punishment, twin variants)
 */
function areNearTwinSections(a: SectionSuggestion, b: SectionSuggestion): boolean {
  if (a.act !== b.act) return false;
  if (a.act === 'BNS') {
    const minN = Math.min(a.n, b.n);
    const maxN = Math.max(a.n, b.n);
    // False evidence: 227 & 228 & 229
    if (minN === 227 && (maxN === 228 || maxN === 229)) return true;
    if (minN === 228 && maxN === 229) return true;
    // Kidnapping: 137 & 138, 137 & 139, 137 & 140, 97 & 137
    if (minN === 137 && (maxN === 138 || maxN === 139 || maxN === 140)) return true;
    if (minN === 97 && maxN === 137) return true;
    // Theft variants: 303 & 305, 303 & 306
    if (minN === 303 && (maxN === 305 || maxN === 306)) return true;
    // Hurt variants: 115 & 116, 117 & 118
    if (minN === 115 && maxN === 116) return true;
    if (minN === 117 && maxN === 118) return true;
    // Rape variants: 63 & 64
    if (minN === 63 && maxN === 64) return true;
    // Cheating: 318 & 319
    if (minN === 318 && maxN === 319) return true;
    // Forgery: 335 & (336, 337, 338)
    if (minN === 335 && (maxN === 336 || maxN === 337 || maxN === 338)) return true;
    // Trespass: 329 & 330
    if (minN === 329 && maxN === 330) return true;
    // Insult: 351 & 352
    if (minN === 351 && maxN === 352) return true;
  }

  // Same title stem
  const stemA = getTitleOffenceStem(a.title);
  const stemB = getTitleOffenceStem(b.title);
  if (stemA && stemB && stemA === stemB) return true;

  // Check df definition / punishment reference
  const aRefB = a.entry?.df?.some(line => (line.includes(`${b.act} ${b.n}`) || line.includes(` ${b.n} `)) && (line.includes('सज़ा') || line.includes('परिभाषा')));
  const bRefA = b.entry?.df?.some(line => (line.includes(`${a.act} ${a.n}`) || line.includes(` ${a.n} `)) && (line.includes('सज़ा') || line.includes('परिभाषा')));
  if (aRefB || bRefA) return true;

  return false;
}

/**
 * Unified Section Ranking Helper (Shared across Copilot & FIR screen)
 *
 * Rules:
 * 1. Stop-words: Ignores generic words in scoring (Hindi/Hinglish/English).
 * 2. Hard minimum: Candidate only if:
 *    (a) at least 2 distinct query terms match kw/title/summary, OR
 *    (b) one kw matches AND that kw is a multi-word phrase or rare term (appears in <= 3 sections).
 * 3. Relative cutoff: Keep only sections with score >= 55% of top score; absolute cap = 3 default.
 * 4. Show-more: Up to 3 more (score >= 35% of top, max 6 total).
 * 5. De-duplicate near-twins: Show higher-ranked with "संबंधित: BNS xxx".
 * 6. Weak query: If nothing passes, returns isWeakQuery: true with 3 detail chips.
 */
export function rankSectionSuggestions(
  query: string,
  getSectionFn?: (act: ActId, n: number) => { title: string } | null
): RankedSuggestionsResult {
  const weakResult: RankedSuggestionsResult = {
    primary: [],
    secondary: [],
    all: [],
    isWeakQuery: true,
    weakDetailChips: ['किसने/किसके साथ', 'किस चीज़ से/हथियार', 'चोट/नुकसान/संपत्ति?'],
  };

  if (!query || !query.trim()) return weakResult;

  const normQuery = query.toLowerCase();
  const rawTokens = normQuery.replace(/[^\w\s\u0900-\u097F]/g, ' ').split(/\s+/).filter(Boolean);
  const queryTokens = rawTokens.filter((t) => !STOP_WORDS.has(t));

  if (queryTokens.length === 0) {
    return weakResult;
  }

  const normQueryHinglish = queryTokens.map(normalizeHinglishToken).join(' ');
  const kwRarity = getKwRarityMap();
  const allData = getAllDetailedExplainData();
  const candidates: SectionSuggestion[] = [];

  for (const actKey of Object.keys(allData)) {
    const act = actKey as ActId;
    const actEntries = allData[act];
    if (!actEntries) continue;

    for (const [secStr, entry] of Object.entries(actEntries)) {
      const n = parseInt(secStr, 10);
      if (isNaN(n)) continue;

      let secTitle = '';
      if (getSectionFn) {
        const sec = getSectionFn(act, n);
        if (sec) secTitle = sec.title;
      }

      const normTitle = (secTitle || '').toLowerCase();
      const normSummary = (entry.s || '').toLowerCase();
      const keywords = entry.kw || [];

      // Check Hard Minimum Rule:
      // (a) at least 2 distinct query terms match its kw/title/summary
      // (b) one kw matches AND that kw is a multi-word phrase or rare term (appears in <= 3 sections)
      const distinctMatchedTerms = new Set<string>();
      let matchedRareOrPhraseKw = false;
      const matchedKwList: string[] = [];

      for (const t of queryTokens) {
        let termMatched = false;
        const tH = normalizeHinglishToken(t);

        if (normTitle.includes(t)) termMatched = true;
        if (normSummary.includes(t)) termMatched = true;

        for (const kw of keywords) {
          const normKw = kw.toLowerCase().trim();
          const kwH = normalizeHinglishToken(normKw);
          const kwWords = normKw.split(/\s+/);
          const kwHWords = kwWords.map(normalizeHinglishToken);

          if (kwWords.includes(t) || normKw === t || kwHWords.includes(tH) || kwH === tH) {
            termMatched = true;
            if (!matchedKwList.includes(kw)) matchedKwList.push(kw);
          } else if (t.length >= 4 && (normKw.includes(t) || kwH.includes(tH))) {
            termMatched = true;
            if (!matchedKwList.includes(kw)) matchedKwList.push(kw);
          }
        }
        if (termMatched) distinctMatchedTerms.add(t);
      }

      // Check full kw phrase matches in query
      for (const kw of keywords) {
        const normKw = kw.toLowerCase().trim();
        const kwH = normalizeHinglishToken(normKw);
        const isMultiWord = normKw.split(/\s+/).length > 1;
        const isRare = (kwRarity.get(normKw) || 0) <= 3;

        if (isMultiWord && (normQuery.includes(normKw) || normQueryHinglish.includes(kwH))) {
          if (!matchedKwList.includes(kw)) matchedKwList.push(kw);
          matchedRareOrPhraseKw = true;
        } else if (isRare && (queryTokens.includes(normKw) || queryTokens.map(normalizeHinglishToken).includes(kwH))) {
          if (!matchedKwList.includes(kw)) matchedKwList.push(kw);
          matchedRareOrPhraseKw = true;
        }
      }

      const passesRule2 = (distinctMatchedTerms.size >= 2) || matchedRareOrPhraseKw;
      if (!passesRule2) continue;

      // Scoring
      let score = 0;
      score += distinctMatchedTerms.size * 20;

      for (const kw of matchedKwList) {
        const nkw = kw.toLowerCase().trim();
        if (normQuery.includes(nkw)) {
          score += 40; // exact phrase match in query
        } else {
          score += 15;
        }
      }

      for (const t of queryTokens) {
        if (normTitle.includes(t)) score += 25;
      }

      // Targeted penal / procedural relevance boosts
      if (act === 'BNS') {
        if (n === 304 && /chheen|snatch|mobile.*chheen/i.test(normQuery)) score += 35;
        if (n === 303 && /chori|theft/i.test(normQuery)) score += 20;
        if (n === 309 && /loot|robbery/i.test(normQuery)) score += 25;
        if (n === 118 && /chaku.*hamla|knife.*attack|chaku/i.test(normQuery)) score += 40;
        if (n === 109 && /chaku.*hamla|jaan.*marne/i.test(normQuery)) score += 30;
        if (n === 115 && /hamla|chot|marpeet/i.test(normQuery)) score += 20;
        if (n === 117 && /hamla|chot|marpeet|gambhir/i.test(normQuery)) score += 22;
        if (n === 137 && /kidnap|bachch.*kidnap/i.test(normQuery)) score += 40;
        if (n === 142 && /kidnap|bachch.*kidnap/i.test(normQuery)) score += 28;
        if (n === 227 && /jhooth|gawahi/i.test(normQuery)) score += 50;
        if (n === 228 && /jhooth|gawahi/i.test(normQuery)) score += 30;
        if (n === 229 && /jhooth|gawahi/i.test(normQuery)) score += 20;
        if ((n === 64 || n === 66) && /rape|balatkar/i.test(normQuery)) score += 25;
        if (n === 78 && /stalking|peecha/i.test(normQuery)) score += 25;
        if ((n === 318 || n === 319) && /dhokhadhadi|cheating|dhokha/i.test(normQuery)) score += 22;
        if (n === 335 && /jaali\s*dastavez|forgery/i.test(normQuery)) score += 22;
        if (n === 106 && /lapravahi\s*se\s*maut|negligent\s*death/i.test(normQuery)) score += 25;
        if (n === 105 && /gair[- ]iradatan\s*hatya/i.test(normQuery)) score += 25;
        if (n === 330 && /ghar\s*me\s*ghusna|house[- ]breaking/i.test(normQuery)) score += 25;
      } else if (act === 'BSA') {
        if (n === 63 && /whatsapp|chat|cctv|video|electronic|digital|certificate|63/i.test(normQuery)) score += 30;
        if (n === 104 && /bojh|bhar|burden/i.test(normQuery)) score += 20;
      } else if (act === 'BNSS') {
        if (n === 53 && /arrest.*medical|medical/i.test(normQuery)) score += 25;
        if (n === 105 && /videography|tall?ash|video/i.test(normQuery)) score += 25;
        if (n === 173 && /zero\s*fir|fir\s*darj|fir\s*kaise/i.test(normQuery)) score += 25;
        if (n === 176 && /forensic/i.test(normQuery)) score += 25;
        if (n === 180 && /gawah.*bayan/i.test(normQuery)) score += 25;
        if (n === 183 && /magistrate.*bayan|confession/i.test(normQuery)) score += 25;
        if (n === 187 && /remand|custody/i.test(normQuery)) score += 25;
        if (n === 193 && /chargesheet|aarop\s*patra/i.test(normQuery)) score += 25;
        if (n === 482 && /anticipatory|agrim\s*zamanat/i.test(normQuery)) score += 25;
        if (n === 480 && /bail|jamanat|zamanat/i.test(normQuery)) score += 20;
      }

      candidates.push({
        act,
        n,
        title: secTitle || `Section ${n}`,
        summary: entry.s || '',
        score,
        matchedKeywords: matchedKwList.slice(0, 3),
        entry,
      });
    }
  }

  if (candidates.length === 0) {
    return weakResult;
  }

  // Sort candidates by score descending
  const ACT_WEIGHT: Record<ActId, number> = { BNS: 1, BNSS: 2, BSA: 3 };
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const actDiff = (ACT_WEIGHT[a.act] || 9) - (ACT_WEIGHT[b.act] || 9);
    if (actDiff !== 0) return actDiff;
    return a.n - b.n;
  });

  const topScore = candidates[0].score;

  // De-duplicate near-twins (keep higher ranked, annotate with "संबंधित: BNS xxx")
  const deduplicated: SectionSuggestion[] = [];
  for (const cand of candidates) {
    const existing = deduplicated.find((d) => areNearTwinSections(d, cand));
    if (existing) {
      if (!existing.relatedSection) {
        // Special case for false evidence: BNS 227 -> संबंधित: BNS 228
        if (existing.act === 'BNS' && existing.n === 227 && (cand.n === 228 || cand.n === 229)) {
          existing.relatedSection = 'BNS 228';
        } else {
          existing.relatedSection = `${cand.act} ${cand.n}`;
        }
      }
    } else {
      deduplicated.push(cand);
    }
  }

  // Primary: >= 55% of top score, cap = 3
  const primary = deduplicated.filter((c) => c.score >= 0.55 * topScore).slice(0, 3);

  // Secondary: next best >= 35% of top score, cap = 3 (max 6 total)
  const secondary = deduplicated
    .filter((c) => !primary.includes(c) && c.score >= 0.35 * topScore)
    .slice(0, 3);

  const all = [...primary, ...secondary];
  const isWeak = primary.length === 0;

  return {
    primary,
    secondary,
    all,
    isWeakQuery: isWeak,
    weakDetailChips: isWeak ? weakResult.weakDetailChips : [],
  };
}

/**
 * Backward-compatible helper for callers that want an array of suggestions
 */
export function suggestSections(
  query: string,
  getSectionFn?: (act: ActId, n: number) => { title: string } | null,
  limit: number = 3,
  showAll: boolean = false
): SectionSuggestion[] {
  const res = rankSectionSuggestions(query, getSectionFn);
  const list = showAll ? res.all : res.primary;
  return list.slice(0, limit);
}

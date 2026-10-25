/**
 * lawLibrary.ts
 *
 * Core pure library for official Act texts:
 * - Bharatiya Nyaya Sanhita, 2023 (BNS) - 358 sections
 * - Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) - 531 sections
 * - Bharatiya Sakshya Adhiniyam, 2023 (BSA) - 170 sections
 *
 * Lazy-loads JSON assets on first access.
 * Pure logic — no React hooks or components.
 */

import { logger } from '../logger';
import { getAllSimpleData, getSimple } from './simpleExplain';
import { getAllDetailedExplainData } from './detailedAnalysis';
import {
  type OldActId,
  type OldLawReference,
  type NewSectionTarget,
  type ParsedOldLawQuery,
  getOldLawForNew,
  getNewSectionsForOld,
  parseOldLawQuery,
  getOldActForNew,
  getLawMapData,
} from './lawMapping';

export {
  type OldActId,
  type OldLawReference,
  type NewSectionTarget,
  type ParsedOldLawQuery,
  getOldLawForNew,
  getNewSectionsForOld,
  parseOldLawQuery,
  getOldActForNew,
  getLawMapData,
};

declare const require: any;

export type ActId = 'BNS' | 'BNSS' | 'BSA';

export interface ActMeta {
  id: ActId;
  nameEn: string;
  nameHi: string;
  shortHi: string;
  total: number;
  citation: string;
}

export const ACTS: Record<ActId, ActMeta> = {
  BNS: {
    id: 'BNS',
    nameEn: 'Bharatiya Nyaya Sanhita, 2023',
    nameHi: 'भारतीय न्याय संहिता, 2023',
    shortHi: 'बीएनएस',
    total: 358,
    citation: 'Act No. 45 of 2023',
  },
  BNSS: {
    id: 'BNSS',
    nameEn: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    nameHi: 'भारतीय नागरिक सुरक्षा संहिता, 2023',
    shortHi: 'बीएनएसएस',
    total: 531,
    citation: 'Act No. 46 of 2023',
  },
  BSA: {
    id: 'BSA',
    nameEn: 'Bharatiya Sakshya Adhiniyam, 2023',
    nameHi: 'भारतीय साक्ष्य अधिनियम, 2023',
    shortHi: 'बीएसए',
    total: 170,
    citation: 'Act No. 47 of 2023',
  },
};

export interface SectionItem {
  n: number;
  title: string;
  text: string;
  schedule?: {
    first_schedule_notes?: string;
    second_schedule_forms?: string;
  };
  classification_of_offences?: ClassificationRow[];
}

export interface ClassificationVariant {
  cognizable?: string;
  bailable?: string;
  court?: string;
  punishment?: string;
}

export interface ClassificationRow {
  sec: string;
  offence: string;
  punishment: string;
  cognizable: string;
  bailable: string;
  court: string;
  page?: number | string;
  variants?: ClassificationVariant[];
}

export type OffenceClassificationRow = ClassificationRow;

export interface SectionRef {
  act: ActId;
  n: number;
  sub?: string;
}

export interface LawSearchResult {
  act: ActId;
  n: number;
  title: string;
  snippet: string;
  score: number;
  oldLawMapping?: {
    oldAct: OldActId;
    oldSec: string;
    displayLabel: string;
  };
}

export interface LawLinkItem {
  act: ActId;
  n: number;
  title: string;
}

export interface LawLinksResult {
  refs: LawLinkItem[];
  citedBy: LawLinkItem[];
}

export interface LawLinkCounts {
  refsCount: number;
  citedByCount: number;
  total: number;
}

// ── Cache for loaded sections and links ───────────────────────────────────────
let bnsCache: SectionItem[] | null = null;
let bnssCache: SectionItem[] | null = null;
let bsaCache: SectionItem[] | null = null;
let linksCache: Record<string, Record<string, { refs?: [string, number][]; cited_by?: [string, number][] }>> | null = null;

// Prebuilt lowercase caches for fast search
let searchCache: Map<string, {
  titleLower: string;
  textLower: string;
  simpleLower: string;
  simpleRaw: string;
  explainLower: string;
  explainRaw: string;
}> | null = null;

function loadActData(act: ActId): SectionItem[] {
  try {
    if (act === 'BNS') {
      if (!bnsCache) {
        bnsCache = require('../../../assets/law/bns_en.json') as SectionItem[];
      }
      return bnsCache;
    }
    if (act === 'BNSS') {
      if (!bnssCache) {
        bnssCache = require('../../../assets/law/bnss_en.json') as SectionItem[];
      }
      return bnssCache;
    }
    if (act === 'BSA') {
      if (!bsaCache) {
        bsaCache = require('../../../assets/law/bsa_en.json') as SectionItem[];
      }
      return bsaCache;
    }
  } catch (err) {
    logger.warn(`[lawLibrary] Failed to load Act data for ${act}:`, err);
  }
  return [];
}

/** Get all sections of an Act */
export function getSections(act: ActId): SectionItem[] {
  return loadActData(act);
}

/** Get section count of an Act */
export function getSectionCount(act: ActId): number {
  const sections = loadActData(act);
  return sections.length || ACTS[act]?.total || 0;
}

/** Get a single section by Act and section number */
export function getSection(act: ActId, n: number): SectionItem | null {
  const sections = loadActData(act);
  if (!sections || sections.length === 0) return null;
  // Fast 1-based index lookup since sections are 1..N
  if (n >= 1 && n <= sections.length && sections[n - 1]?.n === n) {
    return sections[n - 1];
  }
  return sections.find((s) => s.n === n) ?? null;
}

/**
 * Parses a section reference from a query or citation string.
 * Examples:
 * "BNS 103(1)", "BNSS 35", "धारा 103 BNS", "bsa-63", "103 बीएनएस", "धारा 35 बीएनएसएस"
 */
/**
 * A section number without an Act: "103", "धारा 103", "दफा 103", "section 103",
 * "sec. 103", "u/s 103(1)", "धारा १०३". Returns null for anything else.
 */
export function parseBareSectionNumber(str: string): number | null {
  if (!str) return null;
  const s = str.trim().toLowerCase().replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
  const m = s.match(/^(?:धारा|दफा|दफ़ा|section|sec\.?|s\.|u\/s\.?)?\s*(\d{1,3})\s*(?:\(\s*[a-z0-9]+\s*\))*\s*$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : null;
}

export function parseSectionRef(str: string): SectionRef | null {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim().toLowerCase().replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));

  // Match act identifier (BNSS must precede BNS to avoid prefix collision)
  let act: ActId | null = null;
  if (s.includes('bnss') || s.includes('बीएनएसएस')) act = 'BNSS';
  else if (s.includes('bns') || s.includes('बीएनएस')) act = 'BNS';
  else if (s.includes('bsa') || s.includes('बीएसए')) act = 'BSA';

  if (!act) return null;

  // Extract section number and optional subsection e.g. (1)
  const numMatch = s.match(/(?:धारा\s*|sec(?:tion)?\.?\s*|-|\s)?(\d+)(?:\s*\(([a-z0-9]+)\))?/i);
  if (!numMatch) return null;

  const n = parseInt(numMatch[1], 10);
  if (isNaN(n) || n <= 0) return null;

  const sub = numMatch[2] ? `(${numMatch[2]})` : undefined;
  return { act, n, ...(sub ? { sub } : {}) };
}

/**
 * Extracts and deduplicates section references from unformatted free text.
 */
export function extractRefs(text: string): SectionRef[] {
  if (!text || typeof text !== 'string') return [];
  const results: SectionRef[] = [];
  const seen = new Set<string>();

  function add(actStr: string, numStr: string, subStr?: string) {
    const s = actStr.toLowerCase();
    let act: ActId | null = null;
    if (s.includes('bnss') || s.includes('बीएनएसएस')) act = 'BNSS';
    else if (s.includes('bns') || s.includes('बीएनएस')) act = 'BNS';
    else if (s.includes('bsa') || s.includes('बीएसए')) act = 'BSA';
    if (!act) return;

    const n = parseInt(numStr, 10);
    if (isNaN(n) || n <= 0) return;

    const sub = subStr ? `(${subStr})` : undefined;
    const key = `${act}:${n}:${sub || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ act, n, ...(sub ? { sub } : {}) });
    }
  }

  // Pattern 1: Act then number (e.g. "BNS 103(1)", "BNSS 35", "bsa-63")
  const regex1 = /(?:धारा\s*|sec(?:tion)?\.?\s*)?(bnss|bns|bsa|बीएनएसएस|बीएनएस|बीएसए)[\s\-_.]*(?:धारा\s*|sec(?:tion)?\.?\s*)?(\d+)(?:\s*\(([a-z0-9]+)\))?/gi;
  let m: RegExpExecArray | null;
  while ((m = regex1.exec(text)) !== null) {
    add(m[1], m[2], m[3]);
  }

  // Pattern 2: Number then act (e.g. "103 बीएनएस", "धारा 35 बीएनएसएस", "103(1) BNS")
  const regex2 = /(?:धारा\s*|sec(?:tion)?\.?\s*)?(\d+)(?:\s*\(([a-z0-9]+)\))?[\s\-_.]+(bnss|bns|bsa|बीएनएसएस|बीएनएस|बीएसए)/gi;
  while ((m = regex2.exec(text)) !== null) {
    add(m[3], m[1], m[2]);
  }

  return results;
}

function makeSnippet(text: string, matchIndex: number, len = 160): string {
  if (!text) return '';
  const start = Math.max(0, matchIndex - Math.floor(len / 4));
  const end = Math.min(text.length, start + len);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

/** Prebuild lowercase cache lazily for fast search (<150 ms) */
function ensureSearchCache() {
  if (searchCache) return;
  searchCache = new Map();
  const simpleData = getAllSimpleData();
  const detailedData = getAllDetailedExplainData();
  const acts: ActId[] = ['BNS', 'BNSS', 'BSA'];
  for (const act of acts) {
    const list = loadActData(act);
    for (const sec of list) {
      const sim = simpleData?.[act]?.[String(sec.n)];
      const simpleText = sim ? `${sim.s || ''} ${(sim.k || []).join(' ')}` : '';
      const det = detailedData?.[act]?.[String(sec.n)];
      const detText = det ? `${det.s || ''} ${(det.kw || []).join(' ')}` : '';
      searchCache.set(`${act}:${sec.n}`, {
        titleLower: sec.title.toLowerCase(),
        textLower: sec.text.toLowerCase(),
        simpleLower: simpleText.toLowerCase(),
        simpleRaw: simpleText,
        explainLower: detText.toLowerCase(),
        explainRaw: detText,
      });
    }
  }
}

const ACT_ORDER: Record<ActId, number> = { BNS: 1, BNSS: 2, BSA: 3 };

function loadLinksData(): Record<string, Record<string, { refs?: [string, number][]; cited_by?: [string, number][] }>> | null {
  if (linksCache) return linksCache;
  try {
    linksCache = require('../../../assets/law/law_links.json');
    return linksCache;
  } catch (err) {
    logger.warn('[lawLibrary] Failed to load law_links.json:', err);
    return null;
  }
}

/**
 * Returns cross-act and intra-act links for a section:
 * - refs: sections mentioned in THIS section's official text
 * - citedBy: sections whose text mentions THIS section
 * Dropping pairs whose section does not exist; deduplicated; sorted by BNS, BNSS, BSA then section number.
 */
export function getLinks(act: ActId, n: number): LawLinksResult {
  const emptyResult: LawLinksResult = { refs: [], citedBy: [] };
  try {
    const data = loadLinksData();
    if (!data) return emptyResult;
    const actData = data[act];
    if (!actData) return emptyResult;
    const entry = actData[String(n)];
    if (!entry) return emptyResult;

    const parsePairList = (pairs?: [string, number][]): LawLinkItem[] => {
      if (!Array.isArray(pairs) || pairs.length === 0) return [];
      const seen = new Set<string>();
      const items: LawLinkItem[] = [];

      for (const pair of pairs) {
        if (!pair || !Array.isArray(pair) || pair.length < 2) continue;
        const targetAct = pair[0] as ActId;
        const targetN = typeof pair[1] === 'number' ? pair[1] : parseInt(String(pair[1]), 10);
        if (!targetAct || isNaN(targetN) || targetN <= 0) continue;
        if (targetAct !== 'BNS' && targetAct !== 'BNSS' && targetAct !== 'BSA') continue;

        const key = `${targetAct}:${targetN}`;
        if (seen.has(key)) continue;

        // Verify section actually exists
        const sec = getSection(targetAct, targetN);
        if (!sec) continue;

        seen.add(key);
        items.push({
          act: targetAct,
          n: targetN,
          title: sec.title,
        });
      }

      // Sort: BNS, BNSS, BSA, then section number
      items.sort((a, b) => {
        const orderDiff = (ACT_ORDER[a.act] ?? 99) - (ACT_ORDER[b.act] ?? 99);
        if (orderDiff !== 0) return orderDiff;
        return a.n - b.n;
      });

      return items;
    };

    return {
      refs: parsePairList(entry.refs),
      citedBy: parsePairList(entry.cited_by),
    };
  } catch (err) {
    logger.warn(`[lawLibrary] Error in getLinks(${act}, ${n}):`, err);
    return emptyResult;
  }
}

/**
 * Returns link counts for a section.
 */
export function getLinkCounts(act: ActId, n: number): LawLinkCounts {
  const links = getLinks(act, n);
  return {
    refsCount: links.refs.length,
    citedByCount: links.citedBy.length,
    total: links.refs.length + links.citedBy.length,
  };
}

/**
 * Searches across one or all three Acts.
 * - Exact section number or ref matches first.
 * - Lowercase tokens (>= 2 chars).
 * - Matches title, text, and simple explanation (s and k).
 * - Score: 5 * title hit + 1 * text hit + 4 * simple hit per token.
 * - Prefers all tokens matched (AND logic), falling back to any token (OR).
 * - Generates 160-char snippet around first match.
 */
export function searchLaw(
  query: string,
  options?: { act?: ActId; limit?: number }
): LawSearchResult[] {
  if (!query || !query.trim()) return [];
  const q = query.trim();
  const limit = options?.limit ?? 30;
  const targetActs: ActId[] = options?.act ? [options.act] : ['BNS', 'BNSS', 'BSA'];
  const results: LawSearchResult[] = [];

  // Check if query is an act reference
  const ref = parseSectionRef(q);
  if (ref && targetActs.includes(ref.act)) {
    const sec = getSection(ref.act, ref.n);
    if (sec) {
      results.push({
        act: ref.act,
        n: sec.n,
        title: sec.title,
        snippet: sec.text.slice(0, 160).replace(/\s+/g, ' ').trim(),
        score: 1000,
      });
    }
  }

  // Check if query is a bare section number: "103", "धारा 103", "section 103", "u/s 103(1)", "धारा १०३"
  const numOnly = parseBareSectionNumber(q) ?? NaN;
  if (!ref && !isNaN(numOnly)) {
    for (const a of targetActs) {
      const sec = getSection(a, numOnly);
      if (sec) {
        results.push({
          act: a,
          n: sec.n,
          title: sec.title,
          snippet: sec.text.slice(0, 160).replace(/\s+/g, ' ').trim(),
          score: 500,
        });
      }
    }
  }

  // Check if query is an old law reference (e.g. "IPC 302", "ipc302", "302 ipc", "CrPC 154", "crpc 41", "IEA 65B", "section 420 ipc", "498a ipc", "65b")
  const oldRef = parseOldLawQuery(q);
  if (oldRef) {
    const targets = getNewSectionsForOld(oldRef.oldAct, oldRef.oldSec);
    for (const target of targets) {
      if (!targetActs.includes(target.act)) continue;
      const sec = getSection(target.act, target.n);
      if (sec) {
        const simple = getSimple(target.act, target.n);
        let shortTitle = '';
        if (simple?.s) {
          const firstPart = simple.s.split(/[:(]/)[0].trim().replace(/[।,.]$/, '');
          if (firstPart) shortTitle = firstPart;
        }
        if (!shortTitle) shortTitle = sec.title;
        const displayLabel = `${oldRef.oldAct} ${oldRef.oldSec} → ${target.act} ${target.n} (${shortTitle})`;
        results.push({
          act: target.act,
          n: sec.n,
          title: sec.title,
          snippet: `${displayLabel} — ${simple?.s || sec.text.slice(0, 140).replace(/\s+/g, ' ').trim()}`,
          score: 5000,
          oldLawMapping: {
            oldAct: oldRef.oldAct,
            oldSec: oldRef.oldSec,
            displayLabel,
          },
        });
      }
    }
  }

  // Token-based full text search
  const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length > 0) {
    ensureSearchCache();
    const matchedItems: Array<LawSearchResult & { allMatched: boolean }> = [];

    // Check if query matches parenthesized English term in simple explanation
    const expandedEnglishTerms: string[] = [];
    const simpleData = getAllSimpleData();
    if (simpleData) {
      for (const a of targetActs) {
        const actSim = simpleData[a];
        if (!actSim) continue;
        for (const [, d] of Object.entries(actSim)) {
          const full = `${d.s || ''} ${(d.k || []).join(' ')}`.toLowerCase();
          if (full.includes(q.toLowerCase())) {
            const matches = full.match(/\(([a-zA-Z\s]{3,})\)/g);
            if (matches) {
              for (const m of matches) {
                const cleaned = m.replace(/[()]/g, '').trim();
                if (cleaned && !expandedEnglishTerms.includes(cleaned)) {
                  expandedEnglishTerms.push(cleaned);
                }
              }
            }
          }
        }
      }
    }

    for (const a of targetActs) {
      const list = loadActData(a);
      for (const sec of list) {
        if (results.some((r) => r.act === a && r.n === sec.n)) continue;

        const cached = searchCache?.get(`${a}:${sec.n}`) ?? {
          titleLower: sec.title.toLowerCase(),
          textLower: sec.text.toLowerCase(),
          simpleLower: '',
          simpleRaw: '',
          explainLower: '',
          explainRaw: '',
        };

        let allMatched = true;
        let anyMatched = false;
        let score = 0;
        let firstIndex = -1;
        let matchedInSimple = false;
        let matchedInExplain = false;

        // Exact phrase match bonus in simple explanation
        if (cached.simpleLower && cached.simpleLower.includes(q.toLowerCase())) {
          score += 30;
          anyMatched = true;
          matchedInSimple = true;
        }

        // Exact phrase match bonus in detailed explanation (s and kw)
        if (cached.explainLower && cached.explainLower.includes(q.toLowerCase())) {
          score += 20;
          anyMatched = true;
          matchedInExplain = true;
        }

        // Expanded English terms from simple matches (e.g. burden of proof -> BSA 104-106)
        for (const en of expandedEnglishTerms) {
          if (cached.titleLower.includes(en)) {
            score += 25;
            anyMatched = true;
          } else if (cached.textLower.includes(en)) {
            score += 10;
            anyMatched = true;
          }
        }

        let tokensMatchedCount = 0;
        for (const token of tokens) {
          const tInTitle = cached.titleLower.indexOf(token);
          const tInText = cached.textLower.indexOf(token);
          const tInSimple = cached.simpleLower.indexOf(token);
          const tInExplain = cached.explainLower.indexOf(token);

          if (tInTitle !== -1 || tInText !== -1 || tInSimple !== -1 || tInExplain !== -1) {
            anyMatched = true;
            tokensMatchedCount++;
            if (tInTitle !== -1) {
              score += 5;
              if (firstIndex === -1 && tInText !== -1) firstIndex = tInText;
            }
            if (tInText !== -1) {
              score += 1;
              if (firstIndex === -1) firstIndex = tInText;
            }
            if (tInSimple !== -1) {
              score += 4;
              matchedInSimple = true;
            }
            if (tInExplain !== -1) {
              score += 3;
              matchedInExplain = true;
            }
          } else {
            allMatched = false;
          }
        }

        if (tokensMatchedCount === tokens.length && tokens.length > 0) {
          score += 10;
          allMatched = true;
        }

        if (anyMatched) {
          let snippet = '';
          if (firstIndex >= 0) {
            snippet = makeSnippet(sec.text, firstIndex);
          } else if (matchedInSimple && cached.simpleRaw) {
            const sIdx = cached.simpleLower.indexOf(tokens[0] || q.toLowerCase());
            snippet = makeSnippet(cached.simpleRaw, sIdx >= 0 ? sIdx : 0);
          } else if (matchedInExplain && cached.explainRaw) {
            const eIdx = cached.explainLower.indexOf(tokens[0] || q.toLowerCase());
            snippet = makeSnippet(cached.explainRaw, eIdx >= 0 ? eIdx : 0);
          } else {
            snippet = sec.text.slice(0, 160).replace(/\s+/g, ' ').trim();
          }

          matchedItems.push({
            act: a,
            n: sec.n,
            title: sec.title,
            snippet,
            score,
            allMatched,
          });
        }
      }
    }

    // Sort: allMatched (AND) first, then higher score, then section order
    matchedItems.sort((a, b) => {
      if (a.allMatched !== b.allMatched) return a.allMatched ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return a.n - b.n;
    });

    for (const item of matchedItems) {
      if (results.length >= limit) break;
      // Avoid duplicate sections if already present from old law mapping or ref
      if (results.some((r) => r.act === item.act && r.n === item.n)) continue;
      results.push({
        act: item.act,
        n: item.n,
        title: item.title,
        snippet: item.snippet,
        score: item.score,
      });
    }
  }

  return results.slice(0, limit);
}

/**
 * Returns BNSS Schedule I offence classification rows matching a BNS section number.
 * Performs exact number match on prefix: e.g. "103" matches "103" and "103(1)" but not "1030".
 */
export function getOffenceClassification(bnsSection: number | string): ClassificationRow[] {
  try {
    const bnss = loadActData('BNSS');
    const lastItem = bnss.length > 0 ? bnss[bnss.length - 1] : null;
    const classes = lastItem?.classification_of_offences;
    if (!Array.isArray(classes)) return [];

    const target = String(bnsSection).trim();
    if (!target) return [];

    // Match exact number at start of sec, followed by end or non-digit
    const regex = new RegExp(`^${target}(?![0-9])`);
    return classes.filter((row) => regex.test(String(row.sec || '').trim()));
  } catch (err) {
    logger.warn('[lawLibrary] getOffenceClassification error:', err);
    return [];
  }
}

/** Returns the Second Schedule Forms text from BNSS Section 531 */
export function getSecondScheduleForms(): string {
  try {
    const bnss = loadActData('BNSS');
    const last = bnss.length > 0 ? bnss[bnss.length - 1] : null;
    return last?.schedule?.second_schedule_forms ?? '';
  } catch {
    return '';
  }
}

/** Returns the First Schedule Notes text from BNSS Section 531 */
export function getFirstScheduleNotes(): string {
  try {
    const bnss = loadActData('BNSS');
    const last = bnss.length > 0 ? bnss[bnss.length - 1] : null;
    return last?.schedule?.first_schedule_notes ?? '';
  } catch {
    return '';
  }
}

/** Returns a user-friendly label for a section e.g. 'BNS 103 — Punishment for murder' */
export function getSectionLabel(act: ActId, n: number, lang?: string): string {
  const sec = getSection(act, n);
  const title = sec?.title ?? '';
  if (lang === 'hi') {
    return `${ACTS[act]?.shortHi || act} धारा ${n} — ${title}`;
  }
  return `${act} ${n} — ${title}`;
}

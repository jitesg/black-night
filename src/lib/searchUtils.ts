/**
 * Universal Smart Search Utilities
 * - Normalize queries: Hindi-aware (nukta, ँ/ं, Devanagari digits), case, whitespace
 * - matchesQuery / smartMatch: word-by-word match (all words, any order)
 * - sqlWordFilter: loose SQL LIKE pre-filter for the same rules
 * - matchesQuery: multi-field substring match
 * - fuzzyMatch: token-level Levenshtein distance for typo tolerance
 * - Highlight segments for HighlightText component
 */

// ─── Hindi-aware normalisation ────────────────────────────────────────────
// Same rules for the query and the text, so spelling variants match:
//   • Unicode NFD, then the nukta (़) is dropped: ड़ (one or two code points) = ड
//   • chandrabindu (ँ) → anusvara (ं): पाँच = पांच
//   • Devanagari digits → 0-9: १२३ = 123, उ०नि० = उ0नि0
//   • zero-width joiners and soft hyphens removed
//   • punctuation (. , ; : ( ) । …) → space; '/' and '-' are kept (123/26)
//   • lower-case, whitespace collapsed
const DEV_DIGITS = '०१२३४५६७८९';

export function searchNormalize(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/़/g, '')
    .replace(/ँ/g, 'ं')
    .replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)))
    .replace(/[​-‍­﻿]/g, '')
    .replace(/[.,;:!?()[\]{}"'`|।॥]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize a search string (Hindi-aware, see searchNormalize). */
export function normalizeQuery(q: string): string {
  return searchNormalize(q);
}

/** Normalize a haystack field the same way */
export function normalizeText(text: string | null | undefined): string {
  return searchNormalize(text);
}

/** Query → search words (normalised, empty words dropped). */
export function queryTokens(q: string): string[] {
  return searchNormalize(q).split(' ').filter(Boolean);
}

// ─── Hinglish: English typing finds Hindi text (approximate) ────────────────
// Both scripts become a consonant "sound key" (vowels dropped, aspirates and
// look-alike sounds merged): राम / ram / raam → "rm", सिंह / singh → "snh",
// शर्मा / sharma → "srm", यादव / yadav → "ydv". Used only for query words typed
// in English letters (3+ letters) when the plain match fails.
const DEV_KEY: Record<string, string> = {
  'क': 'k', 'ख': 'k', 'ग': 'g', 'घ': 'g', 'ङ': 'n', 'च': 'c', 'छ': 'c', 'ज': 'j', 'झ': 'j', 'ञ': 'n',
  'ट': 't', 'ठ': 't', 'ड': 'd', 'ढ': 'd', 'ण': 'n', 'त': 't', 'थ': 't', 'द': 'd', 'ध': 'd', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'b', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 's', 'ष': 's', 'स': 's', 'ह': 'h', 'ं': 'n', 'ः': 'h', 'ॐ': 'om',
};

/** Devanagari (normalised) → sound key; Latin letters pass through the Latin rules. */
export function soundKey(word: string): string {
  let out = '';
  for (const ch of word) {
    if (DEV_KEY[ch]) out += DEV_KEY[ch];
    else if (/[a-z]/.test(ch)) out += ch;
    // vowels, matras, virama, digits, signs: dropped
  }
  // Latin side (and mixed): digraphs and look-alike letters
  out = out
    .replace(/ksh/g, 'ks').replace(/x/g, 'ks').replace(/ngh/g, 'nh')
    .replace(/sh/g, 's').replace(/ch/g, 'c').replace(/ph/g, 'f')
    .replace(/([kgjtdpb])h/g, '$1')
    .replace(/ng(?=[^aeiou]|$)/g, 'n')
    .replace(/w/g, 'v').replace(/z/g, 'j').replace(/q/g, 'k').replace(/c(?=[eiy])/g, 's')
    .replace(/[aeiou]/g, '')
    .replace(/(.)\1+/g, '$1');
  return out;
}

const LATIN_WORD = /^[a-z][a-z]{2,}$/;

const DEVANAGARI = /[ऀ-ॿ]/;

/** Sound keys of the Hindi words of a normalised text, ' ' separated (cacheable). */
export function soundHayOf(normalizedHay: string): string {
  return ' ' + normalizedHay.split(' ').filter((w) => DEVANAGARI.test(w)).map(soundKey).filter(Boolean).join(' ');
}

/** Does an English-letter query word sound like the start of some Hindi word in the text? */
function soundMatch(token: string, normalizedHay: string, soundHay?: string): boolean {
  if (!LATIN_WORD.test(token)) return false;
  const tk = soundKey(token);
  if (tk.length < 2) return false;
  return (soundHay ?? soundHayOf(normalizedHay)).includes(' ' + tk);
}

/**
 * Word-by-word match: true when EVERY word of the query appears somewhere in
 * the given fields (any order, any field). "राम सिंह" finds "राम प्रसाद सिंह".
 * Hindi spelling variants are folded (searchNormalize). Null fields are ignored.
 */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const tokens = queryTokens(query);
  if (!tokens.length) return true;
  const hay = fields.map(searchNormalize).join(' \u0001 ');
  return tokens.every((t) => hay.includes(t) || soundMatch(t, hay));
}

// Global search options, set from the Settings store (typo tolerance applies everywhere).
let _typoTolerance = false;
export function setSearchOptions(opts: { typoTolerance?: boolean }): void {
  if (opts.typoTolerance != null) _typoTolerance = opts.typoTolerance;
}
export function isTypoTolerant(): boolean { return _typoTolerance; }

/**
 * matchesQuery + typo tolerance: a word may also match a text word with one
 * wrong letter (words of 4+ letters) when typo tolerance is on.
 */
export function smartMatch(query: string, fields: (string | null | undefined)[], typo: boolean = _typoTolerance): boolean {
  if (matchesQuery(query, ...fields)) return true;
  if (!typo) return false;
  const tokens = queryTokens(query);
  const words = fields.map(searchNormalize).join(' ').split(' ').filter(Boolean);
  return tokens.every((t) => words.some((w) => w.includes(t) || (t.length >= 4 && levenshtein(t, w) <= 1)));
}

/**
 * Same as smartMatch, for a haystack that is already searchNormalize()d
 * (lets big lists cache their normalised text instead of re-normalising per keystroke).
 */
export function matchNormalized(query: string, normalizedHay: string, typo: boolean = _typoTolerance, soundHay?: () => string): boolean {
  const tokens = queryTokens(query);
  if (!tokens.length) return true;
  if (tokens.every((t) => normalizedHay.includes(t) || soundMatch(t, normalizedHay, soundHay?.()))) return true;
  if (!typo) return false;
  const words = normalizedHay.split(' ');
  return tokens.every((t) => normalizedHay.includes(t) || (t.length >= 4 && words.some((w) => levenshtein(t, w) <= 1)));
}

// ─── SQL pre-filter ───────────────────────────────────────────────────────
// SQLite LIKE cannot fold Hindi spelling, so each word becomes a loose LIKE
// pattern (letters that can carry a nukta → %, ं/ँ and digits → _); the caller
// then keeps only real matches with matchesQuery / smartMatch on the same fields.
const NUKTA_BASES = 'कखगजडढफयर';

function likeSkeleton(token: string): string {
  let out = '';
  for (const ch of token) {
    if (NUKTA_BASES.includes(ch)) out += '%';
    else if (ch === 'ं') out += '_';
    else if (/[0-9]/.test(ch)) out += '_';
    else if (ch === '%' || ch === '_' || ch === '\\') out += `\\${ch}`;
    else out += ch;
  }
  return `%${out}%`.replace(/%+/g, '%');
}

/**
 * WHERE fragment requiring every query word to (loosely) appear in one of the
 * SQL expressions. Returns { sql: '1=1', params: [] } for an empty query.
 */
export function sqlWordFilter(exprs: string[], query: string): { sql: string; params: string[] } {
  const tokens = queryTokens(query);
  if (!tokens.length || !exprs.length) return { sql: '1=1', params: [] };
  const params: string[] = [];
  // English-letter words may match Hindi text by sound (Hinglish), which LIKE
  // cannot see — leave them to the JS check.
  const sqlTokens = tokens.filter((t) => !LATIN_WORD.test(t));
  if (!sqlTokens.length) return { sql: '1=1', params: [] };
  const parts = sqlTokens.map((t) => {
    const pat = likeSkeleton(t);
    params.push(...exprs.map(() => pat));
    return `(${exprs.map((e) => `LOWER(COALESCE(${e}, '')) LIKE ? ESCAPE '\\'`).join(' OR ')})`;
  });
  return { sql: parts.join(' AND '), params };
}

export type HighlightSegment = { text: string; highlighted: boolean };

// Regex that finds a normalised word inside the original text (any spelling variant).
const PRECOMPOSED: Record<string, string> = {
  'क': 'क़', 'ख': 'ख़', 'ग': 'ग़', 'ज': 'ज़', 'ड': 'ड़', 'ढ': 'ढ़', 'फ': 'फ़', 'य': 'य़',
};
function escapeRe(ch: string): string { return ch.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&'); }
function tokenRegexSource(token: string): string {
  let src = '';
  for (const ch of token) {
    if (/[0-9]/.test(ch)) src += `[${ch}${DEV_DIGITS[Number(ch)]}]`;
    else if (ch === 'ं') src += '[ंँ]';
    else if (PRECOMPOSED[ch]) src += `(?:${ch}़?|${PRECOMPOSED[ch]})`;
    else if (/[क-ह]/.test(ch)) src += `${ch}़?`;
    else src += escapeRe(ch);
    src += '[​-‍]?';
  }
  return src;
}

/**
 * Split `text` into segments, marking every place where a query word matches
 * (word-by-word, Hindi spelling variants included). Used by HighlightText.
 */
export function buildHighlightSegments(text: string, query: string): HighlightSegment[] {
  const tokens = queryTokens(query).sort((a, b) => b.length - a.length);
  if (!tokens.length || !text) return [{ text, highlighted: false }];
  let re: RegExp;
  try { re = new RegExp(tokens.map(tokenRegexSource).join('|'), 'gi'); } catch { return [{ text, highlighted: false }]; }
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!m[0]) { re.lastIndex += 1; continue; }
    if (m.index > cursor) segments.push({ text: text.slice(cursor, m.index), highlighted: false });
    segments.push({ text: m[0], highlighted: true });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlighted: false });
  // Hinglish: also mark Hindi words that sound like an English query word.
  const latin = tokens.filter((t) => LATIN_WORD.test(t) && soundKey(t).length >= 2).map(soundKey);
  if (latin.length) {
    const out: HighlightSegment[] = [];
    for (const seg of segments) {
      if (seg.highlighted) { out.push(seg); continue; }
      for (const part of seg.text.split(/(\s+)/)) {
        if (!part) continue;
        const w = searchNormalize(part);
        const hit = !!w && /[\u0900-\u097F]/.test(w) && latin.some((k) => soundKey(w).startsWith(k));
        const last = out[out.length - 1];
        if (last && last.highlighted === hit) last.text += part;
        else out.push({ text: part, highlighted: hit });
      }
    }
    return out.length ? out : [{ text, highlighted: false }];
  }
  return segments.length ? segments : [{ text, highlighted: false }];
}

// ─── Levenshtein distance (iterative, memory-optimised two-row) ───────────

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr: number[] = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev] = [[...curr]];
  }

  return prev[b.length];
}

/**
 * Token-level fuzzy match using Levenshtein distance.
 *
 * Splits both query and text into whitespace-delimited tokens.
 * Returns true when every query token either:
 *   (a) appears as a substring of some text token (exact case-insensitive), OR
 *   (b) has an edit distance ≤ maxDistance from some text token.
 *
 * This is a recency / typo-tolerance heuristic — it is NOT a ranking function.
 * Used only as a post-filter fallback when exact LIKE matching returns no results.
 *
 * @param query       The user's search string
 * @param text        The field value to test against
 * @param maxDistance Maximum edit distance per token (default 1)
 */
export function fuzzyMatch(query: string, text: string, maxDistance = 1): boolean {
  const nq = normalizeQuery(query);
  if (!nq) return true;
  const nt = normalizeText(text);
  if (!nt) return false;

  const queryTokens = nq.split(' ').filter(Boolean);
  const textTokens = nt.split(' ').filter(Boolean);

  return queryTokens.every((qt) =>
    textTokens.some(
      (tt) => tt.includes(qt) || levenshtein(qt, tt) <= maxDistance
    )
  );
}

export interface ScoredMatch {
  matched: boolean;
  score: number;
}

/**
 * Scored fuzzy matching:
 * - 100 = full normalized string exact substring match
 * - 90 = every query token is an exact substring of some text token
 * - scaled 40-80 = every query token fuzzy-matches (Levenshtein <= maxDistance)
 *   some text token; score = 80 - (avg distance across tokens * 20), floor 40
 * - 0, matched:false = at least one query token has no exact or fuzzy match
 */
export function scoredFuzzyMatch(query: string, text: string, maxDistance = 1): ScoredMatch {
  const nq = normalizeQuery(query);
  if (!nq) return { matched: true, score: 100 };
  const nt = normalizeText(text);
  if (!nt) return { matched: false, score: 0 };

  // 100 = full normalized string exact substring match
  if (nt.includes(nq)) {
    return { matched: true, score: 100 };
  }

  const queryTokens = nq.split(' ').filter(Boolean);
  const textTokens = nt.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return { matched: true, score: 100 };
  if (textTokens.length === 0) return { matched: false, score: 0 };

  // 90 = every query token is an exact substring of some text token
  const allExactSubstrings = queryTokens.every((qt) =>
    textTokens.some((tt) => tt.includes(qt))
  );
  if (allExactSubstrings) {
    return { matched: true, score: 90 };
  }

  // Check fuzzy match
  let totalDistance = 0;
  for (const qt of queryTokens) {
    let minDistanceForQt = Infinity;
    for (const tt of textTokens) {
      if (tt.includes(qt)) {
        minDistanceForQt = 0;
        break;
      }
      const dist = levenshtein(qt, tt);
      if (dist < minDistanceForQt) {
        minDistanceForQt = dist;
      }
    }
    if (minDistanceForQt > maxDistance) {
      return { matched: false, score: 0 };
    }
    totalDistance += minDistanceForQt;
  }

  const avgDistance = totalDistance / queryTokens.length;
  const score = Math.max(40, Math.round(80 - avgDistance * 20));
  return { matched: true, score };
}

/**
 * Fuzzy-aware highlight segments:
 * Reuse buildHighlightSegments first; if no exact hit and typoTolerant,
 * tokenize text/query and highlight whole text tokens whose Levenshtein
 * distance to any query token is <= 1. Same HighlightSegment[] shape.
 */
export function buildFuzzyHighlightSegments(
  text: string,
  query: string,
  typoTolerant = false
): HighlightSegment[] {
  const baseSegments = buildHighlightSegments(text, query);
  if (!typoTolerant) return baseSegments;

  const hasExactHit = baseSegments.some((s) => s.highlighted);
  if (hasExactHit) return baseSegments;

  const nq = normalizeQuery(query);
  if (!nq || !text) return [{ text, highlighted: false }];

  const queryTokens = nq.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return [{ text, highlighted: false }];

  const tokenRegex = /\S+|\s+/g;
  const segments: HighlightSegment[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const rawToken = match[0];
    if (/^\s+$/.test(rawToken)) {
      segments.push({ text: rawToken, highlighted: false });
      continue;
    }

    const cleanToken = rawToken.toLowerCase().replace(/^[^\w\u0900-\u097F]+|[^\w\u0900-\u097F]+$/g, '');
    const isFuzzyHit = queryTokens.some((qt) => {
      if (cleanToken && (cleanToken.includes(qt) || levenshtein(qt, cleanToken) <= 1)) {
        return true;
      }
      const rawLower = rawToken.toLowerCase();
      return rawLower.includes(qt) || levenshtein(qt, rawLower) <= 1;
    });

    segments.push({ text: rawToken, highlighted: isFuzzyHit });
  }

  const merged: HighlightSegment[] = [];
  for (const seg of segments) {
    if (merged.length > 0 && merged[merged.length - 1].highlighted === seg.highlighted) {
      merged[merged.length - 1].text += seg.text;
    } else {
      merged.push(seg);
    }
  }

  return merged;
}

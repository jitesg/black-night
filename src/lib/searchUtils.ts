/**
 * Universal Smart Search Utilities
 * - Normalize queries: ignore case, collapse whitespace
 * - matchesQuery: multi-field substring match
 * - fuzzyMatch: token-level Levenshtein distance for typo tolerance
 * - Highlight segments for HighlightText component
 */

/** Normalize a search string: lowercase + collapse all whitespace to single space + trim */
export function normalizeQuery(q: string): string {
  return q.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Normalize a haystack field the same way */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Returns true if any of the provided fields contains the normalized query.
 * Handles null/undefined fields gracefully.
 * Ignores case, extra spaces, leading/trailing spaces.
 */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const nq = normalizeQuery(query);
  if (!nq) return true;
  return fields.some((f) => normalizeText(f).includes(nq));
}

export type HighlightSegment = { text: string; highlighted: boolean };

/**
 * Split `text` into segments, marking which parts match the query.
 * Used by HighlightText to render coloured spans.
 */
export function buildHighlightSegments(text: string, query: string): HighlightSegment[] {
  const nq = normalizeQuery(query);
  if (!nq || !text) return [{ text, highlighted: false }];

  const segments: HighlightSegment[] = [];
  const lower = text.toLowerCase();
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lower.indexOf(nq, cursor);
    if (idx === -1) {
      segments.push({ text: text.slice(cursor), highlighted: false });
      break;
    }
    if (idx > cursor) {
      segments.push({ text: text.slice(cursor, idx), highlighted: false });
    }
    segments.push({ text: text.slice(idx, idx + nq.length), highlighted: true });
    cursor = idx + nq.length;
  }

  return segments;
}

// ─── Levenshtein distance (iterative, memory-optimised two-row) ───────────

function levenshtein(a: string, b: string): number {
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

/**
 * searchSuggest.ts — pure helpers for search suggestions (E) and "क्या आपका मतलब …?" (G).
 * The pool of known values per screen comes from src/lib/db/searchSuggestRepo.ts.
 * Tests: scripts/test_search_utils.ts
 */
import { levenshtein, matchesQuery, queryTokens, searchNormalize } from './searchUtils';

/** Up to `limit` pool values matching the query: starts-with first, then a word start, then the rest. */
export function rankSuggestions(pool: string[], query: string, limit = 8): string[] {
  const nq = searchNormalize(query);
  if (!nq) return [];
  const scored: { s: string; r: number }[] = [];
  const seen = new Set<string>();
  for (const s of pool) {
    const ns = searchNormalize(s);
    if (!ns || ns === nq || seen.has(ns) || !matchesQuery(query, s)) continue;
    seen.add(ns);
    const r = ns.startsWith(nq) ? 0 : (` ${ns}`).includes(` ${nq}`) ? 1 : 2;
    scored.push({ s, r: r * 1000 + Math.min(ns.length, 999) });
  }
  return scored.sort((a, b) => a.r - b.r).slice(0, limit).map((x) => x.s);
}

/**
 * Spelling fix for a query with no results: every word that is not part of a known
 * word is replaced by the closest known word (1 wrong letter for short words, 2 for
 * longer ones). Returns null when nothing could be corrected or the corrected
 * words do not occur together in any known value.
 */
export function didYouMean(pool: string[], query: string): string | null {
  const tokens = queryTokens(query);
  if (!tokens.length) return null;
  // known words: normalised → first original spelling seen
  const vocab = new Map<string, string>();
  for (const s of pool) {
    const raw = String(s).split(/\s+/);
    for (const w of raw) {
      const n = searchNormalize(w);
      if (n.length >= 3 && !vocab.has(n)) vocab.set(n, w.replace(/[.,;:()।]+$/g, ''));
    }
  }
  if (!vocab.size) return null;
  let changed = false;
  const out = tokens.map((t) => {
    for (const n of vocab.keys()) if (n.includes(t)) return t;
    if (t.length < 3) return t;
    const max = t.length <= 6 ? 1 : 2;
    let best: string | null = null;
    let bestD = max + 1;
    for (const n of vocab.keys()) {
      if (Math.abs(n.length - t.length) > max) continue;
      const d = levenshtein(t, n);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (best == null) return t;
    changed = true;
    return vocab.get(best) ?? best;
  });
  if (!changed) return null;
  const fixed = out.join(' ');
  // Offer it only if the corrected words really occur together in some known value.
  return pool.some((p) => matchesQuery(fixed, p)) ? fixed : null;
}

/**
 * प्रारूप खोज का क्रम (owner: "35(3)" लिखा तो 35(3) वाला प्रारूप ऊपर नहीं आया). The old rank used "every word anywhere", so
 * "35(3)" → words "35" + "3" also matched "126/1[35]" and every 126/135 title came first. Now:
 *   0 — the whole query, as typed (words in a row), is in the title — earlier in the title = higher;
 *   1 — every word is in the title;  2 — in the title + tags;  3 — elsewhere (body / type).
 * A number word matches only a whole number ("35" ≠ 135 / 350). Which formats are found does not change — only the order.
 * Pure — tests scripts/test_format_search_rank.ts.
 */
import { queryTokens, searchNormalize } from './searchUtils';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A number word only as a whole number; any other word as part of a word (like before). */
const tokenSrc = (t: string) => (/^\d+$/.test(t) ? `(?<!\\d)${t}(?!\\d)` : esc(t));

export interface RankedFormat { title?: string | null; tags?: string[] | null }

/** [rank, position] — smaller = higher in the list. */
export function formatSearchRank(query: string, f: RankedFormat): [number, number] {
  const tokens = queryTokens(query);
  if (!tokens.length) return [3, 0];
  const title = searchNormalize(f.title ?? '');
  const tags = searchNormalize((f.tags ?? []).join(' '));
  let phrase: RegExp;
  try { phrase = new RegExp(tokens.map(tokenSrc).join('\\s*')); } catch { return [3, 0]; }
  const at = title.search(phrase);
  if (at >= 0) return [0, at];
  const all = (h: string) => tokens.every((t) => { try { return new RegExp(tokenSrc(t)).test(h); } catch { return h.includes(t); } });
  if (all(title)) return [1, 0];
  if (all(`${title} ${tags}`)) return [2, 0];
  return [3, 0];
}

/**
 * Sort found formats by formatSearchRank, then by title (a new array). `keepOrder` = on a tie keep the list's own order
 * instead of the title — the "प्रारूप चुनें" screens build their list with this paper's formats first.
 */
export function sortBySearchRank<T extends RankedFormat>(list: readonly T[], query: string, keepOrder = false): T[] {
  const keyed = list.map((f, i) => ({ f, i, r: formatSearchRank(query, f) }));
  keyed.sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1]
    || (keepOrder ? a.i - b.i : (a.f.title ?? '').localeCompare(b.f.title ?? '')));
  return keyed.map((k) => k.f);
}

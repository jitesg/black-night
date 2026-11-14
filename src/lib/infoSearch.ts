/**
 * Search inside a long info note (owner): the ⓘ format sheet and the law "विस्तृत विश्लेषण" note get a 🔍 when the note is
 * long (`isLongInfo`). `filterInfoBlocks` keeps only the parts whose text matches — a part = a heading (h / h2) and the
 * blocks under it; an h2 part that matches also brings its h section heading along so the reader knows where it is.
 * Matching = the app's usual search (every word anywhere, Hindi spelling folded, Hinglish, typo setting) via smartMatch.
 * Pure — tests: scripts/test_info_search.ts
 */
import type { InfoBlock } from './formatInfo';
import { smartMatch } from './searchUtils';

/** All readable text of a block (nested cards too). */
export function blockText(b: InfoBlock): string {
  switch (b.t) {
    case 'head': return [b.label, b.title, b.sub, ...(b.lines ?? [])].filter(Boolean).join(' ');
    case 'box': return `${b.label} ${b.x}`;
    case 'h': case 'h2': case 'p': case 'tag': return b.x;
    case 'ul': case 'ol': return b.i.join(' ');
    case 'check': return [b.title ?? '', ...b.i].join(' ');
    case 'card': return b.blocks.map(blockText).join(' ');
    case 'img': return b.caption ?? '';
    case 'table': return [...b.head, ...b.rows.flat()].join(' ');
    case 'qa': return b.rows.flat().join(' ');
    default: return '';
  }
}

/** Notes this long get the 🔍 (owner: only long pages — रवानगी samples, BNSS 35 / 194; not the short 179 / 35(3) notes). */
export const LONG_INFO_CHARS = 8000;
export function isLongInfo(blocks: InfoBlock[] | null | undefined): boolean {
  if (!blocks) return false;
  let n = 0;
  for (const b of blocks) { n += blockText(b).length; if (n >= LONG_INFO_CHARS) return true; }
  return false;
}

/** Matching parts of a note. Empty query → everything, count 0. */
export function filterInfoBlocks(blocks: InfoBlock[], query: string, typo?: boolean): { blocks: InfoBlock[]; count: number } {
  if (!query.trim()) return { blocks, count: 0 };
  type Part = { h?: InfoBlock; body: InfoBlock[]; sectionH?: InfoBlock };
  const parts: Part[] = [];
  let sectionH: InfoBlock | undefined;
  let cur: Part = { body: [] };
  const flush = () => { if (cur.h || cur.body.length) parts.push(cur); };
  for (const b of blocks) {
    if (b.t === 'head') continue; // the page title is not a result
    if (b.t === 'h') { flush(); sectionH = b; cur = { h: b, body: [] }; continue; }
    if (b.t === 'h2') { flush(); cur = { h: b, body: [], sectionH }; continue; }
    cur.body.push(b);
  }
  flush();
  const out: InfoBlock[] = [];
  let count = 0;
  let lastSection: InfoBlock | undefined;
  for (const p of parts) {
    const text = [p.h ? blockText(p.h) : '', ...p.body.map(blockText)].join(' ');
    if (!smartMatch(query, [text], typo)) continue;
    count += 1;
    if (p.sectionH && p.sectionH !== lastSection && p.h !== p.sectionH) out.push(p.sectionH);
    lastSection = p.h?.t === 'h' ? p.h : p.sectionH;
    if (p.h) out.push(p.h);
    out.push(...p.body);
  }
  return { blocks: out, count };
}

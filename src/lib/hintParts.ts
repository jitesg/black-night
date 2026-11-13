/**
 * Field tip → the 3 parts the "कैसे भरें" box shows (owner, design C): the way to fill, the example (green box) and a
 * small note. Split at the first "जैसे:" (example) and, after it, at the first " — " (note). A tip without "जैसे" stays
 * whole. Pure — tests: scripts/test_hint_parts.ts
 */
export interface HintParts { main: string; example: string; note: string }

export function splitHint(text: string): HintParts {
  const t = String(text ?? '').trim();
  const m = /जैसे\s*[:–-]?\s*/.exec(t);
  if (!m) return { main: t, example: '', note: '' };
  const main = t.slice(0, m.index).replace(/[\s,;।]+$/, '').trim();
  const rest = t.slice(m.index + m[0].length);
  const d = rest.indexOf(' — ');
  const example = (d >= 0 ? rest.slice(0, d) : rest).trim();
  const note = d >= 0 ? rest.slice(d + 3).trim() : '';
  if (!example) return { main: t, example: '', note: '' };
  return { main, example, note };
}

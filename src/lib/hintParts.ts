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

/**
 * Sheet design B (owner): a short example list ("लखनऊ / इलाहाबाद", "का0, हे0का0") shows as chips — each part ≤ 24 letters,
 * 2–6 parts, split at " / " or ","; anything longer stays one example line ([] = no chips).
 */
export function exampleChips(example: string): string[] {
  const e = String(example ?? '').trim().replace(/[।.]+$/, '');
  if (!e) return [];
  const sep = e.includes(' / ') ? ' / ' : e.includes(',') ? ',' : null;
  if (!sep) return [];
  const parts = e.split(sep).map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 && parts.length <= 6 && parts.every((p) => p.length <= 24) ? parts : [];
}

/** The tip only repeats the field's name ("उच्च न्यायालय की पीठ") → not worth a line. */
export function tipRepeatsTitle(main: string, title: string): boolean {
  const n = (s: string) => String(s ?? '').replace(/[\s*:।.,()—–-]+/g, '').trim();
  return !!n(main) && n(main) === n(title);
}

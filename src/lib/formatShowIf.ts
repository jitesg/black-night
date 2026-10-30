/**
 * formatShowIf.ts — fields that appear only when needed.
 * A key can carry {"showIf": "..."} in its dropdown_options JSON (dropdowns put
 * their list under "options"). Conditions, joined by "&":
 *   "Reason=मुकदमा"         value is मुकदमा   ("Reason=A/B" → A or B)
 *   "doPP"                  ticked / filled
 *   "!doPP"                 not ticked / empty
 * Hidden fields are not shown and not checked as required.
 * Pure — tests: scripts/test_template_adi.ts
 */
export interface ShowIfKey { key_name?: string; dropdown_options?: string | null }

const ticked = (v: unknown) => {
  const t = String(v ?? '').trim();
  return t !== '' && !/^(नहीं|no|false|0)$/i.test(t);
};

export function keyShowIf(key: ShowIfKey): string {
  const raw = String(key.dropdown_options ?? '').trim();
  if (!raw.startsWith('{')) return '';
  try {
    const v = JSON.parse(raw) as { showIf?: unknown };
    return typeof v.showIf === 'string' ? v.showIf : '';
  } catch { return ''; }
}

/** Evaluate a showIf condition string against the form values. */
export function evalShowIf(cond: string, values: Record<string, string>): boolean {
  if (!cond) return true;
  return cond.split('&').every((part) => {
    const c = part.trim();
    if (!c) return true;
    if (c.startsWith('!')) return !ticked(values[c.slice(1).trim()]);
    const eq = c.indexOf('=');
    if (eq < 0) return ticked(values[c]);
    const k = c.slice(0, eq).trim();
    return c.slice(eq + 1).split('/').map((x) => x.trim()).includes(String(values[k] ?? '').trim());
  });
}

export function isKeyVisible(key: ShowIfKey, values: Record<string, string>): boolean {
  return evalShowIf(keyShowIf(key), values);
}

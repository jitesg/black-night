/**
 * Values a format works out by itself before the template is filled (owner, 60(1) फर्द v6). Pure — tests:
 * scripts/test_format_derived.ts
 *
 *  • पहर from a time: a dropdown key whose dropdown_options JSON has `"paharFrom": "<TimeKey>"` and is empty
 *    (or "समय से") gets सुबह / दिन / शाम / रात from that time (05–10 सुबह, 11–15 दिन, 16–18 शाम, else रात).
 *  • Picked person in a list: an item_group column `{ "type": "ref", "ref": "<OtherGroup>" }` holds the name of a
 *    row of the other list; every field of that row is copied into the row as `<col>_<field>` (e.g. who_mahila),
 *    so the template can say अभियुक्त / अभियुक्ता for the picked person.
 *  • `"endWith": "।"` on an item_group column: a filled cell always ends with it.
 */

export interface DerivedKeyDef { key_name: string; field_type?: string | null; dropdown_options?: string | null }

export const PAHAR_AUTO = 'समय से';

/** "21.30" / "9:05" / "21" → रात / सुबह …; '' when no hour can be read. */
export function paharFromTime(time: string | null | undefined): string {
  const m = /(\d{1,2})(?:\s*[.:]\s*(\d{1,2}))?/.exec(String(time ?? ''));
  if (!m) return '';
  const h = Number(m[1]);
  if (!Number.isFinite(h) || h > 24) return '';
  const hh = h % 24;
  if (hh >= 5 && hh <= 10) return 'सुबह';
  if (hh >= 11 && hh <= 15) return 'दिन';
  if (hh >= 16 && hh <= 18) return 'शाम';
  return 'रात';
}

function parseJson(raw: string | null | undefined): unknown {
  try { return JSON.parse(String(raw ?? '')); } catch { return null; }
}

function rowsOf(raw: string | undefined): Record<string, string>[] {
  const v = parseJson(raw);
  return Array.isArray(v) ? (v.filter((r) => r && typeof r === 'object') as Record<string, string>[]) : [];
}

/** The पहर key's TimeKey, if the key is set up that way. */
export function paharSource(dropdownOptions: string | null | undefined): string | null {
  const v = parseJson(dropdownOptions) as { paharFrom?: unknown } | null;
  return v && typeof v === 'object' && typeof v.paharFrom === 'string' ? v.paharFrom : null;
}

/** Copy of `values` with the worked-out values added (the input object is not changed). */
export function deriveFormatValues(values: Record<string, string>, keyDefs?: DerivedKeyDef[]): Record<string, string> {
  if (!keyDefs?.length) return values;
  let out: Record<string, string> | null = null;
  const set = (k: string, v: string) => { out ??= { ...values }; out[k] = v; };

  for (const kd of keyDefs) {
    const src = paharSource(kd.dropdown_options);
    if (src) {
      const cur = String(values[kd.key_name] ?? '').trim();
      if (!cur || cur === PAHAR_AUTO) set(kd.key_name, paharFromTime(values[src]));
    }
    if (kd.field_type === 'item_group') {
      const cfg = parseJson(kd.dropdown_options) as {
        columns?: { key?: string; type?: string; ref?: string; refLabel?: string; endWith?: string }[];
      } | null;
      const refs = (cfg?.columns ?? []).filter((c) => c?.type === 'ref' && c.key && c.ref);
      const ends = (cfg?.columns ?? []).filter((c) => c?.key && c.endWith);
      if (!refs.length && !ends.length) continue;
      const rows = rowsOf(values[kd.key_name]);
      if (!rows.length) continue;
      const next = rows.map((r) => {
        const row = { ...r };
        for (const c of refs) {
          const label = c.refLabel || 'name';
          const picked = String(r[c.key!] ?? '').trim();
          const other = picked ? rowsOf(values[c.ref!]).find((o) => String(o[label] ?? '').trim() === picked) : undefined;
          if (other) for (const [f, x] of Object.entries(other)) row[`${c.key}_${f}`] = String(x ?? '');
        }
        // "endWith": "।" — a typed sentence always ends with the danda (added when missing)
        for (const c of ends) {
          const t = String(row[c.key!] ?? '').replace(/\s+$/, '');
          if (t) row[c.key!] = t.endsWith(c.endWith!) ? t : t.replace(/[.|]$/, '') + c.endWith;
        }
        return row;
      });
      set(kd.key_name, JSON.stringify(next));
    }
  }
  return out ?? values;
}

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
 *  • `"flags": {"isCase": "मुकदमे का माल"}` on a choice column → tick flag per row; `"fallback": "FIRNo"` → empty cell
 *    takes that form value; group `"groupInto"` → this list's rows written into a field of another list (see below).
 *  • group `"copy": ["Drug"]` → that form value in every row; `"weight": {kg, gm, rowField, total}` → per-row
 *    "01 किलो 200 ग्राम" and the total of all rows into the form value `total`.
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

type ColCfg = {
  key?: string; type?: string; ref?: string; refLabel?: string; endWith?: string;
  /** choice column: value → tick flag on the row, e.g. {"isCase": "मुकदमे का माल"} (for {{each:Key?isCase|…}}) */
  flags?: Record<string, string>;
  /** empty cell → this top-level value (e.g. the main मुकदमा "FIRNo") */
  fallback?: string;
};
/** Grams → "01 किलो 200 ग्राम" / "250 ग्राम" ('' for 0). */
export function kgText(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return '';
  const g = Math.round(grams);
  const kg = Math.floor(g / 1000);
  const gm = g % 1000;
  return [kg ? `${String(kg).padStart(2, '0')} किलो` : '', gm ? `${gm} ग्राम` : ''].filter(Boolean).join(' ');
}
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
type Weight = { kg?: string; gm?: string; rowField?: string; total?: string };
type GroupInto = { key?: string; match?: string; by?: string; field?: string; row?: string; sep?: string };

/** Copy of `values` with the worked-out values added (the input object is not changed). */
export function deriveFormatValues(values: Record<string, string>, keyDefs?: DerivedKeyDef[]): Record<string, string> {
  if (!keyDefs?.length) return values;
  let out: Record<string, string> | null = null;
  const set = (k: string, v: string) => { out ??= { ...values }; out[k] = v; };
  const cur = (k: string) => (out ?? values)[k];
  const groupings: { rows: Record<string, string>[]; g: GroupInto }[] = [];

  // Date keys (owner: all formats dd/mm/yyyy; a key may set {"dateFormat": "dd.mm.yyyy"}): the picker's YYYY-MM-DD (or a FIR
  // dd.mm.yyyy default) printed that way.
  for (const kd of keyDefs) {
    if (kd.field_type !== 'date') continue;
    const fmt = dateFormatOf(kd.dropdown_options);
    const v = values[kd.key_name];
    if (fmt && v) { const f = formatDateValue(v, fmt); if (f !== v) set(kd.key_name, f); }
  }

  // Person card → the format's old single keys (owner: person details as cards; template text unchanged). Done first,
  // so a group's "copy" can use a value a card fills (e.g. DName). dropdown_options {"expand": {"VName": "name",
  //   "Rel": "relationType||पुत्र", "VFather": "fatherOrHusbandName", "VAddr": "fullAddress", "VAge": "age|वर्ष"}} —
  //   "field|suffix" appends a word to a non-empty value, "field||fallback" = word when the card leaves it empty; card N = "#2:name".
  for (const kd of keyDefs) {
    if (kd.field_type === 'person_group' || kd.field_type === 'accused_group') {
      const ex = (parseJson(kd.dropdown_options) as { expand?: Record<string, string> } | null)?.expand;
      if (ex && typeof ex === 'object') {
        const cards = rowsOf(values[kd.key_name]).filter((c) => String(c.name ?? '').trim());
        for (const [target, specRaw] of Object.entries(ex)) {
          let spec = String(specRaw);
          let idx = 0;
          const m = /^#(\d+):(.*)$/.exec(spec);
          if (m) { idx = Number(m[1]) - 1; spec = m[2]; }
          const [field, suffix, fallback] = spec.split('|');
          const card = cards[idx];
          let v = card ? String(card[field] ?? card[field === 'fullAddress' ? 'address' : field] ?? '').trim() : '';
          if (v && suffix) v = `${v} ${suffix}`;
          if (!v && fallback && card) v = fallback;
          set(target, v);
        }
      }
    }
  }

  for (const kd of keyDefs) {
    const src = paharSource(kd.dropdown_options);
    if (src) {
      const v = String(values[kd.key_name] ?? '').trim();
      if (!v || v === PAHAR_AUTO) set(kd.key_name, paharFromTime(values[src]));
    }
    if (kd.field_type === 'person_group' || kd.field_type === 'accused_group') continue;
    if (kd.field_type === 'item_group') {
      const cfg = parseJson(kd.dropdown_options) as { columns?: ColCfg[]; groupInto?: GroupInto; copy?: string[]; weight?: Weight } | null;
      const cols = cfg?.columns ?? [];
      const refs = cols.filter((c) => c?.type === 'ref' && c.key && c.ref);
      const ends = cols.filter((c) => c?.key && c.endWith);
      const flags = cols.filter((c) => c?.key && c.flags && typeof c.flags === 'object');
      const falls = cols.filter((c) => c?.key && c.fallback);
      const copy = Array.isArray(cfg?.copy) ? cfg!.copy.filter((k) => typeof k === 'string') : [];
      const wt = cfg?.weight && cfg.weight.rowField ? cfg.weight : null;
      if (!refs.length && !ends.length && !flags.length && !falls.length && !cfg?.groupInto && !copy.length && !wt) continue;
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
        for (const c of flags) {
          const v = String(row[c.key!] ?? '').trim();
          for (const [flag, want] of Object.entries(c.flags!)) row[flag] = v === want ? 'हाँ' : '';
        }
        for (const c of falls) {
          if (!String(row[c.key!] ?? '').trim()) row[c.key!] = String(values[c.fallback!] ?? '').trim();
        }
        // "copy": ["Drug"] — form values the row text needs (a row can't hold {{Drug}} itself)
        for (const k of copy) row[k] = String(cur(k) ?? '');
        // "weight": kg + gm cells → row text "01 किलो 200 ग्राम"
        if (wt) row[wt.rowField!] = kgText(num(row[wt.kg || 'kg']) * 1000 + num(row[wt.gm || 'gm']));
        return row;
      });
      set(kd.key_name, JSON.stringify(next));
      if (wt?.total) set(wt.total, kgText(next.reduce((a, r) => a + num(r[wt.kg || 'kg']) * 1000 + num(r[wt.gm || 'gm']), 0)));
      if (cfg?.groupInto?.key && cfg.groupInto.field) groupings.push({ rows: next, g: cfg.groupInto });
    }
  }

  // "groupInto": this list's rows written into a field of another list's rows, e.g. every बरामद चीज़ of an अभियुक्त
  // into Accused[].found = "पैंट की जेब से 07 अदद बिछिया व कमर से एक तमंचा" (rows matched by who == name).
  for (const { rows, g } of groupings) {
    const target = rowsOf(cur(g.key!));
    if (!target.length) continue;
    const match = g.match || 'who';
    const by = g.by || 'name';
    const tmpl = g.row || '';
    const filled = target.map((t) => {
      const mine = rows.filter((r) => String(r[match] ?? '').trim() && String(r[match]).trim() === String(t[by] ?? '').trim());
      const text = mine
        .map((r) => tmpl.replace(/\{([A-Za-z0-9_]+)\}/g, (_m, c: string) => String(r[c] ?? '').trim()).replace(/ {2,}/g, ' ').trim())
        .filter(Boolean)
        .join(g.sep ?? ' व ');
      return { ...t, [g.field!]: text };
    });
    set(g.key!, JSON.stringify(filled));
  }
  return out ?? values;
}

// ── Date fields (owner: 35(3) नोटिस dates as dd/mm/yyyy) — picker stores YYYY-MM-DD, @FIR.fir_date gives dd.mm.yyyy;
//    every date key shows and prints dd/mm/yyyy (owner: all formats; {"dateFormat": …} can change it). Tests scripts/test_format_date.ts.

/** Any of YYYY-MM-DD, dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy → [yyyy, mm, dd]; null otherwise. */
export function dateParts(v: string | null | undefined): [string, string, string] | null {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return [m[1], m[2].padStart(2, '0'), m[3].padStart(2, '0')];
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (m) return [m[3], m[2].padStart(2, '0'), m[1].padStart(2, '0')];
  return null;
}

/** "YYYY-MM-DD" for the picker ('' when the value is not a date). */
export function toIsoDate(v: string | null | undefined): string {
  const p = dateParts(v);
  return p ? `${p[0]}-${p[1]}-${p[2]}` : '';
}

/** The key's dateFormat option, if any ("dd/mm/yyyy" or "dd.mm.yyyy"). */
/** Every date field prints dd/mm/yyyy (owner) unless its key says otherwise. */
export const DEFAULT_DATE_FORMAT = 'dd/mm/yyyy';

export function dateFormatOf(dropdownOptions: string | null | undefined): string {
  if (!dropdownOptions) return DEFAULT_DATE_FORMAT;
  try {
    const o = JSON.parse(dropdownOptions) as { dateFormat?: unknown };
    return o && typeof o === 'object' && typeof o.dateFormat === 'string' ? o.dateFormat : DEFAULT_DATE_FORMAT;
  } catch {
    return DEFAULT_DATE_FORMAT;
  }
}

/** Value written in `fmt` (dd/mm/yyyy, dd.mm.yyyy, dd-mm-yyyy); not a date → unchanged. */
export function formatDateValue(v: string | null | undefined, fmt: string): string {
  const s = String(v ?? '');
  const p = dateParts(s);
  if (!p) return s;
  const sep = fmt.includes('.') ? '.' : fmt.includes('-') ? '-' : '/';
  return `${p[2]}${sep}${p[1]}${sep}${p[0]}`;
}

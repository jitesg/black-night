/**
 * SSOT Template Engine
 * Single source of truth for all template parsing and report generation.
 *
 * Processing pipeline (applied in order inside generateReport):
 *   0. Field-projection       — {{GroupKey[1,2].f1,f2}} → formatted field subset
 *   1. Indexed field access   — {{GroupKey.N.fieldName}} → raw field value from entry N
 *   2. Dropdown conditional   — {{key|val:text|val:text}} → resolved branch for dropdown fields
 *                               (nested {{KEY}} tokens inside the chosen branch are substituted)
 *   3. Group-agreement text   — {{GroupKey|एक-पुरुष:x|एक-महिला:y|बहु:z}} → agreement branch
 *   4. Whole-group prose      — {{GroupKey}} → full Hindi list block
 *   5. Plain {{key}}          — remaining placeholders filled from values map
 *
 * Steps 0, 1, 3 and 4 work generically for ANY field_type in REPEATABLE_GROUP_TYPES
 * — adding a new group type requires only adding it to that set and providing
 * a renderXxxGroup() function; no other pipeline code changes.
 *
 * Step 2 is for dropdown field_type only — branches are matched by stored VALUE
 * (e.g. "yes"/"no"), not by display label.  Nested plain-key references inside
 * the selected branch are resolved against `values` before output.
 */
import { stripFormatMarkers } from './formatMarkers';

// ─── Key detection ────────────────────────────────────────────────────────
const KEY_REGEX = /\{\{([A-Za-z0-9_]+)\}\}/g;

/**
 * Extract all unique key names from a template string.
 * Returns array of unique key names preserving insertion order.
 */
export function detectKeys(template: string): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(KEY_REGEX.source, 'g');
  while ((match = re.exec(template)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      keys.push(match[1]);
    }
  }
  return keys;
}

/**
 * Generate a human-readable label from a camelCase/PascalCase key name.
 * e.g. "PoliceStation" → "Police Station", "FIRNumber" → "FIR Number"
 */
export function keyToLabel(keyName: string): string {
  return keyName
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

// ─── Entry types ──────────────────────────────────────────────────────────

/**
 * Minimal shape of an accused entry — mirrors AccusedEntry from
 * AccusedGroupInput.tsx without importing the UI component into the engine.
 */
interface AccusedEntry {
  name: string;
  fatherOrHusbandName: string;
  /** Canonical address field for accused_group (UI saves as fullAddress; legacy saved as address) */
  fullAddress: string;
  /** Legacy field name — old saved data; renderAccusedGroup falls back to this */
  address?: string;
  age: string;
  gender: 'पुरुष' | 'महिला' | '';
  /** Explicit relation type — overrides gender-inferred connector for fatherOrHusbandName.
   *  Added in v262; old entries without this field fall back to 'पुत्र'. */
  relationType?: 'पुत्र' | 'पुत्री' | 'पत्नी' | '';
  caughtBy: string;
  caste?: string;
  mobile?: string;
  email?: string;
}

/**
 * Minimal shape of a person_group entry — mirrors PersonEntry from
 * PersonGroupInput.tsx. fatherOrHusbandName added in v259 (split from
 * the old combined "name + father" field). Old saved data may omit it;
 * _parseGroupEntries spreads EMPTY defaults so it is always present.
 * relationType added in v262 — old entries fall back to gender inference.
 */
interface PersonEntry {
  name: string;
  fatherOrHusbandName: string;
  fullAddress: string;
  age: string;
  gender: 'पुरुष' | 'महिला' | '';
  /** Explicit relation type — overrides gender-inferred connector for fatherOrHusbandName. */
  relationType?: 'पुत्र' | 'पुत्री' | 'पत्नी' | '';
  caste?: string;
  mobile?: string;
  email?: string;
}

/** Union type for any repeatable group entry, used by generic helpers. */
type AnyGroupEntry = AccusedEntry | PersonEntry;

// ─── Generic JSON parse helper ────────────────────────────────────────────

/**
 * Parse a JSON string back to a typed entry array.
 * Returns [] on any failure so all downstream rendering degrades gracefully.
 * T is constrained to object so the constraint is always satisfiable,
 * including loose shapes like { gender?: string } used in agreement resolution.
 */
function _parseGroupEntries<T extends object>(jsonStr: string): T[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as T[];
  } catch { /* fall through */ }
  return [];
}

// Keep the old name as a thin alias so existing callers (caseDiaryExport etc.) don't break.
function _parseAccusedEntries(jsonStr: string): AccusedEntry[] {
  return _parseGroupEntries<AccusedEntry>(jsonStr);
}

// ─── Shared connector resolver ────────────────────────────────────────────

/**
 * Resolve the पुत्र/पुत्री/पत्नी connector word for a group entry.
 *
 * Priority:
 *   1. entry.relationType  — explicit officer choice (v262+)
 *   2. entry.gender        — legacy fallback (महिला → पुत्री, else → पुत्र)
 *   3. Hard default        — पुत्र
 *
 * Both group types share this helper so the logic lives in one place.
 */
function _resolveConnector(entry: { relationType?: string; gender?: string }): string {
  const rt = (entry.relationType ?? '').trim();
  if (rt === 'पुत्र' || rt === 'पुत्री' || rt === 'पत्नी') return rt;
  // Legacy gender fallback
  if ((entry.gender ?? '') === 'महिला') return 'पुत्री';
  return 'पुत्र';
}

// ─── Shared group prose builder ───────────────────────────────────────────

/**
 * Core prose builder shared by both renderAccusedGroup and renderPersonGroup.
 *
 * Builds an array of per-entry token lists, applies shared-address collapsing,
 * and returns the final Hindi string.  groupType controls:
 *   - Address prefix words  ('नि0गण'/'निवासी' for accused_group, 'नि0गण'/'नि0' for person_group)
 *   - Plural header word    ('अभियुक्तगण' for accused_group, none for person_group)
 *   - Singular header word  ('अभियुक्त'/'अभियुक्ता' for accused_group, none for person_group)
 *   - caughtBy field        (rendered only for accused_group)
 *
 * Optional fields (age, caste, mobile, email, caughtBy) are omitted entirely
 * when blank — no dangling labels or stray commas.
 */
function _buildGroupProse(
  entries: Array<AccusedEntry | PersonEntry>,
  groupType: 'accused_group' | 'person_group',
): string {
  if (!entries.length) return '';

  // Null-safe string trim
  const s = (v: string | undefined | null) => (v ?? '').trim();

  // Address value — accused_group has fullAddress + legacy address fallback
  const addrOf = (e: AccusedEntry | PersonEntry): string => {
    if (groupType === 'accused_group') {
      const ae = e as AccusedEntry;
      return s(ae.fullAddress) || s(ae.address);
    }
    return s((e as PersonEntry).fullAddress);
  };

  const trimmedAddrs = entries.map(addrOf);
  const firstAddr = trimmedAddrs[0];
  const sameAddress = firstAddr !== '' && trimmedAddrs.every((a) => a === firstAddr);

  // Address prefixes
  const inlineAddrWord = groupType === 'accused_group' ? 'निवासी' : 'नि0';
  const sharedAddrWord = 'नि0गण';

  if (entries.length === 1) {
    const e = entries[0];
    const connector = _resolveConnector(e);
    const tokens: string[] = [];

    // Singular header
    if (groupType === 'accused_group') {
      // अभियुक्त / अभियुक्ता based on gender (not relationType — this is the heading, not the connector)
      tokens.push((e.gender ?? '') === 'महिला' ? 'अभियुक्ता' : 'अभियुक्त');
    }

    if (s(e.name))               tokens.push(s(e.name));
    if (s(e.fatherOrHusbandName)) tokens.push(`${connector} ${s(e.fatherOrHusbandName)}`);
    if (s(e.age))                 tokens.push(`उम्र करीब ${s(e.age)} वर्ष`);
    if (s(e.caste))               tokens.push(`जाति ${s(e.caste)}`);
    if (s((e as AccusedEntry).mobile)) tokens.push(`मो0न0 ${s((e as AccusedEntry).mobile)}`);
    if (s((e as AccusedEntry).email))  tokens.push(`ई-मेल ${s((e as AccusedEntry).email)}`);
    if (groupType === 'accused_group' && s((e as AccusedEntry).caughtBy))
      tokens.push(`${s((e as AccusedEntry).caughtBy)} द्वारा पकड़ा गया`);

    const addrVal = addrOf(e);
    // One person → "निवासी" (owner's rule; "नि0गण" is only for several people).
    if (addrVal) tokens.push(`निवासी ${addrVal}`);

    return tokens.join(' ');
  }

  // Multi-entry
  const rows = entries.map((e, i) => {
    const connector = _resolveConnector(e);
    const parts: string[] = [`${i + 1}.${s(e.name)}`];

    if (s(e.fatherOrHusbandName)) parts.push(`${connector} ${s(e.fatherOrHusbandName)}`);
    if (s(e.age))                 parts.push(`उम्र करीब ${s(e.age)} वर्ष`);
    if (s(e.caste))               parts.push(`जाति ${s(e.caste)}`);
    if (s((e as AccusedEntry).mobile)) parts.push(`मो0न0 ${s((e as AccusedEntry).mobile)}`);
    if (s((e as AccusedEntry).email))  parts.push(`ई-मेल ${s((e as AccusedEntry).email)}`);
    if (groupType === 'accused_group' && s((e as AccusedEntry).caughtBy))
      parts.push(`${s((e as AccusedEntry).caughtBy)} द्वारा पकड़ा गया`);

    if (!sameAddress) {
      const addrVal = addrOf(e);
      if (addrVal) parts.push(`${inlineAddrWord} ${addrVal}`);
    }

    return parts.join(' ');
  });

  const list = rows.join(' ');

  if (groupType === 'accused_group') {
    return sameAddress && firstAddr
      ? `अभियुक्तगण ${list} ${sharedAddrWord} ${firstAddr}`
      : `अभियुक्तगण ${list}`;
  }
  // person_group — no heading word
  return sameAddress && firstAddr ? `${list} ${sharedAddrWord} ${firstAddr}` : list;
}

// ─── Accused Group Rendering ──────────────────────────────────────────────

/**
 * Convert a filled AccusedEntry[] to a single Hindi prose string.
 *
 * Delegates entirely to _buildGroupProse (shared with renderPersonGroup)
 * so both code paths use the same field-renderer logic.
 *
 * SINGULAR:  "अभियुक्त/अभियुक्ता {name} {connector} {father} उम्र करीब {age} वर्ष … निवासी {addr}"
 * PLURAL:    "अभियुक्तगण 1.{name} {connector} {father} … 2.… [नि0गण sharedAddr]"
 *   connector = relationType if set (पुत्र/पुत्री/पत्नी), else gender-inferred fallback.
 */
export function renderAccusedGroup(jsonStr: string): string {
  const entries = _parseAccusedEntries(jsonStr);
  return _buildGroupProse(entries, 'accused_group');
}

// ─── Person Group Rendering ───────────────────────────────────────────────

/**
 * Convert a filled PersonEntry[] to a single Hindi prose string.
 *
 * Delegates entirely to _buildGroupProse (shared with renderAccusedGroup)
 * so both code paths use the same field-renderer logic.
 *
 * SINGULAR:  "{name} {connector} {fatherOrHusbandName} उम्र करीब {age} वर्ष निवासी {fullAddress}"
 * PLURAL:    "1.{name} {connector} {father} उम्र करीब {age} वर्ष 2.… [नि0गण sharedAddr]"
 *   connector = relationType if set (पुत्र/पुत्री/पत्नी), else gender-inferred fallback.
 *
 * Legacy data (no fatherOrHusbandName key): output gracefully omits connector token.
 */
export function renderPersonGroup(jsonStr: string): string {
  const entries = _parseGroupEntries<PersonEntry>(jsonStr);
  return _buildGroupProse(entries, 'person_group');
}

// ─── Group agreement resolver (shared by accused_group + person_group) ───

/**
 * Resolve a three-way gender-number agreement branch for any repeatable group.
 *
 * Branch syntax inside template:  {{KeyName|एक-पुरुष:text|एक-महिला:text|बहु:text}}
 *
 * Resolution rules:
 *   array.length > 1              → बहु branch
 *   array.length === 1, gender === 'महिला' → एक-महिला branch
 *   array.length === 1, gender === '' or 'पुरुष' → एक-पुरुष branch (default)
 *
 * All three branches are optional — missing branches resolve to ''.
 * branchMap keys: 'एक-पुरुष', 'एक-महिला', 'बहु'
 */
function _resolveGroupAgreement(
  jsonStr: string,
  branchMap: Record<string, string>,
): string {
  const entries = _parseGroupEntries<{ gender?: string }>(jsonStr);
  if (!entries.length) return branchMap['एक-पुरुष'] ?? '';
  if (entries.length > 1) return branchMap['बहु'] ?? '';
  // 'महिला' → feminine branch; 'पुरुष', 'अन्य', '' or unset → masculine/default
  const gender = entries[0].gender ?? '';
  if (gender === 'महिला') return branchMap['एक-महिला'] ?? '';
  return branchMap['एक-पुरुष'] ?? '';
}

/**
 * Minimal key-def shape needed for group-type pre-processing.
 * Accepts the same FormatKey interface used by the fill screens without
 * creating a circular dependency on the DB layer.
 */
export interface KeyDefForRender {
  key_name: string;
  field_type: string;
}

/** All field_type values that hold a JSON array of repeatable entries. */
const REPEATABLE_GROUP_TYPES = new Set(['accused_group', 'person_group']);
// 'item_group' (rows with format-defined columns) is handled only by {{each:/count:/any:}} (_applyItemTokens).

// ─── Pipeline Step 0: Field-projection pass ──────────────────────────────
//
// NEW syntax (Step 0 — runs before everything else):
//   {{Key[1,2,3].field1,field2,...}}   — named indices, named fields
//   {{Key.field1,field2,...}}          — ALL entries, named fields
//
// Disambiguated from existing passes:
//   - Trigger condition: "." present AND (comma in field-list OR first segment
//     after first "." contains a comma OR is not purely numeric).
//   - {{Key.N.field}}  (single numeric + single field, no comma) stays in Step 1.
//   - {{Key}} bare                    stays in Step 4.
//
// Field-renderer registry (shared across group types, keyed by field name):
//   name               → raw value (no connector)
//   fatherOrHusbandName → पुत्र {v} / पुत्री {v}   (per-person gender)
//   age                → उम्र करीब {v} वर्ष          ("करीब" ONLY in projection)
//   address/fullAddress → shared-address or inline per-person
//   gender             → raw value
//   caughtBy (accused) → {v} द्वारा पकड़ा गया       (empty on person_group)
//
// Numbering: single resolved entry → no prefix. Multiple → "N." prefix, joined " ".
// Shared-address rule: scoped to selected indices only.

type AnyEntry = Record<string, string>;

/** Field-renderer registry — shared across group types.
 *
 * Blank-safety: every optional field returns '' when value is empty,
 * so callers can filter(Boolean) and join with ' ' safely — no dangling
 * labels, no stray separators.
 *
 * fatherOrHusbandName connector priority:
 *   1. entry.relationType  (पुत्र / पुत्री / पत्नी) — explicit officer choice (v262+)
 *   2. entry.gender        (महिला → पुत्री, else → पुत्र) — legacy fallback
 *   3. Hard default        → पुत्र
 */
function _renderField(
  field: string,
  value: string,
  entry: AnyEntry,
): string {
  const v = (value ?? '').trim();
  switch (field) {
    case 'name':
      return v;
    case 'fatherOrHusbandName': {
      if (!v) return '';
      const connector = _resolveConnector(entry);
      return `${connector} ${v}`;
    }
    case 'age':
      return v ? `उम्र करीब ${v} वर्ष` : '';
    case 'caste':
      return v ? `जाति ${v}` : '';
    case 'mobile':
      return v ? `मो0न0 ${v}` : '';
    case 'email':
      return v ? `ई-मेल ${v}` : '';
    case 'address':
    case 'fullAddress':
      // address rendering is handled specially (shared-address logic)
      return v;
    case 'gender':
    case 'relationType':
      return v;
    case 'caughtBy':
      return v ? `${v} द्वारा पकड़ा गया` : '';
    default:
      return v;
  }
}

/** The address field name differs by group type. */
function _addrField(entry: AnyEntry): string {
  return 'fullAddress' in entry ? 'fullAddress' : 'address';
}

/** Address prefix word — "नि0गण" for accused_group, "निवासी" for person_group. */
function _addrPrefix(groupType: string | undefined): { shared: string; inline: string } {
  if (groupType === 'accused_group') return { shared: 'नि0गण', inline: 'निवासी' };
  return { shared: 'नि0गण', inline: 'नि0' };
}

/**
 * Resolve one projection expression to its final Hindi string.
 *
 * @param entries   full group array (already parsed)
 * @param indices   1-based indices to select (empty = all)
 * @param fields    field names in author-specified order
 * @param groupType "accused_group" | "person_group" | undefined
 */
function _resolveProjection(
  entries: AnyEntry[],
  indices: number[],   // 1-based; [] = all
  fields: string[],
  groupType: string | undefined,
): string {
  // Select entries
  const selected: AnyEntry[] = indices.length
    ? indices
        .map((i) => entries[i - 1])
        .filter((e): e is AnyEntry => e !== undefined)
    : [...entries];

  if (!selected.length) return '';

  const wantsAddress = fields.some((f) => f === 'address' || f === 'fullAddress');
  const nonAddrFields = fields.filter((f) => f !== 'address' && f !== 'fullAddress');

  // Shared-address detection (scoped to selected entries only)
  let sharedAddr = '';
  if (wantsAddress) {
    const addrs = selected.map((e) => (e[_addrField(e)] ?? '').trim());
    if (addrs.length && addrs.every((a) => a === addrs[0]) && addrs[0]) {
      sharedAddr = addrs[0];
    }
  }

  // One person → "निवासी" (never the plural "नि0गण").
  const prefixes = selected.length === 1 ? { shared: 'निवासी', inline: 'निवासी' } : _addrPrefix(groupType);

  const parts = selected.map((e) => {
    const tokens: string[] = [];
    for (const f of nonAddrFields) {
      const rendered = _renderField(f, e[f] ?? '', e);
      if (rendered) tokens.push(rendered);
    }
    // Inline address (only when NOT shared)
    if (wantsAddress && !sharedAddr) {
      const addrVal = (e[_addrField(e)] ?? '').trim();
      if (addrVal) tokens.push(`${prefixes.inline} ${addrVal}`);
    }
    return tokens.join(' ');
  });

  // Numbering: 1 entry → no prefix; >1 → "N." prefix
  const numbered = parts.length === 1
    ? parts
    : parts.map((p, i) => `${i + 1}.${p}`);

  let result = numbered.join(' ');
  if (sharedAddr) result += ` ${prefixes.shared} ${sharedAddr}`;
  return result.trim();
}

/**
 * Regex that matches BOTH new projection forms.
 *
 * Group 1: key name
 * Group 2: optional "[1,2,3]" indices part (without brackets)
 * Group 3: field list segment (may contain commas)
 *
 * We intentionally make this broad and tighten with code to avoid
 * false-positives against {{Key.N.field}} (Step 1).
 *
 * Pattern:  {{ Key ( \[ digits,... \] )? \. fields }}
 *
 * "fields" = everything until "}" — we inspect it ourselves.
 */
const PROJECTION_RE =
  /\{\{([A-Za-z0-9_]+)(?:\[([0-9,\s]+)\])?\.([^}]+)\}\}/g;

function _applyFieldProjection(
  template: string,
  values: Record<string, string>,
  keyDefs: KeyDefForRender[],
): string {
  const typeMap = new Map<string, string>();
  for (const kd of keyDefs) typeMap.set(kd.key_name, kd.field_type);

  return template.replace(PROJECTION_RE, (match, groupKey, indicesRaw, fieldSegment) => {
    // ── Disambiguate: is this actually a Step-1 {{Key.N.field}} match? ──
    // Step-1 form: NO index bracket, fieldSegment is "N.field" where N is
    // purely numeric and the sub-field has no comma and is a single name.
    // Detect: fieldSegment matches /^\d+\.[A-Za-z0-9_]+$/ with no comma → Step 1.
    if (!indicesRaw && /^\d+\.[A-Za-z0-9_]+$/.test(fieldSegment.trim())) {
      return match; // leave for Step 1
    }

    const fieldType = typeMap.get(groupKey);
    if (!fieldType || !REPEATABLE_GROUP_TYPES.has(fieldType)) return match;

    const rawJson = values[groupKey] ?? '';
    const entries = _parseGroupEntries<AnyEntry>(rawJson);
    if (!entries.length) return '';

    // Parse indices (1-based); empty = all
    const indices: number[] = indicesRaw
      ? indicesRaw.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n))
      : [];

    // Parse field list — may be "field1,field2" or a single field with comma
    const fields = fieldSegment.split(',').map((f: string) => f.trim()).filter(Boolean);
    if (!fields.length) return match;

    // Single field, no comma → this is projection only if field name has NO dot.
    // If it looks like "N.field" we already returned above. Safe to proceed.
    return _resolveProjection(entries, indices, fields, fieldType);
  });
}

// ─── Pipeline Step 1: Indexed field access ───────────────────────────────
//
// Syntax:  {{GroupKeyName.N.fieldName}}
//   N         — 1-based index into the group array
//   fieldName — any field on an entry object
//
// Runs BEFORE all other passes so extracted scalar values feed into
// conditional expressions and agreement-text on the same key.
//
// Out-of-bounds index → '' + DEV warning (no crash, no placeholder left).

const INDEXED_ACCESS_RE = /\{\{([A-Za-z0-9_]+)\.(\d+)\.([A-Za-z0-9_]+)\}\}/g;

// ─── Wanted status of accused (judicial custody report) ─────────────────────
/**
 * {{if:Key|text}} → text only when the field Key is filled / ticked (checkbox value "हाँ");
 * {{ifnot:Key|text}} → text only when it is empty / unticked. The text may hold other tokens.
 * {{if:Key=A|text}} / {{if:Key=A/B|text}} → text only when the value is A (or B) — for dropdowns.
 * E.g. the 170 चालानी "14 दिवस रिमांड" checkbox chooses between two निवेदन lines.
 */
export function isTicked(v: string | undefined | null): boolean {
  const t = String(v ?? '').trim();
  return t !== '' && !/^(नहीं|no|false|0)$/i.test(t);
}

/**
 * Item lists (field type "item_group": JSON array of row objects, e.g. vehicles with their drivers).
 *   {{each:Key?flag|row|sep}}  → one "row" per item (only items whose column `flag` is ticked, if given);
 *                               in "row": {#} = 1, 2, 3 …, {col} = the column, {text~col} / {text~col~after} = with the
 *                               words around it, only when the column is filled;
 *                               sep defaults to " ", "\n" = new line.
 *   {{count:Key?flag|one|many}} → "one" for a single item, "many" for 2+, nothing for none.
 *   {{any:Key?flag|text}}       → text when at least one item matches.
 * Branch text may hold any other tokens; "|" inside nested {{…}} does not split.
 */
type ItemRow = Record<string, unknown>;

function _itemRows(values: Record<string, string>, key: string, flag?: string): ItemRow[] {
  let rows: ItemRow[] = [];
  try {
    const v = JSON.parse(values[key] ?? '[]');
    if (Array.isArray(v)) rows = v.filter((r) => r && typeof r === 'object') as ItemRow[];
  } catch { /* not a list */ }
  rows = rows.filter((r) => Object.entries(r).some(([k, x]) => !k.startsWith('_') && typeof x === 'string' && x.trim() && !/^(need|is)/.test(k)));
  return flag ? rows.filter((r) => isTicked(String(r[flag] ?? ''))) : rows;
}

/** Split at "|" that are not inside nested {{…}}. */
function _splitTop(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner.startsWith('{{', i)) { depth += 1; cur += '{{'; i += 1; continue; }
    if (inner.startsWith('}}', i)) { depth -= 1; cur += '}}'; i += 1; continue; }
    if (inner[i] === '{') { // row placeholder {col} / {text~col}
      const end = inner.indexOf('}', i);
      if (end > i) { cur += inner.slice(i, end + 1); i = end; continue; }
    }
    if (inner[i] === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += inner[i];
  }
  parts.push(cur);
  return parts;
}

function _applyItemTokens(template: string, values: Record<string, string>): string {
  if (!/\{\{(each|count|any):/.test(template)) return template;
  const open = /\{\{(each|count|any):([A-Za-z0-9_]+)(?:\?([A-Za-z0-9_]+))?\|/;
  let out = '';
  let rest = template;
  for (let m = open.exec(rest); m; m = open.exec(rest)) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < rest.length && depth > 0) {
      if (rest.startsWith('{{', i)) { depth += 1; i += 2; }
      else if (rest.startsWith('}}', i)) { depth -= 1; i += 2; }
      else if (rest[i] === '{' && rest.indexOf('}', i) > i) i = rest.indexOf('}', i) + 1; // {col}
      else i += 1;
    }
    const parts = _splitTop(rest.slice(m.index + m[0].length, depth === 0 ? i - 2 : i));
    const rows = _itemRows(values, m[2], m[3]);
    let rep = '';
    if (m[1] === 'any') rep = rows.length ? parts.join('|') : '';
    else if (m[1] === 'count') rep = rows.length === 0 ? '' : rows.length === 1 ? (parts[0] ?? '') : (parts[1] ?? parts[0] ?? '');
    else {
      const row = parts[0] ?? '';
      const sep = (parts[1] ?? ' ').replace(/\\n/g, '\n');
      rep = rows.map((r, n) => row
        .replace(/\{([^{}~]*)~([A-Za-z0-9_]+)(?:~([^{}~]*))?\}/g, (_x, pre: string, col: string, post?: string) => {
          const v = String(r[col] ?? '').trim();
          return v ? `${pre}${v}${post ?? ''}` : '';
        })
        .replace(/\{(#|[A-Za-z0-9_]+)\}/g, (_x, col: string) => (col === '#' ? String(n + 1) : String(r[col] ?? '').trim()))
        .replace(/ {2,}/g, ' ')).join(sep);
    }
    // the chosen text may hold more list tokens
    out += rest.slice(0, m.index) + _applyItemTokens(rep, values);
    rest = rest.slice(i);
  }
  return out + rest;
}

/**
 * {{seq|first|next1|next2|…}} — order words for paragraphs that may be left out:
 * the 1st one left in the text gets "first", the following ones take next1, next2, … in turn
 * (e.g. सर्वप्रथम / तत्पश्चात … / वहाँ से … in the GD वापसी). Runs after {{if:…}}.
 */
function _applySeqTokens(template: string): string {
  if (!template.includes('{{seq|')) return template;
  let n = 0;
  return template.replace(/\{\{seq\|([^{}]*)\}\}/g, (_m, list: string) => {
    const w = list.split('|');
    const pick = n === 0 || w.length < 2 ? w[0] : w[1 + ((n - 1) % (w.length - 1))];
    n += 1;
    return pick ?? '';
  });
}

function _applyIfTokens(template: string, values: Record<string, string>): string {
  if (!template.includes('{{if')) return template;
  const open = /\{\{(if|ifnot):([A-Za-z0-9_]+)(?:=([^|{}]+))?\|/;
  let out = '';
  let rest = template;
  for (let m = open.exec(rest); m; m = open.exec(rest)) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < rest.length && depth > 0) {
      if (rest.startsWith('{{', i)) { depth += 1; i += 2; }
      else if (rest.startsWith('}}', i)) { depth -= 1; i += 2; }
      else i += 1;
    }
    const inner = rest.slice(m.index + m[0].length, depth === 0 ? i - 2 : i);
    // {{if:Key|…}} = filled / ticked; {{if:Key=A/B|…}} = the value is A or B (dropdowns)
    const on = m[3] !== undefined
      ? m[3].split('/').map((x) => x.trim()).includes(String(values[m[2]] ?? '').trim())
      : isTicked(values[m[2]]);
    // the kept text may hold more {{if:…}} (nested)
    out += rest.slice(0, m.index) + ((m[1] === 'if') === on ? _applyIfTokens(inner, values) : '');
    rest = rest.slice(i);
  }
  return out + rest;
}

/**
 * Each accused can carry `status`: 'नामजद' | 'प्रकाश में आया' | 'वांछित नहीं'
 * (picker shown by AccusedGroupInput when the format uses these tokens; unset = प्रकाश में आया).
 *   {{Key#summary}}       → "अभियुक्तगण 1.A पुत्र X 2.B पुत्र Y उपरोक्त नामजद हैं व मुकदमा उपरोक्त में वांछित हैं
 *                            तथा अभियुक्त C पुत्र Z उपरोक्त का नाम प्रकाश में आया है व मुकदमा उपरोक्त में वांछित है
 *                            तथा अभियुक्त D पुत्र W उपरोक्त वांछित नहीं है" (only the groups that have someone)
 *   {{Key#wanted}}        → the wanted ones (नामजद + प्रकाश में आया): "अभियुक्त/अभियुक्तगण …"
 *   {{Key#ifWanted|text}} → text only when at least one accused is wanted (text may hold other tokens)
 *   {{Key#list}}          → one person per line (any group): "1.A पुत्र X उम्र करीब 30 वर्ष" … the last line
 *                            gets "नि0गण <address>" when all share it, else every line "निवासी <address>";
 *                            one person → a single line "1.A … निवासी <address>" (owner: "1." also for one).
 *   {{Key#block}}         → like #list, but a shared address goes on its own last line "निवासीगण <address>"
 *   {{Key#inline}}        → the same people on one line ("1.A … 2.B … निवासीगण <address>")
 *   {{Key#short}}         → name + father only ("1.A पुत्र X 2.B पुत्र Y"), for "… उपरोक्त"
 *   {{Key#num}}           → the usual prose ({{Key}}), but one person also gets "1." (126/135 formats)
 *   All of these number a single person "1." too (owner's choice for 126/135 and 170).
 *   {{Key#count}}         → number of people in words (एक, दो, तीन …)
 *   {{Key#cnt}}           → number of people as two digits (01, 03 …)
 *   {{Key#n|one|many}}    → "one" for a single person, "many" for 2+ (e.g. अभियुक्त|अभियुक्तगण, सकता था|सकते थे)
 * Tests: scripts/test_accused_status.ts
 */
type StatusEntry = AnyEntry & { status?: string; gender?: string };

function _statusGroups(values: Record<string, string>, key: string) {
  const all = _parseGroupEntries<StatusEntry>(values[key] ?? '').filter((e) => String(e?.name ?? '').trim());
  const st = (e: StatusEntry) => (e.status || 'प्रकाश में आया').trim();
  return {
    named: all.filter((e) => st(e) === 'नामजद'),
    surfaced: all.filter((e) => st(e) === 'प्रकाश में आया'),
    notWanted: all.filter((e) => st(e) === 'वांछित नहीं'),
    wanted: all.filter((e) => st(e) !== 'वांछित नहीं'),
  };
}

function _statusList(sub: StatusEntry[], groupType: string | undefined): string {
  if (!sub.length) return '';
  const head = sub.length > 1 ? 'अभियुक्तगण' : (sub[0].gender === 'महिला' ? 'अभियुक्ता' : 'अभियुक्त');
  return `${head} ${_resolveProjection(sub, [], ['name', 'fatherOrHusbandName'], groupType)}`;
}

/** {{Key#list}} — one person per line (see above). */
function _groupListLines(entries: StatusEntry[]): string {
  const people = entries.filter((e) => String(e?.name ?? '').trim());
  if (!people.length) return '';
  const s = (v: unknown) => String(v ?? '').trim();
  const addr = (e: StatusEntry) => s(e.fullAddress) || s(e.address);
  const shared = people.length > 1 && addr(people[0]) !== '' && people.every((e) => addr(e) === addr(people[0]));
  return people.map((e, i) => {
    const parts: string[] = [`${i + 1}.${s(e.name)}`];
    if (s(e.fatherOrHusbandName)) parts.push(`${_resolveConnector(e as never)} ${s(e.fatherOrHusbandName)}`);
    if (s(e.age)) parts.push(`उम्र करीब ${s(e.age)} वर्ष`);
    if (s(e.caste)) parts.push(`जाति ${s(e.caste)}`);
    if (shared) {
      if (i === people.length - 1) parts.push(`नि0गण ${addr(e)}`);
    } else if (addr(e)) {
      parts.push(`निवासी ${addr(e)}`);
    }
    return parts.join(' ');
  }).join('\n');
}

const COUNT_WORDS = ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छः', 'सात', 'आठ', 'नौ', 'दस'];

/** One person's words without the address: "1.A पुत्र X उम्र करीब 30 वर्ष जाति Y" (nameOnly: "1.A पुत्र X"). */
function _personWords(e: StatusEntry, i: number, nameOnly = false): string {
  const s = (v: unknown) => String(v ?? '').trim();
  const parts: string[] = [`${i + 1}.${s(e.name)}`];
  if (s(e.fatherOrHusbandName)) parts.push(`${_resolveConnector(e as never)} ${s(e.fatherOrHusbandName)}`);
  if (nameOnly) return parts.join(' ');
  if (s(e.age)) parts.push(`उम्र करीब ${s(e.age)} वर्ष`);
  if (s(e.caste)) parts.push(`जाति ${s(e.caste)}`);
  return parts.join(' ');
}

/** {{Key#block}} / {{Key#inline}} / {{Key#short}} (see above). */
function _groupPeople(entries: StatusEntry[], kind: 'block' | 'inline' | 'short'): string {
  const people = entries.filter((e) => String(e?.name ?? '').trim());
  if (!people.length) return '';
  const many = people.length > 1;
  if (kind === 'short') return people.map((e, i) => _personWords(e, i, true)).join(' ');
  const words = people.map((e, i) => _personWords(e, i));
  const addr = (e: StatusEntry) => String(e.fullAddress ?? '').trim() || String(e.address ?? '').trim();
  const shared = many && addr(people[0]) !== '' && people.every((e) => addr(e) === addr(people[0]));
  const lines = shared ? [...words, `निवासीगण ${addr(people[0])}`]
    : words.map((w, i) => (addr(people[i]) ? `${w} निवासी ${addr(people[i])}` : w));
  return lines.join(kind === 'block' ? '\n' : ' ');
}

function _applyGroupStatus(template: string, values: Record<string, string>, keyDefs: KeyDefForRender[]): string {
  if (!template.includes('#')) return template;
  const typeMap = new Map<string, string>();
  for (const kd of keyDefs) typeMap.set(kd.key_name, kd.field_type);
  const isGroup = (k: string) => REPEATABLE_GROUP_TYPES.has(typeMap.get(k) ?? '');

  // 1) {{Key#ifWanted|…}} — the text can contain {{…}}, so find the matching "}}".
  let out = '';
  let rest = template;
  const open = /\{\{([A-Za-z0-9_]+)#ifWanted\|/;
  for (let m = open.exec(rest); m; m = open.exec(rest)) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < rest.length && depth > 0) {
      if (rest.startsWith('{{', i)) { depth += 1; i += 2; }
      else if (rest.startsWith('}}', i)) { depth -= 1; i += 2; }
      else i += 1;
    }
    const inner = rest.slice(m.index + m[0].length, depth === 0 ? i - 2 : i);
    const show = isGroup(m[1]) && _statusGroups(values, m[1]).wanted.length > 0;
    out += rest.slice(0, m.index) + (show ? inner : '');
    rest = rest.slice(i);
  }
  out += rest;

  // 2) {{Key#n|one|many}}
  const count = (k: string) => _parseGroupEntries<StatusEntry>(values[k] ?? '').filter((e) => String(e?.name ?? '').trim()).length;
  out = out.replace(/\{\{([A-Za-z0-9_]+)#count\}\}/g, (match, key: string) =>
    (isGroup(key) ? (COUNT_WORDS[count(key)] ?? String(count(key))) : match));
  // {{Key#cnt}} → "01", "03" (GD: "01 नफर अभियुक्त")
  out = out.replace(/\{\{([A-Za-z0-9_]+)#cnt\}\}/g, (match, key: string) =>
    (isGroup(key) ? String(count(key)).padStart(2, '0') : match));
  out = out.replace(/\{\{([A-Za-z0-9_]+)#n\|([^|{}]*)\|([^{}]*)\}\}/g, (match, key: string, one: string, many: string) =>
    (isGroup(key) ? (count(key) > 1 ? many : one) : match));

  // 3) {{Key#summary}} / {{Key#wanted}} / {{Key#list|block|inline|short}}
  return out.replace(/\{\{([A-Za-z0-9_]+)#(summary|wanted|list|block|inline|short|num)\}\}/g, (match, key: string, kind: string) => {
    if (!isGroup(key)) return match;
    if (kind === 'num') {
      const list = _parseGroupEntries<StatusEntry>(values[key] ?? '').filter((e) => String(e?.name ?? '').trim());
      const prose = _buildGroupProse(list as never, (typeMap.get(key) ?? 'person_group') as 'accused_group' | 'person_group');
      return list.length === 1 && prose && !/^\d+\./.test(prose) ? `1.${prose}` : prose;
    }
    if (kind === 'block' || kind === 'inline' || kind === 'short') {
      return _groupPeople(_parseGroupEntries<StatusEntry>(values[key] ?? ''), kind);
    }
    if (kind === 'list') return _groupListLines(_parseGroupEntries<StatusEntry>(values[key] ?? ''));
    const g = _statusGroups(values, key);
    const gt = typeMap.get(key);
    if (kind === 'wanted') return _statusList(g.wanted, gt);
    const verb = (n: number) => (n > 1 ? 'हैं' : 'है');
    const parts: string[] = [];
    if (g.named.length) {
      parts.push(`${_statusList(g.named, gt)} उपरोक्त नामजद ${verb(g.named.length)} व मुकदमा उपरोक्त में वांछित ${verb(g.named.length)}`);
    }
    if (g.surfaced.length) {
      const n = g.surfaced.length;
      parts.push(`${_statusList(g.surfaced, gt)} उपरोक्त ${n > 1 ? 'के नाम प्रकाश में आये' : 'का नाम प्रकाश में आया'} ${verb(n)} व मुकदमा उपरोक्त में वांछित ${verb(n)}`);
    }
    if (g.notWanted.length) {
      parts.push(`${_statusList(g.notWanted, gt)} उपरोक्त वांछित नहीं ${verb(g.notWanted.length)}`);
    }
    return parts.join(' तथा ');
  });
}

/**
 * "{{group.1.name}} आदि" when the group has only ONE person → drop "आदि"
 * ("बनाम संगीता आदि" → "बनाम संगीता"). Two or more people keep it. Runs before
 * _applyIndexedFieldAccess. Only touches "आदि" right after the first person's name.
 * Tests: scripts/test_template_adi.ts
 */
const ADI_AFTER_FIRST_NAME_RE = /\{\{([A-Za-z0-9_]+)\.1\.name\}\}\s*आदि/g;

function _dropAdiForSingleEntry(
  template: string,
  values: Record<string, string>,
  keyDefs: KeyDefForRender[],
): string {
  const typeMap = new Map<string, string>();
  for (const kd of keyDefs) typeMap.set(kd.key_name, kd.field_type);
  return template.replace(ADI_AFTER_FIRST_NAME_RE, (match, groupKey: string) => {
    if (!REPEATABLE_GROUP_TYPES.has(typeMap.get(groupKey) ?? '')) return match;
    let named = 0;
    try {
      named = _parseGroupEntries<{ name?: string }>(values[groupKey] ?? '')
        .filter((e) => String(e?.name ?? '').trim()).length;
    } catch { return match; }
    return named === 1 ? `{{${groupKey}.1.name}}` : match;
  });
}

function _applyIndexedFieldAccess(
  template: string,
  values: Record<string, string>,
  keyDefs: KeyDefForRender[],
): string {
  const typeMap = new Map<string, string>();
  for (const kd of keyDefs) typeMap.set(kd.key_name, kd.field_type);

  return template.replace(INDEXED_ACCESS_RE, (match, groupKey, nStr, fieldName) => {
    const fieldType = typeMap.get(groupKey);
    if (!fieldType || !REPEATABLE_GROUP_TYPES.has(fieldType)) return match;

    const entries = _parseGroupEntries<Record<string, string>>(values[groupKey] ?? '');
    const idx = parseInt(nStr, 10) - 1;

    if (idx < 0 || idx >= entries.length) {
      if (__DEV__) {
        console.warn(
          `[templateEngine] indexed access {{${groupKey}.${nStr}.${fieldName}}}: ` +
          `index ${parseInt(nStr, 10)} out of range (array length ${entries.length})`
        );
      }
      return '';
    }

    const entry = entries[idx];
    const value = entry[fieldName];
    if (value === undefined) {
      if (__DEV__) {
        console.warn(
          `[templateEngine] indexed access {{${groupKey}.${nStr}.${fieldName}}}: ` +
          `unknown field "${fieldName}"`
        );
      }
      return '';
    }
    return String(value);
  });
}

// ─── Pipeline Step 2: Dropdown conditional-text substitution ─────────────
//
// Syntax:  {{KeyName|value1:branch text|value2:branch text}}
//
// Applies only when KeyName has field_type='dropdown'.  The stored VALUE of
// the key (e.g. "yes" or "no") selects the matching branch.  Nested plain
// {{KEY}} references inside the selected branch text are resolved against
// `values` before output, so sub-keys like {{SIDNO}} work inside a branch.
//
// If no branch matches the stored value, '' is substituted (silent fallback).
// Runs BEFORE group-agreement text (Step 3) so the pattern regex is shared —
// dropdown keys are identified first and consumed, leaving only group keys for
// Step 3.

function _applyDropdownConditional(
  template: string,
  values: Record<string, string>,
  keyDefs: KeyDefForRender[],
): string {
  const typeMap = new Map<string, string>();
  for (const kd of keyDefs) typeMap.set(kd.key_name, kd.field_type);

  // Matches {{KeyName|branch1:text|branch2:text}} — same regex shape as AGREEMENT_RE below.
  // We consume dropdown keys here so they don't fall through to agreement-text.
  return template.replace(/\{\{([A-Za-z0-9_]+)\|([^}]+)\}\}/g, (match, keyName, branchStr) => {
    const fieldType = typeMap.get(keyName);
    if (fieldType !== 'dropdown') return match; // leave for Step 3

    const storedValue = values[keyName] ?? '';
    // Parse "val:text|val:text" branches
    const branches = _parseAgreementBranches(branchStr);
    const branchText = branches[storedValue] ?? '';
    if (!branchText) return '';

    // Resolve nested {{KEY}} references within the chosen branch
    return branchText.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, innerKey) => values[innerKey] ?? '');
  });
}

// ─── Pipeline Step 3: Group-agreement text substitution ──────────────────
//
// Syntax:  {{KeyName|एक-पुरुष:text|एक-महिला:text|बहु:text}}
//
// Resolves to the matching branch based on array length + gender of first
// entry.  Works for both accused_group and person_group (and any future
// repeatable group type) via the shared _resolveGroupAgreement helper.
//
// Must run AFTER indexed field access so {{Key.1.gender}} already resolved,
// and BEFORE whole-group prose so plain {{Key}} tokens are still available.
// Runs AFTER dropdown conditional (Step 2) — dropdown keys are already gone.

const AGREEMENT_RE = /\{\{([A-Za-z0-9_]+)\|([^}]+)\}\}/g;

function _parseAgreementBranches(branchStr: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of branchStr.split('|')) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx).trim();
    const val = part.slice(colonIdx + 1).trim();
    map[key] = val;
  }
  return map;
}

function _applyGroupAgreementText(
  template: string,
  values: Record<string, string>,
  keyDefs: KeyDefForRender[],
): string {
  const typeMap = new Map<string, string>();
  for (const kd of keyDefs) typeMap.set(kd.key_name, kd.field_type);

  return template.replace(AGREEMENT_RE, (match, keyName, branchStr) => {
    const fieldType = typeMap.get(keyName);
    if (!fieldType || !REPEATABLE_GROUP_TYPES.has(fieldType)) return match;

    const branchMap = _parseAgreementBranches(branchStr);
    return _resolveGroupAgreement(values[keyName] ?? '', branchMap);
  });
}

// ─── Pipeline Step 4: Whole-group prose substitution ─────────────────────

function _applyWholeGroupSubstitution(
  template: string,
  values: Record<string, string>,
  keyDefs: KeyDefForRender[],
): string {
  let result = template;
  for (const kd of keyDefs) {
    if (!REPEATABLE_GROUP_TYPES.has(kd.field_type)) continue;
    const rawJson = values[kd.key_name] ?? '';
    const rendered = kd.field_type === 'person_group'
      ? renderPersonGroup(rawJson)
      : renderAccusedGroup(rawJson);
    const placeholder = new RegExp(`\\{\\{${kd.key_name}\\}\\}`, 'g');
    result = result.replace(placeholder, rendered);
  }
  return result;
}

// ─── Main report generator ────────────────────────────────────────────────

/**
 * Replace all template placeholders with their resolved values.
 * Missing plain keys → empty string.
 *
 * Full pipeline when keyDefs are supplied:
 *   0. Field-projection       {{GroupKey[1,2].f1,f2}}         → formatted field subset
 *   1. Indexed field access   {{GroupKey.N.field}}            → raw scalar value
 *   2. Agreement-text         {{GroupKey|एक-पुरुष:x|...}}     → agreement branch
 *   3. Whole-group prose      {{GroupKey}}                    → full Hindi list block
 *   4. Plain substitution     {{key}}                         → values[key] ?? ''
 *
 * keyDefs is optional — callers that don't supply it get plain substitution
 * only, preserving full backward compatibility.
 */
export function generateReport(
  template: string,
  values: Record<string, string>,
  keyDefs?: KeyDefForRender[],
  opts?: { keepMarkers?: boolean },
): string {
  // Layout marks ([[शीर्षक]] …) are only for the print pipeline (formats/fill).
  if (!opts?.keepMarkers) return stripFormatMarkers(generateReport(template, values, keyDefs, { keepMarkers: true }));
  let processed = _applySeqTokens(_applyIfTokens(_applyItemTokens(template, values), values)); // Step -3/-2 (item lists, {{if:Key|…}}, {{seq|…}})
  if (keyDefs && keyDefs.length > 0) {
    processed = _applyGroupStatus(processed, values, keyDefs);            // Step -1 (accused status)
    processed = _applyFieldProjection(processed, values, keyDefs);        // Step 0
    processed = _dropAdiForSingleEntry(processed, values, keyDefs);       // Step 0.5 (1 person → no "आदि")
    processed = _applyIndexedFieldAccess(processed, values, keyDefs);     // Step 1
    processed = _applyDropdownConditional(processed, values, keyDefs);    // Step 2 (NEW)
    processed = _applyGroupAgreementText(processed, values, keyDefs);     // Step 3
    processed = _applyWholeGroupSubstitution(processed, values, keyDefs); // Step 4
  }
  return processed.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, key) => values[key] ?? '');
}

/**
 * Validate that every key used in template has a corresponding entry in keys list.
 * Returns array of template keys that are missing from keys list.
 */
export function getMissingKeys(template: string, keyNames: string[]): string[] {
  const used = detectKeys(template);
  const defined = new Set(keyNames);
  return used.filter((k) => !defined.has(k));
}

/**
 * Validate that all required keys have non-empty values.
 * Returns array of required key labels that are empty.
 */
export function getMissingRequiredValues(
  keys: Array<{ key_name: string; label: string; is_required: number }>,
  values: Record<string, string>
): string[] {
  return keys
    .filter((k) => k.is_required === 1 && !values[k.key_name]?.trim())
    .map((k) => k.label);
}

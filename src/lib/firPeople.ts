/**
 * "📁 मुकदमे से डालें" (owner): the people of a मुकदमा (वादी + अभियुक्त) as a pick list, and helpers that put the
 * picked ones into a format's group field — person card (PersonGroupInput), accused card (AccusedGroupInput) or an
 * item_group whose columns hold a person (name / rel / father / addr / age / mobile / mahila).
 * Owner's choice (ख): group fields are no longer filled by themselves from the FIR — the officer picks with the button.
 * Pure — tests: scripts/test_fir_people.ts
 */
import type { AccusedLike, FirLike } from './firFill';

export interface FirPerson {
  id: string;
  /** "वादी" / "वादिनी" / "अभियुक्त" / "अभियुक्ता" */
  role: string;
  isAccused: boolean;
  name: string;
  relation: string;
  father: string;
  gender: string;
  age: string;
  mobile: string;
  address: string;
  caste: string;
}

const s = (v: unknown) => (v == null ? '' : String(v).trim());
const tenDigits = (m: string) => {
  const d = m.replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
};
const womanBy = (gender: string, relation: string) => gender === 'महिला' || relation === 'पत्नी' || relation === 'पुत्री';

/** वादी first, then every named अभियुक्त (unknown / deleted left out). */
export function firPeople(fir: (FirLike & { complainant_jati?: string | null }) | null, accused: AccusedLike[] = []): FirPerson[] {
  const out: FirPerson[] = [];
  if (fir && s(fir.complainant_name)) {
    const rel = s(fir.complainant_relation);
    const g = s(fir.complainant_gender) || (womanBy('', rel) ? 'महिला' : '');
    out.push({
      id: 'vadi', role: g === 'महिला' ? 'वादिनी' : 'वादी', isAccused: false,
      name: s(fir.complainant_name), relation: rel, father: s(fir.complainant_father), gender: g,
      age: s(fir.complainant_age), mobile: tenDigits(s(fir.complainant_mobile)), address: s(fir.complainant_address), caste: s(fir.complainant_jati),
    });
  }
  accused.filter((a) => !a.deleted_at && a.is_known !== 0 && s(a.name)).forEach((a, i) => {
    const rel = s(a.relation);
    const woman = womanBy(s(a.gender), rel);
    out.push({
      id: `acc${i}`, role: woman ? 'अभियुक्ता' : 'अभियुक्त', isAccused: true,
      name: s(a.name), relation: rel, father: s(a.father), gender: woman ? 'महिला' : (s(a.gender) || 'पुरुष'),
      age: s(a.age), mobile: tenDigits(s(a.mobile)), address: s(a.address), caste: '',
    });
  });
  return out;
}

/** One line for the pick list: "रामकुमार पुत्र श्यामलाल, निवासी …, उम्र 40". */
export function personLine(p: FirPerson): string {
  return [
    p.name + (p.father ? ` ${p.relation || 'पुत्र'} ${p.father}` : ''),
    p.address ? `निवासी ${p.address}` : '',
    p.age ? `उम्र ${p.age}` : '',
  ].filter(Boolean).join(', ');
}

/** Card of PersonGroupInput / AccusedGroupInput (accused cards also get caughtBy + status नामजद). */
export function toCard(p: FirPerson, accusedCard: boolean, n: number): Record<string, string> {
  return {
    _id: `fir_pick_${Date.now()}_${n}`, name: p.name, relationType: p.relation || (p.father ? 'पुत्र' : ''), fatherOrHusbandName: p.father,
    fullAddress: p.address, age: p.age, mobile: p.mobile, caste: p.caste, gender: p.gender, email: '',
    ...(accusedCard ? { caughtBy: '', status: p.isAccused ? 'नामजद' : 'प्रकाश में आया' } : {}),
  };
}

const NAME_KEYS = ['name'];
const REL_KEYS = ['rel', 'relation'];
const FATHER_KEYS = ['father'];
const ADDR_KEYS = ['addr', 'address'];

/** An item_group holds a person when it has a "name" column (doctor's patients, पंच, फर्द अभियुक्त, सुपुर्दगी …). */
export function isPersonItemGroup(columns: { key: string }[]): boolean {
  return columns.some((c) => NAME_KEYS.includes(c.key));
}

/** Row of an item_group from a person — only the columns the group has; other columns keep their defaults. */
export function toItemRow(p: FirPerson, columns: { key: string; type?: string; default?: string }[]): Record<string, string> {
  const row: Record<string, string> = {};
  for (const c of columns) {
    const k = c.key;
    let v: string | undefined;
    if (NAME_KEYS.includes(k)) v = p.name;
    else if (REL_KEYS.includes(k)) v = p.relation || (p.father ? 'पुत्र' : '');
    else if (FATHER_KEYS.includes(k)) v = p.father;
    else if (ADDR_KEYS.includes(k)) v = p.address;
    else if (k === 'age') v = p.age;
    else if (k === 'mobile') v = p.mobile;
    else if (k === 'mahila') v = p.gender === 'महिला' ? 'हाँ' : '';
    row[k] = v ?? c.default ?? '';
  }
  return row;
}

/** A card / row nobody typed in yet (the empty one a group opens with) — replaced by the picked people. */
function isBlank(o: Record<string, unknown>, ignore: string[] = []): boolean {
  return Object.entries(o).every(([k, v]) => k.startsWith('_') || ignore.includes(k) || s(v) === '');
}

/**
 * Put the picked people into a group value (JSON array): blank entries go, the picked ones are added after the filled
 * ones; a person already in the list (same name + father) is not added twice. `defaults` = the opening row of an
 * item_group (its default cells don't count as "typed").
 */
export function insertIntoGroup(
  currentJson: string, newEntries: Record<string, string>[], defaults: Record<string, string> = {},
): string {
  let cur: Record<string, unknown>[] = [];
  try {
    const v = JSON.parse(currentJson || '[]');
    if (Array.isArray(v)) cur = v;
  } catch { /* empty */ }
  const kept = cur.filter((r) => !isBlank(r, Object.keys(defaults).filter((k) => s(r[k]) === s(defaults[k]))));
  const key = (o: Record<string, unknown>) => `${s(o.name)}|${s(o.fatherOrHusbandName ?? o.father)}`;
  const have = new Set(kept.map(key));
  const add = newEntries.filter((e) => !have.has(key(e)));
  return JSON.stringify([...kept, ...add]);
}

/** "@FIR.<field>" markers that fill a PERSON (owner (ख): not used on group fields any more — the button does it). */
export const PERSON_MARKER_RE = /^@FIR\.(complainant_(name|father|relation|gender|age|age_years|jati|mobile|address|full|with_role|doctor_row)|accused1_\w+|accused_(cards|group|rows|names))\b/;
export const GROUP_FIELD_TYPES = ['person_group', 'accused_group', 'item_group'];

/** Group field with a person marker → leave it empty (owner (ख)). */
export function skipPersonMarker(fieldType: string | null | undefined, defaultValue: string | null | undefined): boolean {
  return !!fieldType && GROUP_FIELD_TYPES.includes(fieldType) && PERSON_MARKER_RE.test(String(defaultValue ?? ''));
}

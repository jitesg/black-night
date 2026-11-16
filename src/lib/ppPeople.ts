/**
 * आवेदक समूह / विपक्षी समूह (owner): two person groups of the प्रार्थना पत्र formats.
 * A format key stays field_type "person_group" and says its role in dropdown_options:
 *   {"role": "avedak", "wordKey": "Avedak"}                       → word आवेदक / आवेदिका / आवेदकगण (worked out from the cards)
 *   {"role": "vipakshi", "wordKey": "VipWord", "kindKey": "VipKind", "nilKey": "noVip"}
 *                                                                 → विपक्षी / विपक्षीगण or आरोपी / आरोपीगण (VipKind = the officer's
 *                                                                   choice); nilKey ticked → the singular word
 * deriveFormatValues writes the word into `wordKey` (default "<Key>Word"), so a template uses {{Avedak}} / {{VipWord}}.
 * The प्रार्थना पत्र's own आवेदक / विपक्षी rows fill these groups (ppComplainantToCard / ppAccusedToCard).
 * Pure — tests: scripts/test_pp_people.ts
 */

// The words themselves live in formatDerived.ts (it runs them for every format; plain node tests import it directly).
export {
  roleConfigOf, namedCards, isWomanCard, avedakCardWord, avedakWord, vipakshiWord, roleWord,
  type GroupRole, type RoleConfig,
} from './formatDerived';

const s = (v: unknown) => (v == null ? '' : String(v).trim());

/** पुत्र → पुरुष, पुत्री / पत्नी → महिला (the form fills लिंग from the सम्बन्ध chip). */
export function genderOfRelation(rel: string): string {
  return rel === 'पुत्र' ? 'पुरुष' : rel === 'पुत्री' || rel === 'पत्नी' ? 'महिला' : '';
}

/** "पिता का नाम" / "पति का नाम" for a सम्बन्ध. */
export function fatherLabelOf(rel: string): string {
  return rel === 'पत्नी' ? 'पति का नाम' : rel ? 'पिता का नाम' : 'पिता / पति का नाम';
}

export interface PPPersonRow {
  name?: string | null;
  father_husband_name?: string | null;
  father_name?: string | null;
  relation?: string | null;
  gender?: string | null;
  age?: string | null;
  mobile?: string | null;
  full_address?: string | null;
  village?: string | null;
  police_station?: string | null;
  district?: string | null;
  jati?: string | null;
}

/** Full address: the typed address, plus ग्राम / थाना / जनपद when they are not in it already. */
export function ppAddress(r: PPPersonRow): string {
  const addr = s(r.full_address);
  const parts = [addr];
  const add = (word: string, v: string) => { if (v && !addr.includes(v)) parts.push(`${word} ${v}`); };
  add('ग्राम', s(r.village));
  add('थाना', s(r.police_station));
  add('जनपद', s(r.district));
  return parts.filter(Boolean).join(' ');
}

function toCard(r: PPPersonRow, father: string, n: number): Record<string, string> {
  const rel = s(r.relation);
  const g = s(r.gender) || genderOfRelation(rel);
  return {
    _id: `pp_pick_${Date.now()}_${n}`,
    name: s(r.name),
    relationType: rel || (father ? (g === 'महिला' ? '' : 'पुत्र') : ''),
    fatherOrHusbandName: father,
    fullAddress: ppAddress(r),
    age: s(r.age),
    mobile: s(r.mobile).replace(/\D/g, '').replace(/^91(\d{10})$/, '$1'),
    caste: s(r.jati),
    gender: g,
    email: '',
  };
}

export function ppComplainantToCard(r: PPPersonRow, n = 0): Record<string, string> {
  return toCard(r, s(r.father_husband_name), n);
}

export function ppAccusedToCard(r: PPPersonRow, n = 0): Record<string, string> {
  return toCard(r, s(r.father_name ?? r.father_husband_name), n);
}

/** Named rows → cards (rows without a name left out). */
export function ppCards(rows: PPPersonRow[], accused: boolean): Record<string, string>[] {
  return rows.filter((r) => s(r.name)).map((r, i) => (accused ? ppAccusedToCard(r, i) : ppComplainantToCard(r, i)));
}

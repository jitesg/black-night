/**
 * Group person card rules (owner, 2026-11-17) — used by PersonGroupInput everywhere (formats, FIR वादी, प्रार्थना पत्र …).
 * Pure, no imports — tests: scripts/test_person_card.ts
 *
 *  • सम्बन्ध: 5 chips पुत्र / पुत्री / पत्नी / ट्रांसजेंडर / दत्तक. relationType keeps the PRINT word, so every format prints it as is:
 *      ट्रांसजेंडर → संतान / गुरु ("सोनम संतान रामलाल", "सोनम गुरु रेखा"), दत्तक → दत्तक पुत्र / दत्तक पुत्री ("रामू दत्तक पुत्र श्याम लाल").
 *  • लिंग comes from the सम्बन्ध (no gender buttons): पुत्र / दत्तक पुत्र → पुरुष, पुत्री / पत्नी / दत्तक पुत्री → महिला, संतान / गुरु → ट्रांसजेंडर.
 *    ट्रांसजेंडर = स्त्रीलिंग grammar (आवेदिका, अभियुक्ता, पीड़िता …) — `isFeminine`.
 *  • पता: मकान / मोहल्ला, ग्राम / मजरा (+ ग्राम / कस्बा), थाना, जनपद (थाना / जनपद prefilled from सेटिंग) → fullAddress is built from them
 *    ("ग्राम भग्तिन खेड़ा थाना बछरावां जनपद रायबरेली"), so every format that reads fullAddress keeps working. Old cards (one typed address,
 *    no parts) stay in 'free' mode and print exactly as typed.
 */

export const RELATION_CHIPS = ['पुत्र', 'पुत्री', 'पत्नी', 'ट्रांसजेंडर', 'दत्तक'] as const;
export type RelationChip = typeof RELATION_CHIPS[number];

export const TRANS_SUBS = ['संतान', 'गुरु'] as const;
export const ADOPT_SUBS = ['पुत्र', 'पुत्री'] as const;

/** Chip + sub-chip → the word stored in relationType (and printed). */
export function relationWord(chip: RelationChip | '', sub = ''): string {
  if (chip === 'ट्रांसजेंडर') return sub === 'गुरु' ? 'गुरु' : sub === 'संतान' ? 'संतान' : '';
  if (chip === 'दत्तक') return sub === 'पुत्री' ? 'दत्तक पुत्री' : sub === 'पुत्र' ? 'दत्तक पुत्र' : '';
  return chip;
}

/** relationType → which chip / sub-chip is on. */
export function chipOf(rel: string | null | undefined): { chip: RelationChip | ''; sub: string } {
  const r = (rel ?? '').trim();
  if (r === 'संतान' || r === 'गुरु') return { chip: 'ट्रांसजेंडर', sub: r };
  if (r === 'दत्तक पुत्र') return { chip: 'दत्तक', sub: 'पुत्र' };
  if (r === 'दत्तक पुत्री') return { chip: 'दत्तक', sub: 'पुत्री' };
  if (r === 'पुत्र' || r === 'पुत्री' || r === 'पत्नी') return { chip: r, sub: '' };
  return { chip: '', sub: '' };
}

export const KNOWN_RELATIONS = ['पुत्र', 'पुत्री', 'पत्नी', 'संतान', 'गुरु', 'दत्तक पुत्र', 'दत्तक पुत्री'];

/** लिंग from the सम्बन्ध ('' = cannot tell). */
export function genderOfRelation(rel: string | null | undefined): string {
  const r = (rel ?? '').trim();
  if (r === 'पुत्र' || r === 'दत्तक पुत्र') return 'पुरुष';
  if (r === 'पुत्री' || r === 'पत्नी' || r === 'दत्तक पुत्री') return 'महिला';
  if (r === 'संतान' || r === 'गुरु') return 'ट्रांसजेंडर';
  return '';
}

/** स्त्रीलिंग grammar: महिला or ट्रांसजेंडर (owner), or a female सम्बन्ध. */
export function isFeminine(p: { gender?: string | null; relationType?: string | null; relation?: string | null }): boolean {
  const g = (p.gender ?? '').trim();
  if (g === 'महिला' || g === 'ट्रांसजेंडर') return true;
  const r = genderOfRelation(p.relationType ?? p.relation);
  return r === 'महिला' || r === 'ट्रांसजेंडर';
}

/** Label of the name box under the सम्बन्ध. */
export function fatherLabel(rel: string | null | undefined): string {
  const r = (rel ?? '').trim();
  if (r === 'पत्नी') return 'पति का नाम';
  if (r === 'गुरु') return 'गुरु / अभिभावक का नाम';
  if (r) return 'पिता का नाम';
  return 'पिता / पति का नाम';
}

// ── पता ─────────────────────────────────────────────────────────────────────

export interface AddressParts {
  house?: string;        // मकान नं0 / मोहल्ला
  village?: string;      // ग्राम / मजरा / कस्बा का नाम
  villageKind?: string;  // 'ग्राम' | 'कस्बा'
  thana?: string;
  district?: string;
}

const clean = (v: string | null | undefined, words: RegExp) => (v ?? '').trim().replace(words, '').trim();

/** "ग्राम भग्तिन खेड़ा थाना बछरावां जनपद रायबरेली" — a typed "ग्राम" / "थाना" / "जनपद" word is not doubled. */
export function composeAddress(p: AddressParts): string {
  const house = (p.house ?? '').trim();
  const village = clean(p.village, /^(ग्राम|गाँव|गांव|कस्बा|मजरा)\s+/);
  const kind = p.villageKind === 'कस्बा' ? 'कस्बा' : 'ग्राम';
  const thana = clean(p.thana, /^थाना\s+/);
  const district = clean(p.district, /^(जनपद|जिला)\s+/);
  return [house, village ? `${kind} ${village}` : '', thana ? `थाना ${thana}` : '', district ? `जनपद ${district}` : '']
    .filter(Boolean).join(' ');
}

export type AddrMode = 'parts' | 'free';

/** Old cards (an address typed in one box, no parts) are 'free' and print as typed. */
export function addrModeOf(e: AddressParts & { fullAddress?: string; addrMode?: string }): AddrMode {
  if (e.addrMode === 'parts' || e.addrMode === 'free') return e.addrMode;
  const hasParts = !!((e.house ?? '') || (e.village ?? ''));
  return !hasParts && (e.fullAddress ?? '').trim() ? 'free' : 'parts';
}

/** Address box filled enough (parts: ग्राम or मकान/मोहल्ला; free: any text). */
export function hasAddress(e: AddressParts & { fullAddress?: string; addrMode?: string }): boolean {
  return addrModeOf(e) === 'free' ? !!(e.fullAddress ?? '').trim() : !!((e.village ?? '').trim() || (e.house ?? '').trim());
}

/**
 * A row of the old प्रार्थना पत्र columns (full_address + village + police_station + district) → card address. Parts when the
 * typed full_address does not already hold the village (else free, built like before so nothing is printed twice).
 */
export function partsFromColumns(r: { full_address?: string | null; village?: string | null; police_station?: string | null; district?: string | null }):
  AddressParts & { addrMode: AddrMode; fullAddress: string } {
  const full = (r.full_address ?? '').trim();
  const village = (r.village ?? '').trim();
  const thana = (r.police_station ?? '').trim();
  const district = (r.district ?? '').trim();
  if (full && ((village && full.includes(village)) || (!village && !thana && !district))) {
    const extra = [thana && !full.includes(thana) ? `थाना ${thana}` : '', district && !full.includes(district) ? `जनपद ${district}` : ''].filter(Boolean);
    return { addrMode: 'free', fullAddress: [full, ...extra].join(' '), house: '', village: '', villageKind: 'ग्राम', thana, district };
  }
  const parts = { house: full, village, villageKind: 'ग्राम', thana, district };
  return { addrMode: 'parts', fullAddress: composeAddress(parts), ...parts };
}

/** Card address → the old columns (round trip with partsFromColumns). */
export function columnsFromCard(e: AddressParts & { fullAddress?: string; addrMode?: string }):
  { full_address: string; village: string; police_station: string; district: string } {
  if (addrModeOf(e) === 'free') return { full_address: (e.fullAddress ?? '').trim(), village: '', police_station: (e.thana ?? '').trim(), district: (e.district ?? '').trim() };
  return { full_address: (e.house ?? '').trim(), village: clean(e.village, /^(ग्राम|गाँव|गांव|कस्बा|मजरा)\s+/), police_station: clean(e.thana, /^थाना\s+/), district: clean(e.district, /^(जनपद|जिला)\s+/) };
}

// ── पहचान पत्र ────────────────────────────────────────────────────────────────

export const ID_TYPES = ['आधार', 'वोटर कार्ड', 'ड्राइविंग लाइसेंस', 'अन्य'] as const;

/** Defaults for new cards (थाना / जनपद from सेटिंग) — set by WorkspaceProvider. */
let defaults: { thana: string; district: string } = { thana: '', district: '' };
export function setPersonCardDefaults(d: { thana?: string; district?: string }): void {
  defaults = { thana: (d.thana ?? '').trim(), district: (d.district ?? '').trim() };
}
export function personCardDefaults(): { thana: string; district: string } { return defaults; }

// ── प्रार्थना पत्र row ↔ group card (owner: PP add form uses the group card) ──────────

export interface PPPersonRow {
  id?: string;
  name?: string | null;
  father?: string | null;           // father_husband_name (आवेदक) / father_name (विपक्षी)
  mobile?: string | null;
  alternate_mobile?: string | null;
  full_address?: string | null;
  village?: string | null;
  police_station?: string | null;
  district?: string | null;
  age?: string | null;
  gender?: string | null;
  jati?: string | null;
  relation?: string | null;
  remarks?: string | null;
  extra_json?: string | null;
}

export interface CardLike extends AddressParts {
  _id?: string;
  name: string; fatherOrHusbandName: string; fullAddress: string; age: string; mobile: string; caste: string;
  gender: string; relationType: string; email: string;
  addrMode?: AddrMode; altMobile?: string; idType?: string; idNumber?: string; remarks?: string;
}

function parseExtra(s: string | null | undefined): Record<string, string> {
  if (!s) return {};
  try { const o = JSON.parse(s); return o && typeof o === 'object' ? o as Record<string, string> : {}; } catch { return {}; }
}

/** One saved PP person → a card (old rows keep their typed address; ई-मेल / पहचान / टिप्पणी from extra_json, remarks column first). */
export function cardFromPPRow(r: PPPersonRow): CardLike {
  const x = parseExtra(r.extra_json);
  const addr = partsFromColumns(r);
  return {
    ...(r.id ? { _id: r.id } : {}),
    name: r.name ?? '', fatherOrHusbandName: r.father ?? '', age: r.age ?? '', mobile: r.mobile ?? '', caste: r.jati ?? '',
    gender: r.gender ?? '', relationType: r.relation ?? '', email: x.email ?? '',
    altMobile: r.alternate_mobile ?? '', idType: x.idType ?? '', idNumber: x.idNumber ?? '', remarks: (r.remarks ?? '') || (x.remarks ?? ''),
    ...addr,
  };
}

/** A card → the PP columns (remarks column only where the table has it — `hasRemarks`). */
export type PPRowOut = { [K in Exclude<keyof PPPersonRow, 'id' | 'remarks'>]: string } & { remarks?: string };
export function ppRowFromCard(c: CardLike, hasRemarks: boolean): PPRowOut {
  const cols = columnsFromCard(c);
  const extra: Record<string, string> = {};
  if ((c.email ?? '').trim()) extra.email = c.email.trim();
  if ((c.idType ?? '').trim() && (c.idNumber ?? '').trim()) extra.idType = c.idType!.trim();
  if ((c.idNumber ?? '').trim()) extra.idNumber = c.idNumber!.trim();
  if (!hasRemarks && (c.remarks ?? '').trim()) extra.remarks = c.remarks!.trim();
  return {
    name: (c.name ?? '').trim(), father: c.fatherOrHusbandName ?? '', mobile: c.mobile ?? '', alternate_mobile: c.altMobile ?? '',
    ...cols, age: c.age ?? '', gender: c.gender ?? '', jati: c.caste ?? '', relation: c.relationType ?? '',
    extra_json: Object.keys(extra).length ? JSON.stringify(extra) : '',
    ...(hasRemarks ? { remarks: c.remarks ?? '' } : {}),
  };
}

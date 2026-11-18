/**
 * व्यक्ति रजिस्टर (owner, "पूरे app से सुझाव") — pure rules.
 *
 * Every module that stores people (मुकदमा वादी / अभियुक्त, प्रार्थना पत्र आवेदक / विपक्षी, न्यायालय, निरोधात्मक, हल्का, हाल के
 * कार्य) gives raw rows (`RawPerson`); this file merges rows that are the same person and ranks them for what the officer is
 * typing. The list is built at search time from the module tables (db/peopleRegistryRepo.ts), so it never goes stale and
 * nothing extra is stored. Everything stays on the phone.
 *
 * Same person = same 10-digit mobile, or the same name + father / husband + village (spelling-normalised).
 * Tests: scripts/test_people_registry.ts
 */
import { searchNormalize } from './searchUtils';
import { composeAddress, genderOfRelation, partsFromColumns } from './personCard';

export type PeopleSourceModule = 'fir' | 'pp' | 'court' | 'nk' | 'halka' | 'recent';

/** Where a person was seen: module + a short label for the chip ("मुकदमा 120/26 · वादी"). */
export interface PeopleSource {
  module: PeopleSourceModule;
  /** e.g. "मुकदमा 120/2026" */
  title: string;
  /** e.g. "वादी" / "अभियुक्त" / "आवेदक" */
  role: string;
  /** dd/mm/yyyy or '' */
  date: string;
  /** to sort the newest first (seconds or ms — only compared within the list) */
  at: number;
}

export interface RawPerson {
  name: string;
  father?: string;
  relation?: string;
  gender?: string;
  age?: string;
  mobile?: string;
  /** full address as stored */
  address?: string;
  house?: string;
  village?: string;
  thana?: string;
  district?: string;
  source: PeopleSource;
}

export interface PersonHit {
  key: string;
  name: string;
  father: string;
  relation: string;
  gender: string;
  age: string;
  mobile: string;
  address: string;
  house: string;
  village: string;
  thana: string;
  district: string;
  /** newest first */
  sources: PeopleSource[];
}

export const MODULE_ICON: Record<PeopleSourceModule, string> = {
  fir: '📁', pp: '📨', court: '⚖️', nk: '🛡', halka: '🏘', recent: '📝',
};
export const MODULE_WORD: Record<PeopleSourceModule, string> = {
  fir: 'मुकदमा', pp: 'प्रार्थना पत्र', court: 'न्यायालय', nk: 'निरोधात्मक', halka: 'हल्का', recent: 'हाल के कार्य',
};

const s = (v: unknown) => String(v ?? '').trim();
/** 10-digit mobile ('' when not a mobile number). */
export function mobile10(v: unknown): string {
  const d = s(v).replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}
const norm = (v: unknown) => searchNormalize(s(v)).replace(/\s+/g, ' ').trim();

/** Same-person key: mobile, else name + father + village (all normalised). */
export function personKey(p: RawPerson): string {
  const m = mobile10(p.mobile);
  if (m) return `m:${m}`;
  return `n:${norm(p.name)}|${norm(p.father)}|${norm(p.village || p.address)}`;
}

/** Merge rows of the same person; a later row only fills what is still empty. Sources newest first. */
export function mergePeople(rows: RawPerson[]): PersonHit[] {
  const byKey = new Map<string, PersonHit>();
  // a person with a mobile and the same person without one (same name + father + village) → one hit
  const nameKeyToMobileKey = new Map<string, string>();
  const sorted = [...rows].filter((r) => s(r.name)).sort((a, b) => b.source.at - a.source.at);
  for (const r of sorted) {
    const nameKey = `n:${norm(r.name)}|${norm(r.father)}|${norm(r.village || r.address)}`;
    let key = personKey(r);
    if (key.startsWith('n:') && nameKeyToMobileKey.has(nameKey)) key = nameKeyToMobileKey.get(nameKey)!;
    if (key.startsWith('m:')) nameKeyToMobileKey.set(nameKey, key);
    const cur = byKey.get(key);
    if (!cur) {
      byKey.set(key, {
        key, name: s(r.name), father: s(r.father), relation: s(r.relation), gender: s(r.gender), age: s(r.age),
        mobile: mobile10(r.mobile) || s(r.mobile), address: s(r.address), house: s(r.house), village: s(r.village),
        thana: s(r.thana), district: s(r.district), sources: [r.source],
      });
      continue;
    }
    const fill = (k: keyof Omit<PersonHit, 'key' | 'sources'>, v: unknown) => { if (!cur[k] && s(v)) cur[k] = s(v); };
    fill('father', r.father); fill('relation', r.relation); fill('gender', r.gender); fill('age', r.age);
    fill('mobile', mobile10(r.mobile) || r.mobile); fill('address', r.address); fill('house', r.house);
    fill('village', r.village); fill('thana', r.thana); fill('district', r.district);
    if (!cur.sources.some((x) => x.module === r.source.module && x.title === r.source.title && x.role === r.source.role)) {
      cur.sources.push(r.source);
    }
  }
  return [...byKey.values()];
}

/**
 * Hits for what is typed in a name box: every word of the query must be in the name (any order, spelling-normalised);
 * names that START with the query first, then the ones seen in more places, then the newest. At most `limit`.
 */
export function rankPeople(hits: PersonHit[], query: string, limit = 5): PersonHit[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const words = q.split(' ').filter(Boolean);
  const scored: { h: PersonHit; score: number }[] = [];
  for (const h of hits) {
    const n = norm(h.name);
    if (!words.every((w) => n.includes(w))) continue;
    if (n === q) continue; // already typed in full — nothing to suggest… unless more is known (below)
    const score = (n.startsWith(q) ? 1000 : 0) + h.sources.length * 10 + Math.min(9, (h.father ? 3 : 0) + (h.village || h.address ? 3 : 0) + (h.mobile ? 3 : 0));
    scored.push({ h, score });
  }
  // A name typed in full still shows its card when that person has more details to fill
  for (const h of hits) {
    if (norm(h.name) === q && (h.father || h.village || h.address || h.mobile)) scored.push({ h, score: 2000 + h.sources.length });
  }
  scored.sort((a, b) => b.score - a.score || (b.h.sources[0]?.at ?? 0) - (a.h.sources[0]?.at ?? 0));
  return scored.slice(0, limit).map((x) => x.h);
}

/** Chip text for a source: "📁 मुकदमा 120/26 · वादी". */
export function sourceChip(src: PeopleSource): string {
  return `${MODULE_ICON[src.module]} ${src.title}${src.role ? ` · ${src.role}` : ''}`;
}

/** One-line details under the name: "पुत्र श्यामलाल · 45 वर्ष". */
export function hitSubline(h: PersonHit): string {
  const rel = h.relation || (h.father ? (h.gender === 'महिला' ? 'पुत्री' : 'पुत्र') : '');
  return [h.father ? `${rel} ${h.father}`.trim() : '', h.age ? `${h.age.replace(/\s*वर्ष$/, '')} वर्ष` : ''].filter(Boolean).join(' · ');
}

/** "ग्राम अघौरा, थाना बछरावां" or the stored address. */
export function hitPlace(h: PersonHit): string {
  if (h.village || h.thana) return [h.village ? `ग्राम ${h.village}` : '', h.thana ? `थाना ${h.thana}` : ''].filter(Boolean).join(', ');
  return h.address;
}

/** People found inside a saved form (values_json): every person card / item row with a name. */
export function peopleInValues(valuesJson: string | null | undefined): Omit<RawPerson, 'source'>[] {
  let vals: Record<string, unknown>;
  try { vals = JSON.parse(valuesJson || '{}') as Record<string, unknown>; } catch { return []; }
  const out: Omit<RawPerson, 'source'>[] = [];
  for (const v of Object.values(vals)) {
    if (typeof v !== 'string' || !v.trim().startsWith('[')) continue;
    let arr: unknown;
    try { arr = JSON.parse(v); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    for (const c of arr) {
      if (!c || typeof c !== 'object') continue;
      const o = c as Record<string, unknown>;
      if (!s(o.name)) continue;
      out.push({
        name: s(o.name), father: s(o.fatherOrHusbandName ?? o.father), relation: s(o.relationType ?? o.rel ?? o.relation),
        gender: s(o.gender), age: s(o.age), mobile: s(o.mobile), address: s(o.fullAddress ?? o.address ?? o.addr),
        house: s(o.house), village: s(o.village), thana: s(o.thana), district: s(o.district),
      });
    }
  }
  return out;
}

/** The card fields a hit fills (PersonGroupInput card shape). A value the hit does not know keeps the card's own. */
export interface CardFill {
  name: string; fatherOrHusbandName: string; relationType: string; gender: string; age: string; mobile: string;
  addrMode: 'parts' | 'free'; fullAddress: string; house: string; village: string; villageKind: string; thana: string; district: string;
}
export function applyHitToCard<T extends Partial<CardFill>>(card: T, h: PersonHit): T {
  const keep = (v: string, old: unknown) => (v ? v : String(old ?? ''));
  const out: Record<string, unknown> = { ...card, name: h.name };
  out.fatherOrHusbandName = keep(h.father, card.fatherOrHusbandName);
  if (h.relation) {
    out.relationType = h.relation;
    const g = genderOfRelation(h.relation);
    if (g) out.gender = g;
  } else if (h.gender) out.gender = h.gender;
  out.age = keep(h.age.replace(/\s*वर्ष$/, ''), card.age);
  out.mobile = keep(h.mobile, card.mobile);
  if (h.village || h.house) {
    const a = partsFromColumns({ full_address: h.house, village: h.village, police_station: h.thana || String(card.thana ?? ''), district: h.district || String(card.district ?? '') });
    Object.assign(out, a);
  } else if (h.address) {
    Object.assign(out, { addrMode: 'free', fullAddress: h.address, house: '', village: '' });
  }
  if (out.addrMode === 'parts') out.fullAddress = composeAddress(out as never);
  return out as T;
}

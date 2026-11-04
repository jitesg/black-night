/**
 * FIR "master data" → format field values (owner: whatever is in the FIR fills every format).
 * Used by contextDefaultResolver for "@FIR.<field>" defaults; pure so it can be tested
 * (scripts/test_fir_fill.ts).  A default may carry a fallback: "@FIR.complainant_relation|पुत्री".
 */
export interface FirLike {
  fir_number?: string | null;
  section?: string | null;
  ghatnasthal?: string | null;
  date_of_occurrence?: string | null;
  time_of_occurrence?: string | null;
  date_of_information?: string | null;
  time_of_information?: string | null;
  complainant_name?: string | null;
  complainant_father?: string | null;
  complainant_relation?: string | null;
  complainant_gender?: string | null;
  complainant_age?: string | null;
  complainant_jati?: string | null;
  complainant_mobile?: string | null;
  complainant_address?: string | null;
}
export interface AccusedLike {
  is_known?: number | null;
  name?: string | null;
  address?: string | null;
  mobile?: string | null;
  age?: string | null;
  father?: string | null;
  relation?: string | null;
  gender?: string | null;
  deleted_at?: number | null;
}

const t = (v: unknown) => (v == null ? '' : String(v).trim());
const tenDigits = (m: string) => {
  const d = m.replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
};
/** "2025-07-01" → "01.07.2025"; anything else as is. */
export function hiDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : v;
}

function full(f: FirLike): string {
  const name = t(f.complainant_name);
  if (!name) return '';
  const father = t(f.complainant_father);
  const rel = t(f.complainant_relation) || 'पुत्र';
  const addr = t(f.complainant_address);
  const age = t(f.complainant_age);
  return [name, father ? `${rel} ${father}` : '', addr ? `निवासी ${addr}` : '', age ? `उम्र ${age} वर्ष` : '']
    .filter(Boolean).join(' ');
}

const knownAccused = (list: AccusedLike[]) => list.filter((a) => !a.deleted_at && a.is_known !== 0 && t(a.name));
/** One FIR अभियुक्त as text: "बबलू पुत्र रामलाल निवासी … उम्र करीब 25 वर्ष" (no पिता → no "पुत्र"). */
export function accusedFull(a: AccusedLike, ageWord = 'उम्र करीब'): string {
  const father = t(a.father);
  const addr = t(a.address);
  const age = t(a.age);
  return [t(a.name), father ? `${t(a.relation) || 'पुत्र'} ${father}` : '', addr ? `निवासी ${addr}` : '', age ? `${ageWord} ${age} वर्ष` : '']
    .filter(Boolean).join(' ');
}
const isWoman = (a: AccusedLike) => t(a.gender) === 'महिला' || t(a.relation) === 'पत्नी' || t(a.relation) === 'पुत्री';
/** "बबलू", "बबलू व नीरज", "बबलू, नीरज व राजू" */
function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} व ${names[names.length - 1]}`;
}
/** Person / accused card JSON (PersonGroupInput / AccusedGroupInput) from the FIR अभियुक्त. */
function accusedCards(list: AccusedLike[], withStatus: boolean): string {
  const rows = knownAccused(list).map((a, i) => ({
    _id: `fir_acc_${i}`, name: t(a.name), relationType: t(a.relation) || 'पुत्र', fatherOrHusbandName: t(a.father),
    fullAddress: t(a.address), age: t(a.age), mobile: tenDigits(t(a.mobile)), caste: '', gender: isWoman(a) ? 'महिला' : 'पुरुष', email: '',
    ...(withStatus ? { caughtBy: '', status: 'नामजद' } : {}),
  }));
  return rows.length ? JSON.stringify(rows) : '';
}

/** Value for "@FIR.<field>", or null when the field is unknown. */
export function firFillValue(field: string, f: FirLike | null, accused: AccusedLike[] = []): string | null {
  const fir = f ?? {};
  const woman = t(fir.complainant_gender) === 'महिला';
  const has = !!t(fir.complainant_name);
  switch (field) {
    case 'fir_number': return t(fir.fir_number);
    case 'section': return t(fir.section);
    case 'ghatnasthal': return t(fir.ghatnasthal);
    case 'fir_date': return hiDate(t(fir.date_of_information));
    case 'occurrence_date': return hiDate(t(fir.date_of_occurrence));
    case 'complainant_name': return t(fir.complainant_name);
    case 'complainant_father': return t(fir.complainant_father);
    case 'complainant_relation': return t(fir.complainant_relation);
    case 'complainant_gender': return t(fir.complainant_gender);
    case 'complainant_age': return t(fir.complainant_age);
    case 'complainant_age_years': return t(fir.complainant_age) ? `${t(fir.complainant_age)} वर्ष` : '';
    case 'complainant_jati': return t(fir.complainant_jati);
    case 'complainant_mobile': return tenDigits(t(fir.complainant_mobile));
    case 'complainant_address': return t(fir.complainant_address);
    case 'complainant_full': return full(fir);
    case 'complainant_vadi': return has ? (woman ? 'वादिनी' : 'वादी') : '';
    case 'complainant_peedit': return has ? (woman ? 'पीड़िता' : 'पीड़ित') : '';
    case 'complainant_majroob_vadi': return has ? (woman ? 'मजरूबा/वादिनी' : 'मजरूब/वादी') : '';
    case 'complainant_mahila': return woman ? 'हाँ' : '';
    case 'complainant_doctor_row':
      return has ? JSON.stringify([{ role: woman ? 'मजरूबा' : 'मजरूब', name: full(fir), bharti: '', from: '', to: '', inj: '' }]) : '';
    case 'fir_datetime': {
      const d = hiDate(t(fir.date_of_information));
      const tm = t(fir.time_of_information);
      return d && tm ? `${d} समय ${tm} बजे` : d;
    }
    case 'occurrence_datetime': {
      const d = hiDate(t(fir.date_of_occurrence));
      const tm = t(fir.time_of_occurrence);
      return d && tm ? `${d} समय करीब ${tm} बजे` : d;
    }
    case 'complainant_with_role': {
      // "वादिनी रेनू पत्नी धीरज"
      if (!has) return '';
      const father = t(fir.complainant_father);
      return [woman ? 'वादिनी' : 'वादी', t(fir.complainant_name), father ? `${t(fir.complainant_relation) || 'पुत्र'} ${father}` : ''].filter(Boolean).join(' ');
    }
    case 'accused1_name': case 'accused1_father': case 'accused1_relation': case 'accused1_gender': case 'accused1_address':
    case 'accused1_age': case 'accused1_mobile': case 'accused1_full': case 'accused1_abhiyukt': case 'accused1_mahila': {
      const a = knownAccused(accused)[0];
      if (!a) return '';
      switch (field) {
        case 'accused1_name': return t(a.name);
        case 'accused1_father': return t(a.father);
        case 'accused1_relation': return t(a.relation) || (t(a.father) ? 'पुत्र' : '');
        case 'accused1_gender': return isWoman(a) ? 'महिला' : 'पुरुष';
        case 'accused1_address': return t(a.address);
        case 'accused1_age': return t(a.age);
        case 'accused1_mobile': return tenDigits(t(a.mobile));
        case 'accused1_full': return accusedFull(a);
        case 'accused1_abhiyukt': return isWoman(a) ? 'अभियुक्ता' : 'अभियुक्त';
        default: return isWoman(a) ? 'हाँ' : '';
      }
    }
    case 'accused_names': return joinNames(knownAccused(accused).map((a) => t(a.name)));
    case 'accused_count': { const n = knownAccused(accused).length; return n ? String(n).padStart(2, '0') : ''; }
    case 'accused_co_count': { const n = knownAccused(accused).length; return n > 1 ? String(n - 1).padStart(2, '0') : ''; }
    case 'accused_abhiyukt': {
      const k = knownAccused(accused);
      if (!k.length) return '';
      return k.length > 1 ? 'अभियुक्तगण' : isWoman(k[0]) ? 'अभियुक्ता' : 'अभियुक्त';
    }
    case 'accused_number': { const n = knownAccused(accused).length; return n ? (n > 1 ? 'अभियुक्तगण' : 'अभियुक्त') : ''; }
    case 'accused_cards': return accusedCards(accused, false);
    case 'accused_group': return accusedCards(accused, true);
    case 'accused_rows': {
      const rows = knownAccused(accused).map((a) => ({
        name: t(a.name), rel: t(a.relation) || 'पुत्र', father: t(a.father), addr: t(a.address), mobile: tenDigits(t(a.mobile)),
        age: t(a.age), mahila: isWoman(a) ? 'हाँ' : '', own: '',
      }));
      return rows.length ? JSON.stringify(rows) : '';
    }
    default: return null;
  }
}

/** True for "@PREFIX.field…" / legacy "__FROM_*__" defaults (resolved from the FIR, not used literally). */
export function isMarkerDefault(dv: string | null | undefined): boolean {
  return !!dv && (dv.startsWith('@') || (dv.startsWith('__FROM_') && dv.endsWith('__')));
}
/** Literal default for a screen without FIR context: a marker gives its "|fallback" part (or ''). */
export function literalDefault(dv: string | null | undefined): string {
  if (!dv) return '';
  if (!isMarkerDefault(dv)) return dv;
  const bar = dv.indexOf('|');
  return bar === -1 ? '' : dv.slice(bar + 1);
}

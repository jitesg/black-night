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
  date_of_information?: string | null;
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
function firstAccused(list: AccusedLike[]): { name: string; mobile: string } | null {
  const a = knownAccused(list)[0];
  return a ? { name: t(a.name), mobile: t(a.mobile) } : null;
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
    case 'accused1_name': return firstAccused(accused)?.name ?? '';
    case 'accused1_mobile': return tenDigits(t(firstAccused(accused)?.mobile));
    case 'accused_rows': {
      const rows = knownAccused(accused).map((a) => ({ name: t(a.name), rel: 'पुत्र', father: '', addr: t(a.address), mobile: tenDigits(t(a.mobile)), age: t(a.age), mahila: '', own: '' }));
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

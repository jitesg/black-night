/**
 * FIR वादी (one person) ↔ person-card value (PersonGroupInput JSON, one entry).
 * The FIR keeps flat columns (complainant_*); the card shows them as one person.
 * Pure — tests: scripts/test_fir_complainant.ts
 */
export interface ComplainantFields {
  complainant_name: string;
  complainant_father: string;
  complainant_relation: string;
  complainant_gender: string;
  complainant_age: string;
  complainant_jati: string;
  complainant_mobile: string;
  complainant_address: string;
}

type Src = Partial<Record<keyof ComplainantFields, string | null | undefined>>;
const s = (v: unknown) => (v == null ? '' : String(v));
/** "+919876543210" / "+9876543210" (old FIR box) → "9876543210" for the card. */
function tenDigits(m: string): string {
  const d = m.replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
}

/** FIR row → card value (JSON array with one person). */
export function complainantToGroup(f: Src): string {
  return JSON.stringify([{
    _id: 'vadi_0',
    name: s(f.complainant_name),
    relationType: s(f.complainant_relation),
    fatherOrHusbandName: s(f.complainant_father),
    gender: s(f.complainant_gender),
    age: s(f.complainant_age),
    caste: s(f.complainant_jati),
    mobile: tenDigits(s(f.complainant_mobile)),
    fullAddress: s(f.complainant_address),
    email: '',
  }]);
}

/** Card value → FIR columns (first person only). */
export function groupToComplainant(json: string): ComplainantFields {
  let e: Record<string, unknown> = {};
  try {
    const arr = JSON.parse(json || '[]');
    if (Array.isArray(arr) && arr[0] && typeof arr[0] === 'object') e = arr[0] as Record<string, unknown>;
  } catch { /* empty */ }
  return {
    complainant_name: s(e.name).trim(),
    complainant_father: s(e.fatherOrHusbandName).trim(),
    complainant_relation: s(e.relationType).trim(),
    complainant_gender: s(e.gender).trim(),
    complainant_age: s(e.age).trim(),
    complainant_jati: s(e.caste).trim(),
    complainant_mobile: s(e.mobile).trim(),
    complainant_address: s(e.fullAddress).trim(),
  };
}

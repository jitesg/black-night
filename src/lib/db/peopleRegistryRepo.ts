/**
 * व्यक्ति रजिस्टर — data side (owner, "पूरे app से सुझाव"). Reads people from every module at search time (no extra table,
 * so it never goes stale): मुकदमा वादी + अभियुक्त, प्रार्थना पत्र आवेदक + विपक्षी, न्यायालय persons, निरोधात्मक + हाल के कार्य
 * (person cards inside saved form values), हल्का persons. Rules (merge / rank) in src/lib/peopleRegistry.ts. On the phone only.
 */
import { getDatabase } from './database';
import { sqlWordFilter } from '../searchUtils';
import { mergePeople, peopleInValues, rankPeople, type PeopleSource, type PersonHit, type RawPerson } from '../peopleRegistry';

const PER_SOURCE = 25;

/** "2026-11-17" → "17/11/2026" (other text unchanged). */
const dmy = (v: unknown) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v ?? '');
};

/** Each source in its own try — one missing column / table never hides the rest. */
async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try { return await fn(); } catch { return []; }
}

/**
 * People whose name matches what is typed (every word, any order), merged into one hit per person and ranked.
 * At most `limit` (default 5). Empty for less than 2 letters.
 */
export async function searchPeople(query: string, limit = 5): Promise<PersonHit[]> {
  const q = query.trim();
  if (q.replace(/\s/g, '').length < 2) return [];
  const db = await getDatabase();
  const raw: RawPerson[] = [];
  const where = (col: string) => sqlWordFilter([col], q);

  // 📁 मुकदमा — वादी
  const fw = where('f.complainant_name');
  raw.push(...(await safe(() => db.getAllAsync<Record<string, string | number>>(
    `SELECT f.fir_number, f.complainant_name, f.complainant_father, f.complainant_relation, f.complainant_gender, f.complainant_age,
            f.complainant_mobile, f.complainant_address, f.date_of_information, f.updated_at
       FROM firs f WHERE f.deleted_at IS NULL AND ${fw.sql} ORDER BY f.updated_at DESC LIMIT ${PER_SOURCE}`, fw.params,
  ))).map((r) => ({
    name: String(r.complainant_name ?? ''), father: String(r.complainant_father ?? ''), relation: String(r.complainant_relation ?? ''),
    gender: String(r.complainant_gender ?? ''), age: String(r.complainant_age ?? ''), mobile: String(r.complainant_mobile ?? ''),
    address: String(r.complainant_address ?? ''),
    source: { module: 'fir', title: `मुकदमा ${r.fir_number ?? ''}`.trim(), role: 'वादी', date: dmy(r.date_of_information), at: Number(r.updated_at) || 0 } as PeopleSource,
  })));

  // 📁 मुकदमा — अभियुक्त
  const aw = where('a.name');
  raw.push(...(await safe(() => db.getAllAsync<Record<string, string | number>>(
    `SELECT a.name, a.father, a.relation, a.gender, a.age, a.mobile, a.address, a.updated_at, f.fir_number
       FROM fir_accused a JOIN firs f ON f.id = a.fir_id
      WHERE a.deleted_at IS NULL AND f.deleted_at IS NULL AND ${aw.sql} ORDER BY a.updated_at DESC LIMIT ${PER_SOURCE}`, aw.params,
  ))).map((r) => ({
    name: String(r.name ?? ''), father: String(r.father ?? ''), relation: String(r.relation ?? ''), gender: String(r.gender ?? ''),
    age: String(r.age ?? ''), mobile: String(r.mobile ?? ''), address: String(r.address ?? ''),
    source: { module: 'fir', title: `मुकदमा ${r.fir_number ?? ''}`.trim(), role: 'अभियुक्त', date: '', at: Number(r.updated_at) || 0 } as PeopleSource,
  })));

  // 📨 प्रार्थना पत्र — आवेदक / विपक्षी
  for (const [table, fatherCol, role] of [
    ['prarthna_patra_complainants', 'father_husband_name', 'आवेदक'],
    ['prarthna_patra_accused', 'father_name', 'विपक्षी'],
  ] as const) {
    const pw = where('c.name');
    raw.push(...(await safe(() => db.getAllAsync<Record<string, string | number>>(
      `SELECT c.name, c.${fatherCol} AS father, c.relation, c.gender, c.age, c.mobile, c.full_address, c.village, c.police_station,
              c.district, c.updated_at, p.petition_type, p.date_of_receipt
         FROM ${table} c JOIN prarthna_patra p ON p.id = c.prarthna_patra_id
        WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL AND ${pw.sql} ORDER BY c.updated_at DESC LIMIT ${PER_SOURCE}`, pw.params,
    ))).map((r) => ({
      name: String(r.name ?? ''), father: String(r.father ?? ''), relation: String(r.relation ?? ''), gender: String(r.gender ?? ''),
      age: String(r.age ?? ''), mobile: String(r.mobile ?? ''), house: String(r.full_address ?? ''), village: String(r.village ?? ''),
      thana: String(r.police_station ?? ''), district: String(r.district ?? ''),
      address: [r.full_address, r.village ? `ग्राम ${r.village}` : '', r.police_station ? `थाना ${r.police_station}` : '', r.district ? `जनपद ${r.district}` : '']
        .map((x) => String(x ?? '').trim()).filter(Boolean).join(' '),
      source: { module: 'pp', title: `प्रार्थना पत्र ${r.petition_type ?? ''}`.trim(), role, date: dmy(r.date_of_receipt), at: Number(r.updated_at) || 0 } as PeopleSource,
    })));
  }

  // ⚖️ न्यायालय
  const nw = where('n.name');
  raw.push(...(await safe(() => db.getAllAsync<Record<string, string | number>>(
    `SELECT n.name, n.father_name, n.mobile, n.address, n.person_type, n.updated_at, d.vad_sankhya, d.fir_number, d.court_name
       FROM nyayalay_persons n JOIN nyayalay_documents d ON d.id = n.doc_id
      WHERE n.deleted_at IS NULL AND d.deleted_at IS NULL AND ${nw.sql} ORDER BY n.updated_at DESC LIMIT ${PER_SOURCE}`, nw.params,
  ))).map((r) => ({
    name: String(r.name ?? ''), father: String(r.father_name ?? ''), mobile: String(r.mobile ?? ''), address: String(r.address ?? ''),
    source: {
      module: 'court', title: r.vad_sankhya ? `वाद ${r.vad_sankhya}` : r.fir_number ? `मु0अ0सं0 ${r.fir_number}` : String(r.court_name || 'न्यायालय'),
      role: r.person_type === 'accused' ? 'अभियुक्त' : '', date: '', at: Number(r.updated_at) || 0,
    } as PeopleSource,
  })));

  // 🏘 हल्का (गाँव के लोग)
  const hw = where('p.name');
  raw.push(...(await safe(() => db.getAllAsync<Record<string, string | number>>(
    `SELECT p.name, p.address, p.mobile, p.designation, p.updated_at, g.name AS gp_name
       FROM persons p LEFT JOIN gram_panchayats g ON g.id = p.gp_id
      WHERE p.deleted_at IS NULL AND ${hw.sql} ORDER BY p.updated_at DESC LIMIT ${PER_SOURCE}`, hw.params,
  ))).map((r) => ({
    name: String(r.name ?? ''), mobile: String(r.mobile ?? ''), address: String(r.address ?? ''),
    source: { module: 'halka', title: r.gp_name ? `हल्का ${r.gp_name}` : 'हल्का', role: String(r.designation ?? ''), date: '', at: Number(r.updated_at) || 0 } as PeopleSource,
  })));

  // 🛡 निरोधात्मक + 📝 हाल के कार्य — person cards inside the saved form values (LIKE on the JSON, then the cards are read)
  const vw = where('values_json');
  for (const [table, module, titleCol] of [
    ['nirodhatmak_karyvahi', 'nk', 'format_title'],
    ['report_records', 'recent', 'format_title'],
  ] as const) {
    const rows = await safe(() => db.getAllAsync<Record<string, string | number>>(
      `SELECT values_json, ${titleCol} AS title, updated_at FROM ${table}
        WHERE deleted_at IS NULL AND values_json IS NOT NULL AND ${vw.sql} ORDER BY updated_at DESC LIMIT ${PER_SOURCE}`, vw.params,
    ));
    for (const r of rows) {
      for (const p of peopleInValues(String(r.values_json ?? ''))) {
        raw.push({ ...p, source: { module, title: String(r.title ?? '').slice(0, 40), role: '', date: '', at: Number(r.updated_at) || 0 } });
      }
    }
  }

  return rankPeople(mergePeople(raw), q, limit);
}

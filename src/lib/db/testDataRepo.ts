/**
 * 🧪 टेस्ट डेटा (owner): one tap fills every module with made-up entries for testing on the phone; one tap removes exactly
 * those entries again. Rows are created through the normal repos (so alerts, playbook cards, search … behave as for real
 * data); their ids are kept in app_settings 'test_data_ids' and only those ids are deleted by `removeTestData`.
 * Never touches real data or the कार्यालय sync. All names are fictional. Used by Developer options → Test Utilities.
 */
import { getDatabase } from './database';
import { createFIR, deleteFIR } from './firRepo';
import { createAccused } from './firAccusedRepo';
import { seedFIRKaryvahi } from './firKaryvahiRepo';
import { addEntry, createCaseDiary, deleteCaseDiary } from './caseDiaryRepo';
import { createPrarthnaPatra, deletePrarthnaPatra, saveReport, type PetitionType } from './prarthnaPatraRepo';
import { createNyayalayDocument, deleteNyayalayDocument, markNyayalayFinished, type DocType } from './nyayalayRepo';
import { createNirodhatmakKaryvahi, deleteNirodhatmakKaryvahi, setKaryvahiChecklist, type NirodhatmakType } from './nirodhatmakRepo';
import { createGramPanchayat, deleteGramPanchayat } from './gramPanchayatRepo';
import { createHamlet, deleteHamlet } from './hamletRepo';
import { createPerson, deletePerson } from './personRepo';
import { createGdEntry, deleteGdEntry, type GdType } from './gdRepo';
import { getReminderById } from './reminderRepo';

const KEY = 'test_data_ids';

export interface TestDataIds {
  fir: string[]; diary: string[]; pp: string[]; court: string[]; nk: string[];
  gp: string[]; hamlet: string[]; person: string[]; gd: string[]; reminder: string[];
}
const EMPTY: TestDataIds = { fir: [], diary: [], pp: [], court: [], nk: [], gp: [], hamlet: [], person: [], gd: [], reminder: [] };

export async function getTestDataIds(): Promise<TestDataIds | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM app_settings WHERE key = ?`, [KEY]);
  if (!row?.value) return null;
  try { return { ...EMPTY, ...(JSON.parse(row.value) as Partial<TestDataIds>) }; } catch { return null; }
}

async function saveIds(ids: TestDataIds | null): Promise<void> {
  const db = await getDatabase();
  if (!ids) await db.runAsync(`DELETE FROM app_settings WHERE key = ?`, [KEY]);
  else await db.runAsync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`, [KEY, JSON.stringify(ids)]);
}

export function countTestData(ids: TestDataIds | null): number {
  return ids ? Object.values(ids).reduce((n, a) => n + a.length, 0) : 0;
}

// ── dates (today ± n days, YYYY-MM-DD) ──────────────────────────────────────────────────────────────
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const year = new Date().getFullYear();

/** A made-up person card (PersonGroupInput JSON shape) — for निरोधात्मक values. */
const card = (name: string, rel: string, father: string, village: string, thana: string, district: string, mobile = '') => ({
  name, relationType: rel, fatherOrHusbandName: father, gender: rel === 'पुत्र' ? 'पुरुष' : 'महिला', age: '', mobile, caste: '', email: '',
  addrMode: 'parts', house: '', village, villageKind: 'ग्राम', thana, district,
  fullAddress: `ग्राम ${village} थाना ${thana} जनपद ${district}`,
});

export interface FillResult { ids: TestDataIds; counts: Record<keyof TestDataIds, number>; ms: number }

/**
 * Fills every module. `thana` / `district` = the officer's settings (fallbacks if empty). Refuses when test data is
 * already there (one set at a time).
 */
export async function fillTestData(opts: { thana: string; district: string; officer: string }): Promise<FillResult> {
  if (countTestData(await getTestDataIds())) throw new Error('टेस्ट डेटा पहले से भरा है — पहले "हटाएँ" दबाएँ।');
  const t0 = Date.now();
  const thana = opts.thana.trim() || 'बछरावां';
  const district = opts.district.trim() || 'रायबरेली';
  const officer = opts.officer.trim() || 'राजेश कुमार';
  const ids: TestDataIds = { fir: [], diary: [], pp: [], court: [], nk: [], gp: [], hamlet: [], person: [], gd: [], reminder: [] };
  const addr = (v: string) => `ग्राम ${v} थाना ${thana} जनपद ${district}`;
  // keep the list as it grows, so a failure half-way can still be removed
  const keep = () => saveIds(ids);

  // ── 🏘 हल्का: 2 ग्राम पंचायत, a मजरा each, 3 people each ──────────────────────────────────────────
  for (const [gpName, hamlet, people] of [
    ['अघौरा', 'पूरे लाला', [['रामवती', 'important', '9876500011'], ['श्यामलाल', 'current_pradhan', '9876500012'], ['कल्लू', 'history_sheeter', '']]],
    ['मुरैनी', 'नयापुरवा', [['मोहन लाल', 'current_pradhan', '9876500021'], ['सुरेश यादव', 'bdc', ''], ['गुड्डू', 'history_sheeter', '']]],
  ] as const) {
    const gp = await createGramPanchayat({ name: gpName, tehsil: 'महराजगंज', police_station: thana, district, state: 'उत्तर प्रदेश', remarks: 'टेस्ट डेटा' });
    ids.gp.push(gp.id);
    const h = await createHamlet({ gp_id: gp.id, name: hamlet, population: 450 });
    ids.hamlet.push(h.id);
    for (const [name, type, mobile] of people) {
      const p = await createPerson({ gp_id: gp.id, person_type: type, name, address: addr(gpName), mobile, remarks: 'टेस्ट डेटा' });
      ids.person.push(p.id);
    }
  }
  await keep();

  // ── 📁 मुकदमा: 6 FIRs (वादी + अभियुक्त), playbook cards, 4 केस डायरी पर्चे ────────────────────────────
  const firs = [
    { no: `120/${year}`, sec: '115(2), 352, 351(3) BNS', crime: 'hurt_grievous_hurt', days: -2, c: ['रामपाल', 'पुत्र', 'श्यामलाल', 'अघौरा', '45', '9876500001'],
      acc: [['राम सिंह', 'पुत्र', 'मोहन', 'मुरैनी', '32'], ['गुड्डू', 'पुत्र', 'कल्लू', 'मुरैनी', '28']], place: 'ग्राम अघौरा में खेत के पास',
      saransh: 'वादी रामपाल के खेत की मेड़ को लेकर विवाद में अभियुक्तगण द्वारा मारपीट कर चोट पहुँचाई गई।' },
    { no: `88/${year}`, sec: '303(2), 317(2) BNS', crime: 'theft', days: -12, c: ['सुनीता देवी', 'पत्नी', 'राजकुमार', 'मुरैनी', '38', '9876500002'],
      acc: [['अज्ञात', '', '', '', '']], place: 'वादिनी का मकान', saransh: 'वादिनी के घर से रात्रि में जेवरात व नकदी चोरी।' },
    { no: `145/${year}`, sec: '281, 106(1) BNS', crime: 'road_accident', days: -20, c: ['विनोद कुमार', 'पुत्र', 'रामचन्द्र', 'अघौरा', '50', '9876500003'],
      acc: [['सलीम', 'पुत्र', 'रहमान', 'नयापुरवा', '35']], place: 'लखनऊ–रायबरेली मार्ग, अघौरा मोड़', saransh: 'तेज़ रफ़्तार ट्रक से बाइक सवार की मृत्यु।' },
    { no: `56/${year}`, sec: '85, 115(2) BNS व 3/4 DP Act', crime: 'cruelty_husband_relatives', days: -35, c: ['पूजा', 'पुत्री', 'हरिश्चन्द्र', 'मुरैनी', '24', '9876500004'],
      acc: [['अनिल', 'पुत्र', 'शिवनारायण', 'अघौरा', '29'], ['शिवनारायण', 'पुत्र', 'बाबूलाल', 'अघौरा', '58']], place: 'ससुराल ग्राम अघौरा', saransh: 'दहेज की माँग को लेकर वादिनी के साथ मारपीट।' },
    { no: `77/${year}`, sec: '8/20 NDPS Act', crime: 'ndps', days: -5, c: ['उ0नि0 ' + officer, 'पुत्र', '', '', '', ''],
      acc: [['सुरेश यादव', 'पुत्र', 'रामभरोसे', 'मुरैनी', '40']], place: 'मुरैनी नहर पुलिया', saransh: 'अभियुक्त के कब्जे से 1.200 किलो गांजा बरामद।' },
    { no: `201/${year}`, sec: '318(4), 319(2) BNS व 66D IT Act', crime: 'cyber_crime', days: -8, c: ['रामपाल', 'पुत्र', 'श्यामलाल', 'अघौरा', '45', '9876500001'],
      acc: [['अज्ञात', '', '', '', '']], place: 'ऑनलाइन', saransh: 'फ़ोन पर बैंक अधिकारी बनकर ₹45,000 की धोखाधड़ी।' },
  ];
  for (const f of firs) {
    const [cn, crel, cf, cv, cage, cmob] = f.c;
    const fir = await createFIR({
      fir_number: f.no, section: f.sec, complainant_name: cn, complainant_relation: crel, complainant_father: cf,
      complainant_gender: crel === 'पुत्र' ? 'पुरुष' : crel ? 'महिला' : '', complainant_age: cage, complainant_mobile: cmob,
      complainant_address: cv ? addr(cv) : `थाना ${thana} जनपद ${district}`, ghatnasthal: f.place, crime_type: f.crime,
      date_of_occurrence: day(f.days - 1), time_of_occurrence: '21:30', date_of_information: day(f.days), time_of_information: '10:15',
      roaam_no: String(10 + firs.indexOf(f)), roaam_time: '10:15', mukadma_saransh: f.saransh,
      unknown_accused_count: f.acc.some((a) => a[0] === 'अज्ञात') ? 1 : 0,
    });
    ids.fir.push(fir.id);
    for (const [an, arel, af, av, aage] of f.acc) {
      if (an === 'अज्ञात') continue;
      await createAccused({
        fir_id: fir.id, is_known: 1, name: an, relation: arel, father: af, gender: arel === 'पुत्र' ? 'पुरुष' : 'महिला',
        address: av ? addr(av) : '', age: aage, bail_status: 'unknown',
      });
    }
    await seedFIRKaryvahi(fir.id, f.crime).catch(() => {});
    await keep();
  }
  // केस डायरी: 120 → पर्चा 01 + 02, 88 → पर्चा 01 + 02
  for (const [fi, diaries] of [[0, [-2, -1]], [1, [-12, -6]]] as const) {
    for (const [k, dd] of diaries.entries()) {
      const d = await createCaseDiary({ fir_id: ids.fir[fi], preparation_date: day(dd), start_time: '11:00', end_time: '16:30', places_visited: k ? 'घटनास्थल' : 'थाना कार्यालय' });
      ids.diary.push(d.id);
      await addEntry({ case_diary_id: d.id, entry_type: 'narrative', sequence_order: 1, karyvahi_name: 'बयान वादी',
        narrative_text: `${k ? 'आज' : 'दिनांक को'} वादी मुकदमा से पूछताछ की गई, वादी ने अपनी तहरीर का समर्थन किया। (टेस्ट डेटा)` });
      await addEntry({ case_diary_id: d.id, entry_type: 'narrative', sequence_order: 2, karyvahi_name: k ? 'निरीक्षण घटना स्थल' : 'नकल चिक / रपट',
        narrative_text: k ? 'वादी की निशानदेही पर घटनास्थल का निरीक्षण कर नक्शा नजरी तैयार किया गया। (टेस्ट डेटा)' : 'नकल चिक व रपट का अवलोकन कर केस डायरी में अंकित किया गया। (टेस्ट डेटा)' });
    }
  }
  await keep();

  // ── 📨 प्रार्थना पत्र: 10 (हर प्रकार; लंबित / आज / समय निकला / निस्तारित) ───────────────────────────────
  const ppRow = (name: string, rel: string, father: string, village: string, mobile = '') => ({
    name, father_husband_name: father, relation: rel, mobile, alternate_mobile: '', full_address: '', village, police_station: thana,
    district, age: '', gender: rel === 'पुत्र' ? 'पुरुष' : 'महिला', jati: '', extra_json: '',
  });
  const ppAcc = (name: string, rel: string, father: string, village: string) => ({
    name, father_name: father, relation: rel, mobile: '', alternate_mobile: '', full_address: '', village, police_station: thana,
    district, jati: '', age: '', gender: rel === 'पुत्र' ? 'पुरुष' : 'महिला', remarks: '', extra_json: '',
  });
  const pps: [PetitionType, number, number, ReturnType<typeof ppRow>, ReturnType<typeof ppAcc> | null, string, boolean][] = [
    ['CO पेशी', -3, 7, ppRow('रामपाल', 'पुत्र', 'श्यामलाल', 'अघौरा', '9876500001'), ppAcc('राम सिंह', 'पुत्र', 'मोहन', 'मुरैनी'), 'खेत की मेड़ को लेकर विपक्षी द्वारा गाली-गलौज व धमकी।', false],
    ['RL', -12, -2, ppRow('सोनम', 'पुत्री', 'रामपाल', 'अघौरा'), ppAcc('अनिल', 'पुत्र', 'शिवनारायण', 'अघौरा'), 'रास्ता रोकने व अभद्रता के सम्बन्ध में।', false],
    ['जनता दर्शन', -10, 0, ppRow('कमला देवी', 'पत्नी', 'स्व0 रामदीन', 'मुरैनी'), ppAcc('गुड्डू', 'पुत्र', 'कल्लू', 'मुरैनी'), 'मकान पर कब्जे के सम्बन्ध में।', false],
    ['SDM', -6, 4, ppRow('हरिश्चन्द्र', 'पुत्र', 'बाबूलाल', 'मुरैनी'), null, 'नाली के पानी के विवाद में जांच हेतु।', false],
    ['DM', -15, -5, ppRow('मोहन लाल', 'पुत्र', 'जगदीश', 'मुरैनी', '9876500021'), ppAcc('सुरेश यादव', 'पुत्र', 'रामभरोसे', 'मुरैनी'), 'सरकारी भूमि पर अवैध निर्माण।', false],
    ['थाना प्रार्थना पत्र', -1, 9, ppRow('रामवती', 'पत्नी', 'राजू', 'अघौरा', '9876500011'), ppAcc('कल्लू', 'पुत्र', 'छोटे', 'अघौरा'), 'पड़ोसी द्वारा गाली-गलौज।', false],
    ['RTI', -20, 10, ppRow('विनोद कुमार', 'पुत्र', 'रामचन्द्र', 'अघौरा', '9876500003'), null, 'मुकदमा की प्रगति की सूचना माँगी गई।', false],
    ['NCR', -4, 6, ppRow('सुनीता देवी', 'पत्नी', 'राजकुमार', 'मुरैनी', '9876500002'), ppAcc('गुड्डू', 'पुत्र', 'कल्लू', 'मुरैनी'), 'मारपीट (NCR) — दोनों पक्षों में विवाद।', false],
    ['CO पेशी', -25, -15, ppRow('पूजा', 'पुत्री', 'हरिश्चन्द्र', 'मुरैनी', '9876500004'), ppAcc('अनिल', 'पुत्र', 'शिवनारायण', 'अघौरा'), 'दहेज उत्पीड़न की शिकायत।', true],
    ['अन्य', -30, -20, ppRow('श्यामलाल', 'पुत्र', 'रामनाथ', 'अघौरा', '9876500012'), null, 'चरित्र सत्यापन हेतु।', true],
  ];
  for (const [type, rec, dead, c, a, matter, done] of pps) {
    const pp = await createPrarthnaPatra({
      petition_type: type, date_of_receipt: day(rec), deadline_date: day(dead), matter: `<div>${matter} (टेस्ट डेटा)</div>`,
      investigator_name: `उ0नि0 ${officer}`, complainants: [c], accused: a ? [a] : [],
    });
    ids.pp.push(pp.id);
    if (done) await saveReport(pp.id, day(dead - 1), '<p>जांच में आवेदक / आवेदिका की शिकायत का निस्तारण आपसी सुलह से कर दिया गया। (टेस्ट डेटा)</p>');
  }
  await keep();

  // ── ⚖️ न्यायालय: 6 कागज़ ──────────────────────────────────────────────────────────────────────────────
  const courts: [DocType, string, string, string, string, number, [string, string, string][], boolean][] = [
    ['NBW', 'CJM रायबरेली', `412/${year % 100}`, firs[0].no, firs[0].sec, -1, [['राम सिंह', 'मोहन', addr('मुरैनी')]], false],
    ['Summons', 'ACJM द्वितीय रायबरेली', `88/${year % 100}`, firs[1].no, firs[1].sec, 2, [['गुड्डू', 'कल्लू', addr('मुरैनी')]], false],
    ['Bail_Lower_Court', 'सत्र न्यायालय रायबरेली', `1032/${year}`, firs[4].no, firs[4].sec, 5, [['सुरेश यादव', 'रामभरोसे', addr('मुरैनी')]], false],
    ['High_Court_Documents', 'मा0 उच्च न्यायालय लखनऊ खंडपीठ', `CRLP 5521/${year}`, firs[3].no, firs[3].sec, 8, [['अनिल', 'शिवनारायण', addr('अघौरा')]], false],
    ['Anya', 'JM प्रथम रायबरेली', `45/${year % 100}`, firs[2].no, firs[2].sec, 0, [['सलीम', 'रहमान', addr('नयापुरवा')]], false],
    ['Summons', 'CJM रायबरेली', `19/${year % 100}`, firs[1].no, firs[1].sec, -10, [['कल्लू', 'छोटे', addr('अघौरा')]], true],
  ];
  for (const [type, court, vad, no, sec, dead, persons, done] of courts) {
    const [num, yr] = no.split('/');
    const id = await createNyayalayDocument({
      doc_type: type, court_name: court, vad_sankhya: vad, apradh_sankhya: no, applicable_sections: sec, fir_number: num, fir_year: yr,
      fir_ps: thana, matter: 'टेस्ट डेटा', document_title: type === 'Anya' ? 'मुकदमा की केस डायरी तलब' : '', deadline_date: day(dead),
      persons: persons.map(([name, father, address]) => ({ person_type: 'accused', name, father_name: father, mobile: '', address, remarks: '' })),
    });
    ids.court.push(id);
    if (done) await markNyayalayFinished(id);
  }
  await keep();

  // ── 🛡 निरोधात्मक: 4 (126/135 वाली; 2 चलानी प्रेषित) ──────────────────────────────────────────────────
  const nks: [NirodhatmakType, string, string, number, ReturnType<typeof card>, ReturnType<typeof card>, boolean, string][] = [
    ['बीट सूचना', 'बीट सूचना 126/135 की कार्यवाही', 'अघौरा', -3, card('रामपाल', 'पुत्र', 'श्यामलाल', 'अघौरा', thana, district, '9876500001'), card('राम सिंह', 'पुत्र', 'मोहन', 'मुरैनी', thana, district), false, 'sys-fmt-bnss126-beat'],
    ['प्रार्थनापत्र', 'प्रार्थना पत्र जांच में 126/135 की कार्यवाही', 'मुरैनी', -9, card('कमला देवी', 'पत्नी', 'स्व0 रामदीन', 'मुरैनी', thana, district), card('गुड्डू', 'पुत्र', 'कल्लू', 'मुरैनी', thana, district), true, 'sys-fmt-bnss126-prarthna'],
    ['जमीनी विवाद', 'थाना क्षेत्र भ्रमण दौरान सूचना', 'अघौरा', -1, card('विनोद कुमार', 'पुत्र', 'रामचन्द्र', 'अघौरा', thana, district), card('अनिल', 'पुत्र', 'शिवनारायण', 'अघौरा', thana, district), false, 'sys-fmt-bnss126-thanabhraman'],
    ['मुकदमा', 'मुकदमा में 126/135 की कार्यवाही', 'मुरैनी', -16, card('सुनीता देवी', 'पत्नी', 'राजकुमार', 'मुरैनी', thana, district), card('सुरेश यादव', 'पुत्र', 'रामभरोसे', 'मुरैनी', thana, district), true, 'sys-fmt-bnss126-mukadma'],
  ];
  for (const [type, title, village, dd, p1, p2, sent, formatId] of nks) {
    const k = await createNirodhatmakKaryvahi({
      proceeding_date: day(dd), village_id: '', village_name: village, proceeding_type: type,
      editor_content: `<p>${title} — ग्राम ${village} में ${p1.name} व ${p2.name} के मध्य खेत की मेड़ को लेकर विवाद। (टेस्ट डेटा)</p>`,
      // the real 126/135 format (its card title comes from it)
      format_id: formatId, format_title: title, values_json: JSON.stringify({ FirstParty: JSON.stringify([p1]), secondparty: JSON.stringify([p2]), village, Matter: 'खेत की मेड़ को लेकर विवाद' }),
    });
    ids.nk.push(k.id);
    if (sent) await setKaryvahiChecklist(k.id, { prashit: true });
  }
  await keep();

  // ── 📒 GD: 5 ───────────────────────────────────────────────────────────────────────────────────────────
  const gds: [GdType, number, string][] = [
    ['रवानगी', 0, `इस समय मैं उ0नि0 ${officer} मय हमराह का0 राजेश के मुकदमा ${firs[0].no} की विवेचना हेतु ग्राम अघौरा रवाना हुआ। (टेस्ट डेटा)`],
    ['वापसी', 0, `इस समय मैं उ0नि0 ${officer} मय हमराह वापस थाना आया, विवेचना की कार्यवाही केस डायरी में अंकित की गई। (टेस्ट डेटा)`],
    ['तस्करा', -1, `तस्करा बावत 126/135 बीएनएसएस की कार्यवाही — ग्राम अघौरा में दोनों पक्षों का चालान। (टेस्ट डेटा)`],
    ['रवानगी', -3, `इस समय मैं उ0नि0 ${officer} क्षेत्र भ्रमण हेतु रवाना हुआ। (टेस्ट डेटा)`],
    ['अन्य', -6, 'थाना परिसर की साफ़-सफ़ाई का तस्करा। (टेस्ट डेटा)'],
  ];
  for (const [type, dd, text] of gds) {
    ids.gd.push(await createGdEntry({ preparation_date: day(dd), ta_da_flag: 0, gd_type: type, vivran_content: text }));
  }
  await keep();

  // ── ⏰ रिमाइंडर: आज, कल, बीता हुआ (through the reminder service → real alarms) ───────────────────────────
  const { saveReminder } = await import('@/lib/reminderService');
  const at = (dDays: number, h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dDays); d.setHours(h, m, 0, 0); return d.getTime(); };
  const later = new Date(); later.setHours(later.getHours() + 2, 0, 0, 0);
  for (const [title, due, cat] of [
    [`मुकदमा ${firs[0].no} — पर्चा 03 लिखना (टेस्ट)`, later.getTime(), 'case'],
    ['CJM न्यायालय में पेशी (टेस्ट)', at(1, 10, 30), 'peshi'],
    ['थाना मीटिंग (टेस्ट)', at(-1, 17), 'meeting'],
  ] as const) {
    ids.reminder.push(await saveReminder({
      title, note: 'टेस्ट डेटा', due_at: due, repeat_mode: 'once', repeat_days: [], sound: 'default', category: cat,
      priority: 'normal', fir_id: cat === 'case' ? ids.fir[0] : '', fir_label: cat === 'case' ? `मु0अ0सं0 ${firs[0].no}` : '', early_min: 0, nag_min: 0,
    }));
  }
  await keep();

  // the bell / phone alerts follow the new rows
  import('@/lib/appNotificationSync').then((m) => m.syncAppNotifications()).catch(() => {});
  const counts = Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, v.length])) as Record<keyof TestDataIds, number>;
  return { ids, counts, ms: Date.now() - t0 };
}

/** Removes exactly the rows `fillTestData` made (through the normal delete functions). Returns how many were removed. */
export async function removeTestData(): Promise<number> {
  const ids = await getTestDataIds();
  if (!ids) return 0;
  let n = 0;
  const run = async (list: string[], del: (id: string) => Promise<unknown>) => {
    for (const id of list) { try { await del(id); n++; } catch { /* already gone */ } }
  };
  const { removeReminder } = await import('@/lib/reminderService');
  await run(ids.reminder, async (id) => { const r = await getReminderById(id); if (r) await removeReminder(r); });
  await run(ids.diary, deleteCaseDiary);
  await run(ids.fir, deleteFIR);
  await run(ids.pp, deletePrarthnaPatra);
  await run(ids.court, deleteNyayalayDocument);
  await run(ids.nk, deleteNirodhatmakKaryvahi);
  await run(ids.gd, deleteGdEntry);
  await run(ids.person, deletePerson);
  await run(ids.hamlet, deleteHamlet);
  await run(ids.gp, deleteGramPanchayat);
  await saveIds(null);
  import('@/lib/appNotificationSync').then((m) => m.syncAppNotifications()).catch(() => {});
  return n;
}

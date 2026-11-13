/** Person details as cards (owner, चरण 3): expand, #prose, #name. Run: node --experimental-strip-types --test scripts/test_person_cards.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const { generateReport } = await import('../src/lib/templateEngine.ts');
const { deriveFormatValues } = await import('../src/lib/formatDerived.ts');
const seed = JSON.parse(readFileSync('assets/seed/formats_seed.json', 'utf8'));
const fmt = (id: string) => seed.formats.find((f: { id: string }) => f.id === id);
const P = (name: string, rel: string, father: string, addr: string, age = '') => ({ name, relationType: rel, fatherOrHusbandName: father, fullAddress: addr, age });

test('expand: a card fills the old single keys (age|वर्ष suffix, #2 = second card)', () => {
  const keys = [{ key_name: 'V', field_type: 'person_group', dropdown_options: JSON.stringify({ expand: { VName: 'name', VAge: 'age|वर्ष', Second: '#2:name', Addr: 'fullAddress' } }) }];
  const out = deriveFormatValues({ V: JSON.stringify([P('आरती', 'पुत्री', 'राज', 'ग्राम अ', '15'), P('सीता', 'पत्नी', 'राम', '')]) }, keys as never);
  assert.equal(out.VName, 'आरती');
  assert.equal(out.VAge, '15 वर्ष');
  assert.equal(out.Second, 'सीता');
  assert.equal(out.Addr, 'ग्राम अ');
  assert.equal(deriveFormatValues({ V: '' }, keys as never).VAge, '');
});

test('#prose: one person without "1.", #name = names only', () => {
  const keys = [{ key_name: 'A', field_type: 'person_group' }];
  const one = JSON.stringify([P('रामू', 'पुत्र', 'श्याम', 'ग्राम अ')]);
  const two = JSON.stringify([P('रामू', 'पुत्र', 'श्याम', 'ग्राम अ'), P('सोनू', 'पुत्र', 'मोहन', 'ग्राम अ')]);
  assert.equal(generateReport('{{A#prose}}', { A: one }, keys as never).trim(), 'रामू पुत्र श्याम निवासी ग्राम अ');
  assert.equal(generateReport('{{A#prose}}', { A: two }, keys as never).trim(), '1.रामू पुत्र श्याम 2.सोनू पुत्र मोहन निवासीगण ग्राम अ');
  assert.equal(generateReport('{{A#name}}', { A: two }, keys as never).trim(), 'रामू व सोनू');
});

test('converted formats print the card people (वापसी, तस्करा, फर्द पीड़िता, 183, मेडिकल)', () => {
  const w = fmt('sys-gd-fmt-wapsi');
  assert.ok(!w.keys.some((k: { key_name: string }) => /Nafar$/.test(k.key_name)));
  const r = generateReport(w.vivran, { doWapsi: '', h8: 'हाँ', h8FIR: '1/26', h8Names: JSON.stringify([P('रामू', 'पुत्र', 'श्याम', 'ग्राम अ')]), pad: 'उपनिरीक्षक', OfficerName: 'क' }, w.keys);
  assert.match(r, /अभियुक्त रामू पुत्र श्याम निवासी ग्राम अ का नाम प्रकाश में आया है।/);
  const b = fmt('sys-fmt-bayan-183-patra');
  const r2 = generateReport(b.vivran, { doL1: 'हाँ', Law: 'बीएनएसएस', Victim: JSON.stringify([P('आरती', 'पुत्री', 'राज', 'ग्राम म', '15')]), FIRNo: '1/24' }, b.keys);
  assert.match(r2, /पीड़िता आरती पुत्री राज निवासिनी ग्राम म उम्र 15 वर्ष/);
  const m = fmt('sys-fmt-cd-medical-avlokan');
  const r3 = generateReport(m.vivran, { p1Role: 'मजरूब', p1Card: JSON.stringify([P('रमेश', 'पुत्र', 'राजेन्द्र', 'ग्राम म', '45')]), p1Mlc: 'हाँ', p1MlcDate: '1.1.25' }, m.keys);
  assert.match(r3, /रमेश पुत्र राजेन्द्र निवासी ग्राम म उम्र 45 वर्ष/);
  for (const f of [w, b, m, fmt('sys-gd-fmt-taskara'), fmt('sys-fmt-fard-peedita-baramadgi')]) {
    const names = new Set(f.keys.map((k: { key_name: string }) => k.key_name));
    for (const t of f.vivran.matchAll(/\{\{(?:if:|ifnot:)?([A-Za-z0-9_]+)/g)) {
      const k = t[1];
      const derived = f.keys.some((kd: { dropdown_options?: string }) => (kd.dropdown_options ?? '').includes(`"${k}"`));
      if (!names.has(k) && !derived && !['each', 'count', 'any', 'none', 'sum', 'seq', 'dhara', 'uniq', 'cnt'].includes(k)) {
        assert.fail(`${f.id}: {{${k}}} has no field`);
      }
    }
  }
});

test('batch 2: बेल नोटिस, 35(3) नोटिस, पंचायतनामा/PM, फार्म 33, PM रिपोर्ट पत्र print the card', () => {
  const acc = JSON.stringify([P('रामचन्द्र', 'पुत्र', 'भिखारी', 'ग्राम भग्तिन खेड़ा थाना बछरावां जनपद रायबरेली')]);
  const b = fmt('sys-fmt-bail-notice-aakhya');
  assert.match(generateReport(b.vivran, { AccCard: acc }, b.keys), /अभियुक्त का नाम –\*?\*? ?रामचन्द्र, \*?\*?पिता का नाम –\*?\*? ?भिखारी, \*?\*?पता –\*?\*? ?ग्राम भग्तिन खेड़ा/);
  const n = fmt('sys-fmt-notice-35-3-bnss');
  const rn = generateReport(n.vivran, { AccCard: acc }, n.keys);
  assert.match(rn, /रामचन्द्र पुत्र भिखारी निवासी ग्राम भग्तिन खेड़ा थाना बछरावां जनपद रायबरेली/);
  assert.match(rn, /अभियुक्त के हस्ताक्षर/);
  const woman = JSON.stringify([P('सीता', 'पत्नी', 'राम', 'ग्राम अ')]);
  assert.match(generateReport(n.vivran, { AccCard: woman }, n.keys), /अभियुक्ता के हस्ताक्षर/);
  // relation left empty on the card → पुत्र
  assert.match(generateReport(n.vivran, { AccCard: JSON.stringify([P('रामू', '', 'श्याम', 'ग्राम अ')]) }, n.keys), /रामू पुत्र श्याम/);
  const d = JSON.stringify([P('नेवल किशोर', 'पुत्र', 'राम आधार', 'नेवाजखेड़ा थाना हरचन्द्रपुर जनपद रायबरेली', '25')]);
  const pn = fmt('sys-fmt-cd-panchayatnama-pm-avlokan');
  const rp = generateReport(pn.vivran, { doPan: 'हाँ', Gender: 'मृतक', DCard: d }, pn.keys);
  assert.match(rp, /मृतक नेवल किशोर पुत्र राम आधार निवासी नेवाजखेड़ा थाना हरचन्द्रपुर जनपद रायबरेली उम्र 25 वर्ष/);
  const p33 = fmt('sys-fmt-postmortem-33');
  const r33 = generateReport(p33.vivran, { Gender: 'मृतक', DCard: d, PoliceStation: 'बछरावां', District: 'रायबरेली' }, p33.keys);
  assert.match(r33, /मृतक नेवल किशोर पुत्र राम आधार निवासी नेवाजखेड़ा थाना हरचन्द्रपुर जनपद रायबरेली उम्र 25 वर्ष का शव/);
  assert.doesNotMatch(r33, /जनपद रायबरेली थाना/);
  const pr = fmt('sys-fmt-postmortem-report-request');
  assert.match(generateReport(pr.vivran, { DeadCard: d }, pr.keys), /मृतक नेवल किशोर पुत्र राम आधार उम्र करीब 25 वर्ष निवासी नेवाजखेड़ा थाना हरचन्द्रपुर जनपद रायबरेली का पोस्टमार्टम/);
  for (const f of [b, n, pn, p33, pr]) {
    const names = new Set(f.keys.map((k: { key_name: string }) => k.key_name));
    for (const t of f.vivran.matchAll(/\{\{(?:if:|ifnot:)?([A-Za-z0-9_]+)/g)) {
      const k = t[1];
      const derived = f.keys.some((kd: { dropdown_options?: string }) => (kd.dropdown_options ?? '').includes(`"${k}"`));
      if (!names.has(k) && !derived && !['each', 'count', 'any', 'none', 'sum', 'seq', 'dhara', 'uniq', 'cnt', 'PoliceStation', 'District', 'OfficerName', 'Rank', 'PSName'].includes(k)) {
        assert.fail(`${f.id}: {{${k}}} has no field`);
      }
    }
  }
});

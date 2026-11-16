/** आवेदक / विपक्षी समूह (owner). Run: node --experimental-strip-types --test scripts/test_pp_people.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const { generateReport } = await import('../src/lib/templateEngine.ts');
const pp = await import('../src/lib/ppPeople.ts');
const seed = JSON.parse(readFileSync('assets/seed/formats_seed.json', 'utf8'));
const fmt = (id: string) => seed.formats.find((f: { id: string }) => f.id === id);
const P = (name: string, rel: string, father: string, addr: string, gender = '') => ({ name, relationType: rel, fatherOrHusbandName: father, fullAddress: addr, gender });

test('role config from the key options', () => {
  assert.equal(pp.roleConfigOf('A', '{"hint":"x"}'), null);
  assert.deepEqual(pp.roleConfigOf('A', '{"role":"avedak"}'), { role: 'avedak', wordKey: 'AWord' });
  assert.deepEqual(pp.roleConfigOf('V', '{"role":"vipakshi","wordKey":"W","kindKey":"K","nilKey":"N"}'),
    { role: 'vipakshi', wordKey: 'W', kindKey: 'K', nilKey: 'N' });
});

test('आवेदक word: पुत्र → आवेदक, पुत्री / पत्नी / महिला → आवेदिका, 2+ → आवेदकगण', () => {
  assert.equal(pp.avedakWord([]), 'आवेदक');
  assert.equal(pp.avedakWord([P('राम', 'पुत्र', 'श्याम', '')]), 'आवेदक');
  assert.equal(pp.avedakWord([P('रेनू', 'पत्नी', 'धीरज', '')]), 'आवेदिका');
  assert.equal(pp.avedakWord([P('सीमा', '', 'राम', '', 'महिला')]), 'आवेदिका');
  assert.equal(pp.avedakWord([P('रेनू', 'पत्नी', 'धीरज', ''), P('धीरज', 'पुत्र', 'राम', '')]), 'आवेदकगण');
});

test('विपक्षी word: officer\'s choice, गण for 2+, nil → singular', () => {
  const two = [P('सुरेश', 'पुत्र', 'बाबू', ''), P('मुकेश', 'पुत्र', 'बाबू', '')];
  assert.equal(pp.vipakshiWord(two, ''), 'विपक्षीगण');
  assert.equal(pp.vipakshiWord(two, 'आरोपी'), 'आरोपीगण');
  assert.equal(pp.vipakshiWord(two.slice(0, 1), 'आरोपी'), 'आरोपी');
  assert.equal(pp.vipakshiWord(two, 'विपक्षी', true), 'विपक्षी');
});

test('प्रार्थना पत्र rows → cards (ग्राम / थाना / जनपद added when missing, unnamed rows dropped)', () => {
  const cards = pp.ppCards([
    { name: 'रेनू', father_husband_name: 'धीरज', relation: 'पत्नी', full_address: '', village: 'भग्तिन खेड़ा', police_station: 'बछरावां', district: 'रायबरेली', mobile: '+91 9118359439' },
    { name: '' },
  ], false);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].fullAddress, 'ग्राम भग्तिन खेड़ा थाना बछरावां जनपद रायबरेली');
  assert.equal(cards[0].gender, 'महिला');
  assert.equal(cards[0].mobile, '9118359439');
  const a = pp.ppCards([{ name: 'सुरेश', father_name: 'बाबूलाल', full_address: 'ग्राम अ थाना ब', police_station: 'ब' }], true);
  assert.equal(a[0].fatherOrHusbandName, 'बाबूलाल');
  assert.equal(a[0].relationType, 'पुत्र');
  assert.equal(a[0].fullAddress, 'ग्राम अ थाना ब');
});

test('जांच आख्या prints the worked-out words (आवेदकगण, विपक्षीगण / आरोपी, निल)', () => {
  const f = fmt('sys-fmt-pp-jaanch-aakhya');
  assert.ok(!f.keys.some((k: { key_name: string }) => k.key_name === 'Avedak'));
  const base = { To: 'पुलिस अधीक्षक', District: 'रायबरेली', PoliceStation: 'बछरावां', pad: 'उपनिरीक्षक', OfficerName: 'क', Findings: 'विवाद है।', doParties: 'हाँ' };
  const addr = 'ग्राम भग्तिन खेड़ा';
  const r = generateReport(f.vivran, {
    ...base, VipKind: 'विपक्षी',
    Applicant: JSON.stringify([P('रेनू', 'पत्नी', 'धीरज', addr), P('धीरज', 'पुत्र', 'रामलाल', addr)]),
    Vipakshi: JSON.stringify([P('सुरेश', 'पुत्र', 'बाबूलाल', addr), P('मुकेश', 'पुत्र', 'बाबूलाल', addr)]),
  }, f.keys);
  assert.match(r, /1\. आवेदकगण –\*?\*? ?1\. ?रेनू पत्नी धीरज/);
  assert.match(r, /2\. विपक्षीगण –/);
  assert.match(r, /सादर अवगत कराना है कि आवेदकगण उपरोक्त/);
  const one = generateReport(f.vivran, {
    ...base, VipKind: 'आरोपी', doParties: '',
    Applicant: JSON.stringify([P('रेनू', 'पत्नी', 'धीरज', addr)]),
    Vipakshi: JSON.stringify([P('सुरेश', 'पुत्र', 'बाबूलाल', addr)]),
  }, f.keys);
  assert.match(one, /सादर अवगत कराना है कि आवेदिका रेनू पत्नी धीरज/);
  const nil = generateReport(f.vivran, { ...base, VipKind: 'आरोपी', noVip: 'हाँ', Applicant: JSON.stringify([P('राम', 'पुत्र', 'श्याम', addr)]) }, f.keys);
  assert.match(nil, /2\. आरोपी –\*?\*? ?निल/);
  assert.match(nil, /1\. आवेदक –/);
});

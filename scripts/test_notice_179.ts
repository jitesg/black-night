import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const { generateReport } = await import('../src/lib/templateEngine.ts');
const d = JSON.parse(readFileSync(new URL('../assets/seed/formats_seed.json', import.meta.url), 'utf8'));
const f = d.formats.find((x: { id: string }) => x.id === 'sys-fmt-notice-179-bnss');
const P = (name: string, rel: string, father: string, addr: string) => JSON.stringify([{ name, relationType: rel, fatherOrHusbandName: father, fullAddress: addr }]);
const base = { PoliceStation: 'बछरावां', District: 'रायबरेली', FIRNo: '297/2025', Sections: '352 बीएनएस', pad: 'उपनिरीक्षक', OfficerName: 'जीतेश सिंह',
  VadiCard: P('रेनू', 'पत्नी', 'धीरज', 'ग्राम अघौरा'), NoticeCard: P('रामचन्द्र', 'पुत्र', 'भिखारी', 'ग्राम भग्तिन खेड़ा'),
  AppearDate: '2025-07-08', AppearTime: '10:00 बजे', AmPm: 'पूर्वान्ह', AppearAt: 'थाना बछरावां जनपद रायबरेली' };

test('179 notice: cards, dates dd/mm/yyyy, officer with rank', () => {
  const r: string = generateReport(f.vivran, { ...base, NoticeDate: '2025-07-05', FirDate: '01.07.2025' }, f.keys);
  assert.match(r, /नाम – रामचन्द्र पुत्र भिखारी/);
  assert.match(r, /पता – ग्राम भग्तिन खेड़ा/);
  assert.match(r, /मामला रेनू पत्नी धीरज निवासी ग्राम अघौरा की शिकायत/);
  assert.match(r, /दिनांक 08\/07\/2025 को समय 10:00 बजे पूर्वान्ह थाना बछरावां जनपद रायबरेली पर उपस्थित होना है/);
  assert.match(r, /दिनांक – 01\/07\/2025/);
  assert.match(r, /दिनांक – 05\/07\/2025/);
  assert.match(r, /विवेचक का नाम – उ0नि0 जीतेश सिंह/);
  assert.match(r, /धारा 208/);
});
test('179 notice: empty optional boxes print dots', () => {
  const r: string = generateReport(f.vivran, base, f.keys);
  assert.match(r, /रो0आम संख्या \/ समय – \.{10}/);
  assert.match(r, /\(यदि कोई हो\) – \.{10}/);
  assert.match(r, /दिनांक – \.{10}/);
  assert.doesNotMatch(r, /\{\{/);
});

test('179 notice: age limit 60 (BNSS 179), not 65', () => {
  assert.match(f.vivran, /60 वर्ष से अधिक/);
  assert.doesNotMatch(f.vivran, /65 वर्ष/);
});

test('179 info note: owner docx text, blocks in order', async () => {
  const { hasFormatInfo, boldParts } = await import('../src/lib/formatInfo.ts');
  assert.equal(hasFormatInfo('sys-fmt-notice-179-bnss'), true);
  assert.equal(hasFormatInfo('sys-fmt-notice-35-3-bnss'), true);
  assert.equal(hasFormatInfo('sys-fmt-samanya-patra'), false);
  assert.deepEqual(boldParts('a **b** c'), [{ text: 'a ', bold: false }, { text: 'b', bold: true }, { text: ' c', bold: false }]);
  const info = JSON.parse(readFileSync(new URL('../assets/format-info/sys-fmt-notice-179-bnss.json', import.meta.url), 'utf8'));
  const heads = info.blocks.filter((b: { t: string }) => b.t === 'h').map((b: { x: string }) => b.x);
  assert.equal(heads.length, 10);
  assert.equal(heads[0], '1. धारा 179 BNSS क्या है?');
  assert.equal(heads[9], '10. कानूनी संदर्भ एवं उपयोग संबंधी नोट');
  const all = JSON.stringify(info);
  assert.match(all, /60 वर्ष से अधिक आयु का पुरुष।/);
  assert.equal(info.blocks.filter((b: { t: string }) => b.t === 'box').length, 2);
  assert.equal(info.blocks.filter((b: { t: string }) => b.t === 'table')[0].rows.length, 4);
});

test('35(3) info note: owner text, no 5.x serials', () => {
  const info = JSON.parse(readFileSync(new URL('../assets/format-info/sys-fmt-notice-35-3-bnss.json', import.meta.url), 'utf8'));
  const heads = info.blocks.filter((b: { t: string }) => b.t === 'h').map((b: { x: string }) => b.x);
  assert.deepEqual(heads, ['धारा 35(3): उपस्थित होने का नोटिस', 'धारा 35(4): नोटिस का पालन',
    'धारा 35(5): नोटिस का पालन करने वाले व्यक्ति की गिरफ्तारी', 'धारा 35(6): नोटिस का पालन न करना']);
  assert.equal(info.blocks.filter((b: { t: string }) => b.t === 'box')[0].label, 'महत्वपूर्ण');
});

test('35(3) + 179 notices: age and mobile come from the person card (separate मो0न0 box removed, owner)', () => {
  const card = (age: string, mobile: string) => JSON.stringify([{ name: 'रामचन्द्र', relationType: 'पुत्र', fatherOrHusbandName: 'भिखारी', fullAddress: 'ग्राम भग्तिन खेड़ा', age, mobile }]);
  const n35 = d.formats.find((x: { id: string }) => x.id === 'sys-fmt-notice-35-3-bnss');
  assert.ok(!n35.keys.some((k: { key_name: string }) => k.key_name === 'Mobile'));
  assert.ok(!f.keys.some((k: { key_name: string }) => k.key_name === 'Mobile'));
  const a: string = generateReport(n35.vivran, { AccCard: card('35', '9876543210') }, n35.keys);
  assert.match(a, /रामचन्द्र पुत्र भिखारी उम्र 35 वर्ष निवासी ग्राम भग्तिन खेड़ा मो0न0 9876543210।/);
  const a2: string = generateReport(n35.vivran, { AccCard: card('', '') }, n35.keys);
  assert.match(a2, /रामचन्द्र पुत्र भिखारी निवासी ग्राम भग्तिन खेड़ा।/);
  const b: string = generateReport(f.vivran, { ...base, NoticeCard: card('35', '9876543210') }, f.keys);
  assert.match(b, /नाम – रामचन्द्र पुत्र भिखारी उम्र 35 वर्ष/);
  assert.match(b, /\(यदि कोई हो\) – 9876543210/);
});

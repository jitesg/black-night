/**
 * One person in a group → no "आदि" after the name, and "निवासी" (not "नि0" / "नि0गण").
 * Two or more people → unchanged ("आदि", numbering 1. 2., "नि0गण").
 * Run: node --experimental-strip-types --test scripts/test_template_adi.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const { generateReport } = await import('../src/lib/templateEngine.ts');

const P = (name: string, father: string, age: string) =>
  ({ name, relationType: 'पुत्र', fatherOrHusbandName: father, age, fullAddress: 'ग्राम बबुरिहा खेड़ा थाना बछरावां', gender: 'पुरुष' });
const keys = [
  { key_name: 'first', label: 'प्रथम पक्ष', field_type: 'person_group' },
  { key_name: 'second', label: 'द्वितीय पक्ष', field_type: 'person_group' },
] as never;
const T = 'बनाम {{first.1.name}} आदि | {{second.1.name}} आदि | {{first}} | {{second}} | आदि शब्द';

test('one person: "आदि" dropped after the name; "निवासी"', () => {
  const out = generateReport(T, { first: JSON.stringify([P('कैलाश', 'लल्लू', '35')]), second: JSON.stringify([P('संगीता', 'रामदेव', '45'), P('रामू', 'रामदेव', '25')]) }, keys);
  assert.match(out, /^बनाम कैलाश \| संगीता आदि \|/);
  assert.match(out, /कैलाश पुत्र लल्लू उम्र करीब 35 वर्ष निवासी ग्राम बबुरिहा खेड़ा/);
  assert.doesNotMatch(out.split('|')[2], /नि0/);
  // several people: numbering and नि0गण unchanged
  assert.match(out, /1\.संगीता पुत्र रामदेव उम्र करीब 45 वर्ष 2\.रामू पुत्र रामदेव उम्र करीब 25 वर्ष नि0गण ग्राम/);
  assert.match(out, /\| आदि शब्द$/);   // other "आदि" untouched
});

test('two people on both sides: everything as before', () => {
  const two = JSON.stringify([P('अ', 'ब', '30'), P('स', 'द', '40')]);
  const out = generateReport(T, { first: two, second: two }, keys);
  assert.match(out, /^बनाम अ आदि \| अ आदि \|/);
});

test('126/135 formats: one person per side → no "नाम आदि", no "नि0गण", rest unchanged', () => {
  const d = JSON.parse(readFileSync(new URL('../assets/seed/formats_seed.json', import.meta.url), 'utf8'));
  for (const f of d.formats.filter((x: { id: string }) => x.id.startsWith('sys-fmt-bnss126'))) {
    const groupKeys = f.keys.filter((k: { field_type: string }) => k.field_type === 'person_group').map((k: { key_name: string }) => k.key_name);
    const one: Record<string, string> = {}; const two: Record<string, string> = {};
    groupKeys.forEach((k: string, i: number) => {
      one[k] = JSON.stringify([P(i ? 'कैलाश' : 'संगीता', 'लल्लू', '35')]);
      two[k] = JSON.stringify([P(i ? 'कैलाश' : 'संगीता', 'लल्लू', '35'), P('रामू', 'रामदेव', '25')]);
    });
    const a = generateReport(f.vivran, one, f.keys);
    const b = generateReport(f.vivran, two, f.keys);
    assert.doesNotMatch(a, /(संगीता|कैलाश) आदि/, f.id);
    assert.doesNotMatch(a, /नि0गण/, f.id);
    assert.match(b, /(संगीता|कैलाश) आदि/, f.id);
    // apart from the group text, the "आदि" count differs only by the removed ones
    const removed = (f.vivran.match(/\.1\.name\}\}\s*आदि/g) ?? []).length;
    assert.equal((b.match(/आदि/g) ?? []).length - (a.match(/आदि/g) ?? []).length, removed, f.id);
  }
});

test('{{Key#list}}: one person per line; shared address → नि0गण after the last; else निवासी each; one → "1." too', () => {
  const two = JSON.stringify([P('संगीता', 'रामदेव', '45'), P('रामू', 'रामदेव', '25')]);
  assert.equal(generateReport('{{first#list}}', { first: two }, keys),
    '1.संगीता पुत्र रामदेव उम्र करीब 45 वर्ष\n2.रामू पुत्र रामदेव उम्र करीब 25 वर्ष नि0गण ग्राम बबुरिहा खेड़ा थाना बछरावां');
  const diff = JSON.stringify([P('संगीता', 'रामदेव', '45'), { ...P('रामू', 'रामदेव', '25'), fullAddress: 'ग्राम पूरे बाबू' }]);
  assert.equal(generateReport('{{first#list}}', { first: diff }, keys),
    '1.संगीता पुत्र रामदेव उम्र करीब 45 वर्ष निवासी ग्राम बबुरिहा खेड़ा थाना बछरावां\n2.रामू पुत्र रामदेव उम्र करीब 25 वर्ष निवासी ग्राम पूरे बाबू');
  assert.equal(generateReport('{{first#list}}', { first: JSON.stringify([P('कैलाश', 'लल्लू', '35')]) }, keys),
    '1.कैलाश पुत्र लल्लू उम्र करीब 35 वर्ष निवासी ग्राम बबुरिहा खेड़ा थाना बछरावां');
  // #num: usual prose, one person numbered too
  assert.equal(generateReport('{{first#num}}', { first: JSON.stringify([P('कैलाश', 'लल्लू', '35')]) }, keys),
    '1.कैलाश पुत्र लल्लू उम्र करीब 35 वर्ष निवासी ग्राम बबुरिहा खेड़ा थाना बछरावां');
  assert.equal(generateReport('{{first#num}}', { first: two }, keys), generateReport('{{first}}', { first: two }, keys));
});

test('{{Key#block}} / #inline / #short / #count / #n', () => {
  const three = JSON.stringify([P('सन्तोष', 'गुरूदीन', '23'), P('शुभम', 'रामलखन', '19'), P('सर्वेश', 'रामनरेश', '24')]);
  const one = JSON.stringify([P('कैलाश', 'लल्लू', '35')]);
  const T2 = '{{first#block}}|{{first#inline}}|{{first#short}}|{{first#n|एक व्यक्ति|{{first#count}} लोगो}}|{{first#n|सकता था|सकते थे}}';
  const [b, i, s, c, v] = generateReport(T2, { first: three }, keys).split('|');
  assert.equal(b, '1.सन्तोष पुत्र गुरूदीन उम्र करीब 23 वर्ष\n2.शुभम पुत्र रामलखन उम्र करीब 19 वर्ष\n3.सर्वेश पुत्र रामनरेश उम्र करीब 24 वर्ष\nनिवासीगण ग्राम बबुरिहा खेड़ा थाना बछरावां');
  assert.equal(i, b.replace(/\n/g, ' '));
  assert.equal(s, '1.सन्तोष पुत्र गुरूदीन 2.शुभम पुत्र रामलखन 3.सर्वेश पुत्र रामनरेश');
  assert.equal(c, 'तीन लोगो');
  assert.equal(v, 'सकते थे');
  const [b1, , s1, c1, v1] = generateReport(T2, { first: one }, keys).split('|');
  assert.equal(b1, '1.कैलाश पुत्र लल्लू उम्र करीब 35 वर्ष निवासी ग्राम बबुरिहा खेड़ा थाना बछरावां');
  assert.equal(s1, '1.कैलाश पुत्र लल्लू');
  assert.equal(c1, 'एक व्यक्ति');
  assert.equal(v1, 'सकता था');
});

test('{{if:Key|…}} / {{ifnot:Key|…}} (checkbox), inner tokens still work', () => {
  const T3 = '{{ifnot:Remand|अतः {{first#short}} को पाबन्द करें।}}{{if:Remand|**अतः {{first#short}} का 14 दिवस का रिमांड …**}}';
  const one = JSON.stringify([P('कैलाश', 'लल्लू', '35')]);
  assert.equal(generateReport(T3, { first: one, Remand: 'हाँ' }, keys), '**अतः 1.कैलाश पुत्र लल्लू का 14 दिवस का रिमांड …**');
  assert.equal(generateReport(T3, { first: one, Remand: '' }, keys), 'अतः 1.कैलाश पुत्र लल्लू को पाबन्द करें।');
  assert.equal(generateReport(T3, { first: one }, keys), 'अतः 1.कैलाश पुत्र लल्लू को पाबन्द करें।');
});

test('170 चालानी formats (7): fill + render, no token left; ubhay = 4 letters; रिमांड tick → bold line', async () => {
  const P2 = (await import('../src/lib/printLayout.ts'));
  const d = JSON.parse(readFileSync(new URL('../assets/seed/formats_seed.json', import.meta.url), 'utf8'));
  const fmts = d.formats.filter((f: { id: string }) => f.id.startsWith('sys-fmt-bnss170'));
  assert.equal(fmts.length, 7);
  const two = JSON.stringify([P('संगीता', 'रामदेव', '45'), P('रामू', 'रामदेव', '25')]);
  for (const f of fmts) {
    const v: Record<string, string> = {};
    for (const k of f.keys) v[k.key_name] = k.field_type === 'person_group' ? two : (k.field_type === 'checkbox' ? 'हाँ' : 'क');
    const marked = generateReport(f.vivran, v, f.keys, { keepMarkers: true });
    assert.doesNotMatch(marked, /\{\{|\}\}/, f.id);
    const html = P2.renderTextForPrint(marked);
    assert.equal((html.match(/class="doc-letter"/g) ?? []).length, /ubhay|kshetra$/.test(f.id) ? 4 : 2, f.id);
    assert.match(html, /<b>अतः श्रीमान से निवेदन है कि [^<]*14 दिवस का रिमांड/, f.id);
    assert.match(html, /party-head">\( बनाम- /, f.id);
    v.Remand = '';
    assert.doesNotMatch(generateReport(f.vivran, v, f.keys), /रिमांड|\*\*/, f.id);
  }
});

test('सामान्य पत्र: empty संलग्नक / दिनांक leave nothing behind; filled ones print', async () => {
  const P2 = (await import('../src/lib/printLayout.ts'));
  const d = JSON.parse(readFileSync(new URL('../assets/seed/formats_seed.json', import.meta.url), 'utf8'));
  const f = d.formats.find((x: { id: string }) => x.id === 'sys-fmt-samanya-patra');
  const base = { Addressee: 'श्रीमान पुलिस अधीक्षक महोदय,\nजनपद रायबरेली।', Subject: 'क', Body: 'पैरा 1\n\nपैरा 2', Closing: 'सादर।', pad: 'उपनिरीक्षक', OfficerName: 'जीतेश सिंह', PoliceStation: 'बछरावां', District: 'रायबरेली' };
  const empty = P2.renderTextForPrint(generateReport(f.vivran, { ...base, Attachments: '', Date: '' }, f.keys, { keepMarkers: true }));
  assert.doesNotMatch(empty, /संलग्नक|दिनांक|\{\{/);
  assert.equal((empty.match(/<p>पैरा/g) ?? []).length, 2);
  const full = P2.renderTextForPrint(generateReport(f.vivran, { ...base, Attachments: 'प्रति - 02 वर्क\nविवरण - 01 वर्क', Date: '29.10.2026' }, f.keys, { keepMarkers: true }));
  assert.match(full, /class="att">1\. प्रति - 02 वर्क/);
  assert.match(full, /दिनांक: 29\.10\.2026/);
});

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

test('{{Key#list}}: one person per line; shared address → नि0गण after the last; else निवासी each; one → no number', () => {
  const two = JSON.stringify([P('संगीता', 'रामदेव', '45'), P('रामू', 'रामदेव', '25')]);
  assert.equal(generateReport('{{first#list}}', { first: two }, keys),
    '1.संगीता पुत्र रामदेव उम्र करीब 45 वर्ष\n2.रामू पुत्र रामदेव उम्र करीब 25 वर्ष नि0गण ग्राम बबुरिहा खेड़ा थाना बछरावां');
  const diff = JSON.stringify([P('संगीता', 'रामदेव', '45'), { ...P('रामू', 'रामदेव', '25'), fullAddress: 'ग्राम पूरे बाबू' }]);
  assert.equal(generateReport('{{first#list}}', { first: diff }, keys),
    '1.संगीता पुत्र रामदेव उम्र करीब 45 वर्ष निवासी ग्राम बबुरिहा खेड़ा थाना बछरावां\n2.रामू पुत्र रामदेव उम्र करीब 25 वर्ष निवासी ग्राम पूरे बाबू');
  assert.equal(generateReport('{{first#list}}', { first: JSON.stringify([P('कैलाश', 'लल्लू', '35')]) }, keys),
    'कैलाश पुत्र लल्लू उम्र करीब 35 वर्ष निवासी ग्राम बबुरिहा खेड़ा थाना बछरावां');
});

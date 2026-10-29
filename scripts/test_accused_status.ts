/**
 * Accused wanted status tokens: {{Key#summary}}, {{Key#wanted}}, {{Key#ifWanted|…}}.
 * Run: node --experimental-strip-types --test scripts/test_accused_status.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const { generateReport } = await import('../src/lib/templateEngine.ts');

const A = (name: string, father: string, status?: string, gender = 'पुरुष') =>
  ({ name, relationType: 'पुत्र', fatherOrHusbandName: father, fullAddress: 'ग्राम X', gender, ...(status ? { status } : {}) });
const keys = [{ key_name: 'Accused', label: 'अभियुक्त', field_type: 'accused_group' }] as never;
const T = 'कार्यवाही में {{Accused#summary}} ।{{Accused#ifWanted| महोदय से निवेदन है {{Accused#wanted}} उपरोक्त न्यायिक अभिरक्षा में लेने कि कृपा करें ।}}|END';
const run = (list: object[]) => generateReport(T, { Accused: JSON.stringify(list) }, keys);

test('one accused, not chosen → "का नाम प्रकाश में आया है"; request line present', () => {
  assert.equal(run([A('करम नबी अंसारी', 'महमूद अहमद')]),
    'कार्यवाही में अभियुक्त करम नबी अंसारी पुत्र महमूद अहमद उपरोक्त का नाम प्रकाश में आया है व मुकदमा उपरोक्त में वांछित है । महोदय से निवेदन है अभियुक्त करम नबी अंसारी पुत्र महमूद अहमद उपरोक्त न्यायिक अभिरक्षा में लेने कि कृपा करें ।|END');
});

test('mixed: नामजद (2) + प्रकाश (1) + वांछित नहीं (1); request lists only the wanted', () => {
  const out = run([A('राम', 'क', 'नामजद'), A('श्याम', 'ख', 'नामजद'), A('करम', 'ग', 'प्रकाश में आया'), A('मोहन', 'घ', 'वांछित नहीं')]);
  assert.match(out, /^कार्यवाही में अभियुक्तगण 1\.राम पुत्र क 2\.श्याम पुत्र ख उपरोक्त नामजद हैं व मुकदमा उपरोक्त में वांछित हैं तथा अभियुक्त करम पुत्र ग उपरोक्त का नाम प्रकाश में आया है व मुकदमा उपरोक्त में वांछित है तथा अभियुक्त मोहन पुत्र घ उपरोक्त वांछित नहीं है ।/);
  assert.match(out, /निवेदन है अभियुक्तगण 1\.राम पुत्र क 2\.श्याम पुत्र ख 3\.करम पुत्र ग उपरोक्त न्यायिक अभिरक्षा/);
  assert.doesNotMatch(out.split('निवेदन')[1], /मोहन/);
});

test('two surfaced → plural "के नाम प्रकाश में आये हैं"; female single → अभियुक्ता', () => {
  assert.match(run([A('अ', 'ब', 'प्रकाश में आया'), A('स', 'द', 'प्रकाश में आया')]), /अभियुक्तगण 1\.अ पुत्र ब 2\.स पुत्र द उपरोक्त के नाम प्रकाश में आये हैं व मुकदमा उपरोक्त में वांछित हैं/);
  assert.match(run([A('सीमा', 'राम', 'नामजद', 'महिला')]), /अभियुक्ता सीमा/);
});

test('nobody wanted → only "वांछित नहीं है", no request line', () => {
  assert.equal(run([A('मोहन', 'घ', 'वांछित नहीं')]), 'कार्यवाही में अभियुक्त मोहन पुत्र घ उपरोक्त वांछित नहीं है ।|END');
});

test('formats without these tokens are unaffected', () => {
  assert.equal(generateReport('{{Accused}}', { Accused: JSON.stringify([A('राम', 'क', 'नामजद')]) }, keys),
    'अभियुक्त राम पुत्र क निवासी ग्राम X');
});

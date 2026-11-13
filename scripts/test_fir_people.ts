/** Run: node --experimental-strip-types --test scripts/test_fir_people.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const { firPeople, personLine, toCard, toItemRow, isPersonItemGroup, insertIntoGroup, skipPersonMarker } = await import('../src/lib/firPeople.ts');

const fir = { complainant_name: 'रेनू', complainant_relation: 'पत्नी', complainant_father: 'धीरज', complainant_address: 'ग्राम बन्नावां', complainant_age: '33', complainant_mobile: '+91 9876543210' };
const accused = [
  { name: 'बबलू', father: 'रामलाल', relation: 'पुत्र', address: 'ग्राम अघौरा', age: '25' },
  { name: '', is_known: 0 },
  { name: 'सीमा', relation: 'पत्नी', father: 'राजू', address: 'ग्राम अघौरा' },
];

test('people of a मुकदमा: वादी first, unknown अभियुक्त left out, roles by gender', () => {
  const p = firPeople(fir, accused);
  assert.deepEqual(p.map((x) => x.role), ['वादिनी', 'अभियुक्त', 'अभियुक्ता']);
  assert.equal(p[0].mobile, '9876543210');
  assert.equal(personLine(p[1]), 'बबलू पुत्र रामलाल, निवासी ग्राम अघौरा, उम्र 25');
  assert.deepEqual(firPeople(null, []), []);
});

test('cards and item rows', () => {
  const [v, b] = firPeople(fir, accused);
  const c = toCard(b, true, 0);
  assert.equal(c.fatherOrHusbandName, 'रामलाल');
  assert.equal(c.status, 'नामजद');
  assert.equal(toCard(v, false, 0).status, undefined);
  const cols = [{ key: 'name' }, { key: 'rel', type: 'choice' }, { key: 'father' }, { key: 'addr' }, { key: 'age' }, { key: 'mahila', type: 'check' }, { key: 'own', default: '' }];
  assert.deepEqual(toItemRow(v, cols), { name: 'रेनू', rel: 'पत्नी', father: 'धीरज', addr: 'ग्राम बन्नावां', age: '33', mahila: 'हाँ', own: '' });
  assert.ok(isPersonItemGroup(cols));
  assert.ok(!isPersonItemGroup([{ key: 'vno' }, { key: 'vtype' }]));
});

test('insert: blank opening card replaced, no duplicates, typed cards kept', () => {
  const [, b, s] = firPeople(fir, accused);
  const blank = JSON.stringify([{ _id: 'x', name: '', fatherOrHusbandName: '', fullAddress: '' }]);
  const one = insertIntoGroup(blank, [toCard(b, false, 0)]);
  assert.equal(JSON.parse(one).length, 1);
  const two = insertIntoGroup(one, [toCard(b, false, 1), toCard(s, false, 2)]);
  assert.deepEqual(JSON.parse(two).map((x: { name: string }) => x.name), ['बबलू', 'सीमा']);
  // item_group opening row with only default cells counts as blank
  const rows = insertIntoGroup(JSON.stringify([{ name: '', rel: 'पुत्र', own: '' }]), [{ name: 'बबलू', rel: 'पुत्र', father: 'रामलाल' }], { rel: 'पुत्र' });
  assert.equal(JSON.parse(rows).length, 1);
});

test('owner (ख): group fields are not filled by themselves from the FIR', () => {
  assert.ok(skipPersonMarker('person_group', '@FIR.accused_cards'));
  assert.ok(skipPersonMarker('accused_group', '@FIR.accused_group'));
  assert.ok(skipPersonMarker('item_group', '@FIR.accused_rows'));
  assert.ok(skipPersonMarker('item_group', '@FIR.complainant_doctor_row'));
  assert.ok(!skipPersonMarker('text', '@FIR.complainant_name')); // loose boxes keep it until they become groups
  assert.ok(!skipPersonMarker('person_group', '@FIR.fir_number'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveFormatValues, paharFromTime } from '../src/lib/formatDerived.ts';

test('पहर from time', () => {
  assert.equal(paharFromTime('05.00'), 'सुबह');
  assert.equal(paharFromTime('10.59'), 'सुबह');
  assert.equal(paharFromTime('11:00'), 'दिन');
  assert.equal(paharFromTime('15.45'), 'दिन');
  assert.equal(paharFromTime('16.00'), 'शाम');
  assert.equal(paharFromTime('18.59'), 'शाम');
  assert.equal(paharFromTime('19.00'), 'रात');
  assert.equal(paharFromTime('02.10'), 'रात');
  assert.equal(paharFromTime('24'), 'रात');
  assert.equal(paharFromTime(''), '');
  assert.equal(paharFromTime('करीब'), '');
});

const keys = [
  { key_name: 'T', field_type: 'text' },
  { key_name: 'P', field_type: 'dropdown', dropdown_options: '{"options":["समय से","सुबह","दिन","शाम","रात"],"paharFrom":"T"}' },
  { key_name: 'Accused', field_type: 'item_group', dropdown_options: '{"columns":[{"key":"name"},{"key":"mahila","type":"check"}]}' },
  { key_name: 'JT', field_type: 'item_group', dropdown_options: '{"columns":[{"key":"by"},{"key":"who","type":"ref","ref":"Accused"},{"key":"how"}]}' },
];

test('पहर filled only when empty / "समय से"', () => {
  assert.equal(deriveFormatValues({ T: '21.30', P: '' }, keys).P, 'रात');
  assert.equal(deriveFormatValues({ T: '21.30', P: 'समय से' }, keys).P, 'रात');
  assert.equal(deriveFormatValues({ T: '21.30', P: 'शाम' }, keys).P, 'शाम');
});

test('picked person fields copied', () => {
  const v = deriveFormatValues({
    Accused: JSON.stringify([{ name: 'रामू', mahila: '' }, { name: 'सुमन', mahila: 'हाँ' }]),
    JT: JSON.stringify([{ by: 'का0 अमित', who: 'सुमन', how: 'x' }, { by: 'का0 ब', who: 'कोई और', how: 'y' }]),
  }, keys);
  const rows = JSON.parse(v.JT);
  assert.equal(rows[0].who_mahila, 'हाँ');
  assert.equal(rows[0].who_name, 'सुमन');
  assert.equal(rows[1].who_mahila, undefined);
});

test('input not changed', () => {
  const input = { T: '07.00', P: '' };
  deriveFormatValues(input, keys);
  assert.equal(input.P, '');
});

test('endWith adds the danda once', () => {
  const k = [{ key_name: 'JT', field_type: 'item_group', dropdown_options: '{"columns":[{"key":"how","endWith":"।"}]}' }];
  const rows = JSON.parse(deriveFormatValues({ JT: JSON.stringify([{ how: 'नोट मिले' }, { how: 'नोट मिले। ' }, { how: 'x.' }, { how: '' }]) }, k).JT);
  assert.deepEqual(rows.map((r: { how: string }) => r.how), ['नोट मिले।', 'नोट मिले।', 'x।', '']);
});

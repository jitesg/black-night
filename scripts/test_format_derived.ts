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

test('flags, fallback, groupInto', () => {
  const k = [
    { key_name: 'Accused', field_type: 'item_group', dropdown_options: '{"columns":[{"key":"name"}]}' },
    { key_name: 'Items', field_type: 'item_group', dropdown_options: JSON.stringify({
      columns: [{ key: 'who', type: 'ref', ref: 'Accused' }, { key: 'what' }, { key: 'from' },
        { key: 'kind', type: 'choice', flags: { isCase: 'मुकदमे का माल', isOwn: 'अपनी चीज़' } }, { key: 'case', fallback: 'FIRNo' }],
      groupInto: { key: 'Accused', match: 'who', by: 'name', field: 'found', row: '{from} से {what}', sep: ' व ' } }) },
  ];
  const v = deriveFormatValues({
    FIRNo: '37/24',
    Accused: JSON.stringify([{ name: 'रौनक' }, { name: 'लखन' }]),
    Items: JSON.stringify([
      { who: 'रौनक', what: 'बिछिया', from: 'जेब', kind: 'मुकदमे का माल', case: '' },
      { who: 'रौनक', what: 'मोबाइल', from: 'हाथ', kind: 'अपनी चीज़', case: '' },
      { who: 'लखन', what: 'टैबलेट', from: 'झोला', kind: 'मुकदमे का माल', case: '45/24' }]),
  }, k);
  const items = JSON.parse(v.Items);
  assert.equal(items[0].isCase, 'हाँ'); assert.equal(items[1].isCase, ''); assert.equal(items[1].isOwn, 'हाँ');
  assert.equal(items[0].case, '37/24'); assert.equal(items[2].case, '45/24');
  const acc = JSON.parse(v.Accused);
  assert.equal(acc[0].found, 'जेब से बिछिया व हाथ से मोबाइल');
  assert.equal(acc[1].found, 'झोला से टैबलेट');
});

test('weight + copy', async () => {
  const { kgText } = await import('../src/lib/formatDerived.ts');
  assert.equal(kgText(1200), '01 किलो 200 ग्राम');
  assert.equal(kgText(250), '250 ग्राम');
  assert.equal(kgText(2000), '02 किलो');
  assert.equal(kgText(0), '');
  const k = [{ key_name: 'Acc', field_type: 'item_group', dropdown_options: JSON.stringify({ columns: [{ key: 'name' }, { key: 'kg' }, { key: 'gm' }], copy: ['Drug'], weight: { kg: 'kg', gm: 'gm', rowField: 'wt', total: 'TotalWt' } }) }];
  const v = deriveFormatValues({ Drug: 'गांजा', Acc: JSON.stringify([{ name: 'अ', kg: '1', gm: '200' }, { name: 'ब', kg: '', gm: '850' }]) }, k);
  const rows = JSON.parse(v.Acc);
  assert.equal(rows[0].wt, '01 किलो 200 ग्राम'); assert.equal(rows[1].wt, '850 ग्राम'); assert.equal(rows[0].Drug, 'गांजा');
  assert.equal(v.TotalWt, '02 किलो 50 ग्राम');
});

/** Group person card rules. Run: node --experimental-strip-types --test scripts/test_person_card.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as p from '../src/lib/personCard.ts';

test('सम्बन्ध chips → printed word and back', () => {
  assert.equal(p.relationWord('ट्रांसजेंडर', 'गुरु'), 'गुरु');
  assert.equal(p.relationWord('ट्रांसजेंडर', 'संतान'), 'संतान');
  assert.equal(p.relationWord('ट्रांसजेंडर'), '');
  assert.equal(p.relationWord('दत्तक', 'पुत्र'), 'दत्तक पुत्र');
  assert.equal(p.relationWord('दत्तक', 'पुत्री'), 'दत्तक पुत्री');
  assert.equal(p.relationWord('पत्नी'), 'पत्नी');
  assert.deepEqual(p.chipOf('दत्तक पुत्री'), { chip: 'दत्तक', sub: 'पुत्री' });
  assert.deepEqual(p.chipOf('गुरु'), { chip: 'ट्रांसजेंडर', sub: 'गुरु' });
  assert.deepEqual(p.chipOf(''), { chip: '', sub: '' });
});

test('लिंग from सम्बन्ध + feminine grammar', () => {
  assert.equal(p.genderOfRelation('दत्तक पुत्र'), 'पुरुष');
  assert.equal(p.genderOfRelation('पत्नी'), 'महिला');
  assert.equal(p.genderOfRelation('संतान'), 'ट्रांसजेंडर');
  assert.equal(p.genderOfRelation(''), '');
  assert.equal(p.isFeminine({ relationType: 'गुरु' }), true);
  assert.equal(p.isFeminine({ gender: 'ट्रांसजेंडर' }), true);
  assert.equal(p.isFeminine({ relationType: 'दत्तक पुत्र' }), false);
  assert.equal(p.isFeminine({ gender: 'महिला' }), true);
  assert.equal(p.fatherLabel('गुरु'), 'गुरु / अभिभावक का नाम');
  assert.equal(p.fatherLabel('पत्नी'), 'पति का नाम');
});

test('पता from parts', () => {
  assert.equal(p.composeAddress({ village: 'भग्तिन खेड़ा', thana: 'बछरावां', district: 'रायबरेली' }), 'ग्राम भग्तिन खेड़ा थाना बछरावां जनपद रायबरेली');
  assert.equal(p.composeAddress({ house: 'मकान 12, गांधी नगर', village: 'बछरावां', villageKind: 'कस्बा', thana: 'थाना बछरावां', district: 'जनपद रायबरेली' }),
    'मकान 12, गांधी नगर कस्बा बछरावां थाना बछरावां जनपद रायबरेली');
  assert.equal(p.composeAddress({ village: 'ग्राम ऐहार', thana: '', district: '' }), 'ग्राम ऐहार');
  assert.equal(p.addrModeOf({ fullAddress: 'ग्राम ऐहार थाना बछरावां' }), 'free');
  assert.equal(p.addrModeOf({ fullAddress: '' }), 'parts');
  assert.equal(p.hasAddress({ addrMode: 'parts', thana: 'बछरावां', district: 'रायबरेली' }), false);
  assert.equal(p.hasAddress({ addrMode: 'parts', village: 'ऐहार' }), true);
});

test('old प्रार्थना पत्र columns ↔ card', () => {
  const a = p.partsFromColumns({ full_address: 'मकान 12', village: 'भग्तिन खेड़ा', police_station: 'बछरावां', district: 'रायबरेली' });
  assert.equal(a.addrMode, 'parts');
  assert.equal(a.fullAddress, 'मकान 12 ग्राम भग्तिन खेड़ा थाना बछरावां जनपद रायबरेली');
  assert.deepEqual(p.columnsFromCard(a), { full_address: 'मकान 12', village: 'भग्तिन खेड़ा', police_station: 'बछरावां', district: 'रायबरेली' });
  const b = p.partsFromColumns({ full_address: 'ग्राम भग्तिन खेड़ा थाना बछरावां', village: 'भग्तिन खेड़ा', police_station: 'बछरावां', district: 'रायबरेली' });
  assert.equal(b.addrMode, 'free');
  assert.equal(b.fullAddress, 'ग्राम भग्तिन खेड़ा थाना बछरावां जनपद रायबरेली');
  const c = p.partsFromColumns({ full_address: 'ग्राम ऐहार थाना बछरावां', village: '', police_station: '', district: '' });
  assert.equal(c.addrMode, 'free');
  assert.equal(c.fullAddress, 'ग्राम ऐहार थाना बछरावां');
});

test('PP row ↔ card round trip', () => {
  const card = p.cardFromPPRow({ id: 'x', name: 'रेनू', father: 'धीरज', relation: 'पत्नी', gender: 'महिला', full_address: '', village: 'ऐहार',
    police_station: 'बछरावां', district: 'रायबरेली', alternate_mobile: '9999999999', remarks: 'पहले भी', extra_json: '{"email":"a@b.in","idType":"आधार","idNumber":"1234"}' });
  assert.equal(card._id, 'x');
  assert.equal(card.fullAddress, 'ग्राम ऐहार थाना बछरावां जनपद रायबरेली');
  assert.equal(card.email, 'a@b.in');
  assert.equal(card.remarks, 'पहले भी');
  const back = p.ppRowFromCard(card, true);
  assert.equal(back.village, 'ऐहार');
  assert.equal(back.remarks, 'पहले भी');
  assert.deepEqual(JSON.parse(back.extra_json), { email: 'a@b.in', idType: 'आधार', idNumber: '1234' });
  const noRem = p.ppRowFromCard(card, false);
  assert.equal(JSON.parse(noRem.extra_json).remarks, 'पहले भी');
  assert.equal(p.ppRowFromCard({ ...card, email: '', idNumber: '', remarks: '' }, true).extra_json, '');
});

test('न्यायालय row ↔ group card (address column = full address, parts in extra_json)', () => {
  const card = {
    name: 'रामपाल', fatherOrHusbandName: 'श्यामलाल', relationType: 'पुत्र', gender: '', age: '42', mobile: '9876500001', caste: '',
    email: '', fullAddress: '', addrMode: 'parts' as const, house: '', village: 'ग्राम अघौरा', villageKind: 'ग्राम', thana: 'बछरावां',
    district: 'रायबरेली', altMobile: '', idType: 'आधार', idNumber: '1234', remarks: 'टिप',
  };
  const row = p.courtRowFromCard(card);
  assert.equal(row.address, 'ग्राम अघौरा थाना बछरावां जनपद रायबरेली');
  assert.equal(row.remarks, 'टिप');
  assert.equal(JSON.parse(row.extra_json).gender, 'पुरुष');
  const back = p.cardFromCourtRow({ id: 'x1', ...row });
  assert.equal(back._id, 'x1');
  assert.equal(back.fullAddress, row.address);
  assert.equal(back.relationType, 'पुत्र');
  assert.equal(back.idNumber, '1234');
  // old row: typed address kept as is ('free')
  const old = p.cardFromCourtRow({ name: 'क', father_name: 'ख', address: 'ग्राम बेला थाना सरेनी', mobile: '', remarks: '' });
  assert.equal(old.addrMode, 'free');
  assert.equal(old.fullAddress, 'ग्राम बेला थाना सरेनी');
  assert.equal(p.courtRowFromCard(old).address, 'ग्राम बेला थाना सरेनी');
});

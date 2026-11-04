import { test } from 'node:test';
import assert from 'node:assert/strict';
import { complainantToGroup, groupToComplainant } from '../src/lib/firComplainant.ts';

test('FIR वादी ↔ person card round trip', () => {
  const fir = { complainant_name: 'प्रतिमा', complainant_father: 'फूलचन्द्र', complainant_relation: 'पत्नी', complainant_gender: 'महिला',
    complainant_age: '32', complainant_jati: 'पासी', complainant_mobile: '+919876543210', complainant_address: 'ग्राम भग्तिन खेड़ा' };
  const back = groupToComplainant(complainantToGroup(fir));
  assert.deepEqual(back, { ...fir, complainant_mobile: '9876543210' });
});
test('old FIR without the new columns', () => {
  const g = JSON.parse(complainantToGroup({ complainant_name: 'राम', complainant_address: null }));
  assert.equal(g.length, 1);
  assert.equal(g[0].fatherOrHusbandName, '');
  assert.equal(groupToComplainant('').complainant_name, '');
});

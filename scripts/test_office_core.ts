/** InvestSuite कार्यालय — pure rules. Run: node --experimental-strip-types --test scripts/test_office_core.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as o from '../src/office/officeCore.ts';

test('member state: joined / code / expired / nocode', () => {
  const now = Date.parse('2026-11-16T10:00:00Z');
  const code = (d: string) => ({ member_id: 'm', code: '482913', expires_at: d });
  assert.equal(o.memberState({ user_id: 'u' }, undefined, now), 'joined');
  assert.equal(o.memberState({ user_id: null }, code('2026-11-20T10:00:00Z'), now), 'code');
  assert.equal(o.memberState({ user_id: null }, code('2026-11-15T10:00:00Z'), now), 'expired');
  assert.equal(o.memberState({ user_id: null }, undefined, now), 'nocode');
  assert.equal(o.daysLeft('2026-11-23T10:00:00Z', now), 7);
  assert.equal(o.daysLeft('2026-11-01T10:00:00Z', now), 0);
});

test('codes and mobiles', () => {
  assert.equal(o.spacedCode('482913'), '482 913');
  assert.equal(o.cleanCode('48 29-13 7'), '482913');
  assert.equal(o.cleanCode('४८२९१३'), '482913');
  assert.equal(o.cleanMobile('+91 98765 43210'), '9876543210');
  assert.equal(o.cleanMobile('09876543210'), '9876543210');
  assert.equal(o.cleanMobile('12345'), '');
});

test('WhatsApp invite: office vs officer wording, link', () => {
  assert.match(o.inviteText('cm', '482913', 'बछरावां', 'रायबरेली'), /"InvestSuite कार्यालय" app खोलें → "कोड से जुड़ें" → कोड 482913/);
  assert.match(o.inviteText('officer', '482913', 'बछरावां', 'रायबरेली'), /InvestSuite app खोलें → सेटिंग → "कार्यालय से जुड़ें"/);
  assert.ok(o.whatsappUrl('9876543210', 'a b').startsWith('https://wa.me/919876543210?text=a%20b'));
  assert.ok(o.whatsappUrl('', 'x').startsWith('https://wa.me/?text='));
});

test('form checks', () => {
  assert.equal(o.newThanaError({ thana: '', district: 'र', name: 'न', role: 'cm' }), 'थाने का नाम लिखें');
  assert.equal(o.newThanaError({ thana: 'ब', district: 'र', name: 'न', role: 'officer' }), 'पद चुनें — CM या HM');
  assert.equal(o.newThanaError({ thana: 'ब', district: 'र', name: 'न', role: 'hm', mobile: '123' }), 'मोबाइल 10 अंकों का लिखें');
  assert.equal(o.newThanaError({ thana: 'ब', district: 'र', name: 'न', role: 'hm', mobile: '' }), '');
  assert.equal(o.newMemberError({ role: 'officer', name: ' ' }), 'नाम लिखें');
  assert.equal(o.newMemberError({ role: 'officer', name: 'श्याम' }), '');
});

test('titles, initials, sort, errors', () => {
  assert.equal(o.memberTitle({ name: 'श्याम सिंह', rank: 'उ0नि0' }), 'उ0नि0 श्याम सिंह');
  assert.equal(o.memberTitle({ name: 'उ0नि0 श्याम', rank: 'उ0नि0' }), 'उ0नि0 श्याम');
  assert.equal(o.initials('राम कुमार'), 'रा');
  assert.equal(o.initials('उ0नि0 श्याम सिंह'), 'श्या');
  const s = o.sortMembers([
    { role: 'officer', name: 'ख', active: true }, { role: 'cm', name: 'क', active: true },
    { role: 'officer', name: 'ग', active: false }, { role: 'hm', name: 'ज', active: true },
  ]);
  assert.deepEqual(s.map((m) => m.name), ['क', 'ज', 'ख']);
  assert.match(o.friendlyError(new Error('TypeError: Network request failed')), /इंटरनेट/);
  assert.equal(o.friendlyError({ message: 'P0001: यह फ़ोन पहले से जुड़ा है' }), 'यह फ़ोन पहले से जुड़ा है');
});

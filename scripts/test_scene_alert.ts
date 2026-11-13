/** Run: node --experimental-strip-types --test scripts/test_scene_alert.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const { scenePending, sceneDue, planSceneAlerts, sceneAlertText } = await import('../src/lib/sceneAlert.ts');
const { buildNoticeCards, noticeBadgeCount } = await import('../src/lib/noticeCards.ts');

const row = (extra: object = {}) => ({ firId: 'f1', fir_number: '0456/2026', date_of_information: '2026-11-01', sub_steps_json: '{}', ...extra });

test('pending until ई-साक्ष्य + नक्शा नजरी; optional parts do not matter', () => {
  assert.equal(scenePending(row())!.done, 0);
  assert.equal(scenePending(row({ sub_steps_json: JSON.stringify({ esakshya: { done: true }, naksha: { done: true } }) })), null);
  assert.equal(scenePending(row({ sub_steps_json: JSON.stringify({ nir: { done: true }, sur: { done: true }, photo: { done: true }, naksha: { done: true } }) }))!.done, 1);
  assert.equal(scenePending(row({ date_of_information: null, created_at: new Date(2026, 10, 2).getTime() / 1000 }))!.base.getDate(), 2);
});

test('due from day 3 to day 30', () => {
  assert.equal(sceneDue([row()], new Date(2026, 10, 3)).length, 0);
  assert.equal(sceneDue([row()], new Date(2026, 10, 4)).length, 1);
  assert.equal(sceneDue([row()], new Date(2026, 11, 1)).length, 1);
  assert.equal(sceneDue([row()], new Date(2026, 11, 2)).length, 0);
});

test('phone alert 9 AM; one FIR → its karyvahi tab, many → सूचनाएँ', () => {
  const a = planSceneAlerts([row()], new Date(2026, 10, 2, 10));
  assert.equal(a[0].at.getDate(), 4);
  assert.equal(a[0].at.getHours(), 9);
  assert.equal(a[0].route, '/(app)/mukadma/f1/karyvahi');
  assert.match(a[0].title, /घटनास्थल की कार्यवाही लंबित — मु0अ0सं0 0456\/2026/);
  assert.match(a[0].body, /3 दिन हो गये.*बाकी: ई-साक्ष्य से फोटो-वीडियोग्राफी, नक्शा नजरी/);
  const day = new Date(2026, 10, 5);
  assert.equal(sceneAlertText(sceneDue([row(), row({ firId: 'f2', fir_number: '12/2026' })], day), day).route, '/(app)/notifications');
});

test('सूचनाएँ card + bell; red from day 7', () => {
  const c = buildNoticeCards({ scene: [row()] }, new Date(2026, 10, 4, 12));
  assert.equal(c[0].kind, 'scene');
  assert.equal(c[0].level, 'warn');
  assert.equal(c[0].progress!.label, '0/2');
  assert.equal(noticeBadgeCount(c), 1);
  assert.equal(buildNoticeCards({ scene: [row()] }, new Date(2026, 10, 8))[0].level, 'over');
});

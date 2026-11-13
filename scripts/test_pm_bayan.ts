/** Run: node --experimental-strip-types --test scripts/test_pm_bayan.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// imports without an extension (Metro style) → let Node find the .ts file
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const { pmBayanPending, pmBayanDue, planPmBayanAlerts, pmBayanAlertText } = await import('../src/lib/pmBayan.ts');
const { buildNoticeCards, noticeBadgeCount } = await import('../src/lib/noticeCards.ts');

const subs = (o: Record<string, object>) => JSON.stringify(o);
const row = (extra: object = {}) => ({
  firId: 'f1', fir_number: '0456/2026',
  sub_steps_json: subs({ pan: { done: true, by: 'auto', parcha: '01', at: new Date(2026, 10, 1, 15).getTime() }, pm: { done: true, by: 'auto' } }),
  last_values_json: JSON.stringify({ PanDate: '02.11.2026' }),
  ...extra,
});

test('pending only when पंचायतनामा done and not 6/6; base = PanDate else tick day', () => {
  const p = pmBayanPending(row())!;
  assert.equal(p.base.getDate(), 2);
  assert.equal(p.done, 2);
  assert.match(p.remaining, /^बाकी: बयान उ0नि0/);
  assert.equal(pmBayanPending(row({ last_values_json: '' }))!.base.getDate(), 1);
  assert.equal(pmBayanPending(row({ sub_steps_json: subs({ pm: { done: true } }) })), null);
  const all = Object.fromEntries(['pan', 'pm', 'si', 'co', 'panch', 'doc'].map((k) => [k, { done: true, at: 1 }]));
  assert.equal(pmBayanPending(row({ sub_steps_json: subs(all) })), null);
  assert.equal(pmBayanPending(row({ sub_steps_json: subs({ pan: { done: true, by: 'old' } }) })), null);
});

test('due from day 7', () => {
  assert.equal(pmBayanDue([row()], new Date(2026, 10, 8)).length, 0);
  assert.equal(pmBayanDue([row()], new Date(2026, 10, 9)).length, 1);
});

test('phone alerts: 9 AM daily from day 7; one FIR → its karyvahi tab, many → सूचनाएँ', () => {
  const a = planPmBayanAlerts([row()], new Date(2026, 10, 7, 10));
  assert.equal(a[0].at.getDate(), 9);
  assert.equal(a[0].at.getHours(), 9);
  assert.equal(a[0].route, '/(app)/mukadma/f1/karyvahi');
  assert.match(a[0].title, /मु0अ0सं0 0456\/2026/);
  assert.match(a[0].body, /7 दिन हो गये, अभी 2\/6 पूरे/);
  const two = pmBayanAlertText(pmBayanDue([row(), row({ firId: 'f2', fir_number: '12/2026' })], new Date(2026, 10, 10)), new Date(2026, 10, 10));
  assert.equal(two.route, '/(app)/notifications');
  assert.match(two.title, /\(2\)/);
});

test('सूचनाएँ card + bell count; red after 15 days', () => {
  const c = buildNoticeCards({ pmBayan: [row()] }, new Date(2026, 10, 9, 12));
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, 'pm');
  assert.equal(c[0].level, 'warn');
  assert.equal(c[0].progress!.label, '2/6');
  assert.equal(noticeBadgeCount(c), 1);
  assert.equal(buildNoticeCards({ pmBayan: [row()] }, new Date(2026, 10, 17))[0].level, 'over');
  assert.equal(buildNoticeCards({ pmBayan: [row()] }, new Date(2026, 10, 5)).length, 0);
});

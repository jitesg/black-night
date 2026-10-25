/** Run: node --experimental-strip-types --test scripts/test_deadline_alerts.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const { planDeadlineAlerts } = await import('../src/lib/deadlineAlerts.ts');

const day = (a: { at: Date }) => `${a.at.getDate()}@${a.at.getHours()}`;

test('normal: 2 / 1 / 0 days before at 9 AM, then daily while overdue', () => {
  const a = planDeadlineAlerts({ petitions: [{ id: 'p1', registration_number: '5/26', petition_type: 'जनता दर्शन', deadline_date: '2026-11-10' }] }, new Date(2026, 9, 25, 10));
  assert.deepEqual(a.map(day), ['8@9', '9@9', '10@9', '11@9', '12@9', '13@9', '14@9', '15@9']);
  assert.match(a[0].card.body, /जाँच आख्या की अंतिम तिथि 10\.11\.2026 है — 2 दिन बाकी/);
  assert.match(a[2].card.body, /अंतिम तिथि आज/);
  assert.match(a[3].card.body, /1 दिन पहले निकल चुकी/);
  assert.equal(a[0].card.route, '/(app)/prarthna-patra/p1');
});

test('High Court: 5 / 3 / 1 / 0 days before', () => {
  const a = planDeadlineAlerts({ courtDocs: [{ id: 'c1', registration_number: '13/26', doc_type: 'High_Court_Documents', sub_type: 'Bail', deadline_date: '2026-11-10' }] }, new Date(2026, 9, 25, 10));
  assert.deepEqual(a.slice(0, 4).map(day), ['5@9', '7@9', '9@9', '10@9']);
  assert.match(a[0].card.title, /हाईकोर्ट दस्तावेज़ \(जमानत\) — सं0 13\/26/);
});

test('already overdue: from the next 9 AM, daily', () => {
  const a = planDeadlineAlerts({ courtDocs: [{ id: 'c2', registration_number: '12/26', doc_type: 'NBW', deadline_date: '2026-10-20' }] }, new Date(2026, 9, 25, 10));
  assert.deepEqual(a.map(day), ['26@9', '27@9', '28@9', '29@9', '30@9']);
  assert.match(a[0].card.body, /6 दिन पहले निकल चुकी/);
});

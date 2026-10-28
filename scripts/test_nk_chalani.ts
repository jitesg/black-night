/**
 * Tests for "चलानी प्रेषण लंबित" (src/lib/nkChalani.ts + the सूचनाएँ card).
 * Run: node --experimental-strip-types --test scripts/test_nk_chalani.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const { planNkAlerts, nkAlertText } = await import('../src/lib/nkChalani.ts');
const { buildNoticeCards, noticeBadgeCount } = await import('../src/lib/noticeCards.ts');

const today = new Date(2026, 9, 28, 14, 0);
const rowToday = { id: 'a', village: 'ग्राम चमन गंज', proceeding_type: 'बीट सूचना', proceeding_date: '2026-10-28' };
const rowOld = { id: 'b', village: 'ग्राम करनपुर', proceeding_type: 'मुकदमा', proceeding_date: '2026-10-20' };

test('a karyvahi made today alerts from tomorrow 9 AM, once a day', () => {
  const alerts = planNkAlerts([rowToday], today);
  assert.equal(alerts.length, 5);
  assert.equal(alerts[0].at.getDate(), 29);
  assert.equal(alerts[0].at.getHours(), 9);
  assert.match(alerts[0].title, /चलानी प्रेषण लंबित — ग्राम चमन गंज/);
});

test('several pending → one summary per day with the count', () => {
  const alerts = planNkAlerts([rowToday, rowOld], new Date(2026, 9, 28, 7, 0));
  assert.equal(alerts[0].at.getDate(), 28);           // today 9 AM: only the old one is due
  assert.match(alerts[0].title, /ग्राम करनपुर/);
  assert.equal(alerts[1].title, 'चलानी प्रेषण लंबित (2)');
});

test('nothing pending → no alerts', () => {
  assert.deepEqual(planNkAlerts([], today), []);
});

test('text has village only (no names)', () => {
  const t = nkAlertText([rowOld]);
  assert.match(t.body, /ग्राम करनपुर की निरोधात्मक कार्यवाही \(दिनांक 20\.10\.2026\)/);
});

test('सूचनाएँ card per pending karyvahi, counted on the bell', () => {
  const cards = buildNoticeCards({ nkPending: [rowOld] }, today);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].kind, 'nk');
  assert.equal(cards[0].when, '8 दिन');
  assert.equal(cards[0].route, '/(app)/nirodhatmak');
  assert.equal(noticeBadgeCount(cards), 1);
});

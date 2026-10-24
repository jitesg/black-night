/** Run: node --experimental-strip-types --test scripts/test_case_diary_gap.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalDate, daysBetween, cdGapDays, planCdAlerts, cdAlertText, gapBase } from '../src/lib/caseDiaryGap.ts';

const fir = (o: Record<string, unknown> = {}) => ({ id: 'f1', fir_number: '123/26', section: '115(2) BNS', date_of_information: '2026-10-01', created_at: 0, last_diary_date: '2026-10-10', ...o });

test('date parsing', () => {
  assert.equal(parseLocalDate('2026-10-24')?.getDate(), 24);
  assert.equal(parseLocalDate('24.10.2026')?.getMonth(), 9);
  assert.equal(parseLocalDate(''), null);
  assert.equal(daysBetween(new Date(2026, 9, 10), new Date(2026, 9, 17, 23)), 7);
});

test('gap counts from the last diary, else from the FIR date', () => {
  const now = new Date(2026, 9, 20, 12);
  assert.equal(cdGapDays(fir(), now), 10);
  assert.equal(cdGapDays(fir({ last_diary_date: null }), now), 19);
  assert.equal(gapBase(fir({ last_diary_date: null }))?.hasDiary, false);
});

test('first alert on day 7 at 9 AM, then daily', () => {
  const a = planCdAlerts([fir()], new Date(2026, 9, 12, 10));
  assert.equal(a.length, 5);
  assert.deepEqual([a[0].at.getDate(), a[0].at.getHours(), a[0].days], [17, 9, 7]);
  assert.equal(a[1].at.getDate(), 18);
});

test('overdue: next 9 AM still ahead (today before 9, else tomorrow)', () => {
  assert.equal(planCdAlerts([fir()], new Date(2026, 9, 20, 8))[0].at.getDate(), 20);
  const a = planCdAlerts([fir()], new Date(2026, 9, 20, 11));
  assert.equal(a[0].at.getDate(), 21);
  assert.equal(a[0].days, 11);
});

test('message text: last diary date, 15-day warning, no names', () => {
  const base = { date: new Date(2026, 9, 10), hasDiary: true };
  const t = cdAlertText(fir(), base, 9);
  assert.match(t.title, /123\/26/);
  assert.match(t.body, /10\.10\.2026 को कटी है/);
  assert.match(t.body, /नियमित तौर पर पर्चा/);
  assert.doesNotMatch(t.body, /15 दिन/);
  assert.match(cdAlertText(fir(), base, 16).body, /15 दिन की सीमा पार/);
  assert.match(cdAlertText(fir(), { date: base.date, hasDiary: false }, 8).body, /कोई केस डायरी/);
});

test('total is capped', () => {
  const many = Array.from({ length: 40 }, (_, i) => fir({ id: `f${i}` }));
  assert.equal(planCdAlerts(many, new Date(2026, 9, 12)).length, 60);
});

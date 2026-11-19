/** Home मेरी उत्पादकता rules. Run: node --experimental-strip-types --test scripts/test_productivity.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProductivity, dayStart, rowPct } from '../src/lib/productivity.ts';

const ts = (y: number, m: number, d: number) => Math.floor(new Date(y, m - 1, d, 10).getTime() / 1000);
const WEEK = Math.floor(new Date(2026, 10, 16).getTime() / 1000);   // Mon 16/11/2026
const MONTH = Math.floor(new Date(2026, 10, 1).getTime() / 1000);   // 01/11/2026

test('मिले / निस्तारित per module and period', () => {
  const firs = [
    { created_at: ts(2026, 11, 17), status: 'Pending' },
    { created_at: ts(2026, 11, 5), status: 'Finished', finished_at: ts(2026, 11, 18) },
    { created_at: ts(2026, 10, 1), status: 'Finished', updated_at: ts(2026, 11, 3) }, // old row: updated_at fallback
  ];
  const courts = [{ created_at: ts(2026, 11, 2), status: 'Finished', finished_at: ts(2026, 11, 2) }];
  const pps = [
    { date_of_receipt: '2026-11-18', created_at: ts(2026, 11, 18), status: 'Pending' },
    { date_of_receipt: '2026-10-28', created_at: ts(2026, 11, 1), status: 'Nistarit', disposal_date: '2026-11-17' },
  ];
  const s = computeProductivity(firs, courts, pps, WEEK, MONTH);
  assert.deepEqual(s.week.fir, { got: 1, done: 1 });
  assert.deepEqual(s.month.fir, { got: 2, done: 2 });
  assert.deepEqual(s.week.court, { got: 0, done: 0 });
  assert.deepEqual(s.month.court, { got: 1, done: 1 });
  // received = date_of_receipt (28/10 is last month even though entered 01/11)
  assert.deepEqual(s.month.pp, { got: 1, done: 1 });
  assert.equal(s.month.got, 4);
  assert.equal(s.month.done, 4);
  assert.equal(s.month.pct, 100);
  assert.equal(rowPct({ got: 0, done: 0 }), 0);
  assert.equal(rowPct({ got: 8, done: 5 }), 63);
  assert.equal(rowPct({ got: 1, done: 3 }), 100); // more निपटाए than मिले (old papers) → capped
  assert.equal(dayStart('x'), null);
});

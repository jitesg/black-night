import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nkMatchesFilters } from '../src/lib/nirodhatmak/nkFilter.ts';

const now = new Date(2026, 10, 5);
const r = (date: string, ck = '{}', type = 'Beat Information') => ({ proceeding_date: date, checklist_json: ck, proceeding_type: type });
test('type / date / status', () => {
  assert.equal(nkMatchesFilters(r('2026-11-05'), { type: 'Beat Information' }, now), true);
  assert.equal(nkMatchesFilters(r('2026-11-05'), { type: 'Case' }, now), false);
  assert.equal(nkMatchesFilters(r('05.11.2026'), { date: 'today' }, now), true);
  assert.equal(nkMatchesFilters(r('2026-10-31'), { date: 'week' }, now), true);
  assert.equal(nkMatchesFilters(r('2026-10-29'), { date: 'week' }, now), false);
  assert.equal(nkMatchesFilters(r('2026-10-29'), { date: 'month' }, now), false);
  assert.equal(nkMatchesFilters(r('2026-11-01'), { status: 'pending' }, now), true);
  assert.equal(nkMatchesFilters(r('2026-11-01', '{"prashit":true}'), { status: 'pending' }, now), false);
  assert.equal(nkMatchesFilters(r('2026-11-01', '{"prashit":true}'), { status: 'incomplete' }, now), true);
  assert.equal(nkMatchesFilters(r('2026-11-01', '{"prashit":true,"notice":true,"tamil":true}'), { status: 'done' }, now), true);
  assert.equal(nkMatchesFilters(r('2026-11-01'), {}, now), true);
});
test('date range (से – तक)', () => {
  const f = (from: string | null, to: string | null) => ({ date: 'range', from, to });
  assert.equal(nkMatchesFilters(r('2026-11-03'), f('2026-11-01', '2026-11-04'), now), true);
  assert.equal(nkMatchesFilters(r('2026-11-01'), f('2026-11-01', '2026-11-04'), now), true);
  assert.equal(nkMatchesFilters(r('2026-11-04'), f('2026-11-01', '2026-11-04'), now), true);
  assert.equal(nkMatchesFilters(r('2026-11-05'), f('2026-11-01', '2026-11-04'), now), false);
  assert.equal(nkMatchesFilters(r('2026-10-31'), f('2026-11-01', '2026-11-04'), now), false);
  assert.equal(nkMatchesFilters(r('2026-11-03'), f('2026-11-04', '2026-11-01'), now), true); // swapped
  assert.equal(nkMatchesFilters(r('2026-11-05'), f('2026-11-01', null), now), true);
  assert.equal(nkMatchesFilters(r('2026-11-06'), f('2026-11-01', null), now), false); // only से → up to today
  assert.equal(nkMatchesFilters(r('2025-01-01'), f(null, '2026-10-01'), now), true);
  assert.equal(nkMatchesFilters(r('2026-10-02'), f(null, '2026-10-01'), now), false);
  assert.equal(nkMatchesFilters(r('02.11.2026'), f('2026-11-01', '2026-11-04'), now), true);
});

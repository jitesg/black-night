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

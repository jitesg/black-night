// node --experimental-strip-types --test scripts/test_knowledge_visits.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addVisit, parseVisits, toggleSaved, isSaved, RECENT_MAX } from '../src/lib/knowledge/knowledgeVisitsCore.ts';

const v = (n: number) => ({ route: `/(app)/knowledge/law/BNS/${n}`, label: `BNS ${n}`, title: '', color: '#DC2626', at: n });

test('recent: newest first, one per route, capped', () => {
  let l = addVisit([], v(1));
  l = addVisit(l, v(2));
  l = addVisit(l, v(1));
  assert.deepEqual(l.map((x) => x.label), ['BNS 1', 'BNS 2']);
  for (let i = 10; i < 40; i++) l = addVisit(l, v(i));
  assert.equal(l.length, RECENT_MAX);
  assert.equal(l[0].label, 'BNS 39');
});

test('bad stored data never breaks', () => {
  assert.deepEqual(parseVisits('not json'), []);
  assert.deepEqual(parseVisits('{"a":1}'), []);
  const l = parseVisits(JSON.stringify([v(5), { route: 'x', label: 'y' }, { route: '/a', label: '' }, { route: '/b', label: 'B', color: 'red' }]));
  assert.deepEqual(l.map((x) => x.label), ['BNS 5', 'B']);
  assert.equal(l[1].color, '#0F766E');
});

test('saved toggle', () => {
  let s = toggleSaved([], v(103));
  assert.equal(isSaved(s, v(103).route), true);
  s = toggleSaved(s, v(103));
  assert.equal(s.length, 0);
});

test('SOPs in progress', async () => {
  const { sopsInProgress } = await import('../src/lib/knowledge/knowledgeVisitsCore.ts');
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const steps = (i: { id: string }) => (i.id === 'd' ? null : { sopId: `s-${i.id}`, total: 10 });
  const done = new Map([['s-a', 3], ['s-b', 10], ['s-c', 7]]);
  assert.deepEqual(sopsInProgress(items, steps, done).map((x) => `${x.item.id}:${x.done}`), ['c:7', 'a:3']);
});

test('crime type grid (part 7)', async () => {
  const { crimeTypeCounts, itemsOfCrime, crimeEmoji } = await import('../src/lib/knowledge/crimeTypeGrid.ts');
  const items = [
    { id: 1, pairs: [{ crimeType: 'murder' }, { crimeType: 'murder' }, { crimeType: 'theft' }] },
    { id: 2, pairs: [{ crimeType: 'theft' }] },
    { id: 3, pairs: [] },
  ];
  assert.deepEqual(crimeTypeCounts(items), [{ id: 'theft', count: 2 }, { id: 'murder', count: 1 }]);
  assert.deepEqual(itemsOfCrime(items, 'murder').map((i) => i.id), [1]);
  assert.equal(itemsOfCrime(items, null).length, 3);
  assert.equal(crimeEmoji('road_accident'), '🚗');
  assert.equal(crimeEmoji('x'), '📋');
});

test('circular month groups (part 8)', async () => {
  const { circularRows, withGroupHeads, isRecent, circularDate } = await import('../src/lib/knowledge/knowledgeGroups.ts');
  const rows = circularRows([
    { id: 'a', last_updated: '2013-01-13' }, { id: 'b', last_updated: '2013-03-02' }, { id: 'c', last_updated: '2013-03-20' }, { id: 'd' },
  ]);
  assert.deepEqual(rows.map((r) => (r.kind === 'head' ? `#${r.label}(${r.count})` : r.item.id)),
    ['#मार्च 2013(2)', 'c', 'b', '#जनवरी 2013(1)', 'a', '#तारीख नहीं(1)', 'd']);
  assert.deepEqual(circularDate({ created_at: 1700000000 })?.y, 2023);
  const now = new Date(2026, 10, 27).getTime();
  assert.equal(isRecent({ last_updated: '2026-11-25' }, now), true);
  assert.equal(isRecent({ last_updated: '2026-10-01' }, now), false);
  assert.equal(withGroupHeads([{ id: 'x' }], () => ({ key: 'k', label: 'L' })).length, 2);
});

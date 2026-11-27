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

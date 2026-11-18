/**
 * ⚙︎ filter of the "प्रारूप चुनें" screens (owner). Run: node --experimental-strip-types --test scripts/test_format_pick_filter.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFilterGroups, applyPickFilters } from '../src/lib/formatPickFilter.ts';

const L = [
  { id: 'a', format_type: 'Prarthna Patra', source: 'system', is_favorite: 1, last_used_at: 10 },
  { id: 'b', format_type: 'Prarthna Patra', source: 'system', is_favorite: 0, last_used_at: 30 },
  { id: 'c', format_type: 'BNSS Karyavahi', source: 'user', is_favorite: 0, last_used_at: null },
];
const label = (t: string) => (t === 'Prarthna Patra' ? 'प्रार्थना पत्र' : 'BNSS कार्यवाही');

test('groups: प्रकार only with 2+ types, counts in labels', () => {
  const g = pickFilterGroups(L, label);
  assert.deepEqual(g.map((x) => x.key), ['type', 'show', 'source']);
  assert.deepEqual(g[0].options.map((o) => o.label), ['प्रार्थना पत्र (2)', 'BNSS कार्यवाही (1)']);
  assert.equal(g[1].options[0].label, '⭐ पसंदीदा (1)');
  assert.equal(g[2].options[1].label, '👤 मेरे बनाए (1)');
  assert.deepEqual(pickFilterGroups(L.slice(0, 2), label).map((x) => x.key), ['show', 'source']);
});

test('apply: type / source / favourite / recent (newest first)', () => {
  assert.deepEqual(applyPickFilters(L, { type: 'Prarthna Patra' }).map((f) => f.id), ['a', 'b']);
  assert.deepEqual(applyPickFilters(L, { source: 'mine' }).map((f) => f.id), ['c']);
  assert.deepEqual(applyPickFilters(L, { show: 'fav' }).map((f) => f.id), ['a']);
  assert.deepEqual(applyPickFilters(L, { show: 'recent' }).map((f) => f.id), ['b', 'a']);
  assert.deepEqual(applyPickFilters(L, {}).map((f) => f.id), ['a', 'b', 'c']);
});

test('न्यायालय tag mode: "<tag> वाले" / "बाकी"', () => {
  const first = { ids: new Set(['a']), label: 'NBW वाले' };
  const g = pickFilterGroups(L, label, first);
  assert.deepEqual(g[0].options.map((o) => o.label), ['NBW वाले (1)', 'बाकी (2)']);
  assert.deepEqual(applyPickFilters(L, { type: g[0].options[0].value }, first).map((f) => f.id), ['a']);
  assert.deepEqual(applyPickFilters(L, { type: g[0].options[1].value }, first).map((f) => f.id), ['b', 'c']);
});

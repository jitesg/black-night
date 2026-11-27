// node --experimental-strip-types --test scripts/test_hardware_keys.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _resetSearchTargets, addSearchTarget, focusCurrentSearch } from '../src/lib/searchFocusRegistry.ts';

test('Ctrl+F opens the current (last added) screen search box', () => {
  _resetSearchTargets();
  const hits: string[] = [];
  assert.equal(focusCurrentSearch(), false, 'no box → nothing');
  const offHome = addSearchTarget({ focus: () => hits.push('home') });
  const offList = addSearchTarget({ focus: () => hits.push('list') });
  assert.equal(focusCurrentSearch(), true);
  assert.deepEqual(hits, ['list']);
  offList(); offList();
  focusCurrentSearch();
  assert.deepEqual(hits, ['list', 'home'], 'back on Home → its box');
  offHome();
  assert.equal(focusCurrentSearch(), false);
});

test('a box that is gone is skipped', () => {
  _resetSearchTargets();
  const hits: string[] = [];
  addSearchTarget({ focus: () => hits.push('a') });
  addSearchTarget({ focus: () => { throw new Error('gone'); } });
  assert.equal(focusCurrentSearch(), true);
  assert.deepEqual(hits, ['a']);
});

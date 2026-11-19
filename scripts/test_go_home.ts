// node --experimental-strip-types --test scripts/test_go_home.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previousIsHome, type NavLike } from '../src/lib/navHome.ts';

const nav = (state: unknown, parent?: NavLike): NavLike => ({ getState: () => state as never, getParent: () => parent });

test('module opened from Home (nested stack) → back', () => {
  const app = nav({ index: 1, routes: [{ name: 'home' }, { name: 'prarthna-patra' }] });
  assert.equal(previousIsHome(nav({ index: 0, routes: [{ name: 'index' }] }, app)), true);
});
test('module opened from the drawer (Home replaced) → old replace', () => {
  const app = nav({ index: 0, routes: [{ name: 'gd' }] });
  assert.equal(previousIsHome(nav({ index: 0, routes: [{ name: 'index' }] }, app)), false);
});
test('opened from सूचनाएँ → not Home', () => {
  assert.equal(previousIsHome(nav({ index: 2, routes: [{ name: 'home' }, { name: 'notifications' }, { name: 'nyayalay' }] })), false);
});
test('broken / missing state never throws', () => {
  assert.equal(previousIsHome(undefined), false);
  assert.equal(previousIsHome(nav(undefined)), false);
  assert.equal(previousIsHome(nav({ index: 1, routes: [] })), false);
});

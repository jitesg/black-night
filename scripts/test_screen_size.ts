// node --experimental-strip-types --test scripts/test_screen_size.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeTwoColumns, isLargeScreen, sidePadding } from '../src/lib/screenSize.ts';

test('phones stay portrait, tablets / opened foldables may turn', () => {
  assert.equal(isLargeScreen(411, 915), false, 'normal phone');
  assert.equal(isLargeScreen(915, 411), false, 'phone held sideways is still a phone');
  assert.equal(isLargeScreen(600, 960), true, '7" tablet');
  assert.equal(isLargeScreen(1280, 800), true, '10" tablet landscape');
  assert.equal(isLargeScreen(673, 841), true, 'opened foldable');
  assert.equal(isLargeScreen(0, 0), false);
  assert.equal(isLargeScreen(Number.NaN, 900), false);
});

test('tablet layout: A = centred 720 dp, Home B = two columns when lying', () => {
  assert.equal(sidePadding(411, 915), 0, 'phone unchanged');
  assert.equal(sidePadding(915, 411), 0, 'phone sideways unchanged');
  assert.equal(sidePadding(1280, 800), 280, 'tablet lying → 720 in the middle');
  assert.equal(sidePadding(800, 1280), 40, 'tablet standing');
  assert.equal(sidePadding(700, 1000), 0, 'narrower than 720 → full width');
  assert.equal(sidePadding(1280, 800, 1040), 120, 'home two columns');
  assert.equal(homeTwoColumns(1280, 800), true);
  assert.equal(homeTwoColumns(800, 1280), false, 'tablet standing → one column');
  assert.equal(homeTwoColumns(915, 411), false, 'phone sideways never');
});

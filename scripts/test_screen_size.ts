// node --experimental-strip-types --test scripts/test_screen_size.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLargeScreen } from '../src/lib/screenSize.ts';

test('phones stay portrait, tablets / opened foldables may turn', () => {
  assert.equal(isLargeScreen(411, 915), false, 'normal phone');
  assert.equal(isLargeScreen(915, 411), false, 'phone held sideways is still a phone');
  assert.equal(isLargeScreen(600, 960), true, '7" tablet');
  assert.equal(isLargeScreen(1280, 800), true, '10" tablet landscape');
  assert.equal(isLargeScreen(673, 841), true, 'opened foldable');
  assert.equal(isLargeScreen(0, 0), false);
  assert.equal(isLargeScreen(Number.NaN, 900), false);
});

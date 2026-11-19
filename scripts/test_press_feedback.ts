// node --experimental-strip-types --test scripts/test_press_feedback.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressFeedback } from '../src/lib/pressFeedback.ts';

const base = { android: true, hasPress: true, ownRipple: false };

test('rounded card / button / chip → ripple + shrink', () => {
  assert.deepEqual(pressFeedback({ ...base, style: { borderRadius: 16, padding: 12 } }), { ripple: true, scale: true });
  assert.deepEqual(pressFeedback({ ...base, style: { flex: 1, borderRadius: 12 } }), { ripple: true, scale: true });
});
test('full-width list row (no radius) → ripple only', () => {
  assert.deepEqual(pressFeedback({ ...base, style: { paddingVertical: 10, borderBottomWidth: 1 } }), { ripple: true, scale: false });
});
test('backdrops / absolute layers → nothing', () => {
  assert.deepEqual(pressFeedback({ ...base, style: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' } }), { ripple: false, scale: false });
  assert.deepEqual(pressFeedback({ ...base, style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } }), { ripple: false, scale: false });
});
test('own ripple, own transform, style function, disabled, no press, iOS', () => {
  assert.deepEqual(pressFeedback({ ...base, ownRipple: true, style: { borderRadius: 8 } }), { ripple: false, scale: true });
  assert.deepEqual(pressFeedback({ ...base, style: { borderRadius: 8, transform: [{ rotate: '45deg' }] } }), { ripple: true, scale: false });
  assert.deepEqual(pressFeedback({ ...base, style: 'fn' }), { ripple: true, scale: false });
  assert.deepEqual(pressFeedback({ ...base, disabled: true, style: { borderRadius: 8 } }), { ripple: false, scale: false });
  assert.deepEqual(pressFeedback({ ...base, hasPress: false, style: { borderRadius: 8 } }), { ripple: false, scale: false });
  assert.deepEqual(pressFeedback({ ...base, android: false, style: { borderRadius: 8 } }), { ripple: false, scale: false });
});

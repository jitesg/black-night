/** Run: node --experimental-strip-types --test scripts/test_karyvahi_sub_steps.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPmKaryvahi, parseSubSteps, subStepProgress, toggleSubStep, subStepNote, remainingText, PM_SUB_STEPS,
} from '../src/lib/karyvahiSubSteps.ts';

test('which karyvahis get the checklist', () => {
  assert.ok(isPmKaryvahi({ step_code: 'RTA_PM_DEATH', name: 'x' }));
  assert.ok(isPmKaryvahi({ step_code: 'MUR_INQUEST', name: 'शव की पहचान/पंचायतनामा' }));
  assert.ok(isPmKaryvahi({ name: 'मृतक का पंचनामा व पोस्टमार्टम' }));
  assert.ok(isPmKaryvahi({ name: 'मृतक का पंचनामा व शव परीक्षण' }));
  assert.ok(!isPmKaryvahi({ name: 'जब्ती पंचनामा व पोस्टमार्टम' }));
  assert.ok(!isPmKaryvahi({ name: 'पोस्टमार्टम हेतु शव भेजना', step_code: 'MUR_PM_SEND' }));
  assert.ok(!isPmKaryvahi({ name: 'वादी/वादिनी का बयान' }));
});

test('parse is safe and keeps only known done parts', () => {
  assert.deepEqual(parseSubSteps(null), {});
  assert.deepEqual(parseSubSteps('{bad'), {});
  assert.deepEqual(parseSubSteps('[]'), {});
  const m = parseSubSteps(JSON.stringify({ pan: { done: true, parcha: '03' }, xx: { done: true }, pm: { done: false } }));
  assert.deepEqual(Object.keys(m), ['pan']);
});

test('progress, toggle, notes, remaining', () => {
  let m = {};
  assert.equal(subStepProgress(m).done, 0);
  assert.equal(subStepProgress(m).total, 6);
  m = toggleSubStep(m, 'pan', 1);
  m = { ...m, pm: { done: true, by: 'auto', parcha: '03' } };
  const p = subStepProgress(m);
  assert.equal(p.done, 2);
  assert.ok(!p.complete);
  assert.equal(subStepNote(m.pan), 'स्वयं ✓');
  assert.equal(subStepNote(m.pm), 'पर्चा 03');
  assert.equal(remainingText(m), 'बाकी: बयान उ0नि0, बयान आरक्षी, बयान पंच गवाहान, बयान चिकित्सक');
  m = toggleSubStep(m, 'pm');
  assert.equal(subStepProgress(m).done, 1);
  assert.equal(toggleSubStep(m, 'nope'), m);
  for (const s of PM_SUB_STEPS) m = { ...m, [s.id]: { done: true } };
  assert.ok(subStepProgress(m).complete);
  assert.equal(remainingText(m), '');
});

/**
 * न्यायालय के नाम — सुझाव (owner). Run: node --experimental-strip-types --test scripts/test_court_names.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const { COURT_NAMES, matchCourtNames, addCustomCourt, isCourtKey } = await import('../src/lib/courtNames.ts');
const { tidyRepeats } = await import('../src/lib/templateEngine.ts');

test('owner list = 24 names, no repeats', () => {
  assert.equal(COURT_NAMES.length, 24);
  assert.equal(new Set(COURT_NAMES).size, 24);
});

test('match: words anywhere, English, own names first', () => {
  const n = (q: string, c: string[] = []) => matchCourtNames(q, c).map((h) => h.name);
  assert.deepEqual(n('cjm'), ['श्रीमान मुख्य न्यायिक मजिस्ट्रेट (CJM)', 'श्रीमान अपर मुख्य न्यायिक मजिस्ट्रेट (ACJM)', 'श्रीमान विशेष मुख्य न्यायिक मजिस्ट्रेट (Special CJM)']);
  assert.ok(n('पाक्सो').length === 0);
  assert.deepEqual(n('pocso'), ['श्रीमान विशेष न्यायाधीश (POCSO Act)']);
  assert.deepEqual(n('परिवार अपर'), ['श्रीमान अपर प्रधान न्यायाधीश, परिवार न्यायालय']);
  const own = matchCourtNames('pocso', ['श्रीमान विशेष न्यायाधीश (POCSO Act) कोर्ट सं0 3']);
  assert.deepEqual(own.map((h) => h.custom), [true, false]);
  assert.equal(matchCourtNames('विशेष', []).length, 6);
  assert.deepEqual(n(''), []);
  assert.deepEqual(n('श्रीमान रेलवे मजिस्ट्रेट'), []); // already in the box
});

test('own names: new on top, list names / short text skipped, max 30', () => {
  assert.deepEqual(addCustomCourt([], 'श्रीमान श्रम न्यायालय'), []);
  assert.deepEqual(addCustomCourt([], 'abc'), []);
  assert.deepEqual(addCustomCourt(['क कोर्ट सं0 1'], '  ख  कोर्ट सं0 2 '), ['ख कोर्ट सं0 2', 'क कोर्ट सं0 1']);
  assert.deepEqual(addCustomCourt(['क कोर्ट सं0 1', 'ख कोर्ट सं0 2'], 'ख कोर्ट सं0 2'), ['ख कोर्ट सं0 2', 'क कोर्ट सं0 1']);
  let l: string[] = [];
  for (let i = 0; i < 40; i++) l = addCustomCourt(l, `कोर्ट सं0 ${i}`);
  assert.equal(l.length, 30);
  assert.equal(l[0], 'कोर्ट सं0 39');
});

test('court key + "श्रीमान श्रीमान" tidy', () => {
  assert.equal(isCourtKey('{"hint":"x","court":true}'), true);
  assert.equal(isCourtKey('{"hint":"court"}'), false);
  assert.equal(isCourtKey(null), false);
  assert.equal(tidyRepeats('न्यायालय श्रीमान श्रीमान मुख्य न्यायिक मजिस्ट्रेट (CJM)'), 'न्यायालय श्रीमान मुख्य न्यायिक मजिस्ट्रेट (CJM)');
});

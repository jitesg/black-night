/** "कैसे भरें" box parts. Run: node --experimental-strip-types --test scripts/test_hint_parts.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exampleChips, splitHint, tipRepeatsTitle } from '../src/lib/hintParts.ts';

test('main, example and note', () => {
  assert.deepEqual(splitHint('मु0अ0सं0 / वर्ष, जैसे: 106/2026 — मुकदमा चुनने पर अपने आप भरता है'),
    { main: 'मु0अ0सं0 / वर्ष', example: '106/2026', note: 'मुकदमा चुनने पर अपने आप भरता है' });
  assert.deepEqual(splitHint('सिर्फ़ अपना नाम, जैसे: राम सिंह'), { main: 'सिर्फ़ अपना नाम', example: 'राम सिंह', note: '' });
  assert.deepEqual(splitHint('जैसे: चिकित्साधिकारी'), { main: '', example: 'चिकित्साधिकारी', note: '' });
});

test('no example → whole text; dash before जैसे stays in the main part', () => {
  assert.deepEqual(splitHint('शव कपड़े में सील किया या बॉडी बैग में'), { main: 'शव कपड़े में सील किया या बॉडी बैग में', example: '', note: '' });
  assert.equal(splitHint('यह व्यक्ति कौन है — मजरूब / वादी').main, 'यह व्यक्ति कौन है — मजरूब / वादी');
  const p = splitHint('हर अभियुक्त का कार्ड — नाम व पता, जैसे: ग्राम अ थाना ब');
  assert.equal(p.main, 'हर अभियुक्त का कार्ड — नाम व पता');
  assert.equal(p.example, 'ग्राम अ थाना ब');
});

test('sheet B: short example list → chips; long → none; tip that repeats the name', () => {
  assert.deepEqual(exampleChips('लखनऊ / इलाहाबाद'), ['लखनऊ', 'इलाहाबाद']);
  assert.deepEqual(exampleChips('का0 अजय यादव, हे0का0 मनोज कुमार'), ['का0 अजय यादव', 'हे0का0 मनोज कुमार']);
  assert.deepEqual(exampleChips('मु0अ0सं0 284/2025 की जमानत पैरवी हेतु'), []);
  assert.deepEqual(exampleChips('माननीय न्यायालय विशेष न्यायिक मजिस्ट्रेट कोर्ट सं0 25, लखनऊ'), []);
  assert.equal(tipRepeatsTitle('उच्च न्यायालय की पीठ', 'उच्च न्यायालय की पीठ *'), true);
  assert.equal(tipRepeatsTitle('पीठ का नाम लिखें', 'उच्च न्यायालय की पीठ'), false);
});

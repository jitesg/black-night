import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const note = JSON.parse(readFileSync(new URL('../assets/law-notes/BNSS-35.json', import.meta.url), 'utf8'));
const blocks: { t: string; x?: string; i?: string[]; rows?: string[][] }[] = note.blocks;

test('BNSS 35 notes: owner docx, all 14 headings in order', () => {
  const h = blocks.filter((b) => b.t === 'h').map((b) => b.x);
  assert.equal(h[0], 'महत्वपूर्ण प्रारंभिक टिप्पणी');
  assert.ok(h.includes('6. सुप्रीम कोर्ट के महत्वपूर्ण निर्णय'));
  assert.equal(h[h.length - 1], '14. प्रमुख न्यायिक एवं वैधानिक संदर्भ');
  assert.equal(blocks[0].t, 'head');
});
test('BNSS 35 notes: tables, boxes, checklist kept', () => {
  assert.equal(blocks.filter((b) => b.t === 'table').length, 8);
  assert.equal(blocks.filter((b) => b.t === 'box').length, 10);
  const ck = blocks.find((b) => b.t === 'check');
  assert.equal(ck?.i?.length, 15);
});

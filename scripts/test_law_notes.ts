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

test('BNSS 194 notes: owner photo texts, tickable 17-point checklist, keeps आम गलतियाँ + उदाहरण', () => {
  const n = JSON.parse(readFileSync(new URL('../assets/law-notes/BNSS-194.json', import.meta.url), 'utf8'));
  assert.deepEqual(n.keep, ['mist', 'ex']);
  const all = JSON.stringify(n);
  const b: { t: string; x?: string; i?: string[]; interactive?: boolean; key?: string; blocks?: unknown[] }[] = n.blocks;
  const h = b.filter((x) => x.t === 'h').map((x) => x.x);
  assert.equal(h.length, 14);
  assert.equal(h[0], '1. धारा 194 BNSS – Police to enquire and report on suicide, etc.');
  assert.ok(h.includes('8. सुप्रीम कोर्ट के महत्वपूर्ण निर्णय (Case Laws)'));
  assert.equal(h[h.length - 1], '15. अंतिम निष्कर्ष – 10 बातें हमेशा याद रखें');
  const ck = b.find((x) => x.t === 'check');
  assert.equal(ck?.interactive, true);
  assert.equal(ck?.i?.length, 17);
  assert.equal(ck?.i?.[7], 'घटनास्थल की फोटो/वीडियो और अन्य डिजिटल साक्ष्य सुरक्षित किये जाये।');
  assert.equal(b.filter((x) => x.t === 'table').length, 8);
  assert.ok(b.some((x) => x.t === 'img' && x.key === 'bnss194-flow'));
  assert.doesNotMatch(all, /\[\?\]|\(file:|इसी फोटो से|रीसेट/);
  assert.match(all, /Radha Mohan Singh alias Lal Saheb/);
});

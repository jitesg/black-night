/**
 * Tests for layout marks in formats (src/lib/formatMarkers.ts).
 * Run: node --experimental-strip-types --test scripts/test_format_markers.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const M = await import('../src/lib/formatMarkers.ts');
const E = await import('../src/lib/formatParsingEngine.ts');
const P = await import('../src/lib/printLayout.ts');

const SAMPLE = [
  '[[पत्र]]',
  '[[शीर्षक]] रिपोर्ट चालानी अन्तर्गत धारा 126/135 BNSS थाना बछरावा',
  '',
  '[[सेवा में]] सेवा मे,',
  'श्रीमान उपजिलामजिस्ट्रेट महोदय',
  '[[पक्ष]] वादी- उ0नि0 जीतेश सिंह',
  'प्रथम पक्ष',
  '[[महोदय]] महोदय,',
  '[[विवरण]] निवेदन है कि … रिपोर्ट … कृपा करें।',
  '',
  '[[समापन]] रिपोर्ट सादर सेवा मे प्रेषित है ।',
  '[[गवाह]] गवाहान – द्वितीय पक्ष',
  '',
  '[[संलग्नक]] संलग्नक -',
  'रिपोर्ट चालानी 01 वर्क | (जीतेश सिंह)',
  'नकल रपट 1 वर्क | उ0नि0',
  '',
  '[[पत्र]]',
  '[[बीच]] न्यायालय उपजिला मजिस्ट्रेट',
  'नोटिस अन्तर्गत धारा 130',
  '[[दोनों ओर]] शासन | बनाम कुसुम आदि',
  '[[विवरण]] अधोहस्ताक्षरी के समक्ष …',
  '',
  'मैं थानाध्यक्ष …',
  '[[दाएँ]] उपजिला मजिस्ट्रेट, तहसील महराजगंज',
].join('\n');

test('marks are detected and read', () => {
  assert.equal(M.hasFormatMarkers(SAMPLE), true);
  assert.equal(M.hasFormatMarkers('सेवा मे,\n[[SADHARAN]]'), false);
  assert.deepEqual(M.readMark('[[सेवा में]] सेवा मे,'), { role: 'sewa', rest: 'सेवा मे,' });
  assert.equal(M.readMark('[[अनजान]] x'), null);
});

test('letters split at [[पत्र]] and sections come from the marks', () => {
  const letters = E.splitIntoSubLetters(SAMPLE);
  assert.equal(letters.length, 2);
  const m = E.parseIntoDocumentModel(letters[0]);
  assert.equal(m.marked, true);
  assert.match(m.header, /^रिपोर्ट चालानी/);
  assert.deepEqual(m.sewaMein, ['सेवा मे,', 'श्रीमान उपजिलामजिस्ट्रेट महोदय']);
  assert.deepEqual(m.parties, ['वादी- उ0नि0 जीतेश सिंह', 'प्रथम पक्ष']);
  assert.equal(m.salutation, 'महोदय,');
  // "रिपोर्ट" inside the body does not start a new letter or a closing
  assert.equal(m.body.length, 1);
  assert.equal(m.closing, 'रिपोर्ट सादर सेवा मे प्रेषित है ।');
  assert.equal(m.attachments.length, 2);
  const n = E.parseIntoDocumentModel(letters[1]);
  assert.deepEqual(n.bodyBlocks?.map((b) => b.kind), ['center', 'center', 'split', 'para', 'para', 'right']);
});

test('print: one sheet per letter, attachments 1, 2 with signature column', () => {
  const html = P.renderTextForPrint(SAMPLE);
  assert.equal((html.match(/class="doc-letter"/g) ?? []).length, 2);
  assert.match(html, /class="att">1\. रिपोर्ट चालानी 01 वर्क<\/td><td class="sig">\(जीतेश सिंह\)/);
  assert.match(html, /class="att">2\. नकल रपट 1 वर्क<\/td><td class="sig">उ0नि0/);
  assert.match(html, /doc-center">न्यायालय उपजिला मजिस्ट्रेट/);
  assert.match(html, /doc-split"><tr><td>शासन<\/td><td>बनाम कुसुम आदि/);
  assert.match(html, /doc-right">उपजिला मजिस्ट्रेट/);
  assert.doesNotMatch(html, /\[\[/);
});

test('strip: no marks left, attachments numbered again', () => {
  const plain = M.stripFormatMarkers(SAMPLE);
  assert.doesNotMatch(plain, /\[\[/);
  assert.match(plain, /^1\.\tरिपोर्ट चालानी 01 वर्क\t+\(जीतेश सिंह\)$/m);
  assert.match(plain, /^2\.\tनकल रपट 1 वर्क\t+उ0नि0$/m);
  assert.match(plain, /^सेवा मे,$/m);
});

test('editor HTML keeps the layout after a round trip (and after an added line)', () => {
  const models = E.splitIntoSubLetters(SAMPLE).map(E.parseIntoDocumentModel);
  const editorHtml = E.renderModelsForEditor(models);
  assert.equal(M.hasEditorMarks(editorHtml), true);
  const direct = P.renderTextForPrint(SAMPLE);
  const back = P.renderTextForPrint(M.editorHtmlToMarkedText(editorHtml));
  assert.equal(back, direct);
  // The user presses Enter in the body: the new div copies data-fmt="विवरण".
  const edited = editorHtml.replace('कृपा करें।</div>', 'कृपा करें।</div><div data-fmt="विवरण" style="">नया पैरा</div>');
  const html2 = P.renderTextForPrint(M.editorHtmlToMarkedText(edited));
  assert.match(html2, /<p>नया पैरा<\/p>/);
  assert.equal((html2.match(/class="doc-letter"/g) ?? []).length, 2);
});

test('owner 126/135 formats: 6 sheets each (7 with the सिपाही note), attachments 1-3, nothing lost', () => {
  const d = JSON.parse(readFileSync(new URL('../assets/seed/formats_seed.json', import.meta.url), 'utf8'));
  const fmts = d.formats.filter((f: { id: string }) => f.id.startsWith('sys-fmt-bnss126'));
  assert.equal(fmts.length, 5);
  for (const f of fmts) {
    assert.equal(M.hasFormatMarkers(f.vivran), true, f.id);
    const html = P.renderTextForPrint(f.vivran);
    // बीट + यक्ष बीट end with the extra "सिपाही के लिए बीट सूचना" sheet.
    const sheets = /-beat$|-yaksh$/.test(f.id) ? 7 : 6;
    assert.equal((html.match(/class="doc-letter"/g) ?? []).length, sheets, f.id);
    assert.equal((html.match(/doc-closing/g) ?? []).length, 4, f.id);
    assert.deepEqual((html.match(/class="att">\d+/g) ?? []).map((x: string) => x.slice(12)), ['1', '2', '3', '1', '2', '3', '1', '2', '3', '1', '2', '3'], f.id);
    assert.doesNotMatch(html, /\[\[/, f.id);
  }
});

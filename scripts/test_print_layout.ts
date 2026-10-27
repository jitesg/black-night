/**
 * Tests for the fixed print layout (src/lib/printLayout.ts).
 * Run: node --experimental-strip-types --test scripts/test_print_layout.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// printLayout imports './formatParsingEngine' without an extension (Metro style); let Node find the .ts file.
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const {
  splitAttachmentLine, splitSewaMein, splitClosing, isHeading, looksLikeLetter,
  splitPlainText, renderTextForPrint,
} = await import('../src/lib/printLayout.ts');

test('attachment line: number, item, signature part', () => {
  const r = splitAttachmentLine('1.\tरिपोर्ट चालानी 01 वर्क          (जीतेश सिंह)');
  assert.equal(r.no, '1');
  assert.equal(r.left, 'रिपोर्ट चालानी 01 वर्क');
  assert.equal(r.right, '(जीतेश सिंह)');
});

test('सेवा में block: addressee, subject, parties', () => {
  const r = splitSewaMein(['श्रीमान उपजिलामजिस्ट्रेट महोदय', 'तहसील महराजगंज', 'वादी- उ0नि0 जीतेश सिंह', 'विषय – न्यायिक अभिरक्षा']);
  assert.deepEqual(r.addressee, ['श्रीमान उपजिलामजिस्ट्रेट महोदय', 'तहसील महराजगंज']);
  assert.ok(r.subject.join(' ').startsWith('विषय'));
  assert.ok(r.parties.join(' ').startsWith('वादी'));
});

test('closing: signature split off after "प्रेषित है ।"', () => {
  const r = splitClosing('रिपोर्ट सादर सेवा मे प्रेषित है । (जीतेश सिंह) उ0नि0 थाना बछरावा जनपद रायबरेली');
  assert.equal(r.closing, 'रिपोर्ट सादर सेवा मे प्रेषित है ।');
  assert.equal(r.signature[0], '(जीतेश सिंह)');
  assert.ok(r.signature.some((l) => l.startsWith('थाना')));
});

test('isHeading / looksLikeLetter', () => {
  assert.ok(isHeading('रिपोर्ट थाना बछरावा जनपद रायबरेली'));
  assert.ok(!isHeading('क'.repeat(200)));
  assert.ok(looksLikeLetter('सेवा मे,\nश्रीमान\nमहोदय,\nनिवेदन है'));
  assert.ok(!looksLikeLetter('फर्द बरामदगी\nआज दिनांक …'));
});

test('plain text (फर्द): note, title, paragraphs, signature', () => {
  const r = splitPlainText('नोट- यह नमूना है\nफर्द बरामदगी अन्तर्गत धारा 60(1)\n\nआज दिनांक को ' + 'क '.repeat(80) + 'किया गया ।\n(जीतेश सिंह)\nउ0नि0\nथाना बछरावां');
  assert.equal(r.notes.length, 1);
  assert.ok(r.title.startsWith('फर्द'));
  assert.equal(r.paras.length, 1);
  assert.deepEqual(r.signature, ['(जीतेश सिंह)', 'उ0नि0', 'थाना बछरावां']);
});

test('one A4 sheet per letter', () => {
  const one = 'रिपोर्ट थाना बछरावा\nसेवा मे,\nश्रीमान\nमहोदय,\nनिवेदन है ।\nरिपोर्ट सादर सेवा मे प्रेषित है ।';
  const html = renderTextForPrint(one);
  assert.equal((html.match(/class="doc-letter/g) ?? []).length, 1);
  assert.ok(html.includes('doc-sewa-mein'));
  assert.ok(renderTextForPrint('फर्द\n\nपाठ').includes('doc-plain'));
});

test('closing line "रिपोर्ट सादर…" after a blank line stays in the same letter; attachments renumbered 1, 2, 3', () => {
  const text = [
    'रिपोर्ट चालानी अन्तर्गत धारा 126/135 BNSS थाना बछरावा',
    'सेवा मे,', 'श्रीमान उपजिलामजिस्ट्रेट महोदय', '', 'महोदय,', 'निवेदन है कि … कृपा करें।', '',
    'रिपोर्ट सादर सेवा मे प्रेषित है ।', 'संलग्नक -',
    '4.\tरिपोर्ट चालानी 01 वर्क          (जीतेश सिंह)', '5.\tनकल रपट 1 वर्क          उ0नि0',
  ].join('\n');
  const html = renderTextForPrint(text);
  assert.equal((html.match(/class="doc-letter"/g) ?? []).length, 1);
  assert.match(html, /doc-closing">रिपोर्ट सादर/);
  assert.match(html, /class="att">1\. रिपोर्ट चालानी/);
  assert.match(html, /class="att">2\. नकल रपट/);
});

/** Format layout kept for प्रार्थना पत्र / न्यायालय आख्या. Run: node --experimental-strip-types --test scripts/test_report_layout.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const L = await import('../src/lib/reportLayout.ts');
const { generateReport } = await import('../src/lib/templateEngine.ts');
const { editorHtmlToMarkedText, hasEditorMarks } = await import('../src/lib/formatMarkers.ts');
const seed = JSON.parse(readFileSync('assets/seed/formats_seed.json', 'utf8'));
const f = seed.formats.find((x: { id: string }) => x.id === 'sys-fmt-bail-notice-aakhya');
const acc = JSON.stringify([{ name: 'राम', relationType: 'पुत्र', fatherOrHusbandName: 'श्याम', fullAddress: 'ग्राम अ' }]);
const vals = { AccCard: acc, FIRNo: '123/2026', Sections: '115(2)', Court: 'लखनऊ खंडपीठ' };
const plain = generateReport(f.vivran, vals, f.keys) as string;
const marked = generateReport(f.vivran, vals, f.keys, { keepMarkers: true }) as string;

test('unchanged box → editor HTML that still holds the table', () => {
  const t = L.appendTrack(null, '', plain, marked);
  assert.ok(t);
  const src = L.layoutSource(t, plain);
  assert.ok(hasEditorMarks(src));
  assert.match(editorHtmlToMarkedText(src), /\[\[तालिका\]\]/);
  assert.equal(L.markedToSave(t, `  ${plain}\n`), marked); // whitespace only → still unchanged
});

test('edited box → plain box text, nothing marked to save', () => {
  const t = L.appendTrack(null, '', plain, marked);
  const edited = `${plain}\nअतिरिक्त लाइन`;
  assert.equal(L.layoutSource(t, edited), edited);
  assert.equal(L.markedToSave(t, edited), '');
});

test('appending: after a tracked format both stay, after hand-typed text none', () => {
  const t1 = L.appendTrack(null, '', 'क', '[[बीच]] क');
  const t2 = L.appendTrack(t1, 'क', 'ख', '[[बीच]] ख');
  assert.deepEqual(t2, { plain: 'क\n\nख', marked: '[[बीच]] क\n\n[[बीच]] ख' });
  assert.equal(L.appendTrack(null, 'हाथ से लिखा', 'ख', '[[बीच]] ख'), null);
  assert.equal(L.appendTrack(null, '', 'ख', ''), null);
});

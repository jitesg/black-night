/** स्टेटस रिपोर्ट / बेल नोटिस आख्या (20 बिन्दु). Run: node --experimental-strip-types --test scripts/test_status_report.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const { generateReport } = await import('../src/lib/templateEngine.ts');
const seed = JSON.parse(readFileSync('assets/seed/formats_seed.json', 'utf8'));
const f = seed.formats.find((x: { id: string }) => x.id === 'sys-fmt-bail-notice-aakhya');
const acc = JSON.stringify([{ name: 'रामचन्द्र', relationType: 'पुत्र', fatherOrHusbandName: 'भिखारी', fullAddress: 'ग्राम अ' }]);
const gen = (v: Record<string, string>) => generateReport(f.vivran, { AccCard: acc, FIRNo: '284/2025', Sections: '103(1) बीएनएस', ...v }, f.keys, { keepMarkers: true }) as string;
const row = (r: string, n: number) => r.split('\n').find((l) => l.startsWith(`${n} |`)) ?? '';

test('20 rows, title, court address by choice', () => {
  assert.match(f.title, /20 बिन्दु/);
  const r = gen({ Court: 'लखनऊ खंडपीठ' });
  for (let i = 1; i <= 20; i++) assert.ok(row(r, i), `row ${i}`);
  assert.match(r, /\[\[बीच\]\] स्टेटस रिपोर्ट/);
  assert.match(r, /मा0 उच्च न्यायालय खंडपीठ लखनऊ,\nजनपद लखनऊ।/);
  assert.match(gen({ Court: 'उच्च न्यायालय इलाहाबाद' }), /मा0 उच्च न्यायालय इलाहाबाद,\nजनपद प्रयागराज।/);
  const o = gen({ Court: 'अन्य', ToAddr: 'श्रीमान जिला शासकीय अधिवक्ता,\nजनपद रायबरेली।' });
  assert.match(o, /\[\[सूची अंदर\]\] श्रीमान जिला शासकीय अधिवक्ता,\nजनपद रायबरेली।/);
  assert.doesNotMatch(o, /खंडपीठ/);
});

test('filled values bold, empty → bold निल, unticked → plain लागू नहीं।', () => {
  const r = gen({ Court: 'लखनऊ खंडपीठ', BailNo: '345/2025', CrimHistory: 'कोई नहीं', AccStatus: 'नामित', CSStatus: 'आरोप पत्र प्रेषित', CSNo: '120/2025', pad: 'उपनिरीक्षक' });
  assert.match(r, /बेल नोटिस सं0 \*\*345\/2025\*\*/);
  assert.match(r, /अभि0 का नाम \*\*रामचन्द्र\*\* पुत्र \*\*भिखारी\*\*/);
  assert.match(row(r, 3), /– \*\*कोई नहीं\*\* ⏎ 2– .* – \*\*निल\*\*/);
  assert.match(row(r, 6), /\*\*120\/2025\*\*.*विवेचना प्रचलित हो तो उसका उल्लेख – \*\*लागू नहीं।\*\*.*आरोप विरचित किये जाने का दिनांक – \*\*निल\*\*/);
  assert.match(row(r, 19), /\| लागू नहीं।$/);
  assert.match(row(r, 2), /– \*\*नामित\*\* ⏎ .* – \*\*लागू नहीं।\*\*$/);
  // note keeps dots, no दण्ड वाद when empty
  assert.match(r, /पर्चा सं0 \.{10} तक/);
  assert.doesNotMatch(r, /दण्ड वाद/);
  assert.match(r, /विवेचनाधिकारी \/ उ0नि0\nथाना- /);
});

test('point 11 new lines and point 20 CDR', () => {
  const r = gen({ gRecovery: 'हाँ', RecWhat: 'चाकू', RecVideo: 'हाँ', RecUpload: 'हाँ', RecCD: 'हाँ', RecCDNo: '05', Cdr: 'हाँ', CdrParcha: 'पर्चा सं0 07' });
  assert.match(row(r, 11), /धारा 105 .* – \*\*हाँ\*\* ⏎ 6– .* – \*\*हाँ\*\* ⏎ 7– .* – \*\*हाँ\*\*, पर्चा सं0 \*\*05\*\*/);
  assert.match(row(r, 20), /1– हाँ अथवा नहीं – \*\*हाँ\*\* ⏎ 2– .* – \*\*पर्चा सं0 07\*\*/);
  const n = gen({ gRecovery: 'हाँ', RecVideo: 'नहीं', Cdr: 'नहीं' });
  assert.match(row(n, 11), /6– .* – \*\*लागू नहीं।\*\* ⏎ 7– .* – \*\*लागू नहीं।\*\*/);
  assert.match(row(n, 20), /2– .* – \*\*लागू नहीं।\*\*/);
  assert.match(row(gen({}), 20), /1– हाँ अथवा नहीं – \*\*निल\*\*/);
});

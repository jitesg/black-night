/** नोटिस सूचना वादी / पीड़िता + [[बीच रेखा]]. Run: node --experimental-strip-types --test scripts/test_notice_suchna.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { if (s === 'expo-sqlite/localStorage/install') return { url: 'data:text/javascript,', shortCircuit: true }; try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
(globalThis as Record<string, unknown>).__DEV__ = false;
const { generateReport } = await import('../src/lib/templateEngine.ts');
const { parseMarkedLetter, editorHtmlToMarkedText } = await import('../src/lib/formatMarkers.ts');
const { renderModelsForEditor } = await import('../src/lib/formatParsingEngine.ts');
const { renderTextForPrint } = await import('../src/lib/printLayout.ts');
const seed = JSON.parse(readFileSync('assets/seed/formats_seed.json', 'utf8'));
const f = seed.formats.find((x: { id: string }) => x.id === 'sys-fmt-notice-suchna-vadi');
const C = (o: object) => JSON.stringify([o]);
const base = { PoliceStation: 'बछरावां', District: 'रायबरेली', VThana: 'बछरावां', VDistrict: 'रायबरेली', FIRNo: '284/2025', Sections: '352 बीएनएस',
  AccCard: C({ name: 'रामचन्द्र', fullAddress: 'ग्राम बन्नावां' }), Court: 'लखनऊ खंडपीठ', CaseType: 'जमानत प्रार्थना पत्र', pad: 'उपनिरीक्षक', OfficerName: 'जीतेश सिंह' };
const gen = (v: Record<string, string>) => generateReport(f.vivran, { ...base, ...v }, f.keys, { keepMarkers: true }) as string;
const woman = C({ name: 'रेनू', relationType: 'पत्नी', fatherOrHusbandName: 'धीरज' });
const man = C({ name: 'रामू', relationType: 'पुत्र', fatherOrHusbandName: 'श्याम' });

test('format is a Case Diary format', () => {
  assert.equal(f.format_type, 'Case Diary');
});

test('वादी ही पीड़ित: one card, वादिनी/पीड़िता by relation', () => {
  const r = gen({ Who: 'वादी ही पीड़ित', VCard: woman });
  assert.match(r, /\[\[बीच रेखा\]\] नोटिस सूचना वादिनी\/पीड़िता\n/);
  assert.match(r, /\*\*वादिनी\/पीड़िता का नाम –\*\* रेनू\n\*\*पति का नाम –\*\* धीरज/);
  assert.match(r, /वादिनी\/पीड़िता का हस्ताक्षर – \| \(जीतेश सिंह\)/);
  assert.match(gen({ Who: 'वादी ही पीड़ित', VCard: man }), /नोटिस सूचना वादी\/पीड़ित\n[\s\S]*\*\*पिता का नाम –\*\* श्याम/);
});

test('वादी और पीड़ित अलग: all four pairs, both sign lines', () => {
  for (const [v, p, head] of [[man, woman, 'वादी व पीड़िता'], [woman, woman, 'वादिनी व पीड़िता'], [woman, man, 'वादिनी व पीड़ित'], [man, man, 'वादी व पीड़ित']] as const) {
    const r = gen({ Who: 'वादी और पीड़ित अलग', VCard: v, PCard: p });
    assert.match(r, new RegExp(`नोटिस सूचना ${head}\\n`));
    const [vw, pw] = head.split(' व ');
    assert.match(r, new RegExp(`${vw} मुकदमा का हस्ताक्षर –`));
    assert.match(r, new RegExp(`\\n${pw} का हस्ताक्षर – \\| \\(जीतेश सिंह\\)`));
    assert.match(r, new RegExp(`\\*\\*${pw} का नाम –\\*\\*`));
  }
});

test('सिर्फ़ वादी, court / case type, empty boxes → dots', () => {
  const r = gen({ Who: 'सिर्फ़ वादी', VCard: man, Court: 'उच्च न्यायालय इलाहाबाद', CaseType: 'क्रिमिनल अपील' });
  assert.match(r, /नोटिस सूचना वादी\n/);
  assert.doesNotMatch(r, /पीड़ित/);
  assert.match(r, /माननीय उच्च न्यायालय इलाहाबाद में क्रिमिनल अपील संख्या \.{10} रामचन्द्र बनाम उ0प्र0 राज्य व अन्य, तिथि \.{10} नियत है।/);
  assert.match(r, /\*\*मोबाइल नम्बर –\*\* \.{10}/);
  const l = gen({ Who: 'वादी ही पीड़ित', VCard: woman, CaseNo: '12/2025', HearDate: '2025-12-02' });
  assert.match(l, /माननीय उच्च न्यायालय लखनऊ खण्डपीठ लखनऊ में जमानत प्रार्थना पत्र संख्या 12\/2025 रामचन्द्र बनाम उ0प्र0 राज्य व अन्य, तिथि 02\/12\/2025 नियत है।/);
});

test('[[बीच रेखा]] = centred, bold, underlined (print + editor round trip)', () => {
  const m = parseMarkedLetter('[[बीच रेखा]] शीर्षक\n[[विवरण]] पाठ');
  assert.deepEqual(m.bodyBlocks?.[0], { kind: 'center', text: 'शीर्षक', underline: true });
  assert.match(renderTextForPrint('[[पत्र]]\n[[बीच रेखा]] शीर्षक\n[[बीच]] दूसरा\n[[विवरण]] पाठ'), /doc-center doc-center-u">शीर्षक[\s\S]*class="doc-center">दूसरा/);
  const html = renderModelsForEditor([m]);
  assert.match(html, /data-fmt="बीच रेखा"[^>]*><b><u>शीर्षक<\/u><\/b>/);
  assert.match(editorHtmlToMarkedText(html), /\[\[बीच रेखा\]\] शीर्षक/);
});

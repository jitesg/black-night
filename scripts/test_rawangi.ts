/** रवानगी उ0नि0 — 7 kinds. Run: node --experimental-strip-types --test scripts/test_rawangi.ts */
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
const f = seed.formats.find((x: { id: string }) => x.id === 'sys-gd-fmt-rawangi-samanya');
const b = { pad: 'उपनिरीक्षक', OfficerName: 'जीतेश सिंह', Hamrah: 'का0 अजय यादव' };
const gen = (v: Record<string, string>) => generateReport(f.vivran, { ...b, ...v }, f.keys, {}) as string;

test('title and 7 kinds', () => {
  assert.equal(f.title, 'रवानगी उ0नि0');
  assert.equal(f.format_type, 'GD');
  assert.equal(JSON.parse(f.keys.find((k: { key_name: string }) => k.key_name === 'Kind').dropdown_options).options.length, 7);
});

test('क्षेत्र (default wording) and no हमराह', () => {
  assert.equal(gen({ Kind: 'क्षेत्र' }), 'रवानगी उ0नि0\n\nइस समय मैं उ0नि0 जीतेश सिंह मय हमराह का0 अजय यादव क्षेत्र देखभाल, शांति व्यवस्था, संदिग्ध व्यक्ति व वाहन चेकिंग, रोकथाम जुर्म-जरायम तथा लंबित प्रार्थना पत्रों व विवेचनाओं के निस्तारण हेतु क्षेत्र में रवाना हुआ।');
  assert.match(gen({ Kind: 'क्षेत्र', Hamrah: '', pad: 'निरीक्षक' }), /^रवानगी निरीक्षक\n\nइस समय मैं निरीक्षक जीतेश सिंह क्षेत्र देखभाल/);
});

test('मुकदमा, न्यायालय, गैर प्रान्त, अन्य', () => {
  assert.match(gen({ Kind: 'मुकदमा', FIRNo: '284/2025', Sections: '352 बीएनएस' }), /^रवानगी उ0नि0 मु0अ0सं0 284\/2025 धारा 352 बीएनएस\n\n.*अजय यादव, मु0अ0सं0 284\/2025 धारा 352 बीएनएस की विवेचना/);
  assert.match(gen({ Kind: 'उच्च न्यायालय', HCourt: 'लखनऊ खंडपीठ', Purpose: 'जमानत पैरवी हेतु' }), /^रवानगी उ0नि0 मा0 उच्च न्यायालय जनपद लखनऊ\n\n.*अजय यादव जमानत पैरवी हेतु मा0 उच्च न्यायालय जनपद लखनऊ रवाना हुआ।$/);
  assert.match(gen({ Kind: 'उच्च न्यायालय', HCourt: 'इलाहाबाद' }), /यादव मा0 उच्च न्यायालय जनपद प्रयागराज रवाना हुआ।$/);
  assert.match(gen({ Kind: 'जनपद न्यायालय', CourtDist: 'लखनऊ' }), /^रवानगी उ0नि0 मा0 न्यायालय जनपद लखनऊ\n\n.*यादव मा0 न्यायालय जनपद लखनऊ रवाना हुआ।$/);
  assert.match(gen({ Kind: 'गैर प्रान्त', State: 'बिहार' }), /^रवानगी उ0नि0 गैर प्रान्त \(बिहार\)\n\n.*यादव गैर प्रान्त बिहार रवाना हुआ।$/);
  assert.match(gen({ Kind: 'अन्य', Other: 'परेड हेतु पुलिस लाइन' }), /^रवानगी उ0नि0\n\n.*यादव परेड हेतु पुलिस लाइन रवाना हुआ।$/);
});

test('NBW / सम्मन / मृत्यु आख्या', () => {
  const w = { Kind: 'वारंट', Hamrah: '', OfficerName: 'चन्द्रपाल सिंह', WCourt: 'माननीय न्यायालय विशेष न्यायिक मजिस्ट्रेट कोर्ट सं0 25', WCaseNo: '795/20', WFir: '409/18', WSec: '60(1) आबकारी अधिनियम',
    WCard: JSON.stringify([{ name: 'दिलीप कुमार', relationType: 'पुत्र', fatherOrHusbandName: 'विजय कुमार', fullAddress: 'असरेंदा पो0 गुनजौली मौरावा उन्नाव' }]) };
  assert.equal(gen({ ...w, WType: 'NBW' }), 'रवानगी उ0नि0 वारंटी सम्बन्धित मु0अ0सं0 409/18 धारा 60(1) आबकारी अधिनियम\n\nइस समय मैं उ0नि0 चन्द्रपाल सिंह माननीय न्यायालय विशेष न्यायिक मजिस्ट्रेट कोर्ट सं0 25 के वाद सं0 795/20 अ0सं0 409/18 शा0 प्रति दिलीप कुमार धारा 60(1) आबकारी अधिनियम से सम्बन्धित दिलीप कुमार पुत्र विजय कुमार निवासी असरेंदा पो0 गुनजौली मौरावा उन्नाव की तलाश मे रवाना हुआ।');
  assert.match(gen({ ...w, WType: 'सम्मन', WVs: 'रामू आदि' }), /^रवानगी उ0नि0 सम्मन सम्बन्धित[\s\S]*शा0 प्रति रामू आदि धारा[\s\S]*को सम्मन तामील कराने हेतु रवाना हुआ।$/);
  assert.match(gen({ ...w, WType: 'मृत्यु आख्या' }), /^रवानगी उ0नि0 मृत्यु आख्या सम्बन्धित[\s\S]*की मृत्यु के सम्बन्ध में जानकारी कर आख्या हेतु रवाना हुआ।$/);
});

test('ⓘ note = owner Formatted_Police_Log.docx (names masked)', () => {
  const n = JSON.parse(readFileSync('assets/format-info/sys-gd-fmt-rawangi-samanya.json', 'utf8'));
  assert.equal(n.blocks[0].title, 'पुलिस दैनिक रपट / रवानगी एवं आमद विवरण');
  assert.equal(n.blocks.filter((b: { t: string }) => b.t === 'h').length, 2);
  assert.equal(n.blocks.filter((b: { t: string }) => b.t === 'h2').length, 37);
  assert.ok(!JSON.stringify(n).match(/\[[A-Z]{1,2}\]/));
  assert.match(readFileSync('src/lib/formatInfo.ts', 'utf8'), /'sys-gd-fmt-rawangi-samanya': \(\) => require\('..\/..\/assets\/format-info\/sys-gd-fmt-rawangi-samanya.json'\)/);
});

import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }`));
const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const P = await import('../src/lib/caseDiaryParcha.ts');

const txt = (ps: { runs?: { text: string }[] }[]) => ps.map((p) => (p.runs ?? []).map((r) => r.text).join('')).join('\n');

test('मुकदमा साराशः = FIR box as typed (owner)', () => {
  const ps = txt(P.buildParcha({ no: 1, date: '2025-07-08', places: [], entries: [
    { entry_type: 'narrative', narrative_text: 'मुकदमा सारांश:\nपुरानी अपने-आप वाली entry' },
    { entry_type: 'karyvahi', karyvahi_name: 'क', vivran: 'एक' }] }, '<p>पहली लाइन</p><p>दूसरी लाइन</p>') as never);
  assert.match(ps, /\nमुकदमा साराशः- पहली लाइन\nदूसरी लाइन\nश्रीमान जी/);
  assert.doesNotMatch(ps, /पुरानी अपने-आप/);
  const none = txt(P.buildParcha({ no: 1, date: '2025-07-08', places: [], entries: [] }, '') as never);
  assert.doesNotMatch(none, /साराश/);
  assert.match(none, /कार्यवाही- विवेचना ग्रहण\n/);
});
test('पर्चा 01 / 02', () => {
  const one = P.buildParcha({ no: 1, date: '2025-07-08', start: '18:50', end: '19:50', places: [], entries: [
    { entry_type: 'karyvahi', karyvahi_name: 'नकल चिक', vivran: '<p>सेवा में</p><p>दूसरा</p>' }, { entry_type: 'karyvahi', karyvahi_name: 'खाली', vivran: '' }] }, 'X।');
  const t1 = txt(one as never);
  assert.match(t1, /^पर्चा नं0 01 दिनाँक 08\.07\.2025 समय 18\.50 से 19\.50 बजे तक\nकार्यवाही- मुकदमा साराशं, विवेचना ग्रहण, नकल चिक, खाली\nदौरा- थाना कार्यालय ।\n\nमुकदमा साराशः- X।\nश्रीमान जी मुकदमा उपरोक्त थाना हाजा पर पंजीकृत/);
  assert.match(t1, /\nनकल चिक\.{10} सेवा में\nदूसरा$/);
  assert.doesNotMatch(t1, /कृत कार्यवाही का पर्चा/); // closing line = "पर्चा अंत" format (owner)
  assert.equal((one[0] as { runs: { highlight?: boolean }[] }).runs[0].highlight, true);
  const two = txt(P.buildParcha({ no: 2, date: '2025-07-15', places: ['क', 'ख'], prev: { no: 1, date: '2025-07-08' }, entries: [] }, '') as never);
  assert.match(two, /^पर्चा नं0 02 दिनाँक 15\.07\.2025\n/);
  assert.match(two, /दौरा- क व ख ।/);
  assert.match(two, /मे पर्चा नं0 01 दिनाँक 08\.07\.2025 को किता कर सेवा मे प्रेषित/);
  assert.doesNotMatch(two, /कार्यवाही-|मुकदमा साराशः/);
  assert.match(P.parchaHtml(one), /<span class="hl">पर्चा नं0 01/);
});
test('1.5 line gap between entries (owner)', () => {
  const paras = P.buildParcha({ no: 2, date: '2025-07-15', places: [], prev: { no: 1, date: '2025-07-08' }, entries: [
    { entry_type: 'karyvahi', karyvahi_name: 'क', vivran: 'एक\nदो' },
    { entry_type: 'karyvahi', karyvahi_name: 'ख', vivran: '' },
    { entry_type: 'narrative', narrative_text: 'तीन' },
  ] } as never, '') as Array<{ gapBefore?: number; runs?: Array<{ text: string }> }>;
  const gaps = paras.filter((p) => p.gapBefore).map((p) => p.runs?.map((r) => r.text).join(''));
  assert.deepEqual(gaps, ['तीन']);
});
test('old automatic opening entry is not printed twice (owner)', () => {
  const auto1 = 'श्रीमान जी मुकदमा उपरोक्त थाना स्थानीय पर पंजीकृत होकर विवेचना हस्वादेश प्रभारी निरीक्षक महोदय के मुझ उपनिरीक्षक को सुपुर्द हुई है। थाना कार्यालय से नकल चिक, नकल रपट प्राप्त हुई है । विवेचना ग्रहण कर मशरूफ विवेचना हुआ। प्राप्त प्रपत्रो का अवलोकन किया जा रहा है।';
  const auto2 = 'श्रीमान जी मुकदमा उपरोक्त मे पर्चा नं0 01 दिनांक अज्ञात तिथि को किता कर सेवा मे प्रेषित किया जा चुका है। आज मै विवेचक दीगर कार्यसरकार से फुरसत पाकर मुकदमा उपरोक्त की विवेचना मे मशरूफ हुआ।';
  assert.equal(P.isAutoOpening(auto1), true);
  assert.equal(P.isAutoOpening(auto2), true);
  assert.equal(P.isAutoOpening(auto2.replace('2025-07-08', 'x').replace('अज्ञात तिथि', '2025-07-08')), true);
  assert.equal(P.isAutoOpening(auto1 + ' मेरा जोड़ा हुआ'), false);
  const ps = txt(P.buildParcha({ no: 1, date: '2025-07-08', places: [], entries: [
    { entry_type: 'narrative', narrative_text: auto1 },
    { entry_type: 'narrative', narrative_text: auto1 + ' मेरा जोड़ा हुआ' }] }, '') as never);
  assert.equal(ps.split('थाना स्थानीय पर पंजीकृत').length, 2); // only the edited one
  assert.match(ps, /मेरा जोड़ा हुआ/);
});
test('diary with its own सारांश / opening-line narratives prints them once, as edited (owner)', () => {
  const open = P.openingLine(2, { no: 1, date: '2025-07-08' });
  assert.match(open, /पर्चा नं0 01 दिनाँक 08\.07\.2025/);
  const paras = P.buildParcha({ no: 2, date: '2025-07-15', places: [], prev: { no: 1, date: '2025-07-08' }, entries: [
    { entry_type: 'narrative', narrative_template: P.SARANSH_LABEL, narrative_text: 'डायरी वाला सारांश' },
    { entry_type: 'narrative', narrative_template: P.OPENING_LABEL, narrative_text: open + ' बदला' },
    { entry_type: 'karyvahi', karyvahi_name: 'बयान', vivran: 'एक' },
    { entry_type: 'karyvahi', karyvahi_name: 'नक्शा', vivran: 'दो' }] }, 'FIR वाला सारांश');
  const s = txt(paras as never);
  assert.doesNotMatch(s, /FIR वाला सारांश/);
  assert.equal(s.split('मुकदमा साराशः- डायरी वाला सारांश').length, 2);
  assert.equal(s.split('को किता कर सेवा मे प्रेषित किया जा चुका है').length, 2);
  assert.match(s, /मशरूफ हुआ। बदला/);
  const gaps = (paras as { gapBefore?: number; runs?: { text: string }[] }[]).filter((p) => p.gapBefore).map((p) => p.runs![1].text);
  assert.deepEqual(gaps, ['दो']); // gap only between the two real entries
  const first = txt(P.buildParcha({ no: 1, date: '2025-07-08', places: [], entries: [
    { entry_type: 'narrative', narrative_template: P.SARANSH_LABEL, narrative_text: 'स' }] }, '') as never);
  assert.match(first, /कार्यवाही- मुकदमा साराशं, विवेचना ग्रहण/);
});

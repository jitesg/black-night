/**
 * पंचायतनामा / पोस्टमार्टम — अवलोकन व सभी बयान (sys-fmt-cd-panchayatnama-pm-avlokan), owner's sample texts.
 * Run: node --experimental-strip-types --test scripts/test_panchayatnama_pm.ts
 */
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
const f = (seed.formats ?? seed).find((x: { id: string }) => x.id === 'sys-fmt-cd-panchayatnama-pm-avlokan');
const P = (name: string, rel: string, father: string, addr: string, age: string, mobile: string, extra: Record<string, string> = {}) =>
  ({ name, rel, father, addr, age, mobile, mahila: '', own: '', ...extra });
const ALL_OFF = { doPan: '', doPm: '', doBayanSI: '', doBayanCo: '', doBayanPanch: '', doBayanDoc: '' };
const base = {
  Gender: 'मृतक', DCard: JSON.stringify([{ name: 'नेवल किशोर', relationType: 'पुत्र', fatherOrHusbandName: 'राम आधार', fullAddress: 'नेवाजखेड़ा थाना हरचन्द्रपुर जनपद रायबरेली', age: '25' }]),
  SIRank: 'उ0नि0', SIName: 'जीतेश सिंह', CoRank: 'का0', CoName: 'राजमल', Thana: 'थाना बछरावां',
  PanDate: '19.07.2025', PanInfo: 'थाना बछरावां से मिली सूचना के आधार पर', PanPlace: 'बन्नावा', PanchOpinion: 'सड़क दुर्घटना मे आयी चोटो के कारण',
  doIOAgree: 'हाँ', PmHouseSent: 'पीएम हाउस रायबरेली', doCD: 'हाँ',
  Panch: JSON.stringify([P('लवकुश', 'पुत्र', 'राम आधार', 'नेवाजखेड़ा थाना हरचन्द्रपुर जनपद रायबरेली', '38', '9335845279'),
    P('रेनू', 'पत्नी', 'भोला', 'रामपालखेड़ा मजरे बन्नावा थाना बछरावां जनपद रायबरेली', 'करीब 33', '7258926880', { mahila: 'हाँ' })]),
  PmDate: '20.07.2025', BodyTime: '01.45 PM', PmFrom: '01.50 PM', PmTo: '02.30 PM', PmNo: '122/2025',
  DocName: 'मनोज मिश्रा', DocPost: 'चिकित्साधिकारी', DocHosp: 'सीएचसी खीरों जनपद रायबरेली', PmPlace: 'जिला पीएम हाउस रायबरेली',
  PmInjury: 'ANTEMORTEM INJURY ;- 1. CRUSHED INJURY OF HEAD', PmCause: 'HAEMORRHAGIC shock',
};
const run = (v: Record<string, string>) => generateReport(f.vivran, { ...base, ...v }, f.keys);

test('format is in the seed with a hint on every field', () => {
  assert.ok(f);
  for (const k of f.keys) assert.match(String(k.dropdown_options), /"hint"/, k.key_name);
});

test('पंचायतनामा + PM अवलोकन = owner wording', () => {
  const out = run({ ...ALL_OFF, doPan: 'हाँ', doPm: 'हाँ' });
  assert.match(out, /^थाना कार्यालय से मृतक नेवल किशोर का मूल पंचायतनामा व पोस्टमार्टम रिपोर्ट प्राप्त हुए है जिनका अवलोकन किया जा रहा है ।/);
  assert.match(out, /उ0नि0 जीतेश सिंह द्वारा बन्नावा मे समक्ष पंच गवाहान 1\. लवकुश पुत्र राम आधार निवासी .* उम्र 38 वर्ष मो0न0 9335845279 2\. रेनू पत्नी भोला/);
  assert.match(out, /का0 राजमल थाना बछरावां की सुपुर्दगी मे देकर पोस्टमार्टम हेतु पीएम हाउस रायबरेली भेजा जाना अंकित है/);
  assert.match(out, /पीएम न0 122\/2025 डा0 मनोज मिश्रा चिकित्साधिकारी सीएचसी खीरों जनपद रायबरेली द्वारा जिला पीएम हाउस रायबरेली में किया गया।/);
  assert.match(out, /बाद अवलोकन पोस्टमार्टम रिपोर्ट मूल संलग्न सीडी है।$/);
});

test('only PM → "की मूल … रिपोर्ट प्राप्त हुई है जिसका"; only बयान → no blank lines on top', () => {
  assert.match(run({ ...ALL_OFF, doPm: 'हाँ' }), /^थाना कार्यालय से मृतक नेवल किशोर की मूल पोस्टमार्टम रिपोर्ट प्राप्त हुई है जिसका/);
  const out = run({ ...ALL_OFF, doBayanDoc: 'हाँ', DutyFrom: 'जिला अस्पताल' });
  assert.match(out, /^बयान चिकित्सक \( मृतक का PM करने वाले \):- डा0 मनोज मिश्रा चिकित्साधिकारी, सीएचसी खीरों/);
  assert.doesNotMatch(out, /थाना कार्यालय से/);
});

test('उ0नि0 / आरक्षी बयान; महिला आरक्षी → रही / पहुंची', () => {
  const v = { ...ALL_OFF, doBayanSI: 'हाँ', doBayanCo: 'हाँ', InfoDate: '09.05.2025', InfoTime: 'सुबह 9.10', BodyPlace: 'एपेक्स ट्रामा सेंटर लखनऊ', DeathHow: 'सड़क दुर्घटना मे', PanWhen: 'सवेरे' };
  const out = run(v);
  assert.match(out, /बयान पंचनामा भरने वाले उपनिरीक्षक\.\.\.\.\.\.उ0नि0 श्री जीतेश सिंह थाना बछरावां पूछने पर/);
  assert.match(out, /मै उपनिरीक्षक मय हमराह का0 राजमल के थाना हाजा से/);
  assert.match(out, /बयान पोस्टमार्टम कराने वाला आरक्षी\.+का0 राजमल थाना बछरावां पूछने पर बता रहे है/);
  const w = run({ ...v, CoRank: 'म0का0' });
  assert.match(w, /बयान पोस्टमार्टम कराने वाला महिला आरक्षी/);
  assert.match(w, /बता रही है/);
  assert.match(w, /मे पहुंची थी/);
});

test('पंच बयान: one paragraph per पंच; woman → रही / आयी थी; own text wins', () => {
  const panch = JSON.stringify([P('विनय', 'पुत्र', 'हरि', 'दुर्गापुर', '', '9794940250'),
    P('रेनू', 'पत्नी', 'भोला', 'बन्नावा', '', '', { mahila: 'हाँ' }), P('विपिन', 'पुत्र', 'हरीश', 'छबीले खेड़ा', '', '', { own: 'मेरा भाई नितिन … ।' })]);
  const out = run({ ...ALL_OFF, doBayanPanch: 'हाँ', Panch: panch, DCard: JSON.stringify([{ name: 'नितिन', fullAddress: 'क' }]), BodyPlace: 'पीजीआई ट्रामा सेन्टर', Story1: 'घटना।', Story2: 'आखिर।' });
  const paras = out.split('\n\n');
  assert.equal(paras.length, 3);
  assert.match(paras[0], /^बयान गवाह\/पंच गवाह\.+विनय पुत्र हरि नि0 दुर्गापुर मो0न0 9794940250 पूछने पर बता रहे है कि घटना। सूचना मिलने पर मै भी पीजीआई ट्रामा सेन्टर मे आया था । दरोगा जी द्वारा नितिन के शव का पंचनामा भरा था .* आखिर। यही मेरा बयान है ।$/);
  assert.match(paras[1], /बता रही है .* मे आयी थी/);
  assert.match(paras[2], /बता रहे है कि मेरा भाई नितिन … । यही मेरा बयान है ।$/);
});

test('चिकित्सक बयान: own injury text, viscera, महिला doctor', () => {
  const out = run({ ...ALL_OFF, doBayanDoc: 'हाँ', DutyFrom: 'जिला अस्पताल', DocInjury: 'के सिर पर घाव थी।', doViscera: 'हाँ', docMahila: 'हाँ' });
  assert.match(out, /\( ANTi MORTEM INJURIES \) के सिर पर घाव थी। जो PM रिपोर्ट में अंकित है।/);
  assert.match(out, /विसरा परीक्षण हेतु संरक्षित किया था।/);
  assert.match(out, /बता रही है/);
  assert.match(out, /समर्थन करती हूँ।$/);
});

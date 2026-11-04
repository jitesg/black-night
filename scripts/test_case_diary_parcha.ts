import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }`));
const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const P = await import('../src/lib/caseDiaryParcha.ts');

const fir = { fir_number: '297/2025', section: '115(2)/352 बीएनएस', ghatnasthal: 'खेत वादी', date_of_occurrence: '2025-07-08', time_of_occurrence: '17:30',
  date_of_information: '2025-07-08', time_of_information: '18:36', complainant_name: 'नमन सिंह', complainant_father: 'राजीव कुमार सिंह',
  complainant_relation: 'पुत्र', complainant_address: 'ग्राम ठकुराइनखेड़ा', complainant_mobile: '+918429836065' };
const acc = [{ is_known: 1, name: 'रामलाल', father: 'सुखई', address: 'रिशालखेड़ा' }, { is_known: 1, name: 'नीरज', father: 'राजाराम', address: 'रिशालखेड़ा' }];
const txt = (ps: { runs?: { text: string }[] }[]) => ps.map((p) => (p.runs ?? []).map((r) => r.text).join('')).join('\n');

test('मुकदमा साराशः', () => {
  const s = P.mukadmaSaransh(fir, acc);
  assert.match(s, /^मु0अ0सं0 297\/2025 धारा 115\(2\)\/352 बीएनएस, दिनाँक घटना 08\.07\.2025 समय 17\.30 बजे, दिनाँक सूचना 08\.07\.2025 समय 18\.36 बजे, घटनास्थल खेत वादी, /);
  assert.match(s, /वमुदैय्यत श्री नमन सिंह पुत्र राजीव कुमार सिंह निवासी ग्राम ठकुराइनखेड़ा मो0नं0 8429836065 बनाम 1\.रामलाल पुत्र सुखई, 2\.नीरज पुत्र राजाराम निवासीगण रिशालखेड़ा।$/);
  assert.equal(P.accusedLine([], 2), '02 अज्ञात');
  assert.equal(P.accusedLine([{ name: 'बबलू', address: 'क' }]), 'बबलू निवासी क');
  assert.match(P.mukadmaSaransh({ ...fir, complainant_relation: 'पत्नी' }, acc), /वमुदैय्यत श्रीमती नमन/);
});
test('पर्चा 01 / 02', () => {
  const one = P.buildParcha({ no: 1, date: '2025-07-08', start: '18:50', end: '19:50', places: [], entries: [
    { entry_type: 'karyvahi', karyvahi_name: 'नकल चिक', vivran: '<p>सेवा में</p><p>दूसरा</p>' }, { entry_type: 'karyvahi', karyvahi_name: 'खाली', vivran: '' }] }, 'X।');
  const t1 = txt(one as never);
  assert.match(t1, /^पर्चा नं0 01 दिनाँक 08\.07\.2025 समय 18\.50 से 19\.50 बजे तक\nकार्यवाही- मुकदमा साराशं, विवेचना ग्रहण, नकल चिक, खाली\nदौरा- थाना कार्यालय ।\n\nमुकदमा साराशः- X।\nश्रीमान जी मुकदमा उपरोक्त थाना हाजा पर पंजीकृत/);
  assert.match(t1, /\nनकल चिक\.{10} सेवा में\nदूसरा\nश्रीमान जी आज की कृत कार्यवाही का पर्चा किता कर सेवा मे प्रेषित है । विवेचना प्रचलित है ।$/);
  assert.equal((one[0] as { runs: { highlight?: boolean }[] }).runs[0].highlight, true);
  const two = txt(P.buildParcha({ no: 2, date: '2025-07-15', places: ['क', 'ख'], prev: { no: 1, date: '2025-07-08' }, entries: [] }, '') as never);
  assert.match(two, /^पर्चा नं0 02 दिनाँक 15\.07\.2025\n/);
  assert.match(two, /दौरा- क व ख ।/);
  assert.match(two, /मे पर्चा नं0 01 दिनाँक 08\.07\.2025 को किता कर सेवा मे प्रेषित/);
  assert.doesNotMatch(two, /कार्यवाही-|मुकदमा साराशः/);
  assert.match(P.parchaHtml(one), /<span class="hl">पर्चा नं0 01/);
});

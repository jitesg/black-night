import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }`));
const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { caseDiaryBlocks, buildCaseDiaryPrintHtml, entryParagraphs } = await import('../src/lib/caseDiaryPrint.ts');

test('blocks: title, meta, entries, signature', () => {
  const b = caseDiaryBlocks({
    diaryNumber: 1, preparation_date: '2025-07-01', start_time: '10:30', end_time: '18:00', places: ['ग्राम मैहरोरा'],
    fir: { fir_number: '703/2025', section: '137(2) बीएनएस', complainant_name: 'आरती' },
    entries: [
      { entry_type: 'karyvahi', karyvahi_name: 'निरीक्षण घटना स्थल', vivran: '<p>पहला पैरा</p><p>दूसरा &amp; पैरा</p>' },
      { entry_type: 'narrative', narrative_text: 'सामान्य विवरण' },
      { entry_type: 'karyvahi', karyvahi_name: '', vivran: '' },
    ],
    policeStation: 'बछरावां', district: 'रायबरेली', officerName: 'जीतेश सिंह',
  }).join('\n');
  assert.match(b, /केस डायरी संख्या – 01/);
  assert.match(b, /703\/2025 धारा 137\(2\) बीएनएस/);
  assert.match(b, /01\.07\.2025/);
  assert.match(b, /निरीक्षण घटना स्थल –/);
  assert.match(b, /दूसरा &amp; पैरा/);
  assert.match(b, /सामान्य विवरण/);
  assert.match(b, /\( जीतेश सिंह \)/);
  assert.doesNotMatch(b, /कोई कार्यवाही/);
});
test('empty diary + marks stripped', () => {
  assert.match(buildCaseDiaryPrintHtml({ entries: [] }), /अभी कोई कार्यवाही/);
  assert.deepEqual(entryParagraphs('[[विवरण]] क\n\nख'), ['क', 'ख']);
});

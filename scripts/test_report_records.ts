/**
 * "हाल के कार्य" record rules (src/lib/reportRecordCore.ts).
 * Run: node --experimental-strip-types --test scripts/test_report_records.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const R = await import('../src/lib/reportRecordCore.ts');

test('summary: FIR number + first person / vehicle / name, else the विषय line', () => {
  assert.equal(R.reportSummary({ FIRNumber: '245/2026', Accused: JSON.stringify([{ name: 'राम कुमार' }]) }, ''), 'मु0अ0सं0 245/2026 · राम कुमार');
  assert.equal(R.reportSummary({ FIRNo: '1/26', Accused: JSON.stringify([{ name: 'क' }, { name: 'ख' }]) }, ''), 'मु0अ0सं0 1/26 · क आदि');
  assert.equal(R.reportSummary({ FIRNumber: '9/26', Vehicles: JSON.stringify([{ role: 'x', vno: 'UP58AT0846' }]) }, ''), 'मु0अ0सं0 9/26 · वाहन UP58AT0846');
  assert.equal(R.reportSummary({ EmpName: 'रामेश्वर यादव' }, ''), 'रामेश्वर यादव');
  assert.equal(R.reportSummary({}, 'रिपोर्ट थाना क\nसेवा में,\nविषय – चोरी वाहन को पोर्टल पर फ्लैग कराने हेतु।'), 'चोरी वाहन को पोर्टल पर फ्लैग कराने हेतु।');
});

test('module labels', () => {
  assert.equal(R.moduleLabel('NK'), 'निरोधात्मक');
  assert.equal(R.moduleLabel('BNSS Karyavahi'), 'निरोधात्मक');
  assert.equal(R.moduleLabel('Nyayalay'), 'न्यायालय');
  assert.equal(R.moduleLabel('GD'), 'GD');
  assert.equal(R.moduleLabel(null), 'प्रारूप');
});

test('ranges, day groups (आज / कल / date), time label, search', () => {
  const now = new Date(2026, 10, 1, 15, 0);
  const t = (d: number, h: number) => Math.floor(new Date(2026, 10, d, h, 5).getTime() / 1000);
  assert.equal(R.rangeStart('today', now), Math.floor(new Date(2026, 10, 1).getTime() / 1000));
  assert.equal(R.rangeStart('week', now), Math.floor(new Date(2026, 9, 26).getTime() / 1000));
  assert.equal(R.rangeStart('all', now), 0);
  const g = R.groupByDay([{ created_at: t(1, 14) }, { created_at: t(1, 9) }, { created_at: Math.floor(new Date(2026, 9, 31, 10).getTime() / 1000) }, { created_at: Math.floor(new Date(2026, 9, 29, 10).getTime() / 1000) }], now);
  assert.deepEqual(g.map((x) => [x.title, x.items.length]), [['आज — 01.11.2026', 2], ['कल — 31.10.2026', 1], ['29.10.2026', 1]]);
  assert.equal(R.timeLabel(t(1, 14)), '02:05 PM');
  assert.equal(R.timeLabel(t(1, 0)), '12:05 AM');
  const rec = { format_title: 'वाहन अवमुक्त आख्या', summary: 'मु0अ0सं0 245/2026 · राम', module: 'Nyayalay' };
  assert.equal(R.matchesRecord(rec, '245 राम'), true);
  assert.equal(R.matchesRecord(rec, 'न्यायालय'), true);
  assert.equal(R.matchesRecord(rec, 'श्याम'), false);
});

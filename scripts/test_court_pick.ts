// node --experimental-strip-types --test scripts/test_court_pick.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import type { PickPaper } from '../src/lib/courtPick.ts';
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const { courtPickSpecOf, fillValuesFrom, matchPaper, orderPapers, paperFir, paperPersonLine, typesFor } = await import('../src/lib/courtPick.ts');

const seed = JSON.parse(readFileSync('assets/seed/formats_seed.json', 'utf8'));
const f = seed.formats.find((x: { id: string }) => x.id === 'sys-gd-fmt-rawangi-samanya');
const spec = courtPickSpecOf(f.keys.find((k: { key_name: string }) => k.key_name === 'WType').dropdown_options)!;

const paper = (over: Partial<PickPaper>): PickPaper => ({
  id: 'x', doc_type: 'NBW', court_name: 'श्रीमान CJM', vad_sankhya: '77/26', apradh_sankhya: '', applicable_sections: '323 भादवि',
  fir_number: '', fir_year: '', deadline_date: '2026-12-05', person: null, ...over,
});

test('रवानगी WType spec: which papers per choice', () => {
  assert.deepEqual(typesFor(spec, 'NBW'), ['NBW', 'Summons']);
  assert.deepEqual(typesFor(spec, 'सम्मन'), ['NBW', 'Summons']);
  assert.deepEqual(typesFor(spec, 'मृत्यु आख्या'), ['Death_Report', 'NBW', 'Summons']);
  assert.deepEqual(typesFor(spec, ''), []);
  assert.equal(courtPickSpecOf('{"options":["a"]}'), null);
  assert.equal(courtPickSpecOf('not json'), null);
});

test('order: types in spec order, nearest deadline first; other types left out', () => {
  const list = [
    paper({ id: 'n2', doc_type: 'NBW', deadline_date: '2026-12-09' }),
    paper({ id: 's1', doc_type: 'Summons', deadline_date: '2026-11-30' }),
    paper({ id: 'd1', doc_type: 'Death_Report', deadline_date: '2026-12-20' }),
    paper({ id: 'n1', doc_type: 'NBW', deadline_date: '2026-11-28' }),
    paper({ id: 'b1', doc_type: 'Bail_Lower_Court' }),
  ];
  assert.deepEqual(orderPapers(list, typesFor(spec, 'मृत्यु आख्या')).map((p) => p.id), ['d1', 'n1', 'n2', 's1']);
  assert.deepEqual(orderPapers(list, typesFor(spec, 'NBW')).map((p) => p.id), ['n1', 'n2', 's1']);
});

test('fill: court, वाद सं0, मु0अ0सं0 (अपराध सं0 else fir/year), धारा, person card', () => {
  const p = paper({ apradh_sankhya: '409/18', person: { name: 'रामू', father_name: 'श्याम', address: 'ग्राम अघौरा', extra_json: '{"relation":"पुत्र"}' } });
  const v = fillValuesFrom(p, spec.fill);
  assert.equal(v.WCourt, 'श्रीमान CJM'); assert.equal(v.WCaseNo, '77/26'); assert.equal(v.WFir, '409/18'); assert.equal(v.WSec, '323 भादवि');
  const card = JSON.parse(v.WCard)[0];
  assert.equal(card.name, 'रामू'); assert.equal(card.fatherOrHusbandName, 'श्याम'); assert.equal(card.fullAddress, 'ग्राम अघौरा');
  assert.equal(paperFir(paper({ fir_number: '23', fir_year: '2019' })), '23/2019');
  assert.equal(paperFir(paper({ fir_number: '23/2019', fir_year: '2019' })), '23/2019');
  assert.equal(fillValuesFrom(paper({}), spec.fill).WCard, '');
  assert.equal(paperPersonLine(p), 'रामू पुत्र श्याम');
});

test('search: every word, person / court / numbers', () => {
  const p = paper({ apradh_sankhya: '409/18', person: { name: 'रामू', father_name: 'श्याम', address: 'ग्राम अघौरा' } });
  assert.ok(matchPaper(p, ''));
  assert.ok(matchPaper(p, 'रामू अघौरा'));
  assert.ok(matchPaper(p, '77/26'));
  assert.ok(!matchPaper(p, 'सुरेश'));
});

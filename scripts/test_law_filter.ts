/** Act section-list filter. Run: node --experimental-strip-types --test scripts/test_law_filter.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { classFlagsBySection, passesLawFilters, readClassText } = await import('../src/lib/law/lawFilter.ts');

test('schedule text → flags', () => {
  assert.deepEqual(readClassText('Cognizable.', 'cognizable'), { yes: true, no: false });
  assert.deepEqual(readClassText('Non-cognizable.', 'cognizable'), { yes: false, no: true });
  assert.deepEqual(readClassText('Cognizable. Non-cognizable.', 'cognizable'), { yes: true, no: true });
  assert.deepEqual(readClassText('Cognizable (only on the complaint of the victim).', 'cognizable'), { yes: true, no: false });
  assert.deepEqual(readClassText('According as offence abetted is cognizable or non-cognizable.', 'cognizable'), { yes: false, no: false });
  assert.deepEqual(readClassText('Non-bailable.', 'bailable'), { yes: false, no: true });
  assert.deepEqual(readClassText('Bailable.', 'bailable'), { yes: true, no: false });
});

test('BNS 103 संज्ञेय + अजमानतीय, 115(2) जमानतीय, real schedule data', () => {
  const rows = JSON.parse(readFileSync('assets/law/bnss_en.json', 'utf8')).at(-1).classification_of_offences;
  const m = classFlagsBySection(rows);
  assert.deepEqual(m.get(103), { cog: true, noncog: false, bail: false, nonbail: true });
  assert.equal(m.get(115)?.bail, true);
  assert.equal(m.get(115)?.cog, false);
  const f = { simple: true, detailed: false, cases: true, cls: m.get(103) };
  assert.ok(passesLawFilters(f, { cog: 'cog', bail: 'nonbail' }));
  assert.ok(!passesLawFilters(f, { bail: 'bail' }));
  assert.ok(!passesLawFilters(f, { have: 'detailed' }));
  assert.ok(passesLawFilters(f, { have: 'cases' }));
  assert.ok(passesLawFilters({ simple: false, detailed: false, cases: false }, {}));
  assert.ok(!passesLawFilters({ simple: false, detailed: false, cases: false }, { cog: 'noncog' }));
});

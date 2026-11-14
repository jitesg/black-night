import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateParts, toIsoDate, dateFormatOf, formatDateValue } from '../src/lib/formatDerived.ts';

test('parses picker and typed dates', () => {
  assert.deepEqual(dateParts('2026-11-05'), ['2026', '11', '05']);
  assert.deepEqual(dateParts('5.7.2025'), ['2025', '07', '05']);
  assert.deepEqual(dateParts('05/07/2025'), ['2025', '07', '05']);
  assert.equal(dateParts('कल'), null);
  assert.equal(dateParts(''), null);
});
test('iso for the picker', () => {
  assert.equal(toIsoDate('01.07.2025'), '2025-07-01');
  assert.equal(toIsoDate('xyz'), '');
});
test('dd/mm/yyyy output', () => {
  assert.equal(formatDateValue('2026-11-05', 'dd/mm/yyyy'), '05/11/2026');
  assert.equal(formatDateValue('01.07.2025', 'dd/mm/yyyy'), '01/07/2025');
  assert.equal(formatDateValue('', 'dd/mm/yyyy'), '');
  assert.equal(formatDateValue('हाथ से', 'dd/mm/yyyy'), 'हाथ से');
});
test('option read', () => {
  assert.equal(dateFormatOf('{"dateFormat":"dd/mm/yyyy","hint":"x"}'), 'dd/mm/yyyy');
  assert.equal(dateFormatOf('{"hint":"x"}'), null);
  assert.equal(dateFormatOf('a,b'), null);
});

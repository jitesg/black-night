import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firFillValue, hiDate } from '../src/lib/firFill.ts';

const fir = { fir_number: '703/2024', complainant_name: 'आरती', complainant_father: 'राजबहादुर', complainant_relation: 'पुत्री',
  complainant_gender: 'महिला', complainant_age: '13', complainant_address: 'ग्राम मैहरोरा थाना बछरावां', complainant_mobile: '+919876543210',
  date_of_information: '2025-07-01' };
test('वादी values', () => {
  assert.equal(firFillValue('complainant_vadi', fir), 'वादिनी');
  assert.equal(firFillValue('complainant_peedit', fir), 'पीड़िता');
  assert.equal(firFillValue('complainant_majroob_vadi', fir), 'मजरूबा/वादिनी');
  assert.equal(firFillValue('complainant_full', fir), 'आरती पुत्री राजबहादुर निवासी ग्राम मैहरोरा थाना बछरावां उम्र 13 वर्ष');
  assert.equal(firFillValue('complainant_age_years', fir), '13 वर्ष');
  assert.equal(firFillValue('complainant_mobile', fir), '9876543210');
  assert.equal(firFillValue('fir_date', fir), '01.07.2025');
  assert.equal(firFillValue('nope', fir), null);
  assert.equal(firFillValue('complainant_vadi', { complainant_name: 'राम' }), 'वादी');
  assert.equal(firFillValue('complainant_vadi', null), '');
});
test('accused rows', () => {
  const rows = JSON.parse(firFillValue('accused_rows', fir, [
    { is_known: 1, name: 'बबलू', address: 'रिशालखेड़ा', age: '25' }, { is_known: 0, name: '' }, { is_known: 1, name: 'x', deleted_at: 5 }]) ?? '[]');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'बबलू');
  assert.equal(firFillValue('accused_rows', fir, []), '');
  assert.equal(hiDate('03.02.2026'), '03.02.2026');
});
test('first accused + fallback', async () => {
  const { literalDefault, isMarkerDefault } = await import('../src/lib/firFill.ts');
  assert.equal(firFillValue('accused1_name', fir, [{ is_known: 0, name: '' }, { is_known: 1, name: 'बबलू', mobile: '9198765432100' }]), 'बबलू');
  assert.equal(literalDefault('@FIR.complainant_relation|पुत्री'), 'पुत्री');
  assert.equal(literalDefault('@FIR.fir_number'), '');
  assert.equal(literalDefault('पुत्र'), 'पुत्र');
  assert.equal(isMarkerDefault('__FROM_RELATED_FIR__'), true);
});

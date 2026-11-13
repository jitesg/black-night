/** निरोधात्मक card title. Run: node --experimental-strip-types --test scripts/test_nk_card_meta.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanFormatTitle } from '../src/lib/nirodhatmak/nkCardMeta.ts';

test('titles without section numbers', () => {
  assert.equal(cleanFormatTitle('बीट सूचना 126/135 की कार्यवाही'), 'बीट सूचना की कार्यवाही');
  assert.equal(cleanFormatTitle('126/135 थाना क्षेत्र भ्रमण दौरान सूचना'), 'थाना क्षेत्र भ्रमण दौरान सूचना');
  assert.equal(cleanFormatTitle('170/126/135 – PRV द्वारा लाए जाने पर (एकपक्षीय)'), 'PRV द्वारा लाए जाने पर (एकपक्षीय)');
  assert.equal(cleanFormatTitle('NCR में 126/135 की कार्यवाही'), 'NCR में की कार्यवाही');
  const seed = JSON.parse(readFileSync('assets/seed/formats_seed.json', 'utf8'));
  for (const f of seed.formats.filter((x: { format_type: string }) => x.format_type === 'BNSS Karyavahi')) {
    const c = cleanFormatTitle(f.title);
    assert.doesNotMatch(c, /\d+\/\d+/, f.title);
    assert.ok(c.length > 5, f.title);
  }
});


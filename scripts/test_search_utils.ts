/** Run: node --experimental-strip-types --test scripts/test_search_utils.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesQuery, smartMatch, searchNormalize, buildHighlightSegments, sqlWordFilter, fuzzyMatch } from '../src/lib/searchUtils.ts';

test('word-by-word, any order, any field', () => {
  assert.ok(matchesQuery('राम सिंह', 'राम प्रसाद सिंह'));
  assert.ok(matchesQuery('सिंह राम', 'राम प्रसाद सिंह'));
  assert.ok(matchesQuery('राम सरैया', 'राम प्रसाद', 'ग्राम सरैया'));
  assert.ok(!matchesQuery('राम श्याम', 'राम प्रसाद सिंह'));
  assert.ok(matchesQuery('  ', 'anything'));
});

test('Hindi spelling variants', () => {
  assert.ok(matchesQuery('पांच', 'पाँच हजार'));
  assert.ok(matchesQuery('पढ़ाई', 'पढ़ाई')); // precomposed ढ़ vs ढ + nukta
  assert.ok(matchesQuery('पढाई', 'पढ़ाई'));
  assert.ok(matchesQuery('उ0नि0', 'उ०नि० जीतेश'));
  assert.ok(matchesQuery('123/26', 'मु0अ0सं0 १२३/२६'));
  assert.ok(matchesQuery('section 302', 'Section 302, IPC'));
  assert.equal(searchNormalize('A.B,  C'), 'a b c');
});

test('typo tolerance (4+ letters, one letter)', () => {
  assert.ok(!smartMatch('yadva', ['ramesh yadav'], false));
  assert.ok(smartMatch('yadev', ['ramesh yadav'], true));
  assert.ok(fuzzyMatch('पांच', 'पाँच'));
});

test('highlight finds each word in the original text', () => {
  const segs = buildHighlightSegments('राम प्रसाद सिंह', 'सिंह राम');
  assert.deepEqual(segs.filter((s) => s.highlighted).map((s) => s.text), ['राम', 'सिंह']);
  const s2 = buildHighlightSegments('उ०नि० पढ़ाई', 'उ0नि0 पढाई');
  assert.deepEqual(s2.filter((s) => s.highlighted).map((s) => s.text), ['उ०नि०', 'पढ़ाई']);
  assert.equal(buildHighlightSegments('abc', '').length, 1);
});

test('SQL word filter: one group per word, loose patterns', () => {
  const f = sqlWordFilter(['a', 'b'], 'राम 12');
  assert.equal(f.sql, "(LOWER(COALESCE(a, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(b, '')) LIKE ? ESCAPE '\\') AND (LOWER(COALESCE(a, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(b, '')) LIKE ? ESCAPE '\\')");
  assert.deepEqual(f.params, ['%%ाम%', '%%ाम%', '%__%', '%__%'].map((p) => p.replace(/%+/g, '%')));
  assert.deepEqual(sqlWordFilter(['a'], ' '), { sql: '1=1', params: [] });
});

// व्यक्ति रजिस्टर (owner): merge the same person from many modules, rank for the typed name.
// node --experimental-strip-types --test scripts/test_people_registry.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const R = await import('../src/lib/peopleRegistry.ts');

const src = (module: string, title: string, role: string, at: number) => ({ module, title, role, date: '', at }) as never;

test('same mobile = one person, sources newest first, empty details filled from older rows', () => {
  const hits = R.mergePeople([
    { name: 'रामपाल', father: 'श्यामलाल', mobile: '+91 98765 43210', source: src('fir', 'मुकदमा 120/2026', 'वादी', 10) },
    { name: 'रामपाल', village: 'अघौरा', mobile: '9876543210', source: src('pp', 'प्रार्थना पत्र CO पेशी', 'आवेदक', 20) },
  ]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].father, 'श्यामलाल');
  assert.equal(hits[0].village, 'अघौरा');
  assert.equal(hits[0].mobile, '9876543210');
  assert.deepEqual(hits[0].sources.map((x) => x.module), ['pp', 'fir']);
});

test('no mobile: name + father + village decide; a different father = another person', () => {
  const hits = R.mergePeople([
    { name: 'राम सिंह', father: 'मोहन', village: 'मुरैनी', source: src('fir', 'मुकदमा 88/2025', 'अभियुक्त', 1) },
    { name: 'राम  सिंह', father: 'मोहन', village: 'मुरैनी', source: src('nk', 'निरोधात्मक', 'प्रथम पक्ष', 2) },
    { name: 'राम सिंह', father: 'सोहन', village: 'मुरैनी', source: src('halka', 'हल्का', '', 3) },
  ]);
  assert.equal(hits.length, 2);
  assert.equal(hits.find((h) => h.father === 'मोहन')!.sources.length, 2);
});

test('a row with a mobile and the same person without one join', () => {
  const hits = R.mergePeople([
    { name: 'सोनम', father: 'रामपाल', village: 'अघौरा', mobile: '9000000001', source: src('pp', 'प्रार्थना पत्र', 'आवेदक', 5) },
    { name: 'सोनम', father: 'रामपाल', village: 'अघौरा', source: src('recent', 'नोटिस', '', 3) },
  ]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].sources.length, 2);
});

test('rank: every word in the name, starts-with first, at most 5, too short → nothing', () => {
  const hits = R.mergePeople([
    { name: 'सीताराम', source: src('fir', 'a', 'वादी', 9) },
    { name: 'रामपाल', father: 'श्यामलाल', source: src('fir', 'b', 'वादी', 1) },
    { name: 'रामवती', source: src('halka', 'c', '', 2) },
    { name: 'मोहन', source: src('fir', 'd', '', 3) },
  ]);
  assert.deepEqual(R.rankPeople(hits, 'राम').map((h) => h.name), ['रामपाल', 'रामवती', 'सीताराम']);
  assert.deepEqual(R.rankPeople(hits, 'र'), []);
  assert.deepEqual(R.rankPeople(hits, 'पाल राम').map((h) => h.name), ['रामपाल']);
  assert.equal(R.rankPeople(hits, 'मोहन').length, 0); // typed in full and nothing more known
  assert.deepEqual(R.rankPeople(hits, 'रामपाल').map((h) => h.name), ['रामपाल']); // full name, but father is known
});

test('people inside saved form values (person cards / item rows)', () => {
  const vals = JSON.stringify({
    Avedak: JSON.stringify([{ name: 'सोनम', fatherOrHusbandName: 'रामपाल', relationType: 'पुत्री', village: 'अघौरा', mobile: '9' }, { name: '' }]),
    Accused: JSON.stringify([{ name: 'राजू', father: 'मोहन', addr: 'ग्राम मुरैनी' }]),
    Matter: 'कुछ',
  });
  const ppl = R.peopleInValues(vals);
  assert.equal(ppl.length, 2);
  assert.equal(ppl[0].father, 'रामपाल');
  assert.equal(ppl[1].address, 'ग्राम मुरैनी');
  assert.deepEqual(R.peopleInValues('not json'), []);
});

test('chip / sub line / place text', () => {
  const h = R.mergePeople([{ name: 'रामपाल', father: 'श्यामलाल', relation: 'पुत्र', age: '45', village: 'अघौरा', thana: 'बछरावां', source: src('fir', 'मुकदमा 120/2026', 'वादी', 1) }])[0];
  assert.equal(R.sourceChip(h.sources[0]), '📁 मुकदमा 120/2026 · वादी');
  assert.equal(R.hitSubline(h), 'पुत्र श्यामलाल · 45 वर्ष');
  assert.equal(R.hitPlace(h), 'ग्राम अघौरा, थाना बछरावां');
});

test('applyHitToCard: fills the card; parts address when the village is known, else the typed address; unknown keeps the card', () => {
  const pp = R.mergePeople([{ name: 'सोनम', father: 'रामपाल', relation: 'पुत्री', age: '22 वर्ष', mobile: '9000000001', house: 'मो0 पूर्वी टोला', village: 'अघौरा', thana: 'बछरावां', district: 'रायबरेली', source: src('pp', 'x', 'आवेदक', 1) }])[0];
  const c = R.applyHitToCard({ name: 'सो', thana: 'क', district: 'ख', remarks: 'r' } as Record<string, string>, pp);
  assert.equal(c.name, 'सोनम'); assert.equal(c.gender, 'महिला'); assert.equal(c.age, '22'); assert.equal(c.remarks, 'r');
  assert.equal(c.addrMode, 'parts');
  assert.equal(c.fullAddress, 'मो0 पूर्वी टोला ग्राम अघौरा थाना बछरावां जनपद रायबरेली');
  const fir = R.mergePeople([{ name: 'रामपाल', address: 'ग्राम अघौरा थाना बछरावां', source: src('fir', 'x', 'वादी', 1) }])[0];
  const d = R.applyHitToCard({ name: '', mobile: '9111111111', age: '40' } as Record<string, string>, fir);
  assert.equal(d.addrMode, 'free'); assert.equal(d.fullAddress, 'ग्राम अघौरा थाना बछरावां');
  assert.equal(d.mobile, '9111111111'); assert.equal(d.age, '40');
});

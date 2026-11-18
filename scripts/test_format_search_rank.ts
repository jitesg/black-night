/**
 * प्रारूप खोज का क्रम (owner: "35(3)" → the 35(3) formats on top). Run: node --experimental-strip-types --test scripts/test_format_search_rank.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const { sortBySearchRank, formatSearchRank } = await import('../src/lib/formatSearchRank.ts');
const { smartMatch } = await import('../src/lib/searchUtils.ts');

type F = { id: string; title: string; vivran: string; format_type: string; tags?: string[] };
const seed = JSON.parse(readFileSync(new URL('../assets/seed/formats_seed.json', import.meta.url), 'utf8')) as { formats: F[] };
const find = (q: string) => sortBySearchRank(seed.formats.filter((f) => smartMatch(q, [f.title, f.vivran, f.format_type, (f.tags ?? []).join(' ')])), q);
const ids = (q: string, n: number) => find(q).slice(0, n).map((f) => f.id);

test('35(3): both 35(3) formats first, the notice on top', () => {
  assert.deepEqual(ids('35(3)', 2), ['sys-fmt-notice-35-3-bnss', 'sys-fmt-cd-abhiyukt-bayan-35-3']);
  assert.ok(find('35(3)').length >= 18); // the same formats are still found
});

test('other section searches: the right format on top', () => {
  assert.equal(ids('179', 1)[0], 'sys-fmt-notice-179-bnss');
  assert.ok(find('170').slice(0, 7).every((f) => f.id.startsWith('sys-fmt-bnss170-')));
  assert.ok(find('126').slice(0, 3).every((f) => /126\/135/.test(f.title)));
  assert.equal(ids('60(1)', 1)[0], 'sys-fmt-fard-60-1-daru');
  assert.equal(ids('183', 1)[0], 'sys-fmt-bayan-183-patra');
  assert.equal(ids('480(2)', 1)[0], 'sys-gd-fmt-aaropi-avmukt');
});

test('a number matches only a whole number', () => {
  assert.equal(formatSearchRank('35', { title: '126/135 थाना क्षेत्र भ्रमण' })[0], 3);
  assert.equal(formatSearchRank('35', { title: 'धारा 35(3) BNSS' })[0], 0);
  assert.equal(formatSearchRank('रवानगी', { title: 'रवानगी उ0नि0' })[0], 0);
  assert.equal(formatSearchRank('उ0नि0 रवानगी', { title: 'रवानगी उ0नि0' })[0], 1);
  assert.equal(formatSearchRank('gd', { title: 'x', tags: ['GD'] })[0], 2);
});

test('"प्रारूप चुनें" lists: query → rank first, a tie keeps the list order', () => {
  // like prarthna-patra / nirodhatmak select-format: this paper's formats first, then the rest
  const pp = seed.formats.filter((f) => f.format_type === 'Prarthna Patra');
  const rest = seed.formats.filter((f) => f.format_type !== 'Prarthna Patra');
  const list = [...pp, ...rest].filter((f) => smartMatch('35(3)', [f.title, f.vivran, f.format_type, (f.tags ?? []).join(' ')]));
  const out = sortBySearchRank(list, '35(3)', true);
  assert.deepEqual(out.slice(0, 2).map((f) => f.id), ['sys-fmt-notice-35-3-bnss', 'sys-fmt-cd-abhiyukt-bayan-35-3']);
  // the rest keep their list order (Prarthna Patra ones still before the others)
  const tail = out.slice(2).map((f) => f.format_type);
  const firstOther = tail.findIndex((t) => t !== 'Prarthna Patra');
  assert.ok(firstOther === -1 || tail.slice(firstOther).every((t) => t !== 'Prarthna Patra'));
});

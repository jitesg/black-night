/** 🔍 inside long info notes. Run: node --experimental-strip-types --test scripts/test_info_search.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
));
const { filterInfoBlocks, isLongInfo } = await import('../src/lib/infoSearch.ts');
const load = (p: string) => JSON.parse(readFileSync(p, 'utf8')).blocks;
const raw = load('assets/format-info/sys-gd-fmt-rawangi-samanya.json');

test('long notes get the 🔍, short ones not', () => {
  assert.ok(isLongInfo(raw));
  assert.ok(isLongInfo(load('assets/law-notes/BNSS-35.json')));
  assert.ok(isLongInfo(load('assets/law-notes/BNSS-194.json')));
  assert.ok(!isLongInfo(load('assets/format-info/sys-fmt-notice-179-bnss.json')));
  assert.ok(!isLongInfo(load('assets/format-info/sys-fmt-notice-35-3-bnss.json')));
});

test('रवानगी samples: only matching parts, with their section heading', () => {
  const r = filterInfoBlocks(raw, 'हाईकोर्ट');
  assert.equal(r.count, 1);
  assert.deepEqual(r.blocks.map((b: { t: string; x?: string }) => b.x?.slice(0, 20)), ['1. उप-निरीक्षक (उ0नि0', '(11) रवानगी उ0नि0 हा', 'इस समय उ0नि0 ……… को '].map((s) => s.slice(0, 20)));
  const a = filterInfoBlocks(raw, 'अवकाश');
  assert.equal(a.count, 3);
  assert.equal(a.blocks.filter((b: { t: string }) => b.t === 'h').length, 2); // both sections
  // every word anywhere, any order
  assert.equal(filterInfoBlocks(raw, 'निरीक्षक अवकाश').count, 2); // (8) प्रभारी निरीक्षक + (11) निरीक्षक; (23) is उ0नि0
  assert.equal(filterInfoBlocks(raw, 'xyzxyz').count, 0);
  assert.equal(filterInfoBlocks(raw, '').blocks, raw);
});

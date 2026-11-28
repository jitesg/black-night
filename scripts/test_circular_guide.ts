// node --experimental-strip-types --test scripts/test_circular_guide.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { boldParts, checklistProgress, guideSections, lawPairs, parseGuide, parseOldLaw } from '../src/lib/circularGuideCore.ts';

const lawMap = JSON.parse(readFileSync('assets/law/law_map.json', 'utf8'));

test('every guide file parses and belongs to a real परिपत्र', () => {
  const seedIds = new Set<string>();
  for (const f of readdirSync('assets/seed').filter((x) => x.startsWith('circulars_seed'))) {
    const d = JSON.parse(readFileSync(`assets/seed/${f}`, 'utf8'));
    const arr = Array.isArray(d) ? d : (d.entries || d.items || d.rows || Object.values(d).find(Array.isArray));
    for (const e of arr) seedIds.add(e.id);
  }
  const files = readdirSync('assets/circular-guides').filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 1);
  for (const f of files) {
    const g = parseGuide(JSON.parse(readFileSync(`assets/circular-guides/${f}`, 'utf8')));
    assert.ok(g, f);
    assert.ok(seedIds.has(f.replace(/\.json$/, '')), `${f}: no such परिपत्र`);
    for (const r of g!.related ?? []) assert.ok(seedIds.has(r.id), `${f}: related ${r.id} missing`);
    for (const p of lawPairs(g!.laws ?? [], lawMap.rev)) assert.ok(p.news.length, `${f}: ${p.old} has no new section`);
  }
});

test('70/2013: sections, laws, checklist', () => {
  const g = parseGuide(JSON.parse(readFileSync('assets/circular-guides/sys-circ-dg-70-2013.json', 'utf8')))!;
  assert.deepEqual(guideSections(g).map((s) => s.label), ['विवरण', 'समस्या', 'निर्देश', 'DGP', 'वाद', 'चेकलिस्ट']);
  assert.deepEqual(lawPairs(g.laws!, lawMap.rev).map((p) => `${p.old}→${p.news.map((n) => `${n.act} ${n.n}`).join(',')}`),
    ['IPC 363→BNS 137', 'IPC 366→BNS 87', 'CrPC 161→BNSS 180', 'CrPC 164→BNSS 183', 'CrPC 173→BNSS 193']);
  const items = g.checklist!.items;
  assert.deepEqual(checklistProgress(items, new Set([0, 1, 2]), false), { done: 3, total: 3, complete: true });
  assert.deepEqual(checklistProgress(items, new Set([0, 1, 2]), true), { done: 3, total: 4, complete: false });
});

test('helpers', () => {
  assert.equal(parseGuide({ short: 'x' }), null, 'no section → null');
  assert.equal(parseGuide(null), null);
  assert.deepEqual(parseOldLaw('Cr.P.C. 164'), { act: 'CrPC', sec: '164' });
  assert.equal(parseOldLaw('BNS 103'), null);
  assert.deepEqual(boldParts('a **b** c').map((p) => p.bold), [false, true, false]);
});

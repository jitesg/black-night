/**
 * Tests for BNS संदर्भ (IPC ↔ BNS finder).
 * Run: node --experimental-strip-types --test scripts/test_bns_ref.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  findBns, textFor, isRemoved, rowTitle, parseFlags, flagsDepend, secTokens, normSec, parseCopilotRefs,
  copilotMatches, copilotContext, NOT_IN_BNS, type BnsCompareData,
} from '../src/lib/bnsRef/bnsCore.ts';

const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as T;
const data = read<BnsCompareData>('../assets/ref/bns_compare.json');
const lawMap = read<{ rev: { IPC: Record<string, [string, string][]> } }>('../assets/law/law_map.json');
const seed = read<{ knowledge: { id: string; content_type: string; description: string }[] }>('../assets/seed/bns_ref_seed.json');

test('data loads: 595 rows, 144 text keys, 10 seed rows, law_map 309 → 226', () => {
  assert.equal(data.rows.length, 595);
  assert.equal(Object.keys(data.text).length, 144);
  assert.equal(seed.knowledge.length, 10);
  assert.ok(seed.knowledge.every((r) => r.content_type === 'bns_ref' && r.id.startsWith('sys-ref-bns-')));
  assert.deepEqual(lawMap.rev.IPC['309'], [['BNS', '226']]);
});

test('normalise', () => {
  assert.equal(normSec('498 A'), '498a');
  assert.equal(normSec('498-A'), '498a');
  assert.deepEqual(secTokens('20 21'), ['20', '21']);
  assert.deepEqual(secTokens('161 to 165- A'), ['161', '165a']);
  assert.deepEqual(parseFlags(['C/NB']), ['C', 'NB']);
  assert.deepEqual(parseFlags(['C', 'N']), ['C', 'N']);
});

test('IPC → BNS: 302→103, 420→318, 498A→85, 309→226', () => {
  assert.equal(findBns(data.rows, '302', 'ipc')[0].bns, '103');
  assert.match(findBns(data.rows, '420', 'ipc')[0].bns!, /^318/);
  assert.equal(findBns(data.rows, '498A', 'ipc')[0].bns, '85');
  assert.equal(findBns(data.rows, '498 a', 'ipc')[0].bns, '85');
  assert.equal(findBns(data.rows, '309', 'ipc')[0].bns, '226');
});

test('BNS → IPC: 103→302; 351 matches 351(2); multi-token IPC cells', () => {
  assert.equal(findBns(data.rows, '103', 'bns')[0].ipc, '302');
  assert.ok(findBns(data.rows, '351', 'bns').some((r) => r.bns === '351(2)'));
  assert.ok(findBns(data.rows, '21', 'ipc').some((r) => r.ipc === '20 21'));
});

test('124A → NA / हटाई', () => {
  const r = findBns(data.rows, '124A', 'ipc')[0];
  assert.ok(isRemoved(r));
  assert.match(rowTitle(r), new RegExp(NOT_IN_BNS.replace(/[()]/g, '\\$&')));
});

test('351 detail shows Annex text; flags; empty query', () => {
  const r = findBns(data.rows, '506', 'ipc')[0];
  assert.equal(r.bns, '351(2)');
  const t = textFor(data, r.bns);
  assert.ok(t.length >= 1 && t[0].annex === 'V' && /criminal intimidation/i.test(t[0].t ?? ''));
  assert.equal(flagsDepend(r), false);
  assert.ok(flagsDepend(findBns(data.rows, '109', 'ipc')[0]));
  assert.deepEqual(findBns(data.rows, '', 'ipc'), []);
  assert.ok(findBns(data.rows, 'murder', 'title').length > 0);
  assert.deepEqual(findBns([{}] as never, '1', 'ipc'), []); // missing fields never crash
});

test('Copilot refs + context', () => {
  assert.deepEqual(parseCopilotRefs('IPC 302 ka BNS kya hai'), [{ mode: 'ipc', no: '302' }]);
  assert.deepEqual(parseCopilotRefs('धारा 103 BNS'), [{ mode: 'bns', no: '103' }]);
  assert.deepEqual(parseCopilotRefs('IPC 498-A'), [{ mode: 'ipc', no: '498A' }]);
  const hits = copilotMatches(data.rows, 'IPC 302 aur BNS 318', 3);
  assert.ok(hits.length >= 2 && hits[0].bns === '103');
  assert.match(copilotContext(hits), /Delhi Police/);
  assert.match(copilotContext(hits), /BNSS प्रथम अनुसूची/);
});

test('seed rows have 4 sections', () => {
  for (const r of seed.knowledge) {
    const heads = r.description.split('\n').filter((l) => l.startsWith('## '));
    assert.equal(heads.length, 4, r.id);
  }
});

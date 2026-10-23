/**
 * Tests for the "न्यायिक निर्णय (पुलिस)" hub (L39).
 * Run: node --experimental-strip-types --test scripts/test_cases.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  mergeIndexes, orderedIds, actOfId, neighbours, parseRegSections, parseSimpleItems, parseExamples, type RegIndexData,
} from '../src/lib/regulations/regCore.ts';
import { buildCaseItems, filterCases, parseCaseMeta, topicOrder } from '../src/lib/cases/caseCore.ts';

const read = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as T;
const idx = read<RegIndexData>('../assets/reg/cases_index.json');
type Row = { id: string; title: string; tags: string; subcategory: string; description: string; content_type: string; category: string };
const seedFiles = readdirSync(new URL('../assets/seed/', import.meta.url)).filter((f) => /^cases_seed_\d+\.json$/.test(f)).sort();
const rows: Row[] = seedFiles.flatMap((f) => read<{ knowledge: Row[] }>(`../assets/seed/${f}`).knowledge);
const items = buildCaseItems(idx, rows);

test('data: 61 rows (seed 1+2+3), sidecar 61 paras / 18 chapters, all rows in sidecar', () => {
  assert.equal(rows.length, 61);
  assert.equal(new Set(rows.map((r) => r.id)).size, 61);
  assert.ok(rows.every((r) => r.content_type === 'case_note' && r.category === 'Law' && r.id.startsWith('sys-case-')));
  assert.equal(Object.keys(idx.paras).length, 61);
  assert.equal(idx.chapters.length, 18);
  assert.ok(rows.every((r) => idx.paras[r.id]));
});

test('sidecar merge with the other indexes; act routing; neighbours stay in the hub', () => {
  const reg = read<RegIndexData>('../assets/reg/reg_index.json');
  const pocso = read<RegIndexData>('../assets/reg/pocso_index.json');
  const women = read<RegIndexData>('../assets/reg/women_index.json');
  const all = mergeIndexes(reg, pocso, women, idx);
  assert.equal(Object.keys(all.paras).length, 509 + 47 + 124 + 61);
  assert.equal(actOfId('sys-case-joginder-kumar'), 'case');
  assert.equal(orderedIds(all, 'case').length, 61);
  assert.equal(orderedIds(all, 'uppr').length, 509);
  const n = neighbours(all, 'sys-case-joginder-kumar');
  assert.ok(n.prev?.startsWith('sys-case-') && n.next?.startsWith('sys-case-'));
});

test('Joginder Kumar: 4 sections, ✔/✘ items, sub-headings, update callouts, tip', () => {
  const r = rows.find((x) => x.id === 'sys-case-joginder-kumar')!;
  const s = parseRegSections(r.description);
  assert.equal(s.title, 'गिरफ़्तारी सिर्फ़ अधिकार नहीं — ज़रूरत भी साबित हो');
  assert.match(s.breadcrumb, /^Joginder Kumar v\. State of U\.P\. and Others — \(1994\) 4 SCC 260/);
  for (const k of ['original', 'simple', 'examples', 'related'] as const) assert.equal(s[k].pending, false, k);
  const it = parseSimpleItems(s.simple.body);
  const kinds = (k: string) => it.filter((x) => x.kind === k);
  assert.deepEqual(kinds('heading').map((x) => x.text), ['मामला', 'न्यायालय ने क्या कहा', 'पुलिस के लिए — क्या करें', 'क्या न करें']);
  assert.equal(kinds('do').length, 4);
  assert.equal(kinds('dont').length, 3);
  assert.equal(kinds('update').length, 3);
  assert.equal(kinds('tip').length, 1);
  assert.ok(parseExamples(s.examples.body).every((e) => e.num !== undefined));
});

test('every row parses: headings never swallowed into bullets', () => {
  for (const r of rows) {
    const it = parseSimpleItems(parseRegSections(r.description).simple.body);
    assert.ok(it.filter((x) => x.kind === 'heading').length >= 4, r.id);
    assert.ok(!it.some((x) => x.kind === 'bullet' && /न्यायालय ने क्या कहा:|क्या न करें:/.test(x.text)), r.id);
  }
});

test('meta: court, citation, update flag', () => {
  const j = items.find((x) => x.id === 'sys-case-joginder-kumar')!;
  assert.equal(j.meta.court, 'SC');
  assert.match(j.meta.citation, /1994/);
  assert.equal(j.meta.hasUpdate, true);
  assert.equal(items.filter((x) => x.available).length, 61);
  assert.equal(parseCaseMeta(undefined).court, 'HC'); // never throws
});

test('search "Basu" → D.K. Basu note; topic chip; court filter; verified toggle', () => {
  const basu = filterCases(items, { query: 'Basu' });
  assert.ok(basu.some((x) => /D\.?\s?K\.?\s?Basu/i.test(x.meta.caseName || x.para?.en || '')), 'D.K. Basu in results');
  assert.ok(filterCases(items, { query: 'D.K. Basu' }).length >= 1);
  const topic = 'I.4 गिरफ़्तारी और अभिरक्षा';
  const inTopic = filterCases(items, { topic });
  assert.ok(inTopic.length >= 1 && inTopic.every((x) => x.topic === topic));
  assert.ok(inTopic.some((x) => x.id === 'sys-case-joginder-kumar'));
  const hc = filterCases(items, { court: 'HC' });
  assert.ok(hc.length >= 13 && hc.every((x) => x.meta.court === 'HC'));
  assert.equal(filterCases(items, { verifiedOnly: true }).length, 61);
  const fake = buildCaseItems({ ...idx, paras: { ...idx.paras, 'sys-case-joginder-kumar': { ...idx.paras['sys-case-joginder-kumar'], verified: false } } }, rows);
  assert.equal(filterCases(fake, { verifiedOnly: true }).length, 60);
  assert.ok(filterCases(items, { query: 'BNSS 35' }).length >= 1);
  assert.equal(topicOrder(idx, items)[0], 'I.1 क्षेत्राधिकार और विवेचना के अधिकार');
});

test('a row without a sidecar entry does not crash', () => {
  const extra = { id: 'sys-case-zz-test', title: 'X v. Y — test', tags: 'High Court', subcategory: 'न्यायिक निर्णय — अन्य', description: '# शीर्षक\n(X v. Y — 2020)\n' };
  const its = buildCaseItems(idx, [...rows, extra]);
  const z = its.find((x) => x.id === 'sys-case-zz-test')!;
  assert.equal(z.para, null);
  assert.equal(z.title, 'शीर्षक');
  assert.equal(z.meta.citation, '2020');
  assert.equal(filterCases(its, { verifiedOnly: true }).some((x) => x.id === z.id), false);
  assert.deepEqual(buildCaseItems(null, []), []);
});

test('search ignores nukta encoding (ड़ precomposed vs decomposed)', () => {
  const pre = 'हथकड़ी';      // ड़ as one code point
  const dec = 'हथकड़ी';     // ड + nukta
  assert.equal(filterCases(items, { query: pre }).length, filterCases(items, { query: dec }).length);
  assert.ok(filterCases(items, { query: dec }).length >= 1);
});

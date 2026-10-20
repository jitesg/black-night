/**
 * Unit tests for UP Police Regulations helpers (Task L35).
 * Run: node --experimental-strip-types --test scripts/test_regulations.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseRegSections, parseSimpleItems, parseExamples, normalizeParaNo, extractParaNo,
  searchParas, joinSidecar, neighbours, progress, paraIdFromNo, orderedIds, sectionsToPlainText,
  type RegIndexData, type RegSearchItem,
} from '../src/lib/regulations/regCore.ts';

const index = JSON.parse(readFileSync(new URL('../assets/reg/reg_index.json', import.meta.url), 'utf8')) as RegIndexData;
const seed = JSON.parse(readFileSync(new URL('../assets/seed/reg_seed_1.json', import.meta.url), 'utf8')) as {
  knowledge: { id: string; title: string; description: string; tags: string; content_type: string; category: string }[];
};

// ── Section parser ──────────────────────────────────────────────────────────

test('parser: full 4-section description (para 97)', () => {
  const row = seed.knowledge.find((r) => r.id === 'sys-reg-up-97')!;
  const s = parseRegSections(row.description);
  assert.match(s.title, /^पैरा 97 — /);
  assert.match(s.breadcrumb, /^UP Police Regulations · भाग II/);
  assert.ok(s.original.body.startsWith('Process for information'));
  assert.equal(s.original.pending, false);
  assert.equal(s.simple.pending, false);
  assert.equal(s.examples.pending, false);
  assert.equal(s.related.pending, false);
  const items = parseSimpleItems(s.simple.body);
  assert.ok(items.filter((i) => i.kind === 'bullet').length >= 5);
  assert.equal(items.filter((i) => i.kind === 'update').length, 1);
  assert.equal(items.filter((i) => i.kind === 'tip').length, 1);
  const ex = parseExamples(s.examples.body);
  assert.equal(ex.length, 2);
  assert.equal(ex[0].label, 'रात में आई मौखिक सूचना');
  assert.ok(ex[0].scenario.length > 20);
});

test('parser: placeholder sections are pending (para 5)', () => {
  const row = seed.knowledge.find((r) => r.id === 'sys-reg-up-5')!;
  const s = parseRegSections(row.description);
  assert.equal(s.original.pending, false);
  assert.equal(s.simple.pending, true);
  assert.equal(s.examples.pending, true);
  assert.equal(s.related.pending, true);
});

test('parser: tolerant to missing / unnumbered / empty input', () => {
  const s = parseRegSections('# पैरा 9 — X\n(crumb)\n\n## 1. मूल पाठ (Original — English)\nHello\n\n## संबंधित कानून\n- CrPC 1');
  assert.equal(s.title, 'पैरा 9 — X');
  assert.equal(s.breadcrumb, 'crumb');
  assert.equal(s.original.body, 'Hello');
  assert.equal(s.simple.pending, true);
  assert.equal(s.examples.pending, true);
  assert.equal(s.related.body, '- CrPC 1');
  const e = parseRegSections(undefined);
  assert.equal(e.title, '');
  assert.equal(e.original.pending, true);
  const noHead = parseRegSections('just some text');
  assert.equal(noHead.original.pending, true);
});

test('parser: every seed row parses into 4 sections', () => {
  for (const r of seed.knowledge) {
    const s = parseRegSections(r.description);
    assert.ok(s.title.startsWith('पैरा'), r.id);
    assert.ok(s.original.heading.startsWith('1.'), r.id);
    assert.ok(s.related.heading.startsWith('4.'), r.id);
  }
});

// ── Para number search ──────────────────────────────────────────────────────

test('para numbers: normalise and extract', () => {
  assert.equal(normalizeParaNo('104a'), '104-A');
  assert.equal(normalizeParaNo('104 - A'), '104-A');
  assert.equal(normalizeParaNo('097'), '97');
  assert.equal(normalizeParaNo('malkhana'), null);
  assert.equal(extractParaNo('पैरा 97'), '97');
  assert.equal(extractParaNo('reg 104-A'), '104-A');
  assert.equal(extractParaNo('para 154 kya kehta hai'), '154');
  assert.equal(extractParaNo('पैरा ९७'), '97');
  assert.equal(extractParaNo('UPPR पैरा 104 क्या कहता है'), '104');
  assert.equal(extractParaNo('97'), '97');
  assert.equal(extractParaNo('मालखाना नियम'), null);
  assert.equal(paraIdFromNo('104-A'), 'sys-reg-up-104-a');
});

const items: RegSearchItem[] = Object.entries(index.paras).map(([id, p]) => ({ id, no: p.no, title: p.t, en: p.en }));

test('search: "104-A" jumps to para 104-A first (synthetic list)', () => {
  const list: RegSearchItem[] = [
    { id: 'a', no: '104', title: 'Hundred four' },
    { id: 'b', no: '104-A', title: 'Hundred four A' },
    { id: 'c', no: '14', title: 'Fourteen' },
  ];
  assert.equal(searchParas(list, 'reg 104-A')[0].no, '104-A');
  assert.equal(searchParas(list, '104a')[0].no, '104-A');
});

test('search: "reg 96-A" jumps to real para 96-A', () => {
  const r = searchParas(items, 'reg 96-A');
  assert.equal(r[0].id, 'sys-reg-up-96-a');
});

test('search: "पैरा 97" jumps to para 97 first', () => {
  const r = searchParas(items, 'पैरा 97');
  assert.equal(r[0].id, 'sys-reg-up-97');
});

test('search: "96" puts 96 first then 96-A', () => {
  const r = searchParas(items, '96');
  assert.equal(r[0].no, '96');
  assert.equal(r[1].no, '96-A');
});

test('search: keyword matches title', () => {
  const r = searchParas(items, 'FIR');
  assert.ok(r.length > 0);
  assert.ok(r.some((x) => x.id === 'sys-reg-up-97'));
});

// ── Sidecar join ────────────────────────────────────────────────────────────

test('sidecar: join, order, neighbours, progress', () => {
  const p = joinSidecar(index, 'sys-reg-up-97')!;
  assert.equal(p.no, '97');
  assert.equal(p.done, true);
  assert.equal(p.law?.[0].old, 'CrPC 154');
  assert.equal(joinSidecar(index, 'sys-reg-up-99999'), null);
  assert.equal(joinSidecar(null, 'sys-reg-up-97'), null);
  const ids = orderedIds(index);
  assert.equal(ids.length, 509);
  const n = neighbours(index, 'sys-reg-up-1');
  assert.equal(n.prev, null);
  assert.equal(n.next, 'sys-reg-up-1-a');
  assert.deepEqual(progress(index), { done: 47, total: 509 });
  const seedIds = seed.knowledge.map((r) => r.id);
  assert.equal(seedIds.length, 109);
  assert.equal(seedIds.filter((id) => !joinSidecar(index, id)).length, 0);
  assert.equal(seedIds.filter((id) => joinSidecar(index, id)?.done).length, 24);
});

test('share text has all 4 headings', () => {
  const row = seed.knowledge.find((r) => r.id === 'sys-reg-up-5')!;
  const txt = sectionsToPlainText(row.title, parseRegSections(row.description));
  assert.match(txt, /1\. मूल पाठ/);
  assert.match(txt, /4\. संबंधित/);
  assert.match(txt, /जल्द उपलब्ध/);
});

test('related labels from section 4 (para 97)', async () => {
  const { relatedLabels } = await import('../src/lib/regulations/regCore.ts');
  const row = seed.knowledge.find((r) => r.id === 'sys-reg-up-97')!;
  const s = parseRegSections(row.description);
  const circ = relatedLabels(s.related.body, /परिपत्र/);
  assert.equal(circ.length, 2);
  assert.match(circ[0], /^डीजी परिपत्र संख्या-21\/2013/);
  assert.equal(relatedLabels(s.related.body, /^SOP/).length, 0);
});

// ── L36: POCSO ──────────────────────────────────────────────────────────────

test('POCSO: section sort order … 42, 42A, 43', async () => {
  const { compareSectionNo, orderedIds, mergeIndexes } = await import('../src/lib/regulations/regCore.ts');
  const nos = ['43', '42A', '2', '42', '10', '1'];
  assert.deepEqual([...nos].sort(compareSectionNo), ['1', '2', '10', '42', '42A', '43']);
  const pocso = JSON.parse(readFileSync(new URL('../assets/reg/pocso_index.json', import.meta.url), 'utf8'));
  const merged = mergeIndexes(index, pocso);
  const ids = orderedIds(merged, 'pocso');
  assert.equal(ids.length, 47);
  const i42 = ids.indexOf('sys-reg-pocso-42');
  assert.equal(ids[i42 + 1], 'sys-reg-pocso-42a');
  assert.equal(ids[i42 + 2], 'sys-reg-pocso-43');
  assert.equal(ids[0], 'sys-reg-pocso-1');
});

test('POCSO: id-prefix routing (act, labels, ids, neighbours stay in the Act)', async () => {
  const { actOfId, ACT_META, paraIdFromNo, neighbours, mergeIndexes } = await import('../src/lib/regulations/regCore.ts');
  assert.equal(actOfId('sys-reg-pocso-6'), 'pocso');
  assert.equal(actOfId('sys-reg-up-97'), 'uppr');
  assert.equal(ACT_META.pocso.unit, 'धारा');
  assert.equal(ACT_META.uppr.unit, 'पैरा');
  assert.equal(paraIdFromNo('42A', 'pocso'), 'sys-reg-pocso-42a');
  assert.equal(paraIdFromNo(extractParaNo('धारा 42A')!, 'pocso'), 'sys-reg-pocso-42a');
  assert.equal(paraIdFromNo('104-A'), 'sys-reg-up-104-a');
  const pocso = JSON.parse(readFileSync(new URL('../assets/reg/pocso_index.json', import.meta.url), 'utf8'));
  const merged = mergeIndexes(index, pocso);
  assert.deepEqual(neighbours(merged, 'sys-reg-pocso-1'), { prev: null, next: 'sys-reg-pocso-2' });
  assert.equal(neighbours(merged, 'sys-reg-pocso-46').next, null);
  assert.equal(neighbours(merged, 'sys-reg-up-1').prev, null);
  assert.ok(neighbours(merged, 'sys-reg-up-1').next?.startsWith('sys-reg-up-'));
});

test('POCSO: sidecar merge + seed rows + search', async () => {
  const { mergeIndexes, progress, joinSidecar, searchParas, parseSimpleItems } = await import('../src/lib/regulations/regCore.ts');
  const pocso = JSON.parse(readFileSync(new URL('../assets/reg/pocso_index.json', import.meta.url), 'utf8'));
  const merged = mergeIndexes(index, pocso);
  assert.equal(Object.keys(merged.paras).length, 509 + 47);
  assert.deepEqual(progress(merged, 'pocso'), { done: 47, total: 47 });
  assert.deepEqual(progress(merged, 'uppr'), { done: 47, total: 509 });
  assert.equal(joinSidecar(merged, 'sys-reg-pocso-6')?.part, 'POCSO');
  assert.equal(joinSidecar(merged, 'sys-reg-up-97')?.no, '97');
  const pseed = JSON.parse(readFileSync(new URL('../assets/seed/pocso_seed.json', import.meta.url), 'utf8')).knowledge as { id: string; description: string }[];
  assert.equal(pseed.length, 47);
  assert.equal(pseed.filter((r) => joinSidecar(merged, r.id)?.done).length, 47);
  // 2019 update callouts are parsed (label kept) for sections 4, 5, 6, 9, 14, 15
  for (const n of ['4', '5', '6', '9', '14', '15']) {
    const r = pseed.find((x) => x.id === `sys-reg-pocso-${n}`)!;
    const items = parseSimpleItems(parseRegSections(r.description).simple.body);
    const up = items.filter((x) => x.kind === 'update');
    assert.ok(up.length >= 1, `section ${n} has an update`);
    assert.ok(up.some((x) => x.kind === 'update' && /2019/.test(x.label ?? '')), `section ${n} 2019 label`);
  }
  const pitems = Object.entries(pocso.paras).map(([id, p]: [string, any]) => ({ id, no: p.no, title: p.t, en: p.en }));
  assert.equal(searchParas(pitems, '42A')[0].id, 'sys-reg-pocso-42a');
  assert.equal(searchParas(pitems, 'धारा 19')[0].id, 'sys-reg-pocso-19');
  assert.equal(searchParas(pitems, '6')[0].id, 'sys-reg-pocso-6');
  assert.ok(searchParas(pitems, 'reporting').some((x) => x.id === 'sys-reg-pocso-19'));
  assert.ok(searchParas(pitems, 'पोर्नोग्राफी').some((x) => x.id === 'sys-reg-pocso-13'));
  assert.ok(searchParas(pitems, 'special court').some((x) => x.id === 'sys-reg-pocso-28'));
});

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
  assert.deepEqual(progress(index), { done: 87, total: 509 }); // L38: 87 paras with Hindi
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
  assert.deepEqual(progress(merged, 'uppr'), { done: 87, total: 509 });
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

// ── L37A: women-protection Acts ─────────────────────────────────────────────

import {
  compareSectionNo, mergeIndexes, actOfId, sectionLabel, isSensitiveId, WOMEN_ACTS,
} from '../src/lib/regulations/regCore.ts';

const readJson = <T,>(rel: string): T => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as T;
const womenIndex = readJson<RegIndexData>('../assets/reg/women_index.json');
const pocsoIndex = readJson<RegIndexData>('../assets/reg/pocso_index.json');

test('women: section sort order', () => {
  const sortNos = (a: string[]) => [...a].sort(compareSectionNo);
  assert.deepEqual(sortNos(['9', '8B', '4A', '5', '8', '4', '8A']), ['4', '4A', '5', '8', '8A', '8B', '9']);
  assert.deepEqual(sortNos(['3', '2A', '2']), ['2', '2A', '3']);
  assert.deepEqual(sortNos(['11', '10A', '9']), ['9', '10A', '11']);
  assert.deepEqual(sortNos(['1', '0', '12']), ['0', '1', '12']);
});

test('women: sidecar triple-merge keeps every row and orders each Act', () => {
  const all = mergeIndexes(index, pocsoIndex, womenIndex);
  const n = (d: RegIndexData) => Object.keys(d.paras).length;
  assert.equal(n(all), n(index) + n(pocsoIndex) + n(womenIndex));
  assert.equal(n(womenIndex), 124);
  const counts = Object.fromEntries(WOMEN_ACTS.map((a) => [a, orderedIds(all, a).length]));
  assert.deepEqual(counts, { pwdva: 38, posh: 31, itpa: 30, dowry: 14, irwa: 11 });
  const itpa = orderedIds(all, 'itpa').map((id) => all.paras[id].no);
  assert.equal(itpa[0], '0');
  assert.ok(itpa.indexOf('2A') === itpa.indexOf('2') + 1);
  assert.ok(itpa.indexOf('10A') === itpa.indexOf('9') + 1);
  const dowry = orderedIds(all, 'dowry').map((id) => all.paras[id].no);
  assert.deepEqual(dowry.slice(dowry.indexOf('8'), dowry.indexOf('8') + 4), ['8', '8A', '8B', '9']);
  // Prev/next stay inside the Act
  assert.equal(neighbours(all, 'sys-reg-pwdva-0').prev, null);
  assert.equal(neighbours(all, 'sys-reg-pwdva-37').next, null);
  assert.equal(neighbours(all, 'sys-reg-posh-0').next, 'sys-reg-posh-1');
  assert.equal(progress(all, 'pwdva').done, 38);
  // Existing Acts unchanged
  assert.equal(orderedIds(all, 'uppr').length, n(index));
  assert.equal(orderedIds(all, 'pocso').length, n(pocsoIndex));
});

test('women: ids, labels, sensitivity', () => {
  assert.equal(actOfId('sys-reg-pwdva-12'), 'pwdva');
  assert.equal(actOfId('sys-reg-dowry-8b'), 'dowry');
  assert.equal(actOfId('sys-reg-up-97'), 'uppr');
  assert.equal(paraIdFromNo('8B', 'dowry'), 'sys-reg-dowry-8b');
  assert.equal(paraIdFromNo('12', 'pwdva'), 'sys-reg-pwdva-12');
  assert.equal(sectionLabel('pwdva', '0'), 'अधिनियम एक नज़र में');
  assert.equal(sectionLabel('posh', '4'), 'धारा 4');
  assert.equal(sectionLabel('uppr', '97'), 'पैरा 97');
  assert.ok(isSensitiveId('sys-reg-posh-4'));
  assert.ok(isSensitiveId('sys-reg-pocso-4'));
  assert.ok(!isSensitiveId('sys-reg-up-97'));
});

test('women: numbered example parser with real-case badge', () => {
  const ex = parseExamples('1. [वास्तविक मामला] समय-सीमा का तर्क:\nKamatchi … (SC 2022)\n\n2. PO द्वारा आवेदन:\nPO ने Form II भरा।\n\n10. [वास्तविक मामला] 482 से चुनौती:\nSuman Mishra …');
  assert.equal(ex.length, 3);
  assert.deepEqual([ex[0].num, ex[0].real, ex[0].label], [1, true, 'समय-सीमा का तर्क']);
  assert.deepEqual([ex[1].num, ex[1].real, ex[1].label], [2, false, 'PO द्वारा आवेदन']);
  assert.equal(ex[1].scenario, 'PO ने Form II भरा।');
  assert.deepEqual([ex[2].num, ex[2].real], [10, true]);
  // Old unnumbered style unchanged
  const old = parseExamples('रात में सूचना:\nकुछ हुआ');
  assert.deepEqual([old[0].label, old[0].num, old[0].real], ['रात में सूचना', undefined, false]);
});

test('women: seed rows parse, numbered examples present, search', () => {
  const expected: Record<string, number> = { pwdva: 38, posh: 31, itpa: 30, dowry: 14, irwa: 11 };
  for (const f of Object.keys(expected).map((a) => `women_seed_${a}`)) {
    const rows = readJson<typeof seed>(`../assets/seed/${f}.json`).knowledge;
    assert.equal(rows.length, expected[f.replace('women_seed_', '')], f);
    for (const r of rows) {
      assert.equal(r.content_type, 'regulation', r.id);
      assert.equal(r.category, 'Law', r.id);
      assert.ok(womenIndex.paras[r.id], `sidecar ${r.id}`);
      const s = parseRegSections(r.description);
      assert.equal(s.examples.pending, false, r.id);
      const ex = parseExamples(s.examples.body);
      // Admin sections carry a one-line "no example needed" note instead.
      const noteOnly = ex.length === 1 && ex[0].num === undefined && /उदाहरण की आवश्यकता नहीं/.test(ex[0].scenario);
      assert.ok(noteOnly || (ex.length >= 1 && ex.every((e) => e.num !== undefined)), r.id);
    }
    const ov = parseExamples(parseRegSections(rows[0].description).examples.body);
    assert.ok(ov.length >= 10, `${f} overview examples`);
    assert.ok(ov.some((e) => e.real) && ov.some((e) => !e.real));
  }
  const items: RegSearchItem[] = Object.entries(womenIndex.paras).map(([id, p]) => ({ id, no: p.no, title: p.t, en: p.en }));
  const dv = items.filter((i) => actOfId(i.id) === 'pwdva');
  assert.equal(searchParas(dv, 'धारा 31')[0].id, 'sys-reg-pwdva-31');
  assert.equal(searchParas(dv, '12')[0].id, 'sys-reg-pwdva-12');
  assert.equal(searchParas(items.filter((i) => actOfId(i.id) === 'dowry'), '8B')[0].id, 'sys-reg-dowry-8b');
  assert.equal(searchParas(dv, 'शेल्टर')[0].id, 'sys-reg-pwdva-6');
  assert.equal(searchParas(dv, 'संरक्षण अधिकारी')[0].id.startsWith('sys-reg-pwdva-'), true);
  assert.equal(searchParas(items.filter((i) => actOfId(i.id) === 'posh'), 'ICC')[0].id, 'sys-reg-posh-4');
  assert.ok(searchParas(items.filter((i) => actOfId(i.id) === 'itpa'), 'brothel').length >= 2);
});

// ── L38: UP Regulations batch 2 (reg_seed_2, reg_seed_3) ───────────────────

test('L38: reg_seed_2/3 rows join the sidecar and parse', () => {
  const s2 = readJson<typeof seed>('../assets/seed/reg_seed_2.json').knowledge;
  const s3 = readJson<typeof seed>('../assets/seed/reg_seed_3.json').knowledge;
  assert.equal(s2.length, 47);
  assert.equal(s3.length, 109);
  const all = [...seed.knowledge, ...s2, ...s3];
  assert.equal(new Set(all.map((r) => r.id)).size, 265);
  assert.equal(s2.filter((r) => joinSidecar(index, r.id)?.done).length, 47);
  assert.equal(s3.filter((r) => joinSidecar(index, r.id)?.done).length, 16);
  assert.equal(all.filter((r) => joinSidecar(index, r.id)?.done).length, 87);
  for (const r of [...s2, ...s3]) {
    assert.ok(joinSidecar(index, r.id), `sidecar ${r.id}`);
    assert.equal(r.content_type, 'regulation', r.id);
    const sec = parseRegSections(r.description);
    assert.ok(sec.original.heading.startsWith('1.'), r.id);
    assert.ok(sec.related.heading.startsWith('4.'), r.id);
  }
  // Para 152: numbered examples, at least one real case
  const ex = parseExamples(parseRegSections(s2.find((r) => r.id === 'sys-reg-up-152')!.description).examples.body);
  assert.ok(ex.length >= 2);
});

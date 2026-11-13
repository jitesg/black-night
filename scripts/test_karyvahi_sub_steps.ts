/** Run: node --experimental-strip-types --test scripts/test_karyvahi_sub_steps.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPmKaryvahi, parseSubSteps, subStepProgress, toggleSubStep, subStepNote, remainingText, PM_SUB_STEPS,
} from '../src/lib/karyvahiSubSteps.ts';

test('which karyvahis get the checklist', () => {
  assert.ok(isPmKaryvahi({ step_code: 'RTA_PM_DEATH', name: 'x' }));
  assert.ok(isPmKaryvahi({ step_code: 'MUR_INQUEST', name: 'शव की पहचान/पंचायतनामा' }));
  assert.ok(isPmKaryvahi({ name: 'मृतक का पंचनामा व पोस्टमार्टम' }));
  assert.ok(isPmKaryvahi({ name: 'मृतक का पंचनामा व शव परीक्षण' }));
  assert.ok(!isPmKaryvahi({ name: 'जब्ती पंचनामा व पोस्टमार्टम' }));
  assert.ok(!isPmKaryvahi({ name: 'पोस्टमार्टम हेतु शव भेजना', step_code: 'MUR_PM_SEND' }));
  assert.ok(!isPmKaryvahi({ name: 'वादी/वादिनी का बयान' }));
});

test('parse is safe and keeps only known done parts', () => {
  assert.deepEqual(parseSubSteps(null), {});
  assert.deepEqual(parseSubSteps('{bad'), {});
  assert.deepEqual(parseSubSteps('[]'), {});
  const m = parseSubSteps(JSON.stringify({ pan: { done: true, parcha: '03' }, xx: { done: true }, pm: { done: false } }));
  assert.deepEqual(Object.keys(m), ['pan']);
});

test('progress, toggle, notes, remaining', () => {
  let m = {};
  assert.equal(subStepProgress(m).done, 0);
  assert.equal(subStepProgress(m).total, 6);
  m = toggleSubStep(m, 'pan', 1);
  m = { ...m, pm: { done: true, by: 'auto', parcha: '03' } };
  const p = subStepProgress(m);
  assert.equal(p.done, 2);
  assert.ok(!p.complete);
  assert.equal(subStepNote(m.pan), 'स्वयं ✓');
  assert.equal(subStepNote(m.pm), 'पर्चा 03');
  assert.equal(remainingText(m), 'बाकी: बयान उ0नि0, बयान आरक्षी, बयान पंच गवाहान, बयान चिकित्सक');
  m = toggleSubStep(m, 'pm');
  assert.equal(subStepProgress(m).done, 1);
  assert.equal(toggleSubStep(m, 'nope'), m);
  for (const s of PM_SUB_STEPS) m = { ...m, [s.id]: { done: true } };
  assert.ok(subStepProgress(m).complete);
  assert.equal(remainingText(m), '');
});

test('format save → parts with पर्चा; regenerate / delete entry', async () => {
  const { partsFromFormatValues, applyEntryParts, removeEntryParts, isKaryvahiDone, allDoneLegacy } = await import('../src/lib/karyvahiSubSteps.ts');
  assert.deepEqual(partsFromFormatValues({ doPan: 'हाँ', doPm: 'हाँ', doBayanSI: '', doBayanDoc: 'हाँ' }), ['pan', 'pm', 'doc']);
  let m = toggleSubStep({}, 'co', 1);
  m = applyEntryParts(m, 'e1', ['pan', 'pm'], '03', 2);
  assert.equal(subStepNote(m.pan), 'पर्चा 03');
  assert.equal(subStepProgress(m).done, 3);
  m = applyEntryParts(m, 'e1', ['pan'], '03', 3); // generated again with fewer ticks
  assert.equal(subStepProgress(m).done, 2);
  m = applyEntryParts(m, 'e2', ['si', 'panch', 'doc', 'pm'], '04', 4);
  assert.equal(subStepProgress(m).complete, true);
  const json = JSON.stringify(m);
  assert.ok(isKaryvahiDone({ step_code: 'RTA_PM_DEATH', sub_steps_json: json, execution_count: 0 }));
  m = removeEntryParts(m, 'e2');
  assert.deepEqual(Object.keys(m).sort(), ['co', 'pan']);
  assert.ok(!isKaryvahiDone({ step_code: 'RTA_PM_DEATH', sub_steps_json: JSON.stringify(m), execution_count: 5 }));
  assert.ok(isKaryvahiDone({ name: 'वादी/वादिनी का बयान', execution_count: 1 }));
  assert.ok(!isKaryvahiDone({ name: 'वादी/वादिनी का बयान', execution_count: 0 }));
  assert.equal(subStepNote(allDoneLegacy().pan), 'पहले से');
  assert.ok(subStepProgress(allDoneLegacy()).complete);
});

test('pending chip info', async () => {
  const { pmPendingInfo } = await import('../src/lib/karyvahiSubSteps.ts');
  assert.equal(pmPendingInfo({ name: 'वादी/वादिनी का बयान' }), null);
  const i = pmPendingInfo({ step_code: 'RTA_PM_DEATH', sub_steps_json: JSON.stringify({ pan: { done: true }, pm: { done: true }, si: { done: true } }) });
  assert.deepEqual(i, { done: 3, total: 6, remaining: 'बाकी: बयान आरक्षी, बयान पंच गवाहान, बयान चिकित्सक' });
  const all = Object.fromEntries(PM_SUB_STEPS.map((s) => [s.id, { done: true }]));
  assert.equal(pmPendingInfo({ step_code: 'RTA_PM_DEATH', sub_steps_json: JSON.stringify(all) }), null);
});

test('instant filling: last values + only remaining ticks', async () => {
  const { prefillPmValues } = await import('../src/lib/karyvahiSubSteps.ts');
  const v = prefillPmValues({ DName: 'नेवल किशोर', doPan: 'हाँ', doPm: 'हाँ', doBayanSI: '' }, { pan: { done: true }, pm: { done: true } });
  assert.equal(v.DName, 'नेवल किशोर');
  assert.equal(v.doPan, '');
  assert.equal(v.doPm, '');
  assert.equal(v.doBayanSI, 'हाँ');
  assert.equal(v.doBayanDoc, 'हाँ');
});

test('instant filling when all 6 are done keeps the format ticks', async () => {
  const { prefillPmValues, allDoneLegacy } = await import('../src/lib/karyvahiSubSteps.ts');
  const v = prefillPmValues({ DName: 'क', doPan: '' }, allDoneLegacy());
  assert.equal(v.DName, 'क');
  assert.ok(!('doPan' in v));
});

test('घटनास्थल निरीक्षण: 5 parts, only ई-साक्ष्य + नक्शा नजरी required; format ticks निरीक्षण / ई-साक्ष्य / नक्शा', async () => {
  const m = await import('../src/lib/karyvahiSubSteps.ts');
  const { SCENE_DEF, checklistOf, checklistForFormat, isSceneKaryvahi, applyEntryParts, partNotesFromValues, isKaryvahiDone, pmPendingInfo, allDoneLegacy } = m;
  assert.ok(isSceneKaryvahi({ name: 'घटनास्थल निरीक्षण' }));
  assert.ok(isSceneKaryvahi({ name: 'x', step_code: 'ATM_SPOT' }));
  assert.ok(!isSceneKaryvahi({ name: 'घटनास्थल की सुरक्षा' }));
  assert.equal(checklistOf({ name: 'घटनास्थल निरीक्षण' }), SCENE_DEF);
  assert.equal(checklistOf({ name: 'मृतक का पंचनामा व पोस्टमार्टम' })?.kind, 'pm');
  assert.equal(checklistOf({ name: 'वादी/वादिनी का बयान' }), null);
  assert.equal(checklistForFormat('sys-fmt-cd-nirikshan-ghatnasthal'), SCENE_DEF);
  assert.deepEqual(SCENE_DEF.partsFromValues({ ESakshya: 'की गयी' }), ['nir', 'esakshya', 'naksha']);
  assert.deepEqual(SCENE_DEF.partsFromValues({ ESakshya: 'नहीं लिखना' }), ['nir', 'naksha']);
  const tech = { ESakshya: 'तकनीकी समस्या' };
  let map = applyEntryParts({}, 'e1', SCENE_DEF.partsFromValues(tech), '02', 1, SCENE_DEF, partNotesFromValues(SCENE_DEF, tech));
  assert.equal(subStepNote(map.esakshya), 'पर्चा 02 · तकनीकी समस्या');
  const card = (j: object) => ({ name: 'घटनास्थल निरीक्षण', sub_steps_json: JSON.stringify(j), execution_count: 1 });
  assert.ok(isKaryvahiDone(card(map)));
  assert.ok(!isKaryvahiDone(card({ nir: { done: true }, sur: { done: true }, photo: { done: true }, naksha: { done: true } })));
  assert.deepEqual(pmPendingInfo(card({ naksha: { done: true } })), { done: 1, total: 2, remaining: 'बाकी: ई-साक्ष्य से फोटो-वीडियोग्राफी' });
  const p = subStepProgress(map, SCENE_DEF);
  assert.equal(p.optionalDone, 1);
  assert.equal(p.optionalTotal, 3);
  assert.ok(subStepProgress(allDoneLegacy(1, SCENE_DEF), SCENE_DEF).complete);
  // optional parts are tickable by hand
  map = toggleSubStep(map, 'sur', 1, SCENE_DEF);
  assert.ok(map.sur.done);
  assert.equal(toggleSubStep(map, 'pan', 1, SCENE_DEF), map);
});

test('new FIR: playbook cards folded into one card (2+ codes), single code stays, PM extras into the PM card', async () => {
  const { mergeSeedItems, checklistOf, MED_DEF, ACC_DEF, END_DEF } = await import('../src/lib/karyvahiSubSteps.ts');
  const it = (step_code: string, task_name: string, priority = 'RECOMMENDED') => ({ step_code, task_name, priority, brief_description: '' });
  const out = mergeSeedItems([
    it('MUR_INQUEST', 'शव की पहचान/पंचायतनामा', 'MANDATORY'), it('MUR_PM_SEND', 'पोस्टमार्टम हेतु शव भेजना'), it('MUR_PM_REPORT', 'पोस्टमार्टम रिपोर्ट'),
    it('COM_MLC', 'पीड़ित की एमएलसी', 'MANDATORY'), it('HRT_INJURY_OPINION', 'राय'), it('HRT_FINAL_MED', 'अंतिम'),
    it('COM_ACCUSED_TRACE', 'तलाश'), it('COM_ARREST_ASSESS', 'गिरफ्तारी', 'MANDATORY'),
    it('COM_CHARGESHEET', 'आरोपपत्र'),
    it('THF_LOSS_LIST', 'चोरी गई वस्तुओं की सूची'),
  ]);
  const names = out.map((o) => o.task_name);
  assert.deepEqual(names, ['शव की पहचान/पंचायतनामा', 'मेडिकल (घायल / पीड़ित)', 'अभियुक्त', 'आरोपपत्र', 'चोरी गई वस्तुओं की सूची']);
  assert.equal(out[0].merged_codes, 'MUR_PM_SEND,MUR_PM_REPORT');
  assert.equal(out[1].step_code, 'CK_MED');
  assert.equal(out[1].priority, 'MANDATORY');
  assert.equal(out[1].merged_codes, 'COM_MLC,HRT_INJURY_OPINION,HRT_FINAL_MED');
  assert.equal(out[2].priority, 'MANDATORY');
  assert.equal(out[3].step_code, 'COM_CHARGESHEET'); // alone → unchanged
  assert.equal(checklistOf(out[1]), MED_DEF);
  assert.equal(checklistOf({ name: 'अभियुक्त', step_code: 'CK_ACC' }), ACC_DEF);
  assert.equal(checklistOf({ name: 'आरोपपत्र', step_code: 'COM_CHARGESHEET' }), null); // old / single cards stay ordinary
  assert.equal(checklistOf({ name: 'पोस्टमार्टम हेतु शव भेजना', step_code: 'MUR_PM_SEND' }), null);
  assert.ok(END_DEF.steps.find((s) => s.id === 'cs') && !END_DEF.steps.find((s) => s.id === 'cs')!.optional);
});

test('formats tick merged cards; "हिस्सा चुनें" names + picks', async () => {
  const m = await import('../src/lib/karyvahiSubSteps.ts');
  const { checklistForFormat, partsForFormat, partEntryName, partByEntryName, applyEntryParts, removeEntryPicks, MED_DEF, ACC_DEF, FSL_DEF, PM_DEF } = m;
  assert.equal(checklistForFormat('sys-fmt-cd-medical-avlokan'), MED_DEF);
  assert.deepEqual(partsForFormat(MED_DEF, 'sys-fmt-cd-medical-avlokan', { p1Mlc: 'हाँ', p2Xray: 'हाँ' }), ['mlc', 'xray']);
  assert.deepEqual(partsForFormat(MED_DEF, 'sys-fmt-cd-doctor-bayan', {}), ['dr']);
  assert.equal(checklistForFormat('sys-fmt-cd-abhiyukt-bayan-35-3'), ACC_DEF);
  assert.deepEqual(partsForFormat(ACC_DEF, 'sys-fmt-cd-abhiyukt-bayan-35-3', {}), ['arrest', 'interrog']);
  assert.equal(checklistForFormat('fard_jabti'), FSL_DEF);
  assert.equal(checklistForFormat('sys-fmt-unknown'), null);
  const interrog = ACC_DEF.steps.find((s) => s.id === 'interrog')!;
  assert.equal(partEntryName(interrog), 'बयान अभियुक्त');
  assert.equal(partByEntryName(ACC_DEF, 'बयान अभियुक्त')?.id, 'interrog');
  assert.equal(partByEntryName(ACC_DEF, 'कुछ और'), null);
  // format ticks + a pick on the same entry; changing the pick later keeps the format ticks
  let map = applyEntryParts({}, 'e1', ['arrest', 'interrog', 'trace'], '03', 1, ACC_DEF, {}, 'trace');
  assert.ok(map.trace.pick && !map.arrest.pick);
  map = applyEntryParts(map, 'e1', ['recovery'], '03', 2, ACC_DEF, {}, 'recovery', true);
  assert.deepEqual(Object.keys(map).sort(), ['arrest', 'interrog', 'recovery']);
  assert.deepEqual(Object.keys(removeEntryPicks(map, 'e1')).sort(), ['arrest', 'interrog']);
  // PM got an optional "शव भेजा" part — not needed for 6/6, never set by the format
  assert.equal(subStepProgress({}, PM_DEF).total, 6);
  assert.ok(!PM_DEF.partsFromValues({ doPan: 'हाँ' }).includes('send'));
});

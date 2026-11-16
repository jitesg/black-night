/** चरण ग — office कागज़ on the officer's phone. Run: node --experimental-strip-types --test scripts/test_officer_sync.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as s from '../src/office/officerSyncCore.ts';

const T = (p: Partial<s.RemoteTask> = {}): s.RemoteTask => ({
  id: 't1', kind: 'petition', subtype: 'जनता दर्शन', title: 'जनता दर्शन — रेनू पत्नी धीरज', received_on: '2026-11-16', due_on: '2026-11-26',
  created_at: '2026-11-16T05:12:00Z', updated_at: '2026-11-16T05:12:00Z', closed: false, created_by: 'm1', status: 'sent',
  fields: {
    matter: 'ज़मीन पर कब्ज़े की शिकायत', note: 'जल्दी आख्या दें',
    applicants: [{ name: 'रेनू', relation: 'पत्नी', father: 'धीरज', address: 'भग्तिन खेड़ा', mobile: '9118359439' }, { name: '' }],
    opponents: [{ name: 'सुरेश', relation: 'पुत्र', father: 'बाबूलाल', address: '', mobile: '' }],
  },
  ...p,
});

test('petition mapping', () => {
  const p = s.taskToPetition(T(), 'उ0नि0 जितेश सिंह');
  assert.equal(p.petition_type, 'जनता दर्शन');
  assert.equal(p.deadline_date, '2026-11-26');
  assert.equal(p.complainants.length, 1);
  assert.equal(p.complainants[0].father_husband_name, 'धीरज');
  assert.equal(p.complainants[0].gender, 'महिला');
  assert.equal(p.accused[0].father_name, 'बाबूलाल');
  assert.equal(p.investigator_name, 'उ0नि0 जितेश सिंह');
  assert.equal(s.taskToPetition(T({ fields: {} }), '').matter, 'जनता दर्शन — रेनू पत्नी धीरज');
});

test('court mapping', () => {
  const c = s.taskToCourt(T({ kind: 'court', subtype: 'NBW', fields: { court_name: 'CJM', vad_sankhya: '412/2026', accused: [{ name: 'राम', father: 'श्याम' }] } }));
  assert.equal(c.doc_type, 'NBW');
  assert.equal(c.vad_sankhya, '412/2026');
  assert.deepEqual(c.persons[0], { person_type: 'accused', name: 'राम', father_name: 'श्याम', mobile: '', address: '', remarks: '' });
  assert.equal(s.moduleOf('court'), 'court');
  assert.equal(s.moduleOf('info'), null);
});

test('plan: create / skip / restore / keep', () => {
  assert.deepEqual(s.planTask(T(), null, null), { type: 'create' });
  assert.deepEqual(s.planTask(T({ closed: true }), null, null), { type: 'skip' });
  const removedMeta = { ...s.newMeta(T(), 'संजय (CM)'), status: 'removed' as const };
  assert.deepEqual(s.planTask(T({ status: 'sent' }), { exists: true, deleted: true }, removedMeta), { type: 'restore' });
  assert.deepEqual(s.planTask(T({ status: 'removed' }), { exists: true, deleted: true }, removedMeta), { type: 'keep' });
  assert.deepEqual(s.planTask(T(), { exists: true, deleted: false }, removedMeta), { type: 'keep' });
});

test('status back to the office', () => {
  assert.equal(s.desiredStatus({ exists: true, deleted: false, done: false, isNew: true }), 'received');
  assert.equal(s.desiredStatus({ exists: true, deleted: false, done: false, isNew: false }), 'seen');
  assert.equal(s.desiredStatus({ exists: true, deleted: false, done: true, isNew: false }), 'done');
  assert.equal(s.desiredStatus({ exists: true, deleted: true, done: true, isNew: false }), 'removed');
});

test('meta + edits + notices', () => {
  const m = s.newMeta(T(), 'संजय (CM)');
  assert.equal(m.note, 'जल्दी आख्या दें');
  assert.equal(s.officeEdited(m, T()), false);
  assert.equal(s.officeEdited(m, T({ updated_at: '2026-11-16T06:00:00Z' })), true);
  assert.deepEqual(s.parseMeta(JSON.stringify(m)), m);
  assert.equal(s.parseMeta('x'), null);
  assert.equal(s.newPaperNotice(T()).body, 'जनता दर्शन — रेनू पत्नी धीरज · अंतिम तिथि 26/11/2026');
  assert.equal(s.editedNotice(T({ closed: true })).title, '✖ कार्यालय ने कागज़ रद्द किया');
  assert.equal(s.routeFor('court', 'x'), '/(app)/nyayalay/x');
});

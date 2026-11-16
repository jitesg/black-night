/** InvestSuite कार्यालय — कागज़ rules. Run: node --experimental-strip-types --test scripts/test_office_tasks.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as t from '../src/office/taskCore.ts';

const TODAY = '2026-11-18'; // Wednesday

test('dates', () => {
  assert.equal(t.addDaysIso('2026-11-16', 10), '2026-11-26');
  assert.equal(t.addDaysIso('2026-12-28', 10), '2027-01-07');
  assert.equal(t.showDate('2026-11-26'), '26/11/2026');
  assert.equal(t.daysUntil('2026-11-20', TODAY), 2);
  assert.equal(t.daysUntil('2026-11-16', TODAY), -2);
  assert.equal(t.daysLabel(-2), '2 दिन ऊपर');
  assert.equal(t.daysLabel(0), 'आज अंतिम दिन');
  assert.equal(t.weekStart(TODAY), '2026-11-16');
  assert.equal(t.weekStart('2026-11-16'), '2026-11-16');
  assert.equal(t.weekStart('2026-11-22'), '2026-11-16');
});

test('new form: प्रार्थना पत्र due +10, न्यायालय empty', () => {
  assert.equal(t.newTaskForm('petition', '2026-11-16').due_on, '2026-11-26');
  assert.equal(t.newTaskForm('court', '2026-11-16').due_on, '');
});

test('form checks', () => {
  const f = t.newTaskForm('petition', TODAY);
  assert.equal(t.taskFormError(f), 'प्रकार चुनें');
  f.subtype = 'जनता दर्शन';
  assert.equal(t.taskFormError(f), 'कम से कम एक आवेदक का नाम लिखें');
  f.applicants[0].name = 'रेनू';
  assert.equal(t.taskFormError(f), '');
  f.applicants[0].mobile = '12345';
  assert.match(t.taskFormError(f), /10 अंकों/);
  const c = t.newTaskForm('court', TODAY);
  c.subtype = 'NBW'; c.due_on = '2026-11-20';
  assert.match(t.taskFormError(c), /न्यायालय का नाम/);
  c.vad_sankhya = '412/2026';
  assert.equal(t.taskFormError(c), '');
  c.subtype = 'Anya';
  assert.equal(t.taskFormError(c), 'कागज़ का नाम लिखें');
});

test('titles + row round trip', () => {
  const f = t.newTaskForm('petition', TODAY);
  f.subtype = 'जनता दर्शन';
  f.applicants = [{ name: 'रेनू', relation: 'पत्नी', father: 'धीरज', address: 'भग्तिन खेड़ा', mobile: '+91 91183 59439' }, t.emptyPerson()];
  f.opponents = [{ name: 'सुरेश', relation: 'पुत्र', father: 'बाबूलाल', address: '', mobile: '' }];
  const row = t.formToTaskRow(f);
  assert.equal(row.title, 'जनता दर्शन — रेनू पत्नी धीरज');
  assert.equal((row.fields.applicants as unknown[]).length, 1);
  assert.equal((row.fields.applicants as { mobile: string }[])[0].mobile, '9118359439');
  const back = t.taskRowToForm({ ...row, received_on: row.received_on, due_on: row.due_on });
  assert.equal(back.applicants[0].father, 'धीरज');
  assert.equal(back.opponents[0].name, 'सुरेश');
  const c = t.newTaskForm('court', TODAY);
  c.subtype = 'NBW'; c.vad_sankhya = '412/2026';
  assert.equal(t.taskTitle(c), 'NBW — वाद सं0 412/2026');
  c.subtype = 'Summons'; c.vad_sankhya = ''; c.apradh_sankhya = '88/2025';
  assert.equal(t.taskTitle(c), 'सम्मन — मु0अ0सं0 88/2025');
  assert.equal(t.subtypeLabel('petition', 'RL'), 'Registry Letter (RL)');
});

const row = (p: Partial<t.TaskListRow>): t.TaskListRow => ({
  id: Math.random().toString(36), kind: 'petition', subtype: 'RL', title: 'x', received_on: null, due_on: null,
  created_at: `${TODAY}T10:00:00Z`, closed: false, fields: {}, assignee: { member_id: 'a', status: 'sent' }, fileCount: 0, ...p,
});

test('states, filters, dashboard', () => {
  const list = [
    row({ due_on: '2026-11-16', assignee: { member_id: 'a', status: 'seen' } }),                       // overdue
    row({ kind: 'court', subtype: 'NBW', due_on: '2026-11-25', assignee: { member_id: 'b', status: 'sent' } }),
    row({ assignee: { member_id: 'a', status: 'done' }, created_at: '2026-11-10T10:00:00Z' }),          // last week
    row({ closed: true }),                                                                               // cancelled
    row({ assignee: { member_id: 'b', status: 'removed' }, due_on: '2026-11-30' }),
  ];
  assert.equal(t.taskState(list[3]), 'cancelled');
  assert.equal(t.isOverdue(list[0], TODAY), true);
  assert.equal(list.filter((x) => t.matchesFilter(x, { ...t.NO_FILTER, state: 'pending' }, TODAY)).length, 3);
  assert.equal(list.filter((x) => t.matchesFilter(x, { ...t.NO_FILTER, kind: 'court' }, TODAY)).length, 1);
  assert.equal(list.filter((x) => t.matchesFilter(x, { ...t.NO_FILTER, memberId: 'a' }, TODAY)).length, 3); // incl. the cancelled one
  assert.equal(list.filter((x) => t.matchesFilter(x, { ...t.NO_FILTER, range: 'week' }, TODAY)).length, 4);
  const d = t.dashboard(list, TODAY);
  assert.equal(d.thisWeek, 3);
  assert.equal(d.pending, 3);
  assert.equal(d.overdue, 1);
  assert.equal(d.done, 1);
  assert.deepEqual(d.byOfficer.find((o) => o.memberId === 'a'), { memberId: 'a', pending: 1, overdue: 1, done: 1 });
  assert.equal(t.sortTasks(list, TODAY)[0], list[0]);
  assert.deepEqual(t.pendingByOfficer(list), { a: 1, b: 2 });
});

test('storage path + base64', () => {
  const p = t.storagePath('T', 'K', 'प्रार्थना पत्र 1.jpg', 5);
  assert.ok(p.startsWith('T/K/5_'));
  assert.ok(p.endsWith('.jpg'));
  assert.equal(p.split('/').length, 3);
  assert.deepEqual([...t.b64ToBytes('SGVsbG8=')], [...new TextEncoder().encode('Hello')]);
  assert.deepEqual([...t.b64ToBytes('SGk=')], [72, 105]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDiaryTime, newDiaryDefaultDate, timeToMinutes, isoDate } from '../src/lib/caseDiaryTime.ts';

const fir = { date_of_information: '2025-07-01', time_of_information: '10:15' };
test('first diary date = FIR सूचना date', () => {
  assert.equal(newDiaryDefaultDate(0, fir, '2025-07-09'), '2025-07-01');
  assert.equal(newDiaryDefaultDate(2, fir, '2025-07-09'), '2025-07-09');
  assert.equal(newDiaryDefaultDate(0, {}, '2025-07-09'), '2025-07-09');
  assert.equal(isoDate('01.07.2025'), '2025-07-01');
});
test('time not before FIR time on the same date', () => {
  assert.match(checkDiaryTime('2025-07-01', '09:30', '', fir) ?? '', /10:15/);
  assert.equal(checkDiaryTime('2025-07-01', '10:15', '', fir), null);
  assert.equal(checkDiaryTime('2025-07-01', '11:00', '09:00', fir), null); // past midnight allowed
  assert.match(checkDiaryTime('2025-07-01', '', '08:00', fir) ?? '', /समाप्ति/);
  assert.equal(checkDiaryTime('2025-07-02', '06:00', '', fir), null);
  assert.equal(checkDiaryTime('2025-07-01', '09:00', '', { date_of_information: '2025-07-01' }), null);
  assert.equal(timeToMinutes('9:05 PM'), 21 * 60 + 5);
  assert.equal(timeToMinutes('xx'), null);
});

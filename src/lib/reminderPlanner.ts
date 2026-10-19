/**
 * reminderPlanner.ts — pure logic: when should a reminder ring?
 *
 * No React Native / database imports, so it can be tested with plain Node.
 *
 * Model
 *  - `dueMs` is the CURRENT pending occurrence. Completing a repeating
 *    reminder moves it to the next occurrence (like Google Tasks / TickTick).
 *  - Alerts for one reminder:
 *      main   — at the occurrence time
 *      early  — `earlyMin` minutes before ("15 मिनट पहले भी बताएँ")
 *      nag    — every `nagMin` minutes after the time, `NAG_COUNT` times,
 *               until marked done ("जब तक पूरा न करें, याद दिलाते रहें")
 *      snooze — at `snoozeUntil`, followed by nags again
 *  - Repeating main/early alerts use Android's repeating alarms (they keep
 *    ringing even if the app is never opened). Nags are one-off alarms for
 *    the latest + next occurrence and are topped up whenever the app opens
 *    or an action is tapped.
 */

export type RepeatRule = 'once' | 'daily' | 'weekly' | 'monthly';

export interface PlanInput {
  dueMs: number;
  repeat: RepeatRule;
  /** JS weekdays (0 = Sunday) for weekly; empty = weekday of dueMs. */
  repeatDays: number[];
  earlyMin: number;
  nagMin: number;
  snoozeUntil: number;
  isCompleted: boolean;
}

export type PlannedTrigger =
  | { type: 'date'; at: number }
  | { type: 'daily'; hour: number; minute: number }
  /** weekday uses expo's numbering: 1 = Sunday … 7 = Saturday */
  | { type: 'weekly'; weekday: number; hour: number; minute: number }
  | { type: 'monthly'; day: number; hour: number; minute: number };

export interface PlannedAlert {
  kind: 'main' | 'early' | 'nag' | 'snooze';
  trigger: PlannedTrigger;
}

export const NAG_COUNT = 6;
const DAY = 86400000;
const MAX_SCAN_DAYS = 400;

function atTime(day: Date, ref: Date): Date {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), ref.getHours(), ref.getMinutes(), 0, 0);
  return d;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function dayMatches(day: Date, rule: RepeatRule, due: Date, days: number[]): boolean {
  switch (rule) {
    case 'daily':
      return true;
    case 'weekly':
      return (days.length ? days : [due.getDay()]).includes(day.getDay());
    case 'monthly': {
      const want = Math.min(due.getDate(), daysInMonth(day.getFullYear(), day.getMonth()));
      return day.getDate() === want;
    }
    default:
      return false;
  }
}

/** First occurrence that is >= dueMs and > t (once: dueMs). */
export function nextOccurrenceAfter(
  p: Pick<PlanInput, 'dueMs' | 'repeat' | 'repeatDays'>,
  t: number,
  minMs: number = p.dueMs,
): number | null {
  if (p.repeat === 'once') return p.dueMs > t ? p.dueMs : null;
  const due = new Date(p.dueMs);
  const start = new Date(Math.max(minMs, t));
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 0; i < MAX_SCAN_DAYS; i++) {
    if (dayMatches(cursor, p.repeat, due, p.repeatDays)) {
      const cand = atTime(cursor, due).getTime();
      if (cand >= minMs && cand > t) return cand;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/** Latest occurrence that is >= dueMs and <= t (once: dueMs if passed). */
export function prevOccurrenceAtOrBefore(p: Pick<PlanInput, 'dueMs' | 'repeat' | 'repeatDays'>, t: number): number | null {
  if (p.dueMs > t) return null;
  if (p.repeat === 'once') return p.dueMs;
  const due = new Date(p.dueMs);
  const cursor = new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate());
  for (let i = 0; i < MAX_SCAN_DAYS; i++) {
    if (cursor.getTime() + DAY <= new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()) return null;
    if (dayMatches(cursor, p.repeat, due, p.repeatDays)) {
      const cand = atTime(cursor, due).getTime();
      if (cand >= p.dueMs && cand <= t) return cand;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return null;
}

/**
 * Where a reminder moves when it is marked done.
 * once → null (finished). Repeating → next occurrence after now (or after
 * the current one, if it is still in the future).
 */
export function occurrenceAfterDone(p: Pick<PlanInput, 'dueMs' | 'repeat' | 'repeatDays'>, now: number): number | null {
  if (p.repeat === 'once') return null;
  return nextOccurrenceAfter(p, Math.max(now, p.dueMs));
}

function shift(hour: number, minute: number, deltaMin: number): { hour: number; minute: number; dayShift: number } {
  let total = hour * 60 + minute + deltaMin;
  let dayShift = 0;
  while (total < 0) { total += 1440; dayShift -= 1; }
  while (total >= 1440) { total -= 1440; dayShift += 1; }
  return { hour: Math.floor(total / 60), minute: total % 60, dayShift };
}

function repeatingTriggers(p: PlanInput, offsetMin: number): PlannedTrigger[] {
  const due = new Date(p.dueMs);
  const s = shift(due.getHours(), due.getMinutes(), offsetMin);
  if (p.repeat === 'daily') return [{ type: 'daily', hour: s.hour, minute: s.minute }];
  if (p.repeat === 'weekly') {
    const days = p.repeatDays.length ? p.repeatDays : [due.getDay()];
    return [...new Set(days)].map((d) => ({
      type: 'weekly' as const,
      weekday: (((d + s.dayShift) % 7) + 7) % 7 + 1,
      hour: s.hour,
      minute: s.minute,
    }));
  }
  if (p.repeat === 'monthly') {
    const day = due.getDate() + s.dayShift;
    if (day < 1 || day > 28 && s.dayShift !== 0) return []; // early alert crossing a month edge: skip
    return [{ type: 'monthly', day, hour: s.hour, minute: s.minute }];
  }
  return [];
}

/** The first time a repeating Android alarm would ring for this rule. */
function firstNativeFire(p: PlanInput, now: number): number | null {
  // Same rule, ignoring the start date.
  return nextOccurrenceAfter(p, now, 0);
}

export function planAlerts(p: PlanInput, now: number): PlannedAlert[] {
  if (p.isCompleted) return [];
  const out: PlannedAlert[] = [];
  const addDate = (kind: PlannedAlert['kind'], at: number) => {
    if (at > now + 1000) out.push({ kind, trigger: { type: 'date', at } });
  };
  const addNags = (base: number) => {
    if (p.nagMin <= 0) return;
    for (let k = 1; k <= NAG_COUNT; k++) addDate('nag', base + k * p.nagMin * 60000);
  };

  if (p.repeat === 'once') {
    addDate('main', p.dueMs);
    if (p.earlyMin > 0) addDate('early', p.dueMs - p.earlyMin * 60000);
    if (!(p.snoozeUntil > now)) addNags(p.dueMs);
  } else {
    const nativeFirst = firstNativeFire(p, now);
    const next = nextOccurrenceAfter(p, now);
    const startsLater = next != null && nativeFirst != null && nativeFirst < next;
    if (startsLater) {
      // Start date is in the future: a repeating alarm would ring too early,
      // so ring the first occurrences as one-off alarms. The app switches to
      // repeating alarms on a later open.
      let t = now;
      for (let i = 0; i < 8; i++) {
        const occ = nextOccurrenceAfter(p, t);
        if (occ == null) break;
        addDate('main', occ);
        if (p.earlyMin > 0) addDate('early', occ - p.earlyMin * 60000);
        t = occ;
      }
    } else {
      for (const trigger of repeatingTriggers(p, 0)) out.push({ kind: 'main', trigger });
      if (p.earlyMin > 0) {
        for (const trigger of repeatingTriggers(p, -p.earlyMin)) out.push({ kind: 'early', trigger });
      }
    }
    if (!(p.snoozeUntil > now)) {
      const prev = prevOccurrenceAtOrBefore(p, now);
      if (prev != null) addNags(prev);
      if (next != null) addNags(next);
    }
  }

  if (p.snoozeUntil > now) {
    addDate('snooze', p.snoozeUntil);
    addNags(p.snoozeUntil);
  }
  return out;
}

/** Time to show in the list: snooze time, else the pending occurrence. */
export function displayTime(p: Pick<PlanInput, 'dueMs' | 'snoozeUntil' | 'repeat' | 'repeatDays'>, now: number): number {
  if (p.snoozeUntil > now) return p.snoozeUntil;
  // A repeating reminder that was not done: show its latest missed time.
  if (p.repeat !== 'once' && p.dueMs <= now) return prevOccurrenceAtOrBefore(p, now) ?? p.dueMs;
  return p.dueMs;
}

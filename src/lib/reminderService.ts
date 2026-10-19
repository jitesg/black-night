/**
 * reminderService.ts — keeps the reminders table and the phone's scheduled
 * notifications in step. Every change goes through syncReminder(), which
 * cancels the old alarms and schedules what reminderPlanner says.
 *
 * Safe to use from the background notification task (no React).
 */
import i18n from '@/lib/i18n';
import * as repo from '@/lib/db/reminderRepo';
import type { Reminder, ReminderInput } from '@/lib/db/reminderRepo';
import { getPersistedSettings } from '@/hooks/useSettingsStore';
import {
  cancelNotifications, dismissPresentedFor, getScheduledIds, scheduleAlert, type AlertContent,
} from '@/lib/reminderNotifications';
import {
  displayTime, nextOccurrenceAfter, occurrenceAfterDone, planAlerts, type PlanInput,
} from '@/lib/reminderPlanner';

export function dueMs(r: Pick<Reminder, 'due_at'>): number {
  return r.due_at < 10000000000 ? r.due_at * 1000 : r.due_at;
}

export function toPlanInput(r: Reminder): PlanInput {
  return {
    dueMs: dueMs(r),
    repeat: r.repeat_mode,
    repeatDays: r.repeat_days,
    earlyMin: r.early_min,
    nagMin: r.nag_min,
    snoozeUntil: r.snooze_until,
    isCompleted: r.is_completed === 1,
  };
}

/** When the list should say this reminder rings / rang. */
export function reminderTime(r: Reminder, now = Date.now()): number {
  return displayTime(toPlanInput(r), now);
}

/** Upcoming ring time after now (repeating rolls forward), or null. */
export function nextRing(r: Reminder, now = Date.now()): number | null {
  if (r.is_completed) return null;
  if (r.snooze_until > now) return r.snooze_until;
  return nextOccurrenceAfter(toPlanInput(r), now);
}

export function parseIds(v: string | null): string[] {
  if (!v) return [];
  if (v.startsWith('[')) {
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [v];
}

export const CATEGORY_EMOJI: Record<Reminder['category'], string> = {
  general: '⏰',
  peshi: '⚖️',
  case: '📁',
  meeting: '👥',
  personal: '🏠',
};

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function buildContent(r: Reminder, kind: AlertContent['kind'], hide: boolean): AlertContent {
  const t = i18n.t.bind(i18n);
  if (hide) {
    return {
      reminderId: r.id, kind, sound: r.sound,
      title: `⏰ ${t('reminders.notifPrivateTitle')}`,
      body: t('reminders.notifPrivateBody'),
    };
  }
  const emoji = CATEGORY_EMOJI[r.category] ?? '⏰';
  const title =
    kind === 'early' ? `⏳ ${t('reminders.notifEarly', { n: r.early_min })}: ${r.title}`
      : kind === 'nag' ? `🔔 ${t('reminders.notifNag')}: ${r.title}`
        : `${r.priority === 'high' ? '❗' : emoji} ${r.title}`;
  const parts = [r.note.trim(), r.fir_label ? `📁 ${r.fir_label}` : ''].filter(Boolean);
  return { reminderId: r.id, kind, sound: r.sound, title, body: parts.join('\n') || `🕐 ${fmtTime(reminderTime(r))}` };
}

/** Cancels this reminder's alarms and schedules fresh ones. */
export async function syncReminder(r: Reminder, opts?: { hide?: boolean }): Promise<void> {
  await cancelNotifications(parseIds(r.notification_id));
  const hide = opts?.hide ?? (await getPersistedSettings()).reminderPrivate;
  const ids: string[] = [];
  if (r.deleted_at == null) {
    for (const a of planAlerts(toPlanInput(r), Date.now())) {
      try {
        ids.push(await scheduleAlert(buildContent(r, a.kind, hide), a.trigger));
      } catch (e) {
        console.warn('[reminders] schedule failed', a, e);
      }
    }
  }
  await repo.updateReminder(r.id, { notification_id: ids.length ? JSON.stringify(ids) : null });
}

async function syncById(id: string): Promise<void> {
  const r = await repo.getReminderById(id);
  if (r) await syncReminder(r);
}

export async function saveReminder(input: ReminderInput, existingId?: string): Promise<string> {
  let id = existingId;
  if (id) {
    await repo.updateReminder(id, {
      ...input,
      title: input.title.trim(),
      note: input.note.trim(),
      is_completed: 0,
      completed_at: null,
      snooze_until: 0,
    });
  } else {
    id = await repo.createReminder(input);
  }
  await syncById(id);
  return id;
}

/**
 * Marks done. Repeating reminders move to their next occurrence instead
 * (returns 'advanced'); one-time reminders are finished ('completed').
 */
export async function completeReminder(r: Reminder): Promise<'completed' | 'advanced'> {
  const now = Date.now();
  await dismissPresentedFor(r.id);
  const next = occurrenceAfterDone(toPlanInput(r), now);
  if (next != null) {
    await repo.updateReminder(r.id, { due_at: next, snooze_until: 0 });
    await syncById(r.id);
    return 'advanced';
  }
  await repo.updateReminder(r.id, { is_completed: 1, completed_at: now, snooze_until: 0 });
  await syncById(r.id);
  return 'completed';
}

export async function completeReminderById(id: string): Promise<void> {
  const r = await repo.getReminderById(id);
  if (r && !r.is_completed) await completeReminder(r);
}

/** Restores a reminder to exactly how it was (undo of complete / snooze). */
export async function restoreSnapshot(r: Reminder): Promise<void> {
  await repo.updateReminder(r.id, {
    due_at: r.due_at, is_completed: r.is_completed, completed_at: r.completed_at, snooze_until: r.snooze_until,
  });
  await syncById(r.id);
}

export async function reopenReminder(r: Reminder): Promise<void> {
  await repo.updateReminder(r.id, { is_completed: 0, completed_at: null, snooze_until: 0 });
  await syncById(r.id);
}

export async function snoozeReminder(id: string, minutes: number): Promise<void> {
  const r = await repo.getReminderById(id);
  if (!r) return;
  await dismissPresentedFor(id);
  await repo.updateReminder(id, { snooze_until: Date.now() + minutes * 60000, is_completed: 0, completed_at: null });
  await syncById(id);
}

/** Snooze to an exact time (e.g. "tomorrow 9 AM"). */
export async function snoozeReminderUntil(id: string, at: number): Promise<void> {
  await snoozeReminder(id, Math.max(1, Math.round((at - Date.now()) / 60000)));
}

export async function removeReminder(r: Reminder): Promise<void> {
  await cancelNotifications(parseIds(r.notification_id));
  await dismissPresentedFor(r.id);
  await repo.deleteReminder(r.id);
  await repo.updateReminder(r.id, { notification_id: null });
}

export async function restoreRemovedReminder(id: string): Promise<void> {
  await repo.restoreReminder(id);
  await syncById(id);
}

export async function clearCompletedReminders(): Promise<number> {
  return repo.clearCompleted();
}

/**
 * Re-schedules every reminder. Runs on app start and from the background
 * task: tops up repeat-until-done alerts, moves old reminders to the new
 * channels, and restores alarms after a backup restore.
 */
export async function resyncReminderNotifications(opts?: { hide?: boolean }): Promise<void> {
  const hide = opts?.hide ?? (await getPersistedSettings()).reminderPrivate;
  const all = await repo.getAllReminders();
  for (const r of all) {
    try {
      // Clear a snooze that already rang.
      if (r.snooze_until && r.snooze_until <= Date.now() - 6 * 3600000) {
        await repo.updateReminder(r.id, { snooze_until: 0 });
        r.snooze_until = 0;
      }
      if (r.is_completed && !r.notification_id) continue;
      await syncReminder(r, { hide });
    } catch (e) {
      console.warn('[reminders] resync failed for', r.id, e);
    }
  }
}

export interface ReminderHealth {
  pending: number;          // reminders that should ring in future
  scheduled: number;        // of those, how many have alarms queued
  missing: string[];        // reminder ids with no queued alarm
}

/** Checks that every pending reminder really has an alarm queued. */
export async function checkReminderHealth(): Promise<ReminderHealth> {
  const queued = await getScheduledIds();
  const all = await repo.getAllReminders();
  const now = Date.now();
  let pending = 0;
  let scheduled = 0;
  const missing: string[] = [];
  for (const r of all) {
    if (nextRing(r, now) == null) continue;
    pending++;
    const ids = parseIds(r.notification_id);
    if (ids.some((id) => queued.has(id))) scheduled++;
    else missing.push(r.id);
  }
  return { pending, scheduled, missing };
}

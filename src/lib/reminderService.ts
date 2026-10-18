/**
 * reminderService.ts — keeps the reminders table and the scheduled phone
 * notifications in step (save, edit, complete, delete, restore, resync).
 */
import * as reminderRepo from '@/lib/db/reminderRepo';
import type { Reminder, ReminderRepeatMode } from '@/lib/db/reminderRepo';
import { cancelReminderNotification, scheduleReminderNotification } from '@/lib/reminderNotifications';

export function dueMs(r: Pick<Reminder, 'due_at'>): number {
  return r.due_at < 10000000000 ? r.due_at * 1000 : r.due_at;
}

/** Next time a reminder will ring (repeating ones roll forward). */
export function nextOccurrence(r: Pick<Reminder, 'due_at' | 'repeat_mode'>, now = Date.now()): number {
  const base = dueMs(r);
  if (r.repeat_mode === 'once' || base > now) return base;
  const step = r.repeat_mode === 'daily' ? 86400000 : 7 * 86400000;
  const d = new Date(base);
  while (d.getTime() <= now) d.setTime(d.getTime() + step);
  // keep wall-clock time across DST shifts
  const orig = new Date(base);
  d.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
  return d.getTime();
}

function needsSchedule(r: Reminder): boolean {
  if (r.is_completed === 1 || r.deleted_at != null) return false;
  return r.repeat_mode !== 'once' || dueMs(r) > Date.now();
}

async function schedule(r: Reminder): Promise<string | null> {
  await cancelReminderNotification(r.notification_id);
  if (!needsSchedule(r)) return null;
  return scheduleReminderNotification(r.id, r.title, r.note, dueMs(r), r.repeat_mode, r.sound);
}

export interface ReminderFields {
  title: string;
  note: string;
  dueAt: number;
  repeatMode: ReminderRepeatMode;
  sound: string;
}

export async function saveReminder(f: ReminderFields, existingId?: string): Promise<void> {
  if (existingId) {
    const old = await reminderRepo.getReminderById(existingId);
    if (old) await cancelReminderNotification(old.notification_id);
    await reminderRepo.updateReminder(existingId, {
      title: f.title.trim(), note: f.note.trim(), due_at: f.dueAt,
      repeat_mode: f.repeatMode, sound: f.sound, is_completed: 0, notification_id: null,
    });
    const r = await reminderRepo.getReminderById(existingId);
    if (r) await reminderRepo.updateReminder(existingId, { notification_id: await schedule(r) });
    return;
  }
  const r = await reminderRepo.createReminder(f.title, f.note, f.dueAt, f.repeatMode, f.sound);
  await reminderRepo.updateReminder(r.id, { notification_id: await schedule(r) });
}

export async function completeReminder(r: Reminder): Promise<void> {
  await cancelReminderNotification(r.notification_id);
  await reminderRepo.markCompleted(r.id);
  await reminderRepo.updateReminder(r.id, { notification_id: null });
}

export async function completeReminderById(id: string): Promise<void> {
  const r = await reminderRepo.getReminderById(id);
  if (r) await completeReminder(r);
}

export async function reopenReminder(r: Reminder): Promise<void> {
  await reminderRepo.markNotCompleted(r.id);
  const fresh = await reminderRepo.getReminderById(r.id);
  if (fresh) await reminderRepo.updateReminder(r.id, { notification_id: await schedule(fresh) });
}

export async function removeReminder(r: Reminder): Promise<void> {
  await cancelReminderNotification(r.notification_id);
  await reminderRepo.deleteReminder(r.id);
  await reminderRepo.updateReminder(r.id, { notification_id: null });
}

export async function restoreRemovedReminder(id: string): Promise<void> {
  await reminderRepo.restoreReminder(id);
  const r = await reminderRepo.getReminderById(id);
  if (r) await reminderRepo.updateReminder(id, { notification_id: await schedule(r) });
}

/**
 * Re-schedules every pending reminder. Run on app start: moves old
 * reminders to the new sound channels and brings reminders back after a
 * backup restore or a phone restart that dropped them.
 */
export async function resyncReminderNotifications(): Promise<void> {
  const all = await reminderRepo.getAllReminders();
  for (const r of all) {
    if (!needsSchedule(r) && !r.notification_id) continue;
    try {
      await reminderRepo.updateReminder(r.id, { notification_id: await schedule(r) });
    } catch (e) {
      console.warn('[reminders] resync failed for', r.id, e);
    }
  }
}

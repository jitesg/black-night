/**
 * reminderRepo.ts — SQLite data access for custom reminders.
 *
 * Times (due_at, snooze_until, completed_at) are epoch MILLISECONDS; very old
 * rows may hold seconds — use dueMs() from reminderService to read them.
 * notification_id holds a JSON array of scheduled notification ids (older
 * rows: a single id string).
 */
import { getDatabase, generateUUID, nowTimestamp } from './database';

export type ReminderRepeatMode = 'once' | 'daily' | 'weekly' | 'monthly';
export type ReminderPriority = 'high' | 'normal' | 'low';
export type ReminderCategory = 'general' | 'peshi' | 'case' | 'meeting' | 'personal';

export interface Reminder {
  id: string;
  title: string;
  note: string;
  due_at: number;
  repeat_mode: ReminderRepeatMode;
  /** JS weekdays (0 = Sunday) for weekly repeat. */
  repeat_days: number[];
  sound: string;
  notification_id: string | null;
  is_completed: number;
  category: ReminderCategory;
  priority: ReminderPriority;
  fir_id: string;
  fir_label: string;
  early_min: number;
  nag_min: number;
  snooze_until: number;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface ReminderInput {
  title: string;
  note: string;
  due_at: number;
  repeat_mode: ReminderRepeatMode;
  repeat_days: number[];
  sound: string;
  category: ReminderCategory;
  priority: ReminderPriority;
  fir_id: string;
  fir_label: string;
  early_min: number;
  nag_min: number;
}

const REPEATS: ReminderRepeatMode[] = ['once', 'daily', 'weekly', 'monthly'];
const PRIORITIES: ReminderPriority[] = ['high', 'normal', 'low'];
const CATEGORIES: ReminderCategory[] = ['general', 'peshi', 'case', 'meeting', 'personal'];

function pick<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function parseDays(v: unknown): number[] {
  if (typeof v !== 'string' || !v.trim()) return [];
  return v.split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

function rowToReminder(row: Record<string, unknown>): Reminder {
  return {
    id: row.id as string,
    title: (row.title as string) || '',
    note: (row.note as string) || '',
    due_at: Number(row.due_at),
    repeat_mode: pick(row.repeat_mode, REPEATS, 'once'),
    repeat_days: parseDays(row.repeat_days),
    sound: (row.sound as string) || 'default',
    notification_id: (row.notification_id as string | null) ?? null,
    is_completed: Number(row.is_completed) || 0,
    category: pick(row.category, CATEGORIES, 'general'),
    priority: pick(row.priority, PRIORITIES, 'normal'),
    fir_id: (row.fir_id as string) || '',
    fir_label: (row.fir_label as string) || '',
    early_min: Number(row.early_min) || 0,
    nag_min: Number(row.nag_min) || 0,
    snooze_until: Number(row.snooze_until) || 0,
    completed_at: row.completed_at != null ? Number(row.completed_at) : null,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
    deleted_at: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

/** Uncompleted active reminders, soonest first (used by the daily summary). */
export async function getUpcomingReminders(): Promise<Reminder[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM reminders
     WHERE deleted_at IS NULL AND is_completed = 0
     ORDER BY due_at ASC`
  );
  return rows.map(rowToReminder);
}

/** All active (not deleted) reminders. */
export async function getAllReminders(): Promise<Reminder[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM reminders WHERE deleted_at IS NULL ORDER BY due_at ASC`
  );
  return rows.map(rowToReminder);
}

export async function getReminderById(id: string): Promise<Reminder | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM reminders WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return row ? rowToReminder(row) : null;
}

export async function createReminder(input: ReminderInput): Promise<string> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT INTO reminders (
      id, title, note, due_at, repeat_mode, repeat_days, sound, notification_id, is_completed,
      category, priority, fir_id, fir_label, early_min, nag_min, snooze_until, completed_at,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, NULL)`,
    [
      id, input.title.trim(), input.note.trim(), input.due_at, input.repeat_mode, input.repeat_days.join(','),
      input.sound, input.category, input.priority, input.fir_id, input.fir_label,
      input.early_min, input.nag_min, now, now,
    ]
  );
  return id;
}

type Patch = Partial<Omit<Reminder, 'id' | 'created_at' | 'repeat_days'>> & { repeat_days?: number[] };

export async function updateReminder(id: string, fields: Patch): Promise<void> {
  const db = await getDatabase();
  const keys = Object.keys(fields) as (keyof Patch)[];
  if (keys.length === 0) return;
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const k of keys) {
    sets.push(`${k} = ?`);
    const v = fields[k];
    values.push(k === 'repeat_days' ? (v as number[]).join(',') : ((v ?? null) as string | number | null));
  }
  sets.push('updated_at = ?');
  values.push(nowTimestamp());
  values.push(id);
  await db.runAsync(`UPDATE reminders SET ${sets.join(', ')} WHERE id = ?`, values);
}

/** Soft delete. */
export async function deleteReminder(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(`UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
}

/** Undo a soft delete. */
export async function restoreReminder(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE reminders SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [nowTimestamp(), id]);
}

/** Permanently removes completed reminders. Returns how many. */
export async function clearCompleted(): Promise<number> {
  const db = await getDatabase();
  const now = nowTimestamp();
  const res = await db.runAsync(
    `UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL AND is_completed = 1`,
    [now, now]
  );
  return res.changes ?? 0;
}

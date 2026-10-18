/**
 * reminderRepo.ts — SQLite data access for custom reminders
 */
import { getDatabase, generateUUID, nowTimestamp } from './database';

export type ReminderRepeatMode = 'once' | 'daily' | 'weekly';

export interface Reminder {
  id: string;
  title: string;
  note: string;
  due_at: number;
  repeat_mode: ReminderRepeatMode;
  sound: string;
  notification_id: string | null;
  is_completed: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export type ReminderInput = {
  title: string;
  note?: string;
  due_at: number;
  repeat_mode?: ReminderRepeatMode;
  sound?: string;
  notification_id?: string | null;
};

function rowToReminder(row: Record<string, unknown>): Reminder {
  return {
    id: row.id as string,
    title: row.title as string,
    note: (row.note as string) || '',
    due_at: Number(row.due_at),
    repeat_mode: ((row.repeat_mode as string) || 'once') as ReminderRepeatMode,
    sound: (row.sound as string) || 'default',
    notification_id: (row.notification_id as string | null) ?? null,
    is_completed: Number(row.is_completed) || 0,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
    deleted_at: row.deleted_at != null ? Number(row.deleted_at) : null,
  };
}

/**
 * Fetch all upcoming (uncompleted) active reminders sorted by due date ascending.
 */
export async function getUpcomingReminders(): Promise<Reminder[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM reminders
     WHERE deleted_at IS NULL AND is_completed = 0
     ORDER BY due_at ASC`
  );
  return rows.map(rowToReminder);
}

/**
 * Fetch past (completed or due in the past) active reminders sorted by due date descending.
 */
export async function getPastReminders(): Promise<Reminder[]> {
  const db = await getDatabase();
  // due_at is stored in milliseconds (older rows may be seconds)
  const nowMs = Date.now();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM reminders
     WHERE deleted_at IS NULL AND (is_completed = 1 OR
       (CASE WHEN due_at < 10000000000 THEN due_at * 1000 ELSE due_at END) < ?)
     ORDER BY due_at DESC`,
    [nowMs]
  );
  return rows.map(rowToReminder);
}

/**
 * Fetch a single reminder by ID.
 */
export async function getReminderById(id: string): Promise<Reminder | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM reminders WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return row ? rowToReminder(row) : null;
}

/**
 * Create a new reminder record.
 */
export async function createReminder(
  title: string,
  note: string = '',
  dueAt: number,
  repeatMode: ReminderRepeatMode = 'once',
  sound: string = 'default'
): Promise<Reminder> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();

  await db.runAsync(
    `INSERT INTO reminders (
      id, title, note, due_at, repeat_mode, sound, notification_id,
      is_completed, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, NULL)`,
    [id, title.trim(), note.trim(), dueAt, repeatMode, sound, now, now]
  );

  return {
    id,
    title: title.trim(),
    note: note.trim(),
    due_at: dueAt,
    repeat_mode: repeatMode,
    sound,
    notification_id: null,
    is_completed: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

/**
 * Update dynamic fields on an existing reminder.
 */
export async function updateReminder(
  id: string,
  fields: Partial<Omit<Reminder, 'id' | 'created_at'>>
): Promise<void> {
  const db = await getDatabase();
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) return;

  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  for (const k of keys) {
    setClauses.push(`${k} = ?`);
    values.push((fields[k] ?? null) as string | number | null);
  }

  setClauses.push('updated_at = ?');
  values.push(nowTimestamp());
  values.push(id);

  await db.runAsync(
    `UPDATE reminders SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Mark a reminder as completed.
 */
export async function markCompleted(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE reminders SET is_completed = 1, updated_at = ? WHERE id = ?`,
    [now, id]
  );
}

/**
 * Soft delete a reminder.
 */
export async function deleteReminder(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowTimestamp();
  await db.runAsync(
    `UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, id]
  );
}

/**
 * All active (not deleted) reminders, soonest first. Screens group them
 * (overdue / today / upcoming / done) in JS — due_at is stored in ms.
 */
export async function getAllReminders(): Promise<Reminder[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM reminders WHERE deleted_at IS NULL ORDER BY due_at ASC`
  );
  return rows.map(rowToReminder);
}

/** Undo a soft delete. */
export async function restoreReminder(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE reminders SET deleted_at = NULL, updated_at = ? WHERE id = ?`,
    [nowTimestamp(), id]
  );
}

/** Mark a reminder as not completed again. */
export async function markNotCompleted(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE reminders SET is_completed = 0, updated_at = ? WHERE id = ?`,
    [nowTimestamp(), id]
  );
}

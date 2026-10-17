/**
 * notificationLogRepo.ts — SQLite data access for notification deduplication log
 */
import { getDatabase, generateUUID, nowTimestamp } from './database';

export interface NotificationLogEntry {
  id: string;
  ref_type: string;
  ref_id: string;
  notif_kind: string;
  notified_at: number;
}

/**
 * Checks whether an alert has already been logged/sent for the given reference and kind.
 */
export async function hasBeenNotified(
  refType: string,
  refId: string,
  kind: string,
): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM notification_log WHERE ref_type = ? AND ref_id = ? AND notif_kind = ? LIMIT 1`,
    [refType, refId, kind],
  );
  return !!row;
}

/**
 * Marks an alert as logged/sent using INSERT OR IGNORE so duplicate attempts
 * do not overwrite or throw error on UNIQUE(ref_type, ref_id, notif_kind).
 */
export async function markNotified(
  refType: string,
  refId: string,
  kind: string,
): Promise<void> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = nowTimestamp();
  await db.runAsync(
    `INSERT OR IGNORE INTO notification_log (id, ref_type, ref_id, notif_kind, notified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, refType, refId, kind, now],
  );
}

/**
 * reminderBackgroundTask.ts — lets "स्नूज़" / "पूरा हुआ" on a reminder
 * notification work even when the app is closed (Android runs this task
 * headless). Imported from the app entry (index.ts) so it is defined before
 * anything else runs.
 */
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const REMINDER_TASK = 'INVESTSUITE_REMINDER_ACTIONS';

type TaskData = Record<string, unknown>;

/** Pulls the action / ids out of the task payload (shape differs by state). */
function readResponse(data: TaskData): { actionIdentifier: string; notificationId: string; reminderId?: string } | null {
  const d = (data ?? {}) as Record<string, any>;
  const actionIdentifier: string | undefined = d.actionIdentifier;
  if (!actionIdentifier) return null;
  const request = d.notification?.request;
  const raw = request?.content?.data ?? request?.content?.dataString ?? d.data;
  let content: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try { content = JSON.parse(raw); } catch {}
  } else if (raw && typeof raw === 'object') {
    content = raw;
  }
  return {
    actionIdentifier,
    notificationId: request?.identifier ?? '',
    reminderId: content.reminderId as string | undefined,
  };
}

TaskManager.defineTask<TaskData>(REMINDER_TASK, async ({ data, error }) => {
  if (error) return;
  const r = readResponse(data);
  if (!r) return;
  // Loaded lazily so the database/settings code only loads when needed.
  const { handleReminderResponse } = await import('./reminderActions');
  await handleReminderResponse(r);
});

export async function registerReminderBackgroundTask(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const already = await TaskManager.isTaskRegisteredAsync(REMINDER_TASK);
    if (!already) await Notifications.registerTaskAsync(REMINDER_TASK);
  } catch (e) {
    console.warn('[reminders] background task registration failed:', e);
  }
}

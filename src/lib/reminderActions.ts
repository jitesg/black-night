/**
 * reminderActions.ts — handles taps on reminder notifications.
 *
 * Android delivers an action-button tap (स्नूज़ / पूरा हुआ) to the
 * background task when the app is closed or in the background, and to the
 * in-app listener when it is open. Both call handleReminderResponse(); a
 * small "already handled" memory stops the same tap from running twice.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPersistedSettings } from '@/hooks/useSettingsStore';
import { completeReminderById, snoozeReminder } from '@/lib/reminderService';

const HANDLED_KEY = 'reminder.handledResponses';
const handled = new Set<string>();

async function alreadyHandled(key: string): Promise<boolean> {
  if (handled.has(key)) return true;
  handled.add(key);
  try {
    const raw = await AsyncStorage.getItem(HANDLED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (list.includes(key)) return true;
    await AsyncStorage.setItem(HANDLED_KEY, JSON.stringify([...list, key].slice(-50)));
  } catch {}
  return false;
}

export interface ResponseLike {
  actionIdentifier: string;
  notificationId: string;
  reminderId?: string;
}

export function toResponseLike(r: Notifications.NotificationResponse): ResponseLike {
  return {
    actionIdentifier: r.actionIdentifier,
    notificationId: r.notification.request.identifier,
    reminderId: r.notification.request.content.data?.reminderId as string | undefined,
  };
}

/** Returns true when the tap was a snooze / done action that got handled. */
export async function handleReminderResponse(r: ResponseLike): Promise<boolean> {
  if (!r.reminderId) return false;
  if (r.actionIdentifier !== 'snooze' && r.actionIdentifier !== 'done') return false;
  if (await alreadyHandled(`${r.notificationId}:${r.actionIdentifier}`)) return true;
  try {
    await Notifications.dismissNotificationAsync(r.notificationId).catch(() => {});
    if (r.actionIdentifier === 'snooze') {
      const { reminderSnooze } = await getPersistedSettings();
      await snoozeReminder(r.reminderId, reminderSnooze || 10);
    } else {
      await completeReminderById(r.reminderId);
    }
  } catch (e) {
    console.warn('[reminders] action failed:', e);
  }
  return true;
}

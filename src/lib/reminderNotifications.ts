/**
 * reminderNotifications.ts — thin layer over expo-notifications:
 * Android channels (one per sound), categories (action buttons), scheduling
 * one planned alert, cancelling, permission + system-settings helpers.
 * Reminder rules live in reminderPlanner.ts, DB sync in reminderService.ts.
 */
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import type { PlannedTrigger } from '@/lib/reminderPlanner';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type ReminderSound = 'default' | 'bell' | 'chime' | 'alarm' | 'silent';

/**
 * Android plays sound/vibration from the notification CHANNEL, and a
 * channel's sound can never change after it is created — so every sound
 * has its own channel.
 *  default — phone's notification sound
 *  bell / chime — bundled sounds (assets/sounds, copied by the plugin)
 *  alarm — phone's sound on the ALARM stream (rings at alarm volume, also
 *          when the ringer is on silent/vibrate)
 *  silent — banner only
 */
const VIBRATE = [0, 400, 250, 400];
const CHANNELS: Record<ReminderSound, Notifications.NotificationChannelInput & { id: string }> = {
  default: {
    id: 'reminder_v2_default', name: 'रिमाइंडर (फ़ोन की ध्वनि)',
    importance: Notifications.AndroidImportance.MAX, sound: 'default',
    vibrationPattern: VIBRATE, enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  bell: {
    id: 'reminder_v2_bell', name: 'रिमाइंडर (घंटी)',
    importance: Notifications.AndroidImportance.MAX, sound: 'bell.wav',
    vibrationPattern: VIBRATE, enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  chime: {
    id: 'reminder_v2_chime', name: 'रिमाइंडर (चाइम)',
    importance: Notifications.AndroidImportance.MAX, sound: 'chime.wav',
    vibrationPattern: VIBRATE, enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  alarm: {
    id: 'reminder_v2_alarm', name: 'रिमाइंडर (तेज़ अलार्म)',
    importance: Notifications.AndroidImportance.MAX, sound: 'default',
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
    vibrationPattern: [0, 600, 300, 600, 300, 600], enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  silent: {
    id: 'reminder_v2_silent', name: 'रिमाइंडर (बिना ध्वनि)',
    importance: Notifications.AndroidImportance.HIGH, sound: null, enableVibrate: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
};

/** Channel for app alerts (court dates, deadlines, daily summary). */
const ALERTS_CHANNEL: Notifications.NotificationChannelInput & { id: string } = {
  ...CHANNELS.default,
  id: 'app_alerts_v2',
  name: 'केस अलर्ट',
  importance: Notifications.AndroidImportance.HIGH,
};

export const REMINDER_CATEGORY = 'reminder';

export function normalizeSound(sound: string | null | undefined): ReminderSound {
  return sound && sound in CHANNELS ? (sound as ReminderSound) : 'default';
}

export function channelIdForSound(sound: string | null | undefined): string {
  return CHANNELS[normalizeSound(sound)].id;
}

function contentSound(s: ReminderSound): string | boolean {
  if (s === 'silent') return false;
  if (s === 'bell') return 'bell.wav';
  if (s === 'chime') return 'chime.wav';
  return 'default';
}

let channelsReady: Promise<void> | null = null;

export function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelsReady) {
    channelsReady = (async () => {
      for (const { id, ...cfg } of [...Object.values(CHANNELS), ALERTS_CHANNEL]) {
        await Notifications.setNotificationChannelAsync(id, cfg);
      }
      // Old channel from earlier versions (fixed settings, often no sound).
      try { await Notifications.deleteNotificationChannelAsync('default'); } catch {}
    })().catch((e) => {
      channelsReady = null;
      throw e;
    });
  }
  return channelsReady;
}

let categoriesReady: Promise<void> | null = null;

export function setupReminderCategories(): Promise<void> {
  if (!categoriesReady) {
    categoriesReady = Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
      { identifier: 'snooze', buttonTitle: 'स्नूज़', options: { opensAppToForeground: false } },
      { identifier: 'done', buttonTitle: 'पूरा हुआ ✓', options: { opensAppToForeground: false } },
    ]).then(() => undefined).catch((e) => {
      categoriesReady = null;
      throw e;
    });
  }
  return categoriesReady;
}

export async function requestReminderPermissions(): Promise<boolean> {
  try { await ensureAndroidChannels(); } catch {}
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── System settings shortcuts (Android) ────────────────────────────────────

function appPackage(): string {
  return Constants.expoConfig?.android?.package ?? 'com.miaoda.appd2z6dwnk2jnl';
}

async function tryIntent(action: string, params?: IntentLauncher.IntentLauncherParams): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    await IntentLauncher.startActivityAsync(action, params);
    return true;
  } catch {
    return false;
  }
}

/** This app's notification settings page. */
export async function openAppNotificationSettings(): Promise<void> {
  const ok = await tryIntent('android.settings.APP_NOTIFICATION_SETTINGS', {
    extra: { 'android.provider.extra.APP_PACKAGE': appPackage() },
  });
  if (!ok) Linking.openSettings().catch(() => {});
}

/** "Alarms & reminders" special access (Android 12+). */
export async function openExactAlarmSettings(): Promise<void> {
  const ok = await tryIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', { data: `package:${appPackage()}` });
  if (!ok) Linking.openSettings().catch(() => {});
}

/** Battery optimisation list (choose "Don't optimise" / "Unrestricted"). */
export async function openBatterySettings(): Promise<void> {
  const ok = await tryIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  if (!ok) Linking.openSettings().catch(() => {});
}

/** App info page. */
export function openAppInfo(): void {
  Linking.openSettings().catch(() => {});
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

function toExpoTrigger(t: PlannedTrigger, channelId: string): Notifications.NotificationTriggerInput {
  const T = Notifications.SchedulableTriggerInputTypes;
  switch (t.type) {
    case 'date':
      return { type: T.DATE, date: new Date(t.at), channelId };
    case 'daily':
      return { type: T.DAILY, hour: t.hour, minute: t.minute, channelId };
    case 'weekly':
      return { type: T.WEEKLY, weekday: t.weekday, hour: t.hour, minute: t.minute, channelId };
    case 'monthly':
      return { type: T.MONTHLY, day: t.day, hour: t.hour, minute: t.minute, channelId };
  }
}

export interface AlertContent {
  reminderId: string;
  title: string;
  body: string;
  sound: string;
  kind: 'main' | 'early' | 'nag' | 'snooze';
}

export async function scheduleAlert(c: AlertContent, trigger: PlannedTrigger): Promise<string> {
  await ensureAndroidChannels();
  const s = normalizeSound(c.sound);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: c.title,
      body: c.body,
      sound: contentSound(s),
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: s === 'silent' ? undefined : VIBRATE,
      categoryIdentifier: REMINDER_CATEGORY,
      data: { reminderId: c.reminderId, kind: c.kind, sound: s },
    },
    trigger: toExpoTrigger(trigger, channelIdForSound(s)),
  });
}

export async function cancelNotifications(ids: string[]): Promise<void> {
  for (const id of ids) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  }
}

/** Removes this reminder's notifications already showing in the tray. */
export async function dismissPresentedFor(reminderId: string): Promise<void> {
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    for (const n of shown) {
      if (n.request.content.data?.reminderId === reminderId) {
        await Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {});
      }
    }
  } catch {}
}

/** ids of every notification the system has queued for this app. */
export async function getScheduledIds(): Promise<Set<string>> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return new Set(all.map((n) => n.identifier));
  } catch {
    return new Set();
  }
}

/** Fires a sample reminder after `seconds` so the user can hear the sound. */
export async function sendTestReminder(sound: string, seconds = 5): Promise<boolean> {
  const ok = await requestReminderPermissions();
  if (!ok) return false;
  const s = normalizeSound(sound);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ टेस्ट रिमाइंडर',
      body: 'रिमाइंडर की ध्वनि ऐसी सुनाई देगी।',
      sound: contentSound(s),
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { kind: 'test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: channelIdForSound(s),
    },
  });
  return true;
}

/**
 * Schedules a local notification at a specific date, or immediately if triggerDate is null.
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  triggerDate: Date | null,
  data?: Record<string, unknown>,
): Promise<string> {
  try { await ensureAndroidChannels(); } catch {}
  const trigger: Notifications.NotificationTriggerInput = triggerDate
    ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate, channelId: ALERTS_CHANNEL.id }
    : Platform.OS === 'android' ? { channelId: ALERTS_CHANNEL.id } : null;

  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', data },
    trigger,
  });
}

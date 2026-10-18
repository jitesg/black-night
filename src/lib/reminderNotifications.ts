import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

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
 * Android plays sound/vibration from the notification CHANNEL, not from the
 * notification itself, and a channel's sound can never change after it is
 * created. So every reminder sound gets its own channel (v2 ids — the old
 * 'default' channel may exist on phones with the wrong settings).
 *
 * - default: phone's notification sound (follows notification volume)
 * - bell / chime: bundled sounds (assets/sounds, copied by the
 *   expo-notifications plugin)
 * - alarm: phone's sound on the ALARM stream — rings at alarm volume, also
 *   when the ringer is on silent/vibrate
 * - silent: banner only
 */
const CHANNELS: Record<ReminderSound, Notifications.NotificationChannelInput & { id: string }> = {
  default: {
    id: 'reminder_v2_default',
    name: 'रिमाइंडर (फ़ोन की ध्वनि)',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 250, 400],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  bell: {
    id: 'reminder_v2_bell',
    name: 'रिमाइंडर (घंटी)',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'bell.wav',
    vibrationPattern: [0, 400, 250, 400],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  chime: {
    id: 'reminder_v2_chime',
    name: 'रिमाइंडर (चाइम)',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'chime.wav',
    vibrationPattern: [0, 400, 250, 400],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  alarm: {
    id: 'reminder_v2_alarm',
    name: 'रिमाइंडर (तेज़ अलार्म)',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  },
  silent: {
    id: 'reminder_v2_silent',
    name: 'रिमाइंडर (बिना ध्वनि)',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null,
    enableVibrate: false,
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

function normalizeSound(sound: string | null | undefined): ReminderSound {
  return sound && sound in CHANNELS ? (sound as ReminderSound) : 'default';
}

export function channelIdForSound(sound: string | null | undefined): string {
  return CHANNELS[normalizeSound(sound)].id;
}

let channelsReady: Promise<void> | null = null;

function ensureAndroidChannels(): Promise<void> {
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

export async function requestReminderPermissions(): Promise<boolean> {
  try {
    await ensureAndroidChannels();
  } catch {
    // keep going — permission request still matters
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Opens this app's system settings (notifications / battery). */
export function openAppNotificationSettings(): void {
  Linking.openSettings().catch(() => {});
}

function dateTrigger(date: Date, channelId: string): Notifications.NotificationTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId };
}

export async function setupReminderCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync('reminder', [
    { identifier: 'snooze', buttonTitle: 'स्नूज़', options: { opensAppToForeground: false } },
    { identifier: 'done', buttonTitle: 'पूरा हुआ ✓', options: { opensAppToForeground: false } },
  ]);
}

function toMs(t: number): number {
  return t < 10000000000 ? t * 1000 : t;
}

export async function scheduleReminderNotification(
  id: string,
  title: string,
  note: string,
  dueAt: number,
  repeatMode: 'once' | 'daily' | 'weekly',
  sound: string,
): Promise<string> {
  await ensureAndroidChannels();
  const channelId = channelIdForSound(sound);
  const d = new Date(toMs(dueAt));
  const trigger: Notifications.NotificationTriggerInput = repeatMode === 'daily'
    ? {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: d.getHours(), minute: d.getMinutes(), channelId,
      }
    : repeatMode === 'weekly'
      ? {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: d.getDay() + 1, hour: d.getHours(), minute: d.getMinutes(), channelId,
        }
      : dateTrigger(d, channelId);

  const s = normalizeSound(sound);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `⏰ ${title}`,
      body: note || title,
      sound: s === 'silent' ? false : s === 'bell' ? 'bell.wav' : s === 'chime' ? 'chime.wav' : 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: s === 'silent' ? undefined : [0, 400, 250, 400],
      categoryIdentifier: 'reminder',
      data: { reminderId: id, sound: s, kind: 'reminder' },
    },
    trigger,
  });
}

export async function cancelReminderNotification(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
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
      sound: s === 'silent' ? false : s === 'bell' ? 'bell.wav' : s === 'chime' ? 'chime.wav' : 'default',
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
  const trigger = triggerDate
    ? dateTrigger(triggerDate, ALERTS_CHANNEL.id)
    : Platform.OS === 'android' ? { channelId: ALERTS_CHANNEL.id } : null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data,
    },
    trigger,
  });
}

export interface ReminderResponseHandlers {
  snoozeMinutes: number;
  /** Called after "पूरा हुआ" is tapped on a reminder notification. */
  onDone: (reminderId: string) => Promise<void> | void;
  /** Called when the notification body itself is tapped. */
  onOpen: (reminderId: string) => void;
}

// Handles the action buttons and taps on fired reminder notifications.
export function registerReminderResponseHandler(h: ReminderResponseHandlers): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(async (response: Notifications.NotificationResponse) => {
    const content = response.notification.request.content;
    const reminderId = content.data?.reminderId as string | undefined;
    if (!reminderId) return;
    const notifId = response.notification.request.identifier;
    try {
      if (response.actionIdentifier === 'snooze') {
        await Notifications.dismissNotificationAsync(notifId).catch(() => {});
        const sound = normalizeSound(content.data?.sound as string | undefined);
        await ensureAndroidChannels();
        await Notifications.scheduleNotificationAsync({
          content: {
            title: content.title ?? undefined,
            body: content.body ?? undefined,
            data: content.data,
            categoryIdentifier: 'reminder',
            sound: sound === 'silent' ? false : sound === 'bell' ? 'bell.wav' : sound === 'chime' ? 'chime.wav' : 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: dateTrigger(new Date(Date.now() + h.snoozeMinutes * 60 * 1000), channelIdForSound(sound)),
        });
      } else if (response.actionIdentifier === 'done') {
        await Notifications.dismissNotificationAsync(notifId).catch(() => {});
        await h.onDone(reminderId);
      } else if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        h.onOpen(reminderId);
      }
    } catch (e) {
      console.warn('[reminders] notification action failed:', e);
    }
  });
  return () => sub.remove();
}

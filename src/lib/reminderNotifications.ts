import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android shows notifications only through a channel. The app.json plugin
// names 'default' as the default channel, so create it with high importance
// (heads-up banner + sound). It must exist before asking for permission on
// Android 13+.
const ANDROID_CHANNEL_ID = 'default';

async function ensureAndroidChannel(): Promise<void> {
  if (process.env.EXPO_OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function requestReminderPermissions(): Promise<boolean> {
  try {
    await ensureAndroidChannel();
  } catch {
    // keep going — permission request still matters
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// expo-notifications needs a typed trigger; untyped objects are rejected,
// which made every reminder fail to schedule. Calendar-style triggers are
// also iOS-only, so daily/weekly use the dedicated types.
function dateTrigger(date: Date): Notifications.NotificationTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: ANDROID_CHANNEL_ID };
}

export async function setupReminderCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync('reminder', [
    { identifier: 'snooze', buttonTitle: 'Snooze', options: { opensAppToForeground: false } },
    { identifier: 'dismiss', buttonTitle: 'Dismiss', options: { opensAppToForeground: false, isDestructive: true } },
  ]);
}

export async function scheduleReminderNotification(
  id: string,
  title: string,
  note: string,
  dueAt: number,
  repeatMode: 'once' | 'daily' | 'weekly',
  sound: string,
): Promise<string> {
  const dueMs = dueAt < 10000000000 ? dueAt * 1000 : dueAt;
  const d = new Date(dueMs);
  const trigger: Notifications.NotificationTriggerInput = repeatMode === 'daily'
    ? {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: d.getHours(), minute: d.getMinutes(), channelId: ANDROID_CHANNEL_ID,
      }
    : repeatMode === 'weekly'
      ? {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: d.getDay() + 1, hour: d.getHours(), minute: d.getMinutes(), channelId: ANDROID_CHANNEL_ID,
        }
      : dateTrigger(d);

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: note || title,
      sound: sound === 'silent' ? undefined : sound === 'default' ? true : sound,
      categoryIdentifier: 'reminder',
      data: { reminderId: id },
    },
    trigger,
  });
}

export async function cancelReminderNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
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
  const trigger = triggerDate ? dateTrigger(triggerDate) : null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data,
    },
    trigger,
  });
}

// Handles the "Snooze" action tapped on a fired notification —
// reschedules it `snoozeMinutes` from now, one-time.
export function registerSnoozeHandler(snoozeMinutes: number): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(async (response: Notifications.NotificationResponse) => {
    if (response.actionIdentifier !== 'snooze') return;
    const reminderId = response.notification.request.content.data?.reminderId as string | undefined;
    if (!reminderId) return;
    const prevContent = response.notification.request.content;
    const newDue = Date.now() + snoozeMinutes * 60 * 1000;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: prevContent.title ?? undefined,
        body: prevContent.body ?? undefined,
        data: prevContent.data,
        categoryIdentifier: prevContent.categoryIdentifier ?? undefined,
        sound: prevContent.sound ? true : undefined,
      },
      trigger: dateTrigger(new Date(newDue)),
    });
  });
  return () => sub.remove();
}

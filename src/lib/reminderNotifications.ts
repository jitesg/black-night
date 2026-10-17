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

export async function requestReminderPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
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
  const trigger = repeatMode === 'daily'
    ? ({ hour: d.getHours(), minute: d.getMinutes(), repeats: true } as Notifications.NotificationTriggerInput)
    : repeatMode === 'weekly'
      ? ({ weekday: d.getDay() + 1, hour: d.getHours(), minute: d.getMinutes(), repeats: true } as Notifications.NotificationTriggerInput)
      : ({ date: d } as Notifications.NotificationTriggerInput);

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
  const trigger = triggerDate
    ? ({ date: triggerDate } as Notifications.NotificationTriggerInput)
    : null;

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
      trigger: { date: new Date(newDue) } as Notifications.NotificationTriggerInput,
    });
  });
  return () => sub.remove();
}

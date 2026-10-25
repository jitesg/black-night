/**
 * appBadge.ts — number on the app icon (= सूचनाएँ that need action, same as the bell).
 *
 * Android: expo-notifications sets the launcher badge through ShortcutBadger (Samsung, Xiaomi,
 * Oppo/Vivo … launchers); stock Android shows a dot / the number of the notification instead.
 * Careful: setBadgeCountAsync(0) on Android also clears every notification in the tray,
 * so the badge is cleared only when no notification of this app is showing.
 */
import * as Notifications from 'expo-notifications';
import { loadNoticeCards } from '@/lib/db/noticeRepo';
import { noticeBadgeCount } from '@/lib/noticeCards';

let last = -1;

export async function refreshAppBadge(): Promise<number> {
  try {
    const count = noticeBadgeCount(await loadNoticeCards());
    if (count > 0) {
      if (count !== last) await Notifications.setBadgeCountAsync(count);
    } else if (last !== 0) {
      const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
      if (!presented.length) await Notifications.setBadgeCountAsync(0);
    }
    last = count;
    return count;
  } catch {
    return 0;
  }
}

/** Cancel the scheduled notifications whose data.kind matches. */
export async function cancelScheduledOfKind(kind: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => (n.content.data as Record<string, unknown> | undefined)?.kind === kind)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

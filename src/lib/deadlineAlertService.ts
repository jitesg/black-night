/**
 * deadlineAlertService.ts — phone notifications for न्यायालय (setting notifCourtAlerts) and
 * प्रार्थना पत्र (setting notifDeadlines) deadlines. Plan in deadlineAlerts.ts (pure).
 * Cancel + reschedule on every sync (app start / foreground, after a save / delete).
 * Privacy: only type + registration number, never names.
 */
import * as Notifications from 'expo-notifications';
import { getPersistedSettings } from '@/hooks/useSettingsStore';
import { scheduleLocalNotification } from '@/lib/reminderNotifications';
import { planDeadlineAlerts } from '@/lib/deadlineAlerts';
import { buildNoticeCards, noticeBadgeCount } from '@/lib/noticeCards';
import { loadNoticeInput } from '@/lib/db/noticeRepo';
import { cancelScheduledOfKind, refreshAppBadge } from '@/lib/appBadge';

export const DEADLINE_KIND = 'deadline';

let running: Promise<void> | null = null;

export function syncDeadlineAlerts(): Promise<void> {
  const next = (running ?? Promise.resolve()).then(doSync, doSync);
  running = next.finally(() => { if (running === next) running = null; });
  return next;
}

async function doSync(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await cancelScheduledOfKind(DEADLINE_KIND);
    const settings = await getPersistedSettings();
    if (!settings.notifCourtAlerts && !settings.notifDeadlines) return;
    const input = await loadNoticeInput();
    const alerts = planDeadlineAlerts({
      courtDocs: settings.notifCourtAlerts ? input.courtDocs : [],
      petitions: settings.notifDeadlines ? input.petitions : [],
    }, new Date());
    for (const a of alerts) {
      const badge = noticeBadgeCount(buildNoticeCards(input, a.at));
      await scheduleLocalNotification(a.card.title, a.card.body, a.at, { kind: DEADLINE_KIND, route: a.card.route }, badge);
    }
  } catch (e) {
    if (__DEV__) console.warn('[syncDeadlineAlerts]', e);
  }
}

/** Fire-and-forget resync after a न्यायालय document / प्रार्थना पत्र changes. */
export function resyncDeadlineAlertsSoon(): void {
  setTimeout(() => {
    syncDeadlineAlerts().catch(() => {}).finally(() => { refreshAppBadge().catch(() => {}); });
  }, 300);
}

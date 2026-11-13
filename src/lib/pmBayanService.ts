/**
 * pmBayanService.ts — phone alert "पंचनामा के बयान लंबित" (rules in pmBayan.ts).
 * One summary notification at 9 AM per day from day 7 after the पंचायतनामा while the
 * पंचनामा व पोस्टमार्टम checklist is not 6/6. Cancel + reschedule on every sync
 * (app start / foreground, after a checklist change). Setting: notifPmBayan.
 * Privacy: मु0अ0सं0 only, never names.
 */
import * as Notifications from 'expo-notifications';
import { getPersistedSettings } from '@/hooks/useSettingsStore';
import { scheduleLocalNotification } from '@/lib/reminderNotifications';
import { planPmBayanAlerts } from '@/lib/pmBayan';
import { buildNoticeCards, noticeBadgeCount } from '@/lib/noticeCards';
import { loadNoticeInput } from '@/lib/db/noticeRepo';
import { cancelScheduledOfKind, refreshAppBadge } from '@/lib/appBadge';

export const PM_BAYAN_KIND = 'pm_bayan';

let running: Promise<void> | null = null;

export function syncPmBayanAlerts(): Promise<void> {
  const next = (running ?? Promise.resolve()).then(doSync, doSync);
  running = next.finally(() => { if (running === next) running = null; });
  return next;
}

async function doSync(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await cancelScheduledOfKind(PM_BAYAN_KIND);
    const settings = await getPersistedSettings();
    if (settings.notifPmBayan === false) return;
    const input = await loadNoticeInput();
    for (const a of planPmBayanAlerts(input.pmBayan, new Date())) {
      const badge = noticeBadgeCount(buildNoticeCards(input, a.at));
      await scheduleLocalNotification(a.title, a.body, a.at, { kind: PM_BAYAN_KIND, route: a.route }, badge);
    }
  } catch (e) {
    if (__DEV__) console.warn('[syncPmBayanAlerts]', e);
  }
}

/** Fire-and-forget resync after a checklist change. */
export function resyncPmBayanAlertsSoon(): void {
  setTimeout(() => {
    syncPmBayanAlerts().catch(() => {}).finally(() => { refreshAppBadge().catch(() => {}); });
  }, 300);
}

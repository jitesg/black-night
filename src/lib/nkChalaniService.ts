/**
 * nkChalaniService.ts — phone alert "चलानी प्रेषण लंबित" (rules in nkChalani.ts).
 * One summary notification at 9 AM per day while any निरोधात्मक कार्यवाही has not
 * been ticked "चलानी प्रेषित की जा चुकी है". Cancel + reschedule on every sync
 * (app start / foreground, after a tick, a new or deleted karyvahi).
 * Setting: notifNkChalani. Privacy: village only, never names.
 */
import * as Notifications from 'expo-notifications';
import { getPersistedSettings } from '@/hooks/useSettingsStore';
import { scheduleLocalNotification } from '@/lib/reminderNotifications';
import { planNkAlerts } from '@/lib/nkChalani';
import { buildNoticeCards, noticeBadgeCount } from '@/lib/noticeCards';
import { loadNoticeInput } from '@/lib/db/noticeRepo';
import { cancelScheduledOfKind, refreshAppBadge } from '@/lib/appBadge';

export const NK_CHALANI_KIND = 'nk_chalani';
export const NK_CHALANI_ROUTE = '/(app)/nirodhatmak';

let running: Promise<void> | null = null;

export function syncNkChalaniAlerts(): Promise<void> {
  const next = (running ?? Promise.resolve()).then(doSync, doSync);
  running = next.finally(() => { if (running === next) running = null; });
  return next;
}

async function doSync(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await cancelScheduledOfKind(NK_CHALANI_KIND);
    const settings = await getPersistedSettings();
    if (settings.notifNkChalani === false) return;
    const input = await loadNoticeInput();
    for (const a of planNkAlerts(input.nkPending, new Date())) {
      const badge = noticeBadgeCount(buildNoticeCards(input, a.at));
      await scheduleLocalNotification(a.title, a.body, a.at, { kind: NK_CHALANI_KIND, route: NK_CHALANI_ROUTE }, badge);
    }
  } catch (e) {
    if (__DEV__) console.warn('[syncNkChalaniAlerts]', e);
  }
}

/** Fire-and-forget resync after a tick / new / deleted निरोधात्मक कार्यवाही. */
export function resyncNkChalaniAlertsSoon(): void {
  setTimeout(() => {
    syncNkChalaniAlerts().catch(() => {}).finally(() => { refreshAppBadge().catch(() => {}); });
  }, 300);
}

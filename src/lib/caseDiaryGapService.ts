/**
 * caseDiaryGapService.ts — schedules the "केस डायरी लंबित" alerts (rules in caseDiaryGap.ts).
 *
 * Every sync cancels the previously scheduled cd_gap alerts and schedules fresh ones,
 * so a new / edited / deleted case diary moves the alert automatically.
 * Runs on app start / foreground (syncAppNotifications) and after every case diary change.
 * Privacy: text carries only the FIR number, never names.
 */
import * as Notifications from 'expo-notifications';
import { getPersistedSettings } from '@/hooks/useSettingsStore';
import { scheduleLocalNotification } from '@/lib/reminderNotifications';
import { planCdAlerts } from '@/lib/caseDiaryGap';
import { buildNoticeCards, noticeBadgeCount } from '@/lib/noticeCards';
import { loadNoticeInput } from '@/lib/db/noticeRepo';
import { cancelScheduledOfKind, refreshAppBadge } from '@/lib/appBadge';

export { getPendingFirsWithLastDiary } from '@/lib/db/noticeRepo';
export const CD_GAP_KIND = 'cd_gap';

let running: Promise<void> | null = null;

export function syncCaseDiaryAlerts(): Promise<void> {
  // One sync at a time; a call during a running sync waits for it and runs again.
  const next = (running ?? Promise.resolve()).then(doSync, doSync);
  running = next.finally(() => { if (running === next) running = null; });
  return next;
}

async function doSync(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await cancelScheduledOfKind(CD_GAP_KIND);
    const settings = await getPersistedSettings();
    if (!settings.notifCaseDiaryGap) return;
    const input = await loadNoticeInput();
    for (const a of planCdAlerts(input.firs, new Date())) {
      // Badge = how many सूचनाएँ will need action at that moment.
      const badge = noticeBadgeCount(buildNoticeCards(input, a.at));
      await scheduleLocalNotification(a.title, a.body, a.at, { kind: CD_GAP_KIND, firId: a.firId }, badge);
    }
  } catch (e) {
    if (__DEV__) console.warn('[syncCaseDiaryAlerts]', e);
  }
}

/** Fire-and-forget resync after a case diary / FIR is added / edited / deleted. */
export function resyncCaseDiaryAlertsSoon(): void {
  setTimeout(() => {
    syncCaseDiaryAlerts().catch(() => {}).finally(() => { refreshAppBadge().catch(() => {}); });
  }, 300);
}

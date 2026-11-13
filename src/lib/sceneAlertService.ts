/**
 * sceneAlertService.ts — phone alert "घटनास्थल की कार्यवाही लंबित" (rules in sceneAlert.ts).
 * One summary notification at 9 AM per day from day 3 after the FIR (up to day 30) while the
 * घटनास्थल निरीक्षण card's ई-साक्ष्य / नक्शा नजरी are not written. Cancel + reschedule on every sync
 * (app start / foreground, after a checklist change). Setting: notifSceneGap.
 * Privacy: मु0अ0सं0 only, never names.
 */
import * as Notifications from 'expo-notifications';
import { getPersistedSettings } from '@/hooks/useSettingsStore';
import { scheduleLocalNotification } from '@/lib/reminderNotifications';
import { planSceneAlerts } from '@/lib/sceneAlert';
import { buildNoticeCards, noticeBadgeCount } from '@/lib/noticeCards';
import { loadNoticeInput } from '@/lib/db/noticeRepo';
import { cancelScheduledOfKind, refreshAppBadge } from '@/lib/appBadge';

export const SCENE_GAP_KIND = 'scene_gap';

let running: Promise<void> | null = null;

export function syncSceneAlerts(): Promise<void> {
  const next = (running ?? Promise.resolve()).then(doSync, doSync);
  running = next.finally(() => { if (running === next) running = null; });
  return next;
}

async function doSync(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await cancelScheduledOfKind(SCENE_GAP_KIND);
    const settings = await getPersistedSettings();
    if (settings.notifSceneGap === false) return;
    const input = await loadNoticeInput();
    for (const a of planSceneAlerts(input.scene, new Date())) {
      const badge = noticeBadgeCount(buildNoticeCards(input, a.at));
      await scheduleLocalNotification(a.title, a.body, a.at, { kind: SCENE_GAP_KIND, route: a.route }, badge);
    }
  } catch (e) {
    if (__DEV__) console.warn('[syncSceneAlerts]', e);
  }
}

/** Fire-and-forget resync after a checklist change. */
export function resyncSceneAlertsSoon(): void {
  setTimeout(() => {
    syncSceneAlerts().catch(() => {}).finally(() => { refreshAppBadge().catch(() => {}); });
  }, 300);
}

/**
 * caseDiaryGapService.ts — schedules the "केस डायरी लंबित" alerts (rules in caseDiaryGap.ts).
 *
 * Every sync cancels the previously scheduled cd_gap alerts and schedules fresh ones,
 * so a new / edited / deleted case diary moves the alert automatically.
 * Runs on app start / foreground (syncAppNotifications) and after every case diary change.
 * Privacy: text carries only the FIR number, never names.
 */
import * as Notifications from 'expo-notifications';
import { getDatabase } from '@/lib/db/database';
import { getPersistedSettings } from '@/hooks/useSettingsStore';
import { scheduleLocalNotification } from '@/lib/reminderNotifications';
import { planCdAlerts, type CdFirRow } from '@/lib/caseDiaryGap';

export const CD_GAP_KIND = 'cd_gap';

/** Pending FIRs with the date of their latest case diary. */
export async function getPendingFirsWithLastDiary(): Promise<CdFirRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CdFirRow>(
    `SELECT f.id, f.fir_number, f.section, f.date_of_information, f.created_at,
            (SELECT MAX(d.preparation_date) FROM case_diaries d
              WHERE d.fir_id = f.id AND d.deleted_at IS NULL) AS last_diary_date
       FROM firs f
      WHERE f.deleted_at IS NULL AND f.status = 'Pending'`,
  );
}

async function cancelCdAlerts(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => (n.content.data as Record<string, unknown> | undefined)?.kind === CD_GAP_KIND)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

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
    await cancelCdAlerts();
    const settings = await getPersistedSettings();
    if (!settings.notifCaseDiaryGap) return;
    const alerts = planCdAlerts(await getPendingFirsWithLastDiary(), new Date());
    for (const a of alerts) {
      await scheduleLocalNotification(a.title, a.body, a.at, { kind: CD_GAP_KIND, firId: a.firId });
    }
  } catch (e) {
    if (__DEV__) console.warn('[syncCaseDiaryAlerts]', e);
  }
}

/** Fire-and-forget resync after a case diary is added / edited / deleted. */
export function resyncCaseDiaryAlertsSoon(): void {
  setTimeout(() => { syncCaseDiaryAlerts().catch(() => {}); }, 300);
}

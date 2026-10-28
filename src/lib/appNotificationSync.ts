/**
 * appNotificationSync.ts — Background sync engine for local app notifications.
 *
 * CRITICAL PRIVACY RULE:
 *   Notification previews are visible on lock screens even with AppLock enabled.
 *   Titles and bodies MUST NEVER include complainant/victim/accused names, addresses,
 *   or personally identifying details. Only generic types, counts, and bare registration
 *   numbers are permitted.
 */
import { syncNkChalaniAlerts } from '@/lib/nkChalaniService';
import * as Notifications from 'expo-notifications';
import { getDatabase } from '@/lib/db/database';
import { getPersistedSettings } from '@/hooks/useSettingsStore';
import { hasBeenNotified, markNotified } from '@/lib/db/notificationLogRepo';
import { scheduleLocalNotification } from '@/lib/reminderNotifications';
import { getUpcomingReminders } from '@/lib/db/reminderRepo';
import { syncCaseDiaryAlerts } from '@/lib/caseDiaryGapService';
import { syncDeadlineAlerts } from '@/lib/deadlineAlertService';
import { refreshAppBadge } from '@/lib/appBadge';

/**
 * Formats a local date to YYYY-MM-DD string without UTC offset skew.
 */
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Synchronizes and schedules all enabled local notification categories:
 *  - notifCourtAlerts / notifDeadlines (न्यायालय / प्रार्थना पत्र deadlines — deadlineAlertService)
 *  - notifInvestigations (digest of karyvahi tasks pending 3+ days on pending FIRs)
 *  - notifDailySummary (once-per-day morning digest at 9am or immediate)
 */
export async function syncAppNotifications(): Promise<void> {
  try {
    // Check permission; do not crash or show unhandled errors if permission not granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const settings = await getPersistedSettings();
    const db = await getDatabase();

    const now = new Date();
    const todayStr = formatLocalDate(now);

    // ──────────────────────────────────────────────────────────────────────────
    // a + b) notifCourtAlerts / notifDeadlines — न्यायालय & प्रार्थना पत्र deadlines
    // (Hindi, per type; 2/1/0 days before — High Court 5/3/1/0 — then daily while overdue).
    // Replaces the old one-time English alerts. See deadlineAlerts.ts.
    // ──────────────────────────────────────────────────────────────────────────
    await syncDeadlineAlerts();

    // ──────────────────────────────────────────────────────────────────────────
    // c) notifInvestigations (digest of tasks pending 3+ days on pending FIRs)
    // ──────────────────────────────────────────────────────────────────────────
    if (settings.notifInvestigations) {
      const threeDaysAgoSec = Math.floor(Date.now() / 1000) - 3 * 86400;
      const threeDaysAgoMs = Date.now() - 3 * 86400 * 1000;

      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM fir_karyvahi k
         JOIN firs f ON f.id = k.fir_id
         WHERE k.deleted_at IS NULL AND k.is_completed = 0
           AND f.deleted_at IS NULL AND f.status = 'Pending'
           AND (
             (k.created_at < 10000000000 AND k.created_at <= ?) OR
             (k.created_at >= 10000000000 AND k.created_at <= ?)
           )`,
        [threeDaysAgoSec, threeDaysAgoMs],
      );

      const pendingCount = row?.count ?? 0;
      if (pendingCount > 0) {
        const already = await hasBeenNotified('global', todayStr, 'investigation_digest');
        if (!already) {
          await scheduleLocalNotification(
            'Investigation tasks pending',
            `${pendingCount} investigation task${pendingCount > 1 ? 's' : ''} pending 3+ days`,
            null,
            { refType: 'global', refId: todayStr, kind: 'investigation_digest' },
          );
          await markNotified('global', todayStr, 'investigation_digest');
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // d) notifDailySummary (once per calendar day, morning digest)
    // ──────────────────────────────────────────────────────────────────────────
    if (settings.notifDailySummary) {
      const already = await hasBeenNotified('global', todayStr, 'daily_summary');
      if (!already) {
        // 1. Pending karyvahi count
        const karyvahiRow = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count
           FROM fir_karyvahi k
           JOIN firs f ON f.id = k.fir_id
           WHERE k.deleted_at IS NULL AND k.is_completed = 0
             AND f.deleted_at IS NULL AND f.status = 'Pending'`,
        );
        const pendingKaryvahi = karyvahiRow?.count ?? 0;

        // 2. Pending court / petition deadlines count
        const courtRow = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM nyayalay_documents WHERE deleted_at IS NULL AND status = 'Pending'`,
        );
        const petitionRow = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM prarthna_patra WHERE deleted_at IS NULL AND status = 'Pending'`,
        );
        const courtDates = (courtRow?.count ?? 0) + (petitionRow?.count ?? 0);

        // 3. Today's reminders count
        const upcomingReminders = await getUpcomingReminders();
        const todayReminders = upcomingReminders.filter((r) => {
          const ms = r.due_at < 10000000000 ? r.due_at * 1000 : r.due_at;
          return formatLocalDate(new Date(ms)) === todayStr;
        });
        const reminderCount = todayReminders.length;

        const body = `Today: ${pendingKaryvahi} pending karyvahi, ${courtDates} court dates, ${reminderCount} reminder${reminderCount === 1 ? '' : 's'}`;

        // Morning notification: 9:00 AM local, or immediately if already past 9am
        const today9AM = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          9,
          0,
          0,
          0,
        );
        const triggerDate = now.getTime() < today9AM.getTime() ? today9AM : null;

        await scheduleLocalNotification(
          'Daily Summary',
          body,
          triggerDate,
          { refType: 'global', refId: todayStr, kind: 'daily_summary' },
        );
        await markNotified('global', todayStr, 'daily_summary');
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // e) notifCaseDiaryGap — केस डायरी लंबित (7+ days since the last diary)
    // ──────────────────────────────────────────────────────────────────────────
    await syncCaseDiaryAlerts();

    // f) notifNkChalani — निरोधात्मक चलानी प्रेषण लंबित (daily 9 AM summary)
    await syncNkChalaniAlerts();

    // App-icon badge = सूचनाएँ that need action (same number as the home bell).
    await refreshAppBadge();
  } catch (error) {
    if (__DEV__) {
      console.warn('[syncAppNotifications] Sync error:', error);
    }
  }
}

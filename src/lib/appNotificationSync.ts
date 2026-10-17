/**
 * appNotificationSync.ts — Background sync engine for local app notifications.
 *
 * CRITICAL PRIVACY RULE:
 *   Notification previews are visible on lock screens even with AppLock enabled.
 *   Titles and bodies MUST NEVER include complainant/victim/accused names, addresses,
 *   or personally identifying details. Only generic types, counts, and bare registration
 *   numbers are permitted.
 */
import * as Notifications from 'expo-notifications';
import { getDatabase } from '@/lib/db/database';
import { getPersistedSettings } from '@/hooks/useSettingsStore';
import { hasBeenNotified, markNotified } from '@/lib/db/notificationLogRepo';
import { scheduleLocalNotification } from '@/lib/reminderNotifications';
import { getUpcomingReminders } from '@/lib/db/reminderRepo';

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
 *  - notifCourtAlerts (hearings tomorrow at 9am / hearings today)
 *  - notifDeadlines (petition deadlines tomorrow at 9am / today, plus overdue court docs & petitions)
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
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);
    const tomorrow9AM = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      9,
      0,
      0,
      0,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // a) notifCourtAlerts
    // ──────────────────────────────────────────────────────────────────────────
    if (settings.notifCourtAlerts) {
      const courtDocs = await db.getAllAsync<{
        id: string;
        registration_number: string;
        doc_type: string;
        deadline_date: string;
      }>(
        `SELECT id, registration_number, doc_type, deadline_date
         FROM nyayalay_documents
         WHERE deleted_at IS NULL AND status = 'Pending'`,
      );

      for (const doc of courtDocs) {
        if (!doc.deadline_date) continue;

        if (doc.deadline_date === tomorrowStr) {
          const already = await hasBeenNotified('nyayalay', doc.id, 'day_before');
          if (!already) {
            await scheduleLocalNotification(
              'Court hearing tomorrow',
              `${doc.doc_type} (${doc.registration_number})`,
              tomorrow9AM,
              { refType: 'nyayalay', refId: doc.id, kind: 'day_before' },
            );
            await markNotified('nyayalay', doc.id, 'day_before');
          }
        } else if (doc.deadline_date === todayStr) {
          const already = await hasBeenNotified('nyayalay', doc.id, 'same_day');
          if (!already) {
            await scheduleLocalNotification(
              'Court hearing today',
              `${doc.doc_type} (${doc.registration_number})`,
              null,
              { refType: 'nyayalay', refId: doc.id, kind: 'same_day' },
            );
            await markNotified('nyayalay', doc.id, 'same_day');
          }
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // b) notifDeadlines (petitions tomorrow/today + overdue for court & petitions)
    // ──────────────────────────────────────────────────────────────────────────
    if (settings.notifDeadlines) {
      const petitions = await db.getAllAsync<{
        id: string;
        registration_number: string;
        petition_type: string;
        deadline_date: string;
      }>(
        `SELECT id, registration_number, petition_type, deadline_date
         FROM prarthna_patra
         WHERE deleted_at IS NULL AND status = 'Pending'`,
      );

      for (const p of petitions) {
        if (!p.deadline_date) continue;

        if (p.deadline_date === tomorrowStr) {
          const already = await hasBeenNotified('prarthna_patra', p.id, 'day_before');
          if (!already) {
            await scheduleLocalNotification(
              'Petition deadline tomorrow',
              `${p.petition_type} (${p.registration_number})`,
              tomorrow9AM,
              { refType: 'prarthna_patra', refId: p.id, kind: 'day_before' },
            );
            await markNotified('prarthna_patra', p.id, 'day_before');
          }
        } else if (p.deadline_date === todayStr) {
          const already = await hasBeenNotified('prarthna_patra', p.id, 'same_day');
          if (!already) {
            await scheduleLocalNotification(
              'Petition deadline today',
              `${p.petition_type} (${p.registration_number})`,
              null,
              { refType: 'prarthna_patra', refId: p.id, kind: 'same_day' },
            );
            await markNotified('prarthna_patra', p.id, 'same_day');
          }
        }
      }

      // Overdue check for nyayalay_documents (deadline_date strictly before today & status still 'Pending')
      const overdueDocs = await db.getAllAsync<{
        id: string;
        registration_number: string;
        doc_type: string;
        deadline_date: string;
      }>(
        `SELECT id, registration_number, doc_type, deadline_date
         FROM nyayalay_documents
         WHERE deleted_at IS NULL AND status = 'Pending' AND deadline_date < ?`,
        [todayStr],
      );
      for (const doc of overdueDocs) {
        const already = await hasBeenNotified('nyayalay', doc.id, 'overdue_once');
        if (!already) {
          await scheduleLocalNotification(
            'Court document overdue',
            '1 court document is now overdue',
            null,
            { refType: 'nyayalay', refId: doc.id, kind: 'overdue_once' },
          );
          await markNotified('nyayalay', doc.id, 'overdue_once');
        }
      }

      // Overdue check for prarthna_patra (deadline_date strictly before today & status still 'Pending')
      const overduePetitions = await db.getAllAsync<{
        id: string;
        registration_number: string;
        petition_type: string;
        deadline_date: string;
      }>(
        `SELECT id, registration_number, petition_type, deadline_date
         FROM prarthna_patra
         WHERE deleted_at IS NULL AND status = 'Pending' AND deadline_date < ?`,
        [todayStr],
      );
      for (const p of overduePetitions) {
        const already = await hasBeenNotified('prarthna_patra', p.id, 'overdue_once');
        if (!already) {
          await scheduleLocalNotification(
            'Petition overdue',
            '1 petition is now overdue',
            null,
            { refType: 'prarthna_patra', refId: p.id, kind: 'overdue_once' },
          );
          await markNotified('prarthna_patra', p.id, 'overdue_once');
        }
      }
    }

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
  } catch (error) {
    if (__DEV__) {
      console.warn('[syncAppNotifications] Sync error:', error);
    }
  }
}

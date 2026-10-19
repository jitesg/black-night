/**
 * Shared look + text helpers for the reminder screens.
 */
import { Briefcase, Gavel, Home, Users, Bell, type LucideIcon } from 'lucide-react-native';
import type { Reminder, ReminderCategory, ReminderPriority } from '@/lib/db/reminderRepo';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

export const CATEGORY_META: Record<ReminderCategory, { icon: LucideIcon; color: string; labelKey: string }> = {
  general: { icon: Bell, color: '#2563EB', labelKey: 'reminders.catGeneral' },
  peshi: { icon: Gavel, color: '#B45309', labelKey: 'reminders.catPeshi' },
  case: { icon: Briefcase, color: '#7C3AED', labelKey: 'reminders.catCase' },
  meeting: { icon: Users, color: '#0891B2', labelKey: 'reminders.catMeeting' },
  personal: { icon: Home, color: '#16A34A', labelKey: 'reminders.catPersonal' },
};
export const CATEGORY_ORDER: ReminderCategory[] = ['general', 'peshi', 'case', 'meeting', 'personal'];

export const PRIORITY_META: Record<ReminderPriority, { color: string; labelKey: string }> = {
  high: { color: '#DC2626', labelKey: 'reminders.prHigh' },
  normal: { color: '#64748B', labelKey: 'reminders.prNormal' },
  low: { color: '#94A3B8', labelKey: 'reminders.prLow' },
};

export const OVERDUE_COLOR = '#DC2626';
export const DONE_COLOR = '#16A34A';

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function dayLabel(ms: number, t: TFn, lang: string, withWeekday = false): string {
  const d = new Date(ms);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, now)) return t('reminders.today');
  if (sameDay(d, tomorrow)) return t('reminders.tomorrow');
  if (sameDay(d, yesterday)) return lang === 'hi' ? 'कल (बीता)' : 'Yesterday';
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: withWeekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function relative(ms: number, t: TFn): string {
  const diff = ms - Date.now();
  const mins = Math.round(Math.abs(diff) / 60000);
  if (mins < 1) return t('reminders.now');
  const future = diff > 0;
  if (mins < 60) return t(future ? 'reminders.inMin' : 'reminders.agoMin', { n: mins });
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return t(future ? 'reminders.inHr' : 'reminders.agoHr', { n: hrs });
  return t(future ? 'reminders.inDay' : 'reminders.agoDay', { n: Math.round(hrs / 24) });
}

export function dayNames(t: TFn): string[] {
  const parts = t('reminders.days').split(',');
  return parts.length === 7 ? parts : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
}

export function repeatSummary(r: Pick<Reminder, 'repeat_mode' | 'repeat_days' | 'due_at'>, dueMs: number, t: TFn): string {
  switch (r.repeat_mode) {
    case 'daily':
      return t('reminders.summaryDaily');
    case 'weekly': {
      const names = dayNames(t);
      const days = (r.repeat_days.length ? r.repeat_days : [new Date(dueMs).getDay()]).slice().sort();
      return t('reminders.summaryWeekly', { days: days.map((d) => names[d]).join(', ') });
    }
    case 'monthly':
      return t('reminders.summaryMonthly', { d: new Date(dueMs).getDate() });
    default:
      return t('reminders.summaryOnce');
  }
}

export function tint(color: string, isDark: boolean, strong = false): string {
  return `${color}${isDark ? (strong ? '40' : '2B') : (strong ? '26' : '14')}`;
}

/**
 * AnalyticsTool.ts — Answers analytics queries via dashboardRepo.
 */
import { loadDashboardData } from '@/lib/db/dashboardRepo';
import type { AITool } from '../AITypes';

export type AnalyticsQuery =
  | 'pending-investigations'
  | 'court-workload'
  | 'officer-workload'
  | 'deadlines'
  | 'overview'
  | 'performance';

export interface AnalyticsInput {
  query: AnalyticsQuery;
}

export interface AnalyticsOutput {
  query: AnalyticsQuery;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  summary: string;
}

export const AnalyticsTool: AITool<AnalyticsInput, AnalyticsOutput> = {
  name: 'AnalyticsTool',
  description: 'Answers analytics questions: pending investigations, court workload, deadlines, performance.',
  async execute({ query }) {
    const dash = await loadDashboardData();

    switch (query) {
      // MukadmaAnalytics: { total, pending, finished }
      case 'pending-investigations': {
        const pendingFIRs = dash.mukadma?.pending ?? 0;
        const totalFIRs   = dash.mukadma?.total   ?? 0;
        return {
          query,
          data: { pendingFIRs, totalFIRs },
          summary: `${pendingFIRs} of ${totalFIRs} FIRs are pending investigation.`,
        };
      }
      // NyayalayAnalytics: { overall: NyayalayTypeAnalytics, byType: Record<DocType, …> }
      case 'court-workload': {
        const nyayalay = dash.nyayalay;
        const overall  = nyayalay?.overall;
        const byType   = nyayalay?.byType ?? {};
        return {
          query,
          data: { overall: overall ?? {}, byType },
          summary: `Court workload — Total: ${overall?.total ?? 0}, Pending: ${overall?.pending ?? 0}, Finished: ${overall?.finished ?? 0}.`,
        };
      }
      case 'deadlines': {
        const overdue = dash.overdue ?? [];
        const reminders = dash.reminders ?? [];
        return {
          query,
          data: { overdueCount: overdue.length, upcomingCount: reminders.length },
          summary: `${overdue.length} overdue items. ${reminders.length} upcoming deadlines.`,
        };
      }
      case 'performance':
      case 'officer-workload': {
        const p = dash.productivity;
        return {
          query,
          data: {
            createdToday:     p?.createdToday     ?? 0,
            createdThisWeek:  p?.createdThisWeek  ?? 0,
            createdThisMonth: p?.createdThisMonth ?? 0,
            totalPending:     p?.totalPending     ?? 0,
            totalFinished:    p?.totalFinished    ?? 0,
            completionPct:    p?.completionPct    ?? 0,
          },
          summary: `Productivity — ${p?.totalFinished ?? 0} finished, ${p?.totalPending ?? 0} pending (${p?.completionPct ?? 0}% completion).`,
        };
      }
      case 'overview':
      default: {
        // GDAnalytics: { total, todayCount, thisMonthCount }
        return {
          query,
          data: {
            firs:          { total: dash.mukadma?.total ?? 0, pending: dash.mukadma?.pending ?? 0 },
            gd:            { total: dash.gd?.total ?? 0, today: dash.gd?.todayCount ?? 0 },
            courtPending:  dash.nyayalay?.overall?.pending ?? 0,
            remindersCount: (dash.reminders ?? []).length,
          },
          summary: `Overview: ${dash.mukadma?.total ?? 0} FIRs (${dash.mukadma?.pending ?? 0} pending), ${dash.gd?.total ?? 0} GDs, ${dash.nyayalay?.overall?.pending ?? 0} court docs pending.`,
        };
      }
    }
  },
};

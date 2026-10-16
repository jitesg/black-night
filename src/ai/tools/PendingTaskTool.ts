/**
 * PendingTaskTool.ts — Compiles all pending tasks across modules.
 */
import { loadDashboardData } from '@/lib/db/dashboardRepo';
import { getAllFIRs } from '@/lib/db/firRepo';
import type { AITool } from '../AITypes';

export interface PendingTaskInput {
  limit?: number;
}

export interface PendingTask {
  module: string;
  title: string;
  detail: string;  // locally derived — not from OverdueItem/ReminderItem
  daysOverdue?: number;
}

export interface PendingTaskOutput {
  tasks: PendingTask[];
  totalCount: number;
}

export const PendingTaskTool: AITool<PendingTaskInput, PendingTaskOutput> = {
  name: 'PendingTaskTool',
  description: 'Identifies all pending tasks and upcoming deadlines across all modules.',
  async execute({ limit = 20 }) {
    const tasks: PendingTask[] = [];

    // Pending FIRs
    const firs = await getAllFIRs();
    firs
      .filter((f) => f.status === 'Pending')
      .slice(0, 10)
      .forEach((f) =>
        tasks.push({
          module: 'Mukadma',
          title: `FIR ${f.fir_number} — Pending`,
          detail: `Section: ${f.section} | Crime: ${f.crime_type}`,
        })
      );

    // Overdue + reminders from dashboard
    try {
      const dash = await loadDashboardData();
      // OverdueItem: { id, module, title, daysOverdue, route, color } — no .detail
      (dash.overdue ?? []).slice(0, 10).forEach((item) =>
        tasks.push({
          module: item.module,
          title: item.title,
          detail: `${item.daysOverdue}d overdue`,
          daysOverdue: item.daysOverdue,
        })
      );
      // ReminderItem: { id, module, title, daysLeft, route, color } — no .detail
      (dash.reminders ?? []).slice(0, 5).forEach((item) =>
        tasks.push({
          module: item.module,
          title: item.title,
          detail: item.daysLeft === 0 ? 'Due today' : `Due in ${item.daysLeft}d`,
        })
      );
    } catch {
      // non-fatal
    }

    const limited = tasks.slice(0, limit);
    return { tasks: limited, totalCount: tasks.length };
  },
};

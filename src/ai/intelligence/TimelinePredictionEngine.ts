/**
 * TimelinePredictionEngine.ts
 * Builds investigation chronology and predicts next logical steps.
 *
 * SAFETY: Read-only. Consumes InvestigationContext only. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { TimelinePredictionReport, IntelTimelineItem, TimelineItemStatus } from './IntelligenceTypes';

let itemId = 0;
function mkId() { return `TI-${String(++itemId).padStart(3, '0')}`; }

const today = () => new Date().toISOString().split('T')[0];

export class TimelinePredictionEngine {
  static evaluate(ctx: InvestigationContext): TimelinePredictionReport {
    itemId = 0;
    const completed: IntelTimelineItem[] = [];
    const pending: IntelTimelineItem[] = [];
    const overdue: IntelTimelineItem[] = [];
    const predicted: IntelTimelineItem[] = [];
    const td = today();

    // ── FIR registration ─────────────────────────────────────────────────────
    if (ctx.fir) {
      const date = ctx.fir.date_of_information ?? new Date(ctx.fir.created_at * 1000).toISOString().split('T')[0];
      completed.push({
        id: mkId(), date, module: 'FIR',
        title: `FIR Registered — ${ctx.fir.fir_number}`,
        status: 'completed', isCritical: false, isPredicted: false,
      });
    }

    // ── Karyvahi items ────────────────────────────────────────────────────────
    ctx.karyvahi.all.forEach((k) => {
      const date = new Date(k.created_at * 1000).toISOString().split('T')[0];
      const isDone = k.is_completed === 1;
      const item: IntelTimelineItem = {
        id: mkId(), date, module: 'Karyvahi',
        title: k.name,
        status: isDone ? 'completed' : 'pending',
        isCritical: false, isPredicted: false,
      };
      if (isDone) completed.push(item);
      else pending.push(item);
    });

    // ── Case diaries ──────────────────────────────────────────────────────────
    ctx.caseDiaries.forEach((d) => {
      completed.push({
        id: mkId(), date: d.preparation_date, module: 'CaseDiary',
        title: `Case Diary — ${d.preparation_date}`,
        status: 'completed', isCritical: false, isPredicted: false,
      });
    });

    // ── Court documents ───────────────────────────────────────────────────────
    ctx.courtDocs.forEach((c) => {
      const isDone = c.status === 'Finished';
      const isOverdue = !isDone && c.deadline_date < td;
      const status: TimelineItemStatus = isDone ? 'completed' : isOverdue ? 'overdue' : 'pending';
      const item: IntelTimelineItem = {
        id: mkId(), date: c.deadline_date, module: 'Court',
        title: `${c.doc_type} — ${c.registration_number}`,
        status, isCritical: isOverdue, isPredicted: false,
      };
      if (isDone) completed.push(item);
      else if (isOverdue) overdue.push(item);
      else pending.push(item);
    });

    // ── Prarthna Patra ────────────────────────────────────────────────────────
    ctx.prarthnaPatra.forEach((p) => {
      if (!p.deadline_date) return;
      const isDone = p.status !== 'Pending';
      const isOverdue = !isDone && p.deadline_date < td;
      const status: TimelineItemStatus = isDone ? 'completed' : isOverdue ? 'overdue' : 'pending';
      const item: IntelTimelineItem = {
        id: mkId(), date: p.deadline_date, module: 'PrarthnaPatra',
        title: `Prarthna Patra — ${p.petition_type ?? 'Application'}`,
        status, isCritical: isOverdue, isPredicted: false,
      };
      if (isDone) completed.push(item);
      else if (isOverdue) overdue.push(item);
      else pending.push(item);
    });

    // ── Predicted next steps ──────────────────────────────────────────────────
    const allKaryNames = ctx.karyvahi.all.map((k) => k.name.toLowerCase());
    const hasDone = (pattern: RegExp) => ctx.karyvahi.completed.some((k) => pattern.test(k.name));
    const hasAny  = (pattern: RegExp) => allKaryNames.some((n) => pattern.test(n));

    const predictStep = (title: string, reason: string) => {
      predicted.push({
        id: mkId(), date: '', module: 'Predicted',
        title, status: 'predicted', isCritical: false,
        isPredicted: true, predictedReason: reason,
      });
    };

    if (ctx.fir) {
      if (!hasAny(/statement|bayan|witness/i)) {
        predictStep('Record Witness Statements', 'No witness statements recorded yet.');
      }
      if (!hasAny(/medical|mlc|post.mortem/i) && /murder|attempt|robbery|assault|accident/i.test(ctx.fir.crime_type)) {
        predictStep('Obtain Medical / MLC Report', 'Offence type requires medical examination.');
      }
      if (!hasAny(/seizure|panchnama/i)) {
        predictStep('Prepare Seizure Memo / Panchnama', 'No seizure documentation found.');
      }
      if (!hasAny(/fsl|forensic/i) && /murder|ndps|arms|pocso/i.test(ctx.fir.crime_type)) {
        predictStep('Send Evidence to FSL', 'FSL referral required for this crime type.');
      }
      if (!hasDone(/case.*diary|diary/i) && ctx.caseDiaries.length === 0) {
        predictStep('Prepare Case Diary', 'Statutory requirement — case diary not found.');
      }
      if (!hasAny(/arrest|गिरफ्तार/i)) {
        predictStep('Arrest Accused', 'Accused arrest not recorded.');
      }
    }

    // Sort by date
    const sortByDate = (items: IntelTimelineItem[]) =>
      items.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

    const allSorted = sortByDate([...completed, ...pending, ...overdue]);

    const nextLogicalStep = predicted[0]?.title
      ?? pending[0]?.title
      ?? overdue[0]?.title
      ?? 'Investigation appears on track.';

    const overdueSummary =
      overdue.length === 0
        ? 'No overdue items.'
        : `${overdue.length} overdue item(s): ${overdue.slice(0, 2).map((o) => o.title).join(', ')}`;

    const predictedWorkflow = predicted.map((p) => `${p.title} — ${p.predictedReason}`);

    const summary =
      `Timeline: ${completed.length} completed, ${pending.length} pending, ` +
      `${overdue.length} overdue, ${predicted.length} predicted steps. ` +
      `Next: ${nextLogicalStep}`;

    return {
      completedItems: sortByDate([...completed]),
      pendingItems:   sortByDate([...pending]),
      overdueItems:   sortByDate([...overdue]),
      predictedNextSteps: predicted,
      nextLogicalStep,
      overdueSummary,
      predictedWorkflow,
      summary,
    };
  }
}

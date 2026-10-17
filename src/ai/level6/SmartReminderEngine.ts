/**
 * SmartReminderEngine.ts
 * Level-6: Generates context-aware investigation reminders.
 * Never performs actions automatically. All reminders require officer decision.
 *
 * SAFETY: Read-only advisory. Never writes to any repository or database.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  SmartReminderReport,
  SmartReminder,
  ReminderType,
} from './L6Types';
import type { IntelPriority, IntelSeverity } from '../intelligence/IntelligenceTypes';

const MS_PER_DAY = 86_400_000;

function daysUntil(dateStr?: string | null): number | undefined {
  if (!dateStr) return undefined;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / MS_PER_DAY);
}

function daysSince(val?: string | number | null): number {
  if (!val) return 0;
  const t = typeof val === 'string' ? new Date(val).getTime() : (val as number);
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

let idxCounter = 0;
function mkReminder(
  type: ReminderType,
  title: string,
  description: string,
  priority: IntelPriority,
  severity: IntelSeverity,
  firId: string | undefined,
  firNumber: string | undefined,
  opts: {
    dueDate?: string;
    daysRemaining?: number;
    suggestedAction?: string;
    legalReference?: string;
  } = {}
): SmartReminder {
  idxCounter += 1;
  const isOverdue               = (opts.daysRemaining ?? 1) < 0;
  const requiresImmediateAction = isOverdue || (opts.daysRemaining ?? 99) <= 1;
  return {
    id:                     `l6-rem-${type}-${idxCounter}`,
    type,
    title,
    description,
    dueDate:                opts.dueDate,
    daysRemaining:          opts.daysRemaining,
    priority,
    severity,
    firId,
    firNumber,
    isOverdue,
    requiresImmediateAction,
    suggestedAction:        opts.suggestedAction ?? 'Review and take necessary action.',
    legalReference:         opts.legalReference,
  };
}

export class SmartReminderEngine {
  static analyze(ctx: InvestigationContext): SmartReminderReport {
    idxCounter = 0;
    const reminders: SmartReminder[] = [];
    const fir       = ctx.fir;
    const firId     = ctx.activeFirId;
    const firNumber = fir?.fir_number;

    // ── Medical pending ────────────────────────────────────────────────────────
    const medPending = ctx.karyvahi.all.filter(
      (k) => (k.name.toLowerCase().includes('medical') || k.name.toLowerCase().includes('doctor'))
           && k.is_completed === 0
    );
    if (medPending.length > 0) {
      reminders.push(mkReminder(
        'medical-pending',
        'Medical Examination Pending',
        `${medPending.length} medical karyvahi pending. Obtain medical report to strengthen investigation.`,
        'urgent', 'high', firId, firNumber,
        { suggestedAction: 'Follow up with hospital and obtain medical report.', legalReference: 'BNSS Sec 185' }
      ));
    }

    // ── Witness statement pending ─────────────────────────────────────────────
    const witnessPending = ctx.karyvahi.all.filter(
      (k) => (k.name.toLowerCase().includes('witness') || k.name.toLowerCase().includes('bayan') || k.name.includes('बयान') || k.name.includes('वादी') || k.name.includes('गवाह'))
           && k.is_completed === 0
    );
    if (witnessPending.length > 0) {
      reminders.push(mkReminder(
        'statement-pending',
        `${witnessPending.length} Witness Statement(s) Pending`,
        `Record pending witness statements to complete the evidence chain.`,
        'high', 'high', firId, firNumber,
        { suggestedAction: 'Schedule and record pending witness statements.', legalReference: 'BNSS Sec 180' }
      ));
    }

    // ── Seizure pending ───────────────────────────────────────────────────────
    const seizurePending = ctx.karyvahi.all.filter(
      (k) => (k.name.toLowerCase().includes('seizure') || k.name.toLowerCase().includes('muddemal'))
           && k.is_completed === 0
    );
    if (seizurePending.length > 0) {
      reminders.push(mkReminder(
        'seizure-pending',
        'Seizure Memo Pending',
        `${seizurePending.length} seizure karyvahi(s) incomplete. Prepare and complete seizure memos.`,
        'high', 'high', firId, firNumber,
        { suggestedAction: 'Complete seizure memos and update evidence register.', legalReference: 'BNSS Sec 105' }
      ));
    }

    // ── Court tomorrow ────────────────────────────────────────────────────────
    const courtTomorrow = ctx.courtDocs.filter((d) => {
      const days = daysUntil(d.deadline_date);
      return days !== undefined && days >= 0 && days <= 1;
    });
    for (const doc of courtTomorrow) {
      const days = daysUntil(doc.deadline_date) ?? 0;
      reminders.push(mkReminder(
        'court-tomorrow',
        `Court Deadline ${days <= 0 ? 'Today' : 'Tomorrow'}: ${doc.vad_sankhya ?? 'Court Doc'}`,
        `Court deadline in ${days} day(s). Compliance report and evidence custody must be ready.`,
        'urgent', 'critical', firId, firNumber,
        { dueDate: doc.deadline_date ?? undefined, daysRemaining: days,
          suggestedAction: 'Prepare and submit court compliance report immediately.',
          legalReference: 'BNSS Sec 230' }
      ));
    }

    // ── Charge sheet due ──────────────────────────────────────────────────────
    const csKaryvahi = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('charge') && k.is_completed === 0
    );
    if (csKaryvahi.length > 0 || ctx.caseHealth.readinessForChargeSheet) {
      reminders.push(mkReminder(
        'charge-sheet-due',
        'Charge Sheet Preparation Required',
        'Investigation has reached a stage where charge sheet preparation is advised.',
        'high', 'high', firId, firNumber,
        { suggestedAction: 'Review charge sheet readiness and begin preparation.', legalReference: 'BNSS Sec 250' }
      ));
    }

    // ── Bail response pending ─────────────────────────────────────────────────
    const bailPending = ctx.prarthnaPatra.filter(
      (p) => p.status === 'Pending'
    );
    if (bailPending.length > 0) {
      reminders.push(mkReminder(
        'bail-response-pending',
        `${bailPending.length} Bail/Prarthna Response Pending`,
        `Pending bail/prarthna applications require timely response to avoid default bail.`,
        'urgent', 'critical', firId, firNumber,
        { suggestedAction: 'File reply to bail/prarthna patra immediately.', legalReference: 'BNSS Sec 479' }
      ));
    }

    // ── Notice pending ────────────────────────────────────────────────────────
    const noticePending = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('notice') && k.is_completed === 0
    );
    if (noticePending.length > 0) {
      reminders.push(mkReminder(
        'notice-pending',
        `${noticePending.length} Notice(s) Pending`,
        `Pending notice karyvahi. Serve notices and update status to maintain compliance.`,
        'medium', 'medium', firId, firNumber,
        { suggestedAction: 'Serve pending notices and record service.', legalReference: 'BNSS Sec 179' }
      ));
    }

    // ── FSL pending ───────────────────────────────────────────────────────────
    const fslPending = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('fsl') && k.is_completed === 0
    );
    if (fslPending.length > 0) {
      reminders.push(mkReminder(
        'fsl-pending',
        'FSL Report Pending',
        `${fslPending.length} FSL karyvahi pending. Forensic report required for charge sheet.`,
        'high', 'high', firId, firNumber,
        { suggestedAction: 'Follow up with FSL laboratory for pending report.', legalReference: 'BNSS Sec 349' }
      ));
    }

    // ── Case diary overdue ────────────────────────────────────────────────────
    const lastDiary = ctx.caseDiaries[0];
    const daysSinceDiary = daysSince(lastDiary?.preparation_date);
    if (daysSinceDiary > 7 || ctx.caseDiaries.length === 0) {
      reminders.push(mkReminder(
        'case-diary-overdue',
        ctx.caseDiaries.length === 0 ? 'First Case Diary Entry Required' : `Case Diary Not Updated for ${daysSinceDiary} Days`,
        'Regular case diary entries are mandatory to document investigation progress.',
        daysSinceDiary > 14 ? 'urgent' : 'high',
        daysSinceDiary > 14 ? 'critical' : 'high',
        firId, firNumber,
        { daysRemaining: -daysSinceDiary,
          suggestedAction: 'Update case diary with latest investigation activities.',
          legalReference: 'BNSS Sec 193' }
      ));
    }

    // ── Custody deadline ──────────────────────────────────────────────────────
    const custodyItem = ctx.overdueItems.find(
      (o) => o.module.toLowerCase().includes('bail') || o.title.toLowerCase().includes('custody')
    );
    if (custodyItem) {
      reminders.push(mkReminder(
        'custody-deadline',
        'Custody/Bail Deadline',
        `${custodyItem.title}: ${custodyItem.daysOverdue > 0 ? `${custodyItem.daysOverdue} day(s) overdue` : 'approaching'}.`,
        'urgent', 'critical', firId, firNumber,
        { daysRemaining: -custodyItem.daysOverdue,
          suggestedAction: 'Address custody deadline immediately to prevent default bail.',
          legalReference: 'BNSS Sec 479' }
      ));
    }

    // ── Sort by severity then daysRemaining ───────────────────────────────────
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    reminders.sort((a, b) => {
      const sv = (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5);
      if (sv !== 0) return sv;
      return (a.daysRemaining ?? 99) - (b.daysRemaining ?? 99);
    });

    const today      = new Date().toISOString().slice(0, 10);
    const tomorrow   = new Date(Date.now() + MS_PER_DAY).toISOString().slice(0, 10);
    const nextWeek   = new Date(Date.now() + 7 * MS_PER_DAY).toISOString().slice(0, 10);

    const overdueCount      = reminders.filter((r) => r.isOverdue).length;
    const dueTodayCount     = reminders.filter((r) => r.dueDate === today).length;
    const dueThisWeekCount  = reminders.filter((r) => r.dueDate && r.dueDate <= nextWeek && !r.isOverdue).length;
    const criticalCount     = reminders.filter((r) => r.severity === 'critical').length;

    return {
      generatedAt:    new Date().toISOString(),
      firId,
      reminders,
      overdueCount,
      dueTodayCount,
      dueThisWeekCount,
      criticalCount,
      topReminder:    reminders[0] ?? null,
      summary: reminders.length === 0
        ? 'No pending reminders. Investigation is on track.'
        : `${reminders.length} reminder(s) — ${overdueCount} overdue, ${dueTodayCount} due today, ${criticalCount} critical.`,
    };
  }
}

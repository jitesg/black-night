/**
 * PredictiveStepEngine.ts
 * Level-6: Predicts likely next investigation step, pending work, upcoming
 * deadlines, court preparation items, and expected missing documents.
 * Always displays confidence score.
 *
 * SAFETY: Read-only advisory. Never writes to any repository or database.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { PredictiveStepReport, PredictedStep } from './L6Types';
import type { IntelPriority } from '../intelligence/IntelligenceTypes';

const MS_PER_DAY = 86_400_000;
let stepIdx = 0;

function mkStep(
  title: string,
  description: string,
  confidence: number,
  category: PredictedStep['category'],
  priority: IntelPriority,
  opts: { expectedByDate?: string; daysToExpect?: number; legalBasis?: string } = {}
): PredictedStep {
  stepIdx += 1;
  const isOverdue = (opts.daysToExpect ?? 1) < 0;
  return {
    id: `l6-pstep-${stepIdx}`,
    title,
    description,
    confidence,
    expectedByDate: opts.expectedByDate,
    daysToExpect:   opts.daysToExpect,
    category,
    isOverdue,
    legalBasis:     opts.legalBasis,
    priority,
  };
}

function daysUntil(dateStr?: string | null): number | undefined {
  if (!dateStr) return undefined;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / MS_PER_DAY);
}

export class PredictiveStepEngine {
  static analyze(ctx: InvestigationContext): PredictiveStepReport {
    stepIdx = 0;
    const firId = ctx.activeFirId;
    const k     = ctx.karyvahi.all;

    function hasK(re: RegExp) { return k.some((kv) => re.test(kv.name.toLowerCase())); }
    function pendingK(re: RegExp) { return k.some((kv) => re.test(kv.name.toLowerCase()) && kv.is_completed === 0); }

    const likelyNextSteps: PredictedStep[] = [];
    const pendingWork:     PredictedStep[] = [];
    const upcomingDeadlines: PredictedStep[] = [];
    const courtPrep:       PredictedStep[] = [];
    const missingDocs:     string[]        = [];

    // ── Likely next step (most critical missing action) ────────────────────────
    if (!hasK(/medical|doctor/)) {
      likelyNextSteps.push(mkStep(
        'Obtain Medical Examination Report',
        'Medical karyvahi not recorded. Most likely next mandatory step.',
        88, 'evidence', 'urgent',
        { legalBasis: 'BNSS Sec 185' }
      ));
    } else if (!hasK(/witness|bayan/)) {
      likelyNextSteps.push(mkStep(
        'Record Witness Statements',
        'Medical done but witness statements absent. Natural next step.',
        84, 'witness', 'high',
        { legalBasis: 'BNSS Sec 180' }
      ));
    } else if (!hasK(/fsl|forensic/) && hasK(/seizure|muddemal/)) {
      likelyNextSteps.push(mkStep(
        'Obtain FSL Report',
        'Seizure done but FSL analysis pending. Next logical step.',
        82, 'evidence', 'high',
        { legalBasis: 'BNSS Sec 349' }
      ));
    } else if (ctx.caseDiaries.length === 0) {
      likelyNextSteps.push(mkStep(
        'Create First Case Diary Entry',
        'No case diary yet. Document investigation progress.',
        90, 'documentation', 'urgent',
        { legalBasis: 'BNSS Sec 193' }
      ));
    } else if (ctx.caseHealth.readinessForChargeSheet) {
      likelyNextSteps.push(mkStep(
        'Prepare Charge Sheet',
        'Investigation health indicates charge sheet readiness.',
        85, 'documentation', 'urgent',
        { legalBasis: 'BNSS Sec 250' }
      ));
    } else {
      likelyNextSteps.push(mkStep(
        'Update Case Diary',
        'Routine next step: document latest investigation progress.',
        78, 'documentation', 'medium',
        { legalBasis: 'BNSS Sec 193' }
      ));
    }

    // ── Pending work predictions ───────────────────────────────────────────────
    if (pendingK(/medical|doctor/)) {
      pendingWork.push(mkStep(
        'Complete Medical Examination',
        'Medical karyvahi marked pending.', 85, 'evidence', 'urgent',
        { legalBasis: 'BNSS Sec 185' }
      ));
    }
    if (pendingK(/witness|bayan/)) {
      pendingWork.push(mkStep(
        'Complete Witness Statements',
        'Witness karyvahi marked pending.', 82, 'witness', 'high',
        { legalBasis: 'BNSS Sec 180' }
      ));
    }
    if (pendingK(/fsl|forensic/)) {
      pendingWork.push(mkStep(
        'Follow Up FSL Report',
        'FSL karyvahi pending. Forensic report not yet received.', 80, 'evidence', 'high',
        { legalBasis: 'BNSS Sec 349' }
      ));
    }
    if (pendingK(/notice/)) {
      pendingWork.push(mkStep(
        'Serve Pending Notices',
        'Notice karyvahi pending. Serve and record service.', 75, 'witness', 'medium',
        { legalBasis: 'BNSS Sec 179' }
      ));
    }
    if (ctx.prarthnaPatra.some((p) => p.status === 'Pending')) {
      pendingWork.push(mkStep(
        'File Bail/Prarthna Reply',
        'Pending prarthna patra requires response.', 90, 'deadline', 'urgent',
        { legalBasis: 'BNSS Sec 479' }
      ));
    }

    // ── Upcoming deadlines ─────────────────────────────────────────────────────
    for (const doc of ctx.courtDocs.filter((d) => d.deadline_date)) {
      const days = daysUntil(doc.deadline_date);
      if (days !== undefined && days <= 14) {
        upcomingDeadlines.push(mkStep(
          `Court Deadline: ${doc.vad_sankhya ?? doc.doc_type ?? 'Document'}`,
          `Court compliance due in ${days} day(s).`,
          92, 'court', days <= 3 ? 'urgent' : 'high',
          { expectedByDate: doc.deadline_date ?? undefined, daysToExpect: days, legalBasis: 'BNSS Sec 230' }
        ));
      }
    }
    for (const overdue of ctx.overdueItems.slice(0, 4)) {
      upcomingDeadlines.push(mkStep(
        `Overdue: ${overdue.title}`,
        `${overdue.daysOverdue} day(s) overdue in ${overdue.module}.`,
        88, 'deadline', 'urgent',
        { daysToExpect: -overdue.daysOverdue }
      ));
    }

    // ── Court preparation ─────────────────────────────────────────────────────
    if (ctx.courtDocs.length > 0) {
      courtPrep.push(mkStep(
        'Prepare Court Compliance Report',
        'Court documents exist — prepare compliance report in advance.',
        80, 'court', 'high',
        { legalBasis: 'BNSS Sec 230' }
      ));
    }
    if (hasK(/arrest|giraftari/)) {
      courtPrep.push(mkStep(
        'Prepare Production Warrant',
        'Arrested accused must be produced within statutory period.',
        85, 'court', 'urgent',
        { legalBasis: 'BNSS Sec 58' }
      ));
    }

    // ── Expected missing documents ─────────────────────────────────────────────
    if (!hasK(/medical|doctor/))    missingDocs.push('Medical Examination Report (BNSS Sec 185)');
    if (!hasK(/fsl|forensic/) && hasK(/seizure|muddemal/)) missingDocs.push('FSL Report (BNSS Sec 349)');
    if (!hasK(/witness|bayan/))     missingDocs.push('Witness Statements (BNSS Sec 180)');
    if (ctx.caseDiaries.length === 0) missingDocs.push('Case Diary (BNSS Sec 193)');
    if (!hasK(/arrest/) && ctx.fir?.status !== 'Finished') missingDocs.push('Arrest Memo (if applicable)');
    if (!hasK(/seizure|muddemal/))  missingDocs.push('Seizure Memo (if property involved)');

    const allSteps     = [...pendingWork, ...upcomingDeadlines, ...courtPrep];
    const avgConfidence = allSteps.length > 0
      ? Math.round(allSteps.reduce((a, s) => a + s.confidence, 0) / allSteps.length)
      : (likelyNextSteps[0]?.confidence ?? 70);

    return {
      generatedAt:              new Date().toISOString(),
      firId,
      likelyNextStep:           likelyNextSteps[0] ?? null,
      pendingWorkPredictions:   pendingWork,
      upcomingDeadlines,
      courtPreparationItems:    courtPrep,
      expectedMissingDocuments: missingDocs,
      overallConfidence:        avgConfidence,
      summary: likelyNextSteps.length === 0
        ? 'Investigation appears complete. No immediate next steps predicted.'
        : `Next step: "${likelyNextSteps[0]?.title}". ${pendingWork.length} pending work, ${upcomingDeadlines.length} deadline(s), ${missingDocs.length} missing document(s).`,
    };
  }
}

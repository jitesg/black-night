/**
 * IntelligenceRecommendationEngine.ts
 * Generates prioritized, explainable smart next-action recommendations.
 *
 * SAFETY: Read-only. Consumes InvestigationContext only. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  IntelligenceRecommendationReport,
  SmartRecommendation,
  RecommendationAction,
  IntelPriority,
  IntelSeverity,
} from './IntelligenceTypes';
import { LearningEngine } from '@/ai/level5/LearningEngine';

let recId = 0;
const mkRec = (
  action: RecommendationAction,
  title: string,
  reason: string,
  supportingContext: string,
  applicableRule: string,
  confidencePct: number,
  expectedOutcome: string,
  priority: IntelPriority,
  severity: IntelSeverity,
  isBlocking: boolean,
  category: SmartRecommendation['category'],
  dependencies: string[] = [],
  legalReference?: string
): SmartRecommendation => ({
  id: `REC-${String(++recId).padStart(3, '0')}`,
  action, title, reason, supportingContext, applicableRule,
  confidencePct: Math.min(100, confidencePct + LearningEngine.getConfidenceBoost(title)),
  expectedOutcome, priority, severity, isBlocking,
  category, dependencies, legalReference,
});

function has(ctx: InvestigationContext, pattern: RegExp, onlyCompleted = false): boolean {
  const list = onlyCompleted ? ctx.karyvahi.completed : ctx.karyvahi.all;
  return list.some((k) => pattern.test(k.name));
}

function daysSinceFIR(ctx: InvestigationContext): number {
  if (!ctx.fir) return 0;
  const t = ctx.fir.date_of_information
    ? new Date(ctx.fir.date_of_information).getTime()
    : ctx.fir.created_at * 1000;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export class IntelligenceRecommendationEngine {
  static evaluate(ctx: InvestigationContext): IntelligenceRecommendationReport {
    recId = 0;
    const recommendations: SmartRecommendation[] = [];
    const today = new Date().toISOString().split('T')[0];
    const days = daysSinceFIR(ctx);
    const crimeType = (ctx.fir?.crime_type ?? '').toLowerCase();
    const sections  = (ctx.fir?.section ?? '').toLowerCase();

    const hasArrest    = has(ctx, /arrest|गिरफ्तार/i);
    const hasMemo      = has(ctx, /arrest.*memo|गिरफ्तारी.*पंचनामा/i);
    const hasMedical   = has(ctx, /medical|mlc|post.mortem/i);
    const hasWitness   = has(ctx, /witness|statement|bayan|gavah/i);
    const hasSeizure   = has(ctx, /seizure|जब्ती|recovery/i);
    const hasSeizMemo  = has(ctx, /seizure.*memo|panchnama/i);
    const hasFSL       = has(ctx, /fsl|forensic/i);
    const hasScene     = has(ctx, /scene|ghatnasthal|spot/i);
    const hasDiary     = ctx.caseDiaries.length > 0;
    const hasProduction = has(ctx, /court.*production|peshi|remand/i);
    const needsMedical = /murder|attempt|robbery|dacoity|accident|pocso|assault/i.test(crimeType);
    const needsFSL     = /murder|ndps|arms|pocso|robbery|dacoity/i.test(crimeType);
    const overdueCourtDocs = ctx.courtDocs.filter((d) => d.status === 'Pending' && d.deadline_date < today);
    const soonCourtDocs    = ctx.courtDocs.filter((d) => {
      if (d.status !== 'Pending') return false;
      const diff = Math.floor((new Date(d.deadline_date).getTime() - Date.now()) / 86_400_000);
      return diff >= 0 && diff <= 5;
    });

    // ── 1. Default bail / charge sheet ─────────────────────────────────────────
    if (hasArrest && days >= 60) {
      recommendations.push(mkRec(
        'file-charge-sheet',
        'File Charge Sheet Immediately — Default Bail Risk',
        `FIR is ${days} days old. Accused in custody. Charge sheet deadline has expired.`,
        `Arrest date: ${days} days ago. Default bail threshold: 60 days.`,
        'BNSS Section 479 — Default bail on failure to file charge sheet.',
        98, 'Prevents accused from obtaining default bail.',
        'urgent', 'critical', true, 'deadline',
        [], 'BNSS Section 479'
      ));
    } else if (hasArrest && days >= 45) {
      recommendations.push(mkRec(
        'file-charge-sheet',
        'Prepare Charge Sheet — Deadline Approaching',
        `Charge sheet is due in ${60 - days} days. Start preparation immediately.`,
        `${60 - days} days remaining to default bail threshold.`,
        'BNSS Section 193/479',
        90, 'Timely charge sheet filing prevents default bail.',
        'urgent', 'high', true, 'deadline',
        [], 'BNSS Section 479'
      ));
    }

    // ── 2. Overdue court deadlines ─────────────────────────────────────────────
    overdueCourtDocs.slice(0, 3).forEach((doc) => {
      recommendations.push(mkRec(
        'produce-in-court',
        `Overdue Court Action: ${doc.doc_type}`,
        `Court document "${doc.doc_type}" was due ${doc.deadline_date} and is still pending.`,
        `Registration No: ${doc.registration_number}. Status: ${doc.status}.`,
        'BNSS — Compliance with court orders is mandatory.',
        95, 'Resolves court compliance gap. Prevents adverse orders.',
        'urgent', 'critical', true, 'court',
        []
      ));
    });

    // ── 3. Arrest memo ─────────────────────────────────────────────────────────
    if (hasArrest && !hasMemo) {
      recommendations.push(mkRec(
        'prepare-seizure-memo',
        'Prepare Arrest Memo',
        'Arrest is recorded but Arrest Memo not found. Legally mandatory.',
        `Arrest karyvahi found. No arrest memo in records.`,
        'BNSS Section 47 — Arrest memo with two witnesses mandatory.',
        96, 'Makes arrest procedurally correct and legally sound.',
        'urgent', 'critical', true, 'documentation',
        [], 'BNSS Section 47'
      ));
    }

    // ── 4. Witness statements ──────────────────────────────────────────────────
    if (!hasWitness) {
      recommendations.push(mkRec(
        'record-witness-statement',
        'Record Witness Statements',
        'No witness statements found in investigation record.',
        'Witness statements are primary evidence for prosecution.',
        'BNSS Section 180 — Witness statements must be recorded.',
        92, 'Provides corroborating evidence for charge sheet.',
        'high', 'high', true, 'witness',
        ctx.fir ? ['FIR Registration'] : [],
        'BNSS Section 180'
      ));
    }

    // ── 5. Medical report ──────────────────────────────────────────────────────
    if (needsMedical && !hasMedical) {
      recommendations.push(mkRec(
        'obtain-medical-report',
        'Obtain Medical Examination / MLC Report',
        `Crime type "${ctx.fir?.crime_type}" requires medical evidence but none found.`,
        `Sections: ${ctx.fir?.section}. Injury offence requires MLC.`,
        'BNSS Section 198 — Medical examination mandatory for injury cases.',
        93, 'Corroborates victim injuries and strengthens evidence.',
        'urgent', 'critical', true, 'evidence',
        [], 'BNSS Section 198'
      ));
    }

    // ── 6. Scene inspection ────────────────────────────────────────────────────
    if (!hasScene && ctx.fir) {
      recommendations.push(mkRec(
        'conduct-scene-exam',
        'Conduct Scene of Crime Inspection',
        'No scene inspection recorded. This is a fundamental investigation step.',
        `FIR crime type: ${ctx.fir.crime_type}.`,
        'Standard Investigation Procedure — Scene inspection is mandatory.',
        88, 'Provides physical clues and supports evidence chain.',
        'high', 'high', !hasWitness, 'investigation',
        ['FIR Registration']
      ));
    }

    // ── 7. Seizure memo ────────────────────────────────────────────────────────
    if (hasSeizure && !hasSeizMemo) {
      recommendations.push(mkRec(
        'prepare-seizure-memo',
        'Prepare Seizure Memo / Panchnama',
        'Evidence was seized but no Seizure Memo/Panchnama documented.',
        'Seizure without documentation makes evidence legally vulnerable.',
        'BNSS Section 187 — Seizure must be documented with panchnama.',
        94, 'Makes seized evidence admissible in court.',
        'urgent', 'critical', true, 'evidence',
        [], 'BNSS Section 187'
      ));
    }

    // ── 8. CCTV collection ─────────────────────────────────────────────────────
    const hasCCTV = has(ctx, /cctv|footage|camera/i);
    if (!hasCCTV && ctx.fir) {
      recommendations.push(mkRec(
        'collect-cctv',
        'Collect CCTV / Dashcam Footage',
        'CCTV footage not collected. Important corroborative digital evidence.',
        `Crime location: ${ctx.fir.ghatnasthal ?? 'Not specified'}.`,
        'Digital Evidence Protocol — CCTV should be collected immediately.',
        75, 'Provides objective timeline and witness corroboration.',
        'medium', 'medium', false, 'evidence',
        ['FIR Registration']
      ));
    }

    // ── 9. FSL referral ────────────────────────────────────────────────────────
    if (needsFSL && hasSeizure && !hasFSL) {
      recommendations.push(mkRec(
        'followup-fsl',
        'Send Evidence to FSL for Forensic Examination',
        'Evidence seized but not sent to FSL. Forensic examination is critical.',
        `Crime type requires FSL: ${ctx.fir?.crime_type}.`,
        'BNSS Section 349 — FSL examination of physical evidence mandatory.',
        90, 'Provides scientific corroboration of crime.',
        'high', 'high', false, 'evidence',
        ['Seizure Memo / Panchnama'],
        'BNSS Section 349'
      ));
    }

    // ── 10. Case diary ─────────────────────────────────────────────────────────
    if (!hasDiary && ctx.karyvahi.all.length >= 2) {
      recommendations.push(mkRec(
        'update-case-diary',
        'Prepare Case Diary',
        'Investigation is active but Case Diary is not maintained.',
        `${ctx.karyvahi.all.length} karyvahi entries without corresponding Case Diary.`,
        'BNSS Section 193 — Case Diary is a statutory obligation.',
        90, 'Fulfils statutory obligation and creates investigation record.',
        'high', 'high', false, 'documentation',
        [], 'BNSS Section 193'
      ));
    } else if (hasDiary) {
      const lastDiaryDate = ctx.caseDiaries
        .map((d) => d.preparation_date)
        .sort()
        .pop();
      if (lastDiaryDate && lastDiaryDate < today) {
        const daysSince = Math.floor((Date.now() - new Date(lastDiaryDate).getTime()) / 86_400_000);
        if (daysSince >= 5) {
          recommendations.push(mkRec(
            'update-case-diary',
            `Update Case Diary — ${daysSince} Days Since Last Entry`,
            `Case diary last updated ${daysSince} days ago. Should be updated regularly.`,
            `Last entry: ${lastDiaryDate}.`,
            'BNSS Section 193 — Investigation diary must be regularly maintained.',
            85, 'Maintains investigation continuity and statutory compliance.',
            daysSince >= 10 ? 'high' : 'medium', 'medium', false, 'documentation'
          ));
        }
      }
    }

    // ── 11. Court production ──────────────────────────────────────────────────
    if (hasArrest && !hasProduction) {
      recommendations.push(mkRec(
        'produce-in-court',
        'Produce Accused in Court',
        'Arrest recorded but court production not found within records.',
        'Arrested person must be produced before magistrate within 24 hours.',
        'BNSS Section 56 — Mandatory production within 24 hours of arrest.',
        95, 'Ensures legal detention. Prevents habeas corpus applications.',
        'urgent', 'critical', true, 'court',
        ['Arrest', 'Arrest Memo'],
        'BNSS Section 56'
      ));
    }

    // ── 12. Soon court deadlines ──────────────────────────────────────────────
    soonCourtDocs.slice(0, 2).forEach((doc) => {
      const diff = Math.floor((new Date(doc.deadline_date).getTime() - Date.now()) / 86_400_000);
      recommendations.push(mkRec(
        'submit-compliance',
        `Upcoming Court Deadline: ${doc.doc_type} (in ${diff} days)`,
        `Court document "${doc.doc_type}" is due on ${doc.deadline_date}.`,
        `Registration No: ${doc.registration_number}.`,
        'BNSS — Timely court compliance is mandatory.',
        88, 'Maintains court compliance. Prevents adverse orders.',
        'high', 'high', false, 'court',
        []
      ));
    });

    // ── Sort by priority order ─────────────────────────────────────────────────
    const priorityOrder: Record<IntelPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    const sorted = recommendations.sort((a, b) => {
      const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pd !== 0) return pd;
      return b.confidencePct - a.confidencePct;
    });

    const topPriority = sorted[0] ?? null;
    const blockingCount = sorted.filter((r) => r.isBlocking).length;
    const urgentCount   = sorted.filter((r) => r.priority === 'urgent').length;

    const summary =
      sorted.length === 0
        ? '✅ No urgent recommendations. Investigation appears on track.'
        : `${sorted.length} recommendation(s). ` +
          (blockingCount > 0 ? `🔴 ${blockingCount} blocking action(s). ` : '') +
          `Top: ${topPriority?.title ?? ''}.`;

    return {
      recommendations: sorted,
      topPriority,
      blockingCount,
      urgentCount,
      summary,
    };
  }
}

/**
 * RiskPredictionEngine.ts
 * Predicts investigation risks and their likelihood/impact.
 *
 * SAFETY: Read-only. Consumes InvestigationContext only. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { RiskPredictionReport, PredictedRisk, RiskCategory, IntelPriority } from './IntelligenceTypes';

let rid = 0;
const mkRisk = (
  category: RiskCategory,
  title: string,
  riskLevel: PredictedRisk['riskLevel'],
  likelihood: number,
  impact: PredictedRisk['impact'],
  priority: IntelPriority,
  reason: string,
  recommendation: string,
  daysToEvent?: number
): PredictedRisk => ({
  id: `RISK-${String(++rid).padStart(3, '0')}`,
  category, title, riskLevel, likelihood, impact, priority, reason, recommendation, daysToEvent,
});

function has(ctx: InvestigationContext, pattern: RegExp): boolean {
  return ctx.karyvahi.all.some((k) => pattern.test(k.name));
}

function daysSinceFIR(ctx: InvestigationContext): number {
  if (!ctx.fir) return 0;
  const t = ctx.fir.date_of_information
    ? new Date(ctx.fir.date_of_information).getTime()
    : ctx.fir.created_at * 1000;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export class RiskPredictionEngine {
  static evaluate(ctx: InvestigationContext): RiskPredictionReport {
    rid = 0;
    const risks: PredictedRisk[] = [];
    const today = new Date().toISOString().split('T')[0];
    const days = daysSinceFIR(ctx);
    const hasArrest = has(ctx, /arrest|गिरफ्तार/i);

    // ── Default Bail Risk ─────────────────────────────────────────────────────
    if (hasArrest && ctx.fir?.status === 'Pending') {
      const daysToDefault = Math.max(0, 60 - days);
      if (days >= 60) {
        risks.push(mkRisk(
          'default-bail', 'Default Bail Risk — Charge Sheet Overdue',
          'high', 95, 'critical', 'urgent',
          `FIR is ${days} days old. Accused in custody without charge sheet exceeds 60-day limit.`,
          'File charge sheet immediately. Accused is legally entitled to default bail.',
          0
        ));
      } else if (days >= 45) {
        risks.push(mkRisk(
          'default-bail', 'Default Bail Risk — Charge Sheet Deadline Approaching',
          'high', 80, 'critical', 'urgent',
          `Charge sheet due in ${daysToDefault} days. Investigation may not be complete in time.`,
          `Complete all pending investigation steps. File charge sheet before ${daysToDefault} days.`,
          daysToDefault
        ));
      }
    }

    // ── Weak Evidence Risk ────────────────────────────────────────────────────
    const hasSeizure = has(ctx, /seizure|evidence|exhibit/i);
    const hasFSL     = has(ctx, /fsl|forensic/i);
    const hasMedical = has(ctx, /medical|mlc|post.mortem/i);
    const needsMedical = /murder|attempt|robbery|accident|pocso/i.test(ctx.fir?.crime_type ?? '');
    if (!hasSeizure || (needsMedical && !hasMedical) || !hasFSL) {
      const likelihood = (!hasSeizure ? 30 : 0) + (!hasFSL ? 20 : 0) + (needsMedical && !hasMedical ? 25 : 0);
      risks.push(mkRisk(
        'weak-evidence', 'Weak Evidence — Key Exhibits Missing',
        likelihood > 50 ? 'high' : 'medium', Math.min(90, likelihood),
        'critical', 'high',
        `Missing: ${[!hasSeizure && 'Physical Evidence', !hasFSL && 'FSL Report', needsMedical && !hasMedical && 'Medical Report'].filter(Boolean).join(', ')}.`,
        'Collect and document all required evidence immediately. Weak evidence risks case failure.',
      ));
    }

    // ── Witness Risk ──────────────────────────────────────────────────────────
    const hasWitnesses     = has(ctx, /witness|gavah|statement/i);
    const completedWitness = ctx.karyvahi.completed.some((k) => /witness|gavah|statement/i.test(k.name));
    if (!hasWitnesses) {
      risks.push(mkRisk(
        'witness-risk', 'No Witness Statements Recorded',
        'high', 85, 'critical', 'urgent',
        'No witness statements found in investigation record.',
        'Record statements of all eyewitnesses and complainant immediately.',
      ));
    } else if (!completedWitness) {
      risks.push(mkRisk(
        'witness-risk', 'Witness Statements Pending Completion',
        'medium', 60, 'moderate', 'high',
        'Witness statements started but not marked complete.',
        'Complete pending witness statements to strengthen prosecution case.',
      ));
    }

    // ── Court Delay Risk ──────────────────────────────────────────────────────
    const overdueCourtDocs = ctx.courtDocs.filter((d) => d.status === 'Pending' && d.deadline_date < today);
    if (overdueCourtDocs.length > 0) {
      risks.push(mkRisk(
        'court-delay', `${overdueCourtDocs.length} Court Deadline(s) Overdue`,
        'high', 90, 'critical', 'urgent',
        `${overdueCourtDocs.length} court document(s) overdue: ${overdueCourtDocs.slice(0, 2).map((d) => d.doc_type).join(', ')}.`,
        'Appear in court immediately and file required documents.',
        0
      ));
    } else {
      const soonDocs = ctx.courtDocs.filter((d) => {
        if (d.status !== 'Pending') return false;
        const diff = Math.floor((new Date(d.deadline_date).getTime() - Date.now()) / 86_400_000);
        return diff <= 5 && diff >= 0;
      });
      if (soonDocs.length > 0) {
        const minDays = Math.min(...soonDocs.map((d) =>
          Math.floor((new Date(d.deadline_date).getTime() - Date.now()) / 86_400_000)
        ));
        risks.push(mkRisk(
          'court-delay', 'Court Deadline Approaching',
          'medium', 70, 'moderate', 'high',
          `${soonDocs.length} court deadline(s) due within ${minDays} days.`,
          'Prepare required documents and attend court on scheduled dates.',
          minDays
        ));
      }
    }

    // ── Missing Medical Risk ───────────────────────────────────────────────────
    if (needsMedical && !hasMedical) {
      risks.push(mkRisk(
        'missing-medical', 'Medical Examination Not Obtained',
        'high', 90, 'critical', 'urgent',
        `Crime type "${ctx.fir?.crime_type}" requires medical examination but none recorded.`,
        'Obtain MLC/Post-Mortem from government hospital immediately.',
      ));
    }

    // ── Missing FSL Risk ───────────────────────────────────────────────────────
    const needsFSL = /murder|ndps|arms|pocso|robbery|dacoity/i.test(ctx.fir?.crime_type ?? '');
    if (needsFSL && !hasFSL && hasSeizure) {
      risks.push(mkRisk(
        'missing-fsl', 'FSL Report Not Obtained',
        'high', 80, 'critical', 'high',
        'Evidence was seized but not sent to FSL for forensic examination.',
        'Send all physical evidence to FSL immediately. Follow up for report.',
      ));
    }

    // ── Documentation Gap Risk ────────────────────────────────────────────────
    const hasCaseDiary  = ctx.caseDiaries.length > 0;
    const hasArrestMemo = has(ctx, /arrest.*memo|गिरफ्तारी.*पंचनामा/i);
    if (!hasCaseDiary && ctx.karyvahi.all.length > 3) {
      risks.push(mkRisk(
        'documentation-gap', 'Case Diary Not Maintained',
        'high', 85, 'moderate', 'high',
        'Investigation has significant activity but no Case Diary entries.',
        'Start maintaining Case Diary immediately. Record all investigation steps.',
      ));
    }
    if (hasArrest && !hasArrestMemo) {
      risks.push(mkRisk(
        'documentation-gap', 'Arrest Memo Not Prepared',
        'high', 90, 'critical', 'urgent',
        'Arrest recorded but no Arrest Memo found.',
        'Prepare Arrest Memo immediately with two witness signatures.',
      ));
    }

    // ── Deadline Risk ─────────────────────────────────────────────────────────
    const overdueReminders = ctx.overdueItems.length;
    if (overdueReminders > 0) {
      risks.push(mkRisk(
        'deadline-risk', `${overdueReminders} Overdue Investigation Items`,
        'medium', 75, 'moderate', 'high',
        `${overdueReminders} items are overdue across investigation modules.`,
        'Review and complete all overdue items. Update system records.',
      ));
    }

    // Sort risks: high → medium → low
    const sorted = risks.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.riskLevel] ?? 2) - (order[b.riskLevel] ?? 2);
    });

    const overallRiskLevel: PredictedRisk['riskLevel'] =
      sorted.some((r) => r.riskLevel === 'high') ? 'high' :
      sorted.some((r) => r.riskLevel === 'medium') ? 'medium' : 'low';

    const defaultBailRisk = sorted.find((r) => r.category === 'default-bail') ?? null;
    const topPriorityRisk = sorted[0] ?? null;

    const summary =
      risks.length === 0
        ? '✅ No significant risks detected.'
        : `Risk Level: ${overallRiskLevel.toUpperCase()}. ${risks.length} risk(s) identified. ` +
          (defaultBailRisk ? '⚠️ Default bail risk active. ' : '') +
          `Top risk: ${topPriorityRisk?.title ?? ''}.`;

    return {
      overallRiskLevel,
      risks: sorted,
      criticalRiskCount: sorted.filter((r) => r.impact === 'critical').length,
      highRiskCount: sorted.filter((r) => r.riskLevel === 'high').length,
      defaultBailRisk,
      topPriorityRisk,
      summary,
    };
  }
}

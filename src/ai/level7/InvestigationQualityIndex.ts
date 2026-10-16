/**
 * InvestigationQualityIndex.ts
 * Level-7: Composite quality score across 8 dimensions with grade and trend.
 *
 * SAFETY: Read-only. Pure analysis. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  QualityIndexReport, QualityDimension, L7Grade,
} from './L7Types';
import type { ChargeSheetValidatorReport } from './L7Types';
import type { CourtReadinessReport } from './L7Types';
import type { EvidenceStrengthReport } from './L7Types';

function toGrade(score: number): L7Grade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function dim(
  id: string, label: string, score: number,
  issues: string[], suggestions: string[],
): QualityDimension {
  return {
    id, label,
    score: Math.min(100, Math.max(0, score)),
    grade: toGrade(score),
    trend: 'stable',
    issues, suggestions,
  };
}

export class InvestigationQualityIndex {
  static analyze(
    ctx: InvestigationContext,
    evidenceReport?: EvidenceStrengthReport,
    chargeSheetReport?: ChargeSheetValidatorReport,
    courtReport?: CourtReadinessReport,
  ): QualityIndexReport {
    const kCompleted = ctx.karyvahi.completed;
    const kAll       = ctx.karyvahi.all;
    const fir        = ctx.fir;
    const doneK = (pats: string[]) => kCompleted.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));

    const firAge = fir
      ? Math.floor((Date.now() - new Date(fir.date_of_information ?? fir.created_at).getTime()) / 86_400_000)
      : 0;
    const lastDiary = ctx.caseDiaries[0];
    const daysSinceDiary = lastDiary
      ? Math.floor((Date.now() - new Date(lastDiary.preparation_date).getTime()) / 86_400_000)
      : 999;
    const completionPct = kAll.length > 0
      ? Math.round((kCompleted.length / kAll.length) * 100)
      : 0;

    // ── 1. Investigation Score ────────────────────────────────────────────────
    let invScore = completionPct;
    const invIssues: string[] = [];
    const invSuggs: string[] = [];
    if (completionPct < 50) { invIssues.push(`Only ${completionPct}% karyvahi completed`); invSuggs.push('Complete pending investigation steps'); }
    if (daysSinceDiary > 7) { invScore -= 15; invIssues.push(`Case diary not updated for ${daysSinceDiary} days`); invSuggs.push('Update case diary immediately'); }
    if (ctx.overdueItems.length > 0) { invScore -= ctx.overdueItems.length * 5; invIssues.push(`${ctx.overdueItems.length} overdue items`); }

    // ── 2. Evidence Score ─────────────────────────────────────────────────────
    const evidenceScore = evidenceReport?.overallScore ?? (() => {
      let s = 50;
      if (doneK(['seizure', 'panchnama'])) s += 15;
      if (doneK(['bayan', 'witness'])) s += 15;
      if (doneK(['medical', 'mlc'])) s += 10;
      if (doneK(['fsl report'])) s += 10;
      return Math.min(s, 100);
    })();
    const evIssues = evidenceReport?.missingEvidence.slice(0, 2) ?? [];
    const evSuggs  = evidenceReport?.recommendations.slice(0, 2) ?? [];

    // ── 3. Compliance Score ───────────────────────────────────────────────────
    const overdueDeduction = Math.min(ctx.overdueItems.length * 8, 40);
    const complianceScore = Math.max(0, 100 - overdueDeduction - (firAge > 60 ? 20 : 0));
    const compIssues = ctx.overdueItems.slice(0, 2).map((o) => `Overdue: ${o.title}`);
    const compSuggs = ctx.overdueItems.length > 0 ? ['Address all overdue compliance items'] : [];

    // ── 4. Documentation Score ────────────────────────────────────────────────
    let docScore = 40;
    if (ctx.caseDiaries.length > 0) docScore += 20;
    if (ctx.gdEntries.length > 0) docScore += 20;
    if (kCompleted.length >= 5) docScore += 20;
    const docIssues = ctx.caseDiaries.length === 0 ? ['No case diary entries'] : [];
    if (ctx.gdEntries.length === 0) docIssues.push('No GD entries');

    // ── 5. Timeline Score ─────────────────────────────────────────────────────
    const timelineScore = daysSinceDiary > 14 ? 20
      : daysSinceDiary > 7 ? 45
      : daysSinceDiary > 3 ? 70
      : 90;
    const tlIssues = daysSinceDiary > 7 ? [`Case diary gap: ${daysSinceDiary} days`] : [];

    // ── 6. Court Readiness ────────────────────────────────────────────────────
    const courtScore = courtReport?.score ?? (() => {
      let s = 40;
      if (ctx.courtDocs.filter((d) => d.status === 'Finished').length > 0) s += 30;
      if (!ctx.courtDocs.some((d) => {
        const days = d.deadline_date ? Math.ceil((new Date(d.deadline_date).getTime() - Date.now()) / 86_400_000) : 99;
        return days >= 0 && days <= 7;
      })) s += 30;
      return Math.min(s, 100);
    })();
    const courtIssues = courtReport?.criticalIssues.slice(0, 2) ?? [];

    // ── 7. Charge Sheet Readiness ─────────────────────────────────────────────
    const chargeScore = chargeSheetReport?.overallScore ?? (() => {
      let s = 30;
      if (doneK(['seizure', 'panchnama'])) s += 20;
      if (doneK(['bayan', 'witness'])) s += 20;
      if (ctx.caseDiaries.length > 0) s += 15;
      if (firAge <= 60) s += 15;
      return Math.min(s, 100);
    })();
    const csIssues = chargeSheetReport?.criticalMissing.slice(0, 2) ?? [];

    // ── 8. Risk Score (inverse — high risk = low score) ───────────────────────
    let riskPenalty = 0;
    if (ctx.overdueItems.length > 0) riskPenalty += 20;
    if (ctx.overdueItems.length >= 3)   riskPenalty += 20;
    if (firAge > 60)                     riskPenalty += 20;
    if (daysSinceDiary > 14)             riskPenalty += 20;
    const riskScore = Math.max(0, 100 - riskPenalty);
    const riskIssues = riskPenalty > 0 ? [`${riskPenalty}% risk deduction`] : [];

    // ── Composite ─────────────────────────────────────────────────────────────
    const scores = [invScore, evidenceScore, complianceScore, docScore, timelineScore, courtScore, chargeScore, riskScore];
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const trend = overallScore >= 70 ? 'improving' : overallScore >= 50 ? 'stable' : 'declining';

    const criticalIssues = [
      ...invIssues.filter((x) => x.includes('overdue') || x.includes('diary')),
      ...compIssues,
      ...courtIssues.slice(0, 1),
    ].filter(Boolean).slice(0, 4);

    const keyStrengths: string[] = [];
    if (evidenceScore >= 70) keyStrengths.push('Evidence collection is strong');
    if (complianceScore >= 80) keyStrengths.push('Compliance record is good');
    if (timelineScore >= 80) keyStrengths.push('Investigation timeline is current');
    if (chargeScore >= 70) keyStrengths.push('Charge sheet readiness is adequate');

    return {
      generatedAt: new Date().toISOString(),
      firId: ctx.activeFirId,
      investigationScore: Math.min(100, Math.max(0, invScore)),
      evidenceScore,
      complianceScore,
      documentationScore: docScore,
      timelineScore,
      courtReadinessScore: courtScore,
      chargeSheetScore: chargeScore,
      riskScore,
      overallScore,
      overallGrade: toGrade(overallScore),
      trend,
      dimensions: [
        dim('investigation', 'Investigation',   Math.min(100, Math.max(0, invScore)),  invIssues,  invSuggs),
        dim('evidence',      'Evidence',         evidenceScore, evIssues,   evSuggs),
        dim('compliance',    'Compliance',       complianceScore, compIssues, compSuggs),
        dim('documentation', 'Documentation',    docScore,     docIssues,  ['Maintain regular case diary entries']),
        dim('timeline',      'Timeline',         timelineScore, tlIssues,  ['Update diary within 3 days of each activity']),
        dim('court',         'Court Readiness',  courtScore,   courtIssues, ['Prepare compliance reports']),
        dim('chargesheet',   'Charge Sheet',     chargeScore,  csIssues,   ['Complete mandatory documents']),
        dim('risk',          'Risk Control',     riskScore,    riskIssues, ['Address overdue items promptly']),
      ],
      criticalIssues,
      keyStrengths,
    };
  }
}

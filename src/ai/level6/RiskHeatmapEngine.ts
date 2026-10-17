/**
 * RiskHeatmapEngine.ts
 * Level-6: Generates visual risk scores for 8 investigation categories.
 * Produces a color-coded heatmap (Low/Medium/High/Critical) with recommendations.
 *
 * SAFETY: Read-only. Never writes to any repository or database.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  RiskHeatmapReport,
  HeatmapCell,
  HeatmapCategory,
  L6RiskLevel,
} from './L6Types';

const MS_PER_DAY = 86_400_000;

function daysSince(val?: string | number | null): number {
  if (!val) return 0;
  const t = typeof val === 'string' ? new Date(val).getTime() : (val as number);
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

function daysUntil(val?: string | null): number | undefined {
  if (!val) return undefined;
  return Math.ceil((new Date(val).getTime() - Date.now()) / MS_PER_DAY);
}

function toRiskLevel(score: number): L6RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function cell(
  category: HeatmapCategory,
  label: string,
  score: number,
  reason: string,
  recommendation: string,
  linkedItems: string[] = []
): HeatmapCell {
  return { category, label, score, riskLevel: toRiskLevel(score), reason, recommendation, linkedItems };
}

export class RiskHeatmapEngine {
  static analyze(ctx: InvestigationContext): RiskHeatmapReport {
    const fir       = ctx.fir;
    const firId     = ctx.activeFirId;
    const cells: HeatmapCell[] = [];

    // ── Evidence ──────────────────────────────────────────────────────────────
    const seizures = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('seizure') || k.name.toLowerCase().includes('muddemal')
    );
    const fslDone = ctx.karyvahi.all.some(
      (k) => k.name.toLowerCase().includes('fsl') && k.is_completed === 1
    );
    let evidenceScore = 0;
    if (seizures.length === 0) evidenceScore += 60;
    else if (!fslDone)         evidenceScore += 30;
    cells.push(cell('evidence', 'Evidence', evidenceScore,
      seizures.length === 0 ? 'No seizure/evidence karyvahi recorded.' : fslDone ? 'Evidence present and FSL received.' : 'Evidence present but FSL pending.',
      seizures.length === 0 ? 'Conduct scene examination and record evidence.' : 'Follow up with FSL for forensic report.',
      seizures.map((k) => k.name)
    ));

    // ── Court ─────────────────────────────────────────────────────────────────
    const courtDeadlines = ctx.courtDocs.filter((d) => d.deadline_date);
    const urgentCourt    = courtDeadlines.filter((d) => {
      const days = daysUntil(d.deadline_date);
      return days !== undefined && days <= 7;
    });
    const courtScore = urgentCourt.length >= 2 ? 90
      : urgentCourt.length === 1 ? 70
      : courtDeadlines.length > 0 ? 30
      : 10;
    cells.push(cell('court', 'Court', courtScore,
      urgentCourt.length > 0
        ? `${urgentCourt.length} court deadline(s) within 7 days.`
        : courtDeadlines.length > 0 ? 'Court deadlines present — monitor closely.' : 'No court deadlines detected.',
      urgentCourt.length > 0 ? 'Prepare compliance report immediately.' : 'Review upcoming court deadlines.',
      urgentCourt.map((d) => d.vad_sankhya ?? 'Court Doc')
    ));

    // ── Witness ───────────────────────────────────────────────────────────────
    const witnessKaryvahi = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('witness') || k.name.toLowerCase().includes('bayan') || k.name.includes('बयान') || k.name.includes('वादी') || k.name.includes('गवाह')
    );
    const pendingWitness = witnessKaryvahi.filter((k) => k.is_completed === 0);
    const witnessScore   = witnessKaryvahi.length === 0 ? 80
      : pendingWitness.length > 2 ? 65
      : pendingWitness.length > 0 ? 40
      : 10;
    cells.push(cell('witness', 'Witness', witnessScore,
      witnessKaryvahi.length === 0 ? 'No witness statements recorded.' :
        pendingWitness.length > 0 ? `${pendingWitness.length} witness statement(s) pending.` : 'All witness statements completed.',
      witnessKaryvahi.length === 0 ? 'Identify and record witness statements urgently.' : 'Complete pending witness statements.',
      witnessKaryvahi.map((k) => k.name)
    ));

    // ── Delay ─────────────────────────────────────────────────────────────────
    const lastDiaryDate = ctx.caseDiaries[0]?.preparation_date;
    const daysSinceDiary = daysSince(lastDiaryDate);
    const overdueCount  = ctx.overdueItems.length;
    const delayScore    = overdueCount >= 5 ? 90
      : overdueCount >= 3 ? 70
      : daysSinceDiary > 14 ? 65
      : daysSinceDiary > 7  ? 40
      : overdueCount > 0    ? 30
      : 10;
    cells.push(cell('delay', 'Delay', delayScore,
      `${overdueCount} overdue items. Last case diary: ${lastDiaryDate ? `${daysSinceDiary} day(s) ago` : 'never'}.`,
      overdueCount > 0 ? 'Resolve overdue items immediately.' : 'Maintain regular case diary updates.',
      ctx.overdueItems.slice(0, 3).map((o) => o.title)
    ));

    // ── Compliance ────────────────────────────────────────────────────────────
    const arrestDone   = ctx.karyvahi.all.some((k) => k.name.toLowerCase().includes('arrest'));
    const bailReply    = ctx.prarthnaPatra.length > 0;
    const complianceScore = !arrestDone ? 20 : !bailReply ? 55 : 20;
    cells.push(cell('compliance', 'Compliance', complianceScore,
      arrestDone && !bailReply ? 'Arrest recorded but bail reply pending.' : 'Compliance status nominal.',
      arrestDone && !bailReply ? 'File bail reply and update custody status.' : 'Monitor compliance deadlines.',
      []
    ));

    // ── Documentation ─────────────────────────────────────────────────────────
    const totalKaryvahi = ctx.karyvahi.all.length;
    const pending       = ctx.karyvahi.pending.length;
    const completionPct = totalKaryvahi > 0 ? Math.round((1 - pending / totalKaryvahi) * 100) : 0;
    const docScore      = completionPct < 40 ? 85
      : completionPct < 60 ? 60
      : completionPct < 80 ? 35
      : 10;
    cells.push(cell('documentation', 'Documentation', docScore,
      `Karyvahi completion: ${completionPct}% (${pending} pending of ${totalKaryvahi} total).`,
      completionPct < 60 ? 'Complete pending karyvahi records urgently.' : 'Continue maintaining documentation.',
      ctx.karyvahi.pending.slice(0, 3).map((k) => k.name)
    ));

    // ── Legal ─────────────────────────────────────────────────────────────────
    const hasNirodhatmak = ctx.nirodhatmak.length > 0;
    const remindersCount = ctx.reminders.length;
    const legalScore     = !hasNirodhatmak && arrestDone ? 60
      : remindersCount > 3 ? 50
      : 15;
    cells.push(cell('legal', 'Legal', legalScore,
      !hasNirodhatmak && arrestDone ? 'Nirodhatmak (preventive) karyvahi not recorded post-arrest.' :
        remindersCount > 3 ? `${remindersCount} pending reminders including legal actions.` : 'Legal compliance nominal.',
      !hasNirodhatmak && arrestDone ? 'Record nirodhatmak karyvahi as required.' : 'Review and clear legal reminders.',
      []
    ));

    // ── Investigation ─────────────────────────────────────────────────────────
    const health       = ctx.caseHealth;
    const invScore     = health.score < 40 ? 85
      : health.score < 60 ? 60
      : health.score < 80 ? 30
      : 10;
    cells.push(cell('investigation', 'Investigation', invScore,
      `Investigation health: ${health.score}/100 (${health.grade}). ${health.criticalItems} critical item(s).`,
      health.score < 60 ? 'Address critical investigation gaps immediately.' : 'Maintain investigation momentum.',
      health.missingEvidence.slice(0, 3)
    ));

    // ── Aggregate ─────────────────────────────────────────────────────────────
    const scores            = cells.map((c) => c.score);
    const overallRiskScore  = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const overallRiskLevel  = toRiskLevel(overallRiskScore);
    const criticalCount     = cells.filter((c) => c.riskLevel === 'critical').length;
    const highCount         = cells.filter((c) => c.riskLevel === 'high').length;
    const topCell           = cells.reduce((a, b) => a.score > b.score ? a : b);

    return {
      generatedAt:          new Date().toISOString(),
      firId,
      cells,
      overallRiskScore,
      overallRiskLevel,
      criticalCategoryCount: criticalCount,
      highCategoryCount:     highCount,
      topRiskCategory:       topCell.category,
      summary: `Overall risk: ${overallRiskLevel.toUpperCase()} (${overallRiskScore}/100). ${criticalCount} critical and ${highCount} high-risk categories detected. Top risk: ${topCell.label}.`,
    };
  }
}

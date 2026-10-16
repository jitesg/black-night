/**
 * SupervisorEngine.ts
 * Generates SHO/CO-level dashboard showing station-wide investigation health.
 *
 * SAFETY: Read-only. Consumes InvestigationContext only. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  SupervisorReport,
  FIRHealthSummary,
  StationOverview,
  IntelGrade,
  IntelPriority,
} from './IntelligenceTypes';

function grade(score: number): IntelGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function riskLevel(score: number, hasCritical: boolean): 'high' | 'medium' | 'low' {
  if (hasCritical || score < 35) return 'high';
  if (score < 60) return 'medium';
  return 'low';
}

function priority(rl: 'high' | 'medium' | 'low'): IntelPriority {
  if (rl === 'high') return 'urgent';
  if (rl === 'medium') return 'high';
  return 'medium';
}

/** Compute a quick single-FIR health score without running full engine suite */
function quickScore(ctx: InvestigationContext): { score: number; criticalCount: number } {
  let score = 50;
  let criticalCount = 0;

  const today = new Date().toISOString().split('T')[0];
  const karyAll = ctx.karyvahi.all;
  const has = (p: RegExp) => karyAll.some((k) => p.test(k.name));

  // Positive contributions
  if (ctx.caseDiaries.length > 0) score += 10;
  if (ctx.karyvahi.completionPct >= 50) score += 10;
  if (has(/witness|statement/i)) score += 5;
  if (has(/medical|mlc/i)) score += 5;
  if (has(/arrest/i)) score += 5;
  if (has(/seizure|evidence/i)) score += 5;
  if (has(/fsl|forensic/i)) score += 5;

  // Negative contributions
  const overdueCourtDocs = ctx.courtDocs.filter((d) => d.status === 'Pending' && d.deadline_date < today);
  if (overdueCourtDocs.length > 0) { score -= 20; criticalCount++; }
  if (!ctx.caseDiaries.length && karyAll.length > 2) { score -= 10; criticalCount++; }

  // Default bail risk
  if (ctx.fir) {
    const firDate = ctx.fir.date_of_information
      ? new Date(ctx.fir.date_of_information).getTime()
      : ctx.fir.created_at * 1000;
    const days = Math.floor((Date.now() - firDate) / 86_400_000);
    if (days >= 60 && has(/arrest/i)) { score -= 25; criticalCount++; }
  }

  return { score: Math.min(100, Math.max(0, score)), criticalCount };
}

export class SupervisorEngine {
  /** Single-FIR supervisor summary — for the active FIR */
  static evaluate(ctx: InvestigationContext): SupervisorReport {
    const today = new Date().toISOString().split('T')[0];
    const { score, criticalCount } = quickScore(ctx);
    const g = grade(score);
    const rl = riskLevel(score, criticalCount > 0);
    const pr = priority(rl);

    // Next court date
    const pendingCourtDates = ctx.courtDocs
      .filter((d) => d.status === 'Pending' && d.deadline_date >= today)
      .map((d) => d.deadline_date)
      .sort();
    const nextCourtDate = pendingCourtDates[0];

    // Charge sheet readiness (simple estimate)
    const csReady = Math.round(
      ((ctx.fir ? 15 : 0) +
       (ctx.karyvahi.completionPct * 0.5) +
       (ctx.caseDiaries.length > 0 ? 15 : 0) +
       (ctx.karyvahi.all.some((k) => /witness/i.test(k.name)) ? 10 : 0) +
       (ctx.karyvahi.all.some((k) => /evidence|seizure/i.test(k.name)) ? 10 : 0))
    );

    // Days since last diary
    const diaryDates = ctx.caseDiaries.map((d) => new Date(d.preparation_date).getTime());
    const daysSinceDiary = diaryDates.length > 0
      ? Math.floor((Date.now() - Math.max(...diaryDates)) / 86_400_000)
      : undefined;

    const firSummary: FIRHealthSummary = {
      firId:             ctx.fir?.id ?? '',
      firNumber:         ctx.fir?.fir_number ?? 'Unknown',
      crimeType:         ctx.fir?.crime_type ?? 'Unknown',
      healthScore:       score,
      grade:             g,
      status:            ctx.fir?.status ?? 'Pending',
      pendingTaskCount:  ctx.karyvahi.pending.length,
      criticalAlertCount: criticalCount,
      riskLevel:         rl,
      priority:          pr,
      nextCourtDate,
      chargeSheetPct:    Math.min(100, csReady),
      daysSinceLastDiary: daysSinceDiary,
    };

    // Alerts
    const criticalAlerts: string[] = [];
    if (criticalCount > 0) {
      if (ctx.courtDocs.some((d) => d.status === 'Pending' && d.deadline_date < today))
        criticalAlerts.push('Court deadline overdue');
      if (!ctx.caseDiaries.length && ctx.karyvahi.all.length > 2)
        criticalAlerts.push('Case diary not maintained');
    }

    const stationOverview: StationOverview = {
      totalActiveCases:       1,
      averageHealthScore:     score,
      criticalCasesCount:     criticalCount > 0 ? 1 : 0,
      highRiskCasesCount:     rl === 'high' ? 1 : 0,
      courtDeadlinesThisWeek: ctx.courtDocs.filter((d) => {
        if (d.status !== 'Pending') return false;
        const diff = Math.floor((new Date(d.deadline_date).getTime() - Date.now()) / 86_400_000);
        return diff >= 0 && diff <= 7;
      }).length,
      oldDiariesCount:        daysSinceDiary !== undefined && daysSinceDiary >= 7 ? 1 : 0,
      chargeSheetDueCount:    csReady < 60 ? 1 : 0,
    };

    const summary =
      `Supervisor Overview — FIR ${firSummary.firNumber}: ` +
      `Score ${score}/100 (${g}), Risk: ${rl.toUpperCase()}, ` +
      `${ctx.karyvahi.pending.length} pending actions, ` +
      (criticalAlerts.length > 0 ? `🔴 Alerts: ${criticalAlerts.join(', ')}. ` : '✅ No critical alerts. ');

    return {
      stationOverview,
      firSummaries: [firSummary],
      criticalAlerts,
      priorityOrder: [firSummary.firId],
      summary,
    };
  }
}

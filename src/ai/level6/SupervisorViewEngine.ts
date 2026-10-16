/**
 * SupervisorViewEngine.ts
 * Level-6: Generates station-level read-only intelligence for supervisors.
 * Shows pending FIRs, critical FIRs, overdue investigations, officer workload,
 * investigation score distribution, and crime trends.
 *
 * SAFETY: Read-only. isReadOnly = true always. Never writes to any repository.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  SupervisorViewReport,
  OfficerIntelligenceSummary,
  CrimeTrendAnalysis,
  L6Grade,
} from './L6Types';

function gradeFromScore(score: number): L6Grade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export class SupervisorViewEngine {
  static analyze(contexts: InvestigationContext[], stationName?: string): SupervisorViewReport {
    const now        = new Date().toISOString();
    const station    = stationName ?? contexts[0]?.officer?.policeStation ?? 'Unknown Station';
    const total      = contexts.length;

    if (total === 0) {
      const emptyGrade: Record<L6Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      return {
        generatedAt: now, stationName: station,
        totalFIRs: 0, pendingFIRs: 0, criticalFIRs: 0, overdueInvestigations: 0,
        avgInvestigationScore: 0, gradeDistribution: emptyGrade,
        officerSummaries: [], crimeTrends: [], criticalAlerts: [],
        stationRecommendations: ['No FIR data available for station intelligence.'],
        isReadOnly: true,
        summary: 'No FIR contexts provided for supervisor analysis.',
      };
    }

    // ── Per-FIR metrics ───────────────────────────────────────────────────────
    let pendingFIRs    = 0;
    let criticalFIRs   = 0;
    let overdueInvs    = 0;
    let totalScore     = 0;
    const gradeDistribution: Record<L6Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const officerMap   = new Map<string, {
      totalFIRs: number; pendingFIRs: number; criticalFIRs: number;
      overdueTasks: number; scoreSum: number; pendingCS: number; courtDeadlines: number;
    }>();
    const crimeTypeMap = new Map<string, number>();
    const alerts:       string[] = [];

    for (const ctx of contexts) {
      const health     = ctx.caseHealth;
      const fir        = ctx.fir;
      const officerName = ctx.officer?.name ?? 'Unknown';
      const score      = health.score;
      const grade      = gradeFromScore(score);
      totalScore      += score;
      gradeDistribution[grade] += 1;

      if (fir?.status === 'Pending' || !fir?.status) pendingFIRs += 1;
      if (health.criticalItems > 0)                   criticalFIRs += 1;
      if (ctx.overdueItems.length > 0)                overdueInvs += 1;

      // Officer workload
      const ow = officerMap.get(officerName) ?? {
        totalFIRs: 0, pendingFIRs: 0, criticalFIRs: 0, overdueTasks: 0,
        scoreSum: 0, pendingCS: 0, courtDeadlines: 0,
      };
      ow.totalFIRs    += 1;
      ow.scoreSum     += score;
      if (fir?.status === 'Pending') ow.pendingFIRs += 1;
      if (health.criticalItems > 0)  ow.criticalFIRs += 1;
      ow.overdueTasks += ctx.overdueItems.length;
      ow.pendingCS    += ctx.karyvahi.all.filter(
        (k) => k.name.toLowerCase().includes('charge') && k.is_completed === 0
      ).length;
      ow.courtDeadlines += ctx.courtDocs.filter((d) => {
        if (!d.deadline_date) return false;
        const days = Math.ceil((new Date(d.deadline_date).getTime() - Date.now()) / 86_400_000);
        return days >= 0 && days <= 7;
      }).length;
      officerMap.set(officerName, ow);

      // Crime trends
      const ct = fir?.crime_type ?? 'Unknown';
      crimeTypeMap.set(ct, (crimeTypeMap.get(ct) ?? 0) + 1);

      // Critical alerts
      if (grade === 'F' && fir?.fir_number) {
        alerts.push(`CRITICAL: FIR ${fir.fir_number} has investigation grade F. Immediate attention required.`);
      }
      if (ctx.overdueItems.length >= 3 && fir?.fir_number) {
        alerts.push(`WARNING: FIR ${fir.fir_number} has ${ctx.overdueItems.length} overdue items.`);
      }
    }

    const avgScore = Math.round(totalScore / total);

    // ── Officer summaries ─────────────────────────────────────────────────────
    const officerSummaries: OfficerIntelligenceSummary[] = Array.from(officerMap.entries())
      .map(([name, ow]) => ({
        officerName:           name,
        totalFIRs:             ow.totalFIRs,
        pendingFIRs:           ow.pendingFIRs,
        criticalFIRs:          ow.criticalFIRs,
        avgInvestigationScore: ow.totalFIRs > 0 ? Math.round(ow.scoreSum / ow.totalFIRs) : 0,
        overdueTaskCount:      ow.overdueTasks,
        pendingChargeSheets:   ow.pendingCS,
        courtDeadlinesThisWeek: ow.courtDeadlines,
      }))
      .sort((a, b) => b.criticalFIRs - a.criticalFIRs);

    // ── Crime trends ──────────────────────────────────────────────────────────
    const crimeTrends: CrimeTrendAnalysis[] = Array.from(crimeTypeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ct, count]) => ({
        crimeType:   ct,
        count,
        percentage:  Math.round((count / total) * 100),
        trend:       'stable' as const,
        hotspotArea: undefined,
      }));

    // ── Station recommendations ───────────────────────────────────────────────
    const recommendations: string[] = [];
    if (gradeDistribution.F > 0) recommendations.push(`${gradeDistribution.F} FIR(s) with grade F — assign experienced officers.`);
    if (overdueInvs > total * 0.3) recommendations.push(`${overdueInvs} investigations have overdue items — schedule review.`);
    if (avgScore < 60) recommendations.push('Station average investigation score is below 60 — conduct training.');
    if (criticalFIRs > 0) recommendations.push(`${criticalFIRs} critical FIR(s) require supervisor review.`);

    return {
      generatedAt:            now,
      stationName:            station,
      totalFIRs:              total,
      pendingFIRs,
      criticalFIRs,
      overdueInvestigations:  overdueInvs,
      avgInvestigationScore:  avgScore,
      gradeDistribution,
      officerSummaries,
      crimeTrends,
      criticalAlerts:         alerts.slice(0, 6),
      stationRecommendations: recommendations,
      isReadOnly:             true,
      summary: `Station: ${station}. ${total} FIR(s) — ${pendingFIRs} pending, ${criticalFIRs} critical, avg score ${avgScore}/100 (${gradeFromScore(avgScore)}).`,
    };
  }
}

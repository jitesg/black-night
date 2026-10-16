/**
 * MultiFIRIntelligenceEngine.ts
 * Analyzes all FIRs in the station to generate station-wide insights.
 * Consumes InvestigationContext[] — no direct DB access.
 *
 * SAFETY: Read-only advisory. Never modifies investigation records.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  MultiFIRIntelligenceReport,
  FIRSummaryItem,
  OfficerWorkloadItem,
  CrimeTrendItem,
  StationMetrics,
  TrendDirection,
} from './L5Types';

const MS_PER_DAY = 86_400_000;

function daysSince(ts?: number | string): number {
  if (!ts) return 0;
  const t = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

function lastCaseDiaryDate(ctx: InvestigationContext): string | undefined {
  if (!ctx.caseDiaries.length) return undefined;
  const sorted = [...ctx.caseDiaries].sort(
    (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
  );
  const ts = sorted[0]?.created_at;
  return ts ? new Date(ts).toISOString().split('T')[0] : undefined;
}

function hasPendingMedical(ctx: InvestigationContext): boolean {
  const victimsPresent = !!ctx.fir?.complainant_name;
  // KaryvahiSummary shape: { all, completed, pending, completionPct }
  // We approximate "medical done" by checking if any karyvahi name mentions medical
  const medDone = ctx.karyvahi.completed.some(
    (k) => k.name.toLowerCase().includes('medical') || k.name.toLowerCase().includes('doctor')
  );
  return victimsPresent && !medDone;
}

function hasPendingFSL(ctx: InvestigationContext): boolean {
  // Check if any karyvahi is FSL-related but not yet completed
  const hasFSLTask = ctx.karyvahi.all.some(
    (k) => k.name.toLowerCase().includes('fsl') || k.name.toLowerCase().includes('forensic')
  );
  const fslDone = ctx.karyvahi.completed.some(
    (k) => k.name.toLowerCase().includes('fsl') || k.name.toLowerCase().includes('forensic')
  );
  return hasFSLTask && !fslDone;
}

function hasPendingCourtAction(ctx: InvestigationContext): boolean {
  return ctx.courtDocs.some((d) => !!d.deadline_date);
}

function hasDefaultBailRisk(ctx: InvestigationContext): boolean {
  return ctx.overdueItems.some(
    (o) => o.module.toLowerCase().includes('bail') || o.title.toLowerCase().includes('bail')
  );
}

function hasChargeSheetRisk(ctx: InvestigationContext): boolean {
  return ctx.overdueItems.some(
    (o) => o.module.toLowerCase().includes('charge') || o.title.toLowerCase().includes('charge sheet')
  );
}

function buildFIRSummary(ctx: InvestigationContext): FIRSummaryItem {
  const fir = ctx.fir;
  const lastCD = lastCaseDiaryDate(ctx);
  const daysSinceCD = lastCD ? daysSince(lastCD) : undefined;

  // CaseHealth: { score, grade, label, criticalItems, ... } — use criticalItems
  const criticalAlertCount = ctx.caseHealth?.criticalItems ?? 0;

  return {
    firId: fir?.id ?? 'unknown',
    firNumber: fir?.fir_number ?? '—',
    crimeType: fir?.crime_type ?? '—',
    section: fir?.section ?? '—',
    daysSinceRegistration: daysSince(fir?.created_at),
    status: fir?.status ?? 'Pending',
    officerName: ctx.officer?.name ?? '—',
    criticalAlertCount,
    hasDefaultBailRisk: hasDefaultBailRisk(ctx),
    hasChargeSheetRisk: hasChargeSheetRisk(ctx),
    hasPendingMedical: hasPendingMedical(ctx),
    hasPendingFSL: hasPendingFSL(ctx),
    hasPendingCourtAction: hasPendingCourtAction(ctx),
    lastCaseDiaryDate: lastCD,
    daysSinceCaseDiary: daysSinceCD,
  };
}

export class MultiFIRIntelligenceEngine {
  /**
   * Analyze a list of InvestigationContexts (one per FIR) and produce
   * a station-wide intelligence report.
   */
  static analyze(
    allContexts: InvestigationContext[],
    stationName = 'Station'
  ): MultiFIRIntelligenceReport {
    const summaries = allContexts.map(buildFIRSummary);
    const pending   = summaries.filter((s) => s.status === 'Pending');

    // ── Metrics ────────────────────────────────────────────────────────────────
    const metrics: StationMetrics = {
      totalFIRs:              summaries.length,
      pendingFIRs:            pending.length,
      finishedFIRs:           summaries.filter((s) => s.status === 'Finished').length,
      avgHealthScore:         Math.round(
        summaries.reduce((a, s) => a + (s.healthScore ?? 60), 0) / Math.max(summaries.length, 1)
      ),
      criticalFIRCount:       summaries.filter((s) => s.criticalAlertCount > 0).length,
      defaultBailRiskCount:   summaries.filter((s) => s.hasDefaultBailRisk).length,
      chargeSheetOverdueCount: summaries.filter((s) => s.hasChargeSheetRisk).length,
      pendingMedicalCount:    summaries.filter((s) => s.hasPendingMedical).length,
      pendingFSLCount:        summaries.filter((s) => s.hasPendingFSL).length,
      overdueCaseDiaryCount:  summaries.filter(
        (s) => s.daysSinceCaseDiary !== undefined && s.daysSinceCaseDiary > 7
      ).length,
      courtDeadlineCount:     summaries.filter((s) => s.hasPendingCourtAction).length,
    };

    // ── Top-N lists ────────────────────────────────────────────────────────────
    const top = (arr: FIRSummaryItem[], n = 5) => arr.slice(0, n);

    const oldestInvestigations = top(
      [...pending].sort((a, b) => b.daysSinceRegistration - a.daysSinceRegistration)
    );

    const pendingChargeSheets = top(
      pending.filter((s) => s.hasChargeSheetRisk)
        .sort((a, b) => b.daysSinceRegistration - a.daysSinceRegistration)
    );

    const defaultBailRisks = top(
      pending.filter((s) => s.hasDefaultBailRisk)
    );

    const pendingMedicalReports = top(
      pending.filter((s) => s.hasPendingMedical)
    );

    const pendingFSLReports = top(
      pending.filter((s) => s.hasPendingFSL)
    );

    const overdueCaseDiaries = top(
      pending
        .filter((s) => s.daysSinceCaseDiary !== undefined && s.daysSinceCaseDiary > 7)
        .sort((a, b) => (b.daysSinceCaseDiary ?? 0) - (a.daysSinceCaseDiary ?? 0))
    );

    const highPriorityFIRs = top(
      pending
        .filter((s) => s.criticalAlertCount > 0 || s.hasDefaultBailRisk || s.hasChargeSheetRisk)
        .sort((a, b) => b.criticalAlertCount - a.criticalAlertCount)
    );

    // ── Officer workload ───────────────────────────────────────────────────────
    const workloadMap = new Map<string, OfficerWorkloadItem>();
    for (const s of summaries) {
      const name = s.officerName;
      if (!workloadMap.has(name)) {
        workloadMap.set(name, {
          officerName: name,
          totalFIRs: 0,
          pendingFIRs: 0,
          criticalFIRs: 0,
          overdueTaskCount: 0,
          avgHealthScore: 60,
        });
      }
      const w = workloadMap.get(name)!;
      w.totalFIRs += 1;
      if (s.status === 'Pending') w.pendingFIRs += 1;
      if (s.criticalAlertCount > 0) w.criticalFIRs += 1;
    }
    const officerWorkload = [...workloadMap.values()].sort(
      (a, b) => b.pendingFIRs - a.pendingFIRs
    );

    // ── Crime trends ────────────────────────────────────────────────────────────
    const crimeMap = new Map<string, number>();
    for (const s of summaries) {
      crimeMap.set(s.crimeType, (crimeMap.get(s.crimeType) ?? 0) + 1);
    }
    const total = summaries.length || 1;
    const crimeTrends: CrimeTrendItem[] = [...crimeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([crimeType, count]) => ({
        crimeType,
        count,
        percentage: Math.round((count / total) * 100),
        trend: 'stable' as TrendDirection,
      }));

    // ── Summary ─────────────────────────────────────────────────────────────────
    const summary =
      `Station has ${metrics.totalFIRs} FIRs (${metrics.pendingFIRs} pending). ` +
      `${metrics.criticalFIRCount} critical. ` +
      `${metrics.defaultBailRiskCount} default bail risk(s). ` +
      `${metrics.chargeSheetOverdueCount} charge sheet overdue. ` +
      `Top crime: ${crimeTrends[0]?.crimeType ?? '—'}.`;

    return {
      generatedAt: new Date().toISOString(),
      stationName,
      metrics,
      oldestInvestigations,
      pendingChargeSheets,
      defaultBailRisks,
      pendingMedicalReports,
      pendingFSLReports,
      officerWorkload,
      crimeTrends,
      highPriorityFIRs,
      overdueCaseDiaries,
      summary,
    };
  }
}

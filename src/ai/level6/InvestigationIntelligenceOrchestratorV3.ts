/**
 * InvestigationIntelligenceOrchestratorV3.ts
 * Level-6 master orchestrator.
 *
 * Runs all 14 Level-6 engines using Promise.allSettled for maximum parallelism.
 * Reuses cached InvestigationContext. No direct SQLite access.
 * No duplicate repository calls. Advisory only — never writes.
 *
 * SAFETY: Read-only. Never writes to any repository or database.
 */

import { ContinuousMonitorEngine }    from './ContinuousMonitorEngine';
import { EventDrivenIntelligenceEngine } from './EventDrivenIntelligenceEngine';
import { TimelineReplayEngine }        from './TimelineReplayEngine';
import { RiskHeatmapEngine }           from './RiskHeatmapEngine';
import { SmartReminderEngine }         from './SmartReminderEngine';
import { DependencyGraphEngine }       from './DependencyGraphEngine';
import { OfficerDecisionAssistant }    from './OfficerDecisionAssistant';
import { ExplainableAIEngine }         from './ExplainableAIEngine';
import { ReadinessDashboardEngine }    from './ReadinessDashboardEngine';
import { MultiFIRLinkerEngine }        from './MultiFIRLinkerEngine';
import { KnowledgeLearningEngine }     from './KnowledgeLearningEngine';
import { PredictiveStepEngine }        from './PredictiveStepEngine';
import { SupervisorViewEngine }        from './SupervisorViewEngine';
import { AuditTransparencyEngine }     from './AuditTransparencyEngine';

import type { InvestigationContext }   from '../InvestigationContext';
import type { Level6IntelligenceReport } from './L6Types';

// ── 5-minute cache ────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  report:      Level6IntelligenceReport;
  cachedAt:    number;
  firId?:      string;
  sessionId:   string;
}

let cache: CacheEntry | null = null;

function isCacheValid(firId?: string, sessionId?: string): boolean {
  if (!cache) return false;
  if (cache.firId !== firId)       return false;
  if (sessionId && cache.sessionId !== sessionId) return false;
  return (Date.now() - cache.cachedAt) < CACHE_TTL_MS;
}

function unwrap<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

export class InvestigationIntelligenceOrchestratorV3 {
  /** Invalidate cache (e.g. after data change detected). */
  static invalidate(): void {
    cache = null;
  }

  /**
   * Run all 14 Level-6 engines in parallel.
   * allContexts is required for MultiFIRLinker + SupervisorView.
   * stationName is used by SupervisorView.
   */
  static async run(
    ctx:           InvestigationContext,
    allContexts?:  InvestigationContext[],
    stationName?:  string,
    sessionId?:    string
  ): Promise<Level6IntelligenceReport> {
    const sid = sessionId ?? ctx.sessionId ?? 'l6-session';

    // Return cache if still valid
    if (isCacheValid(ctx.activeFirId, sid)) {
      return cache!.report;
    }

    const firId     = ctx.activeFirId;
    const firNumber = ctx.fir?.fir_number;
    const multi     = allContexts ?? [ctx];
    const t0        = Date.now();

    // ── Run all engines in parallel ─────────────────────────────────────────
    const [
      monitorResult,
      eventResult,
      timelineResult,
      heatmapResult,
      reminderResult,
      depGraphResult,
      decisionResult,
      explainResult,
      readinessResult,
      multiFIRResult,
      learningResult,
      predictiveResult,
      supervisorResult,
    ] = await Promise.allSettled([
      Promise.resolve(ContinuousMonitorEngine.record(ctx)),
      Promise.resolve(EventDrivenIntelligenceEngine.analyze(ctx)),
      Promise.resolve(TimelineReplayEngine.analyze(ctx)),
      Promise.resolve(RiskHeatmapEngine.analyze(ctx)),
      Promise.resolve(SmartReminderEngine.analyze(ctx)),
      Promise.resolve(DependencyGraphEngine.analyze(ctx)),
      Promise.resolve(OfficerDecisionAssistant.analyze(ctx)),
      Promise.resolve(ExplainableAIEngine.analyze(ctx)),
      Promise.resolve(ReadinessDashboardEngine.analyze(ctx)),
      Promise.resolve(MultiFIRLinkerEngine.analyze(multi)),
      Promise.resolve(KnowledgeLearningEngine.analyze(ctx)),
      Promise.resolve(PredictiveStepEngine.analyze(ctx)),
      Promise.resolve(SupervisorViewEngine.analyze(multi, stationName)),
    ]);

    const totalMs = Date.now() - t0;

    // ── Unwrap with safe fallbacks ──────────────────────────────────────────
    const monitorReport    = unwrap(monitorResult,    { generatedAt: new Date().toISOString(), firId, lastSnapshot: { firId, capturedAt: new Date().toISOString(), modules: [], contextVersion: 0, changeDetected: false, changedModules: [], triggerReason: 'fallback' }, snapshotHistory: [], totalRebuildCount: 0, lastRebuildAt: new Date().toISOString(), intelligenceIsStale: false, summary: 'Monitor engine unavailable.' });
    const eventReport      = unwrap(eventResult,      { generatedAt: new Date().toISOString(), firId, events: [], criticalEventCount: 0, highEventCount: 0, mostRecentEvent: null, intelligenceRefreshedAt: new Date().toISOString(), summary: 'Event engine unavailable.' });
    const timelineReplayReport = unwrap(timelineResult, { generatedAt: new Date().toISOString(), firId, firNumber, entries: [], gaps: [], nextExpectedEvent: '', delayedInvestigation: false, criticalGaps: 0, totalEntries: 0, totalGaps: 0, investigationDurationDays: 0, summary: 'Timeline engine unavailable.' });
    const riskHeatmapReport = unwrap(heatmapResult,   { generatedAt: new Date().toISOString(), firId, cells: [], overallRiskScore: 0, overallRiskLevel: 'low' as const, criticalCategoryCount: 0, highCategoryCount: 0, topRiskCategory: 'investigation' as const, summary: 'Heatmap engine unavailable.' });
    const reminderReport   = unwrap(reminderResult,   { generatedAt: new Date().toISOString(), firId, reminders: [], overdueCount: 0, dueTodayCount: 0, dueThisWeekCount: 0, criticalCount: 0, topReminder: null, summary: 'Reminder engine unavailable.' });
    const dependencyGraphReport = unwrap(depGraphResult, { generatedAt: new Date().toISOString(), firId, nodes: [], rootNodeId: 'charge-sheet', missingCritical: [], blockingChain: [], completionPct: 0, summary: 'Dependency engine unavailable.' });
    const decisionAssistantReport = unwrap(decisionResult, { generatedAt: new Date().toISOString(), firId, decisions: [], topDecision: null, criticalCount: 0, summary: 'Decision assistant unavailable.' });
    const explainableAIReport = unwrap(explainResult, { generatedAt: new Date().toISOString(), firId, recommendations: [], totalRecommendations: 0, allExplained: true, summary: 'Explainable AI engine unavailable.' });
    const readinessReport  = unwrap(readinessResult,  { generatedAt: new Date().toISOString(), firId, firNumber, investigationScore: { label: 'Investigation Score', score: 0, grade: 'F' as const, description: '', items: [], criticalIssues: [] }, compliance: { label: 'Compliance', score: 0, grade: 'F' as const, description: '', items: [], criticalIssues: [] }, evidenceStrength: { label: 'Evidence', score: 0, grade: 'F' as const, description: '', items: [], criticalIssues: [] }, documentation: { label: 'Documentation', score: 0, grade: 'F' as const, description: '', items: [], criticalIssues: [] }, courtReadiness: { label: 'Court', score: 0, grade: 'F' as const, description: '', items: [], criticalIssues: [] }, chargeSheetReadiness: { label: 'Charge Sheet', score: 0, grade: 'F' as const, description: '', items: [], criticalIssues: [] }, timelineHealth: { label: 'Timeline', score: 0, grade: 'F' as const, description: '', items: [], criticalIssues: [] }, riskScore: { label: 'Risk', score: 0, grade: 'F' as const, description: '', items: [], criticalIssues: [] }, overallScore: 0, overallGrade: 'F' as const, gradeLabel: '', criticalIssues: [], topRecommendations: [], summary: 'Readiness engine unavailable.' });
    const multiFIRLinkerReport = unwrap(multiFIRResult, { generatedAt: new Date().toISOString(), totalFIRsAnalyzed: multi.length, clusters: [], repeatAccusedCount: 0, repeatWitnessCount: 0, repeatLocationCount: 0, repeatVehicleCount: 0, repeatMobileCount: 0, suspectedSerialCrimeCount: 0, summary: 'Multi-FIR linker unavailable.' });
    const knowledgeLearningReport = unwrap(learningResult, { generatedAt: new Date().toISOString(), frequentLaws: [], frequentFormats: [], frequentQuestions: [], recommendationBoosts: [], isEnabled: false, privacyMode: 'local-only' as const, summary: 'Learning engine unavailable.' });
    const predictiveStepReport = unwrap(predictiveResult, { generatedAt: new Date().toISOString(), firId, likelyNextStep: null, pendingWorkPredictions: [], upcomingDeadlines: [], courtPreparationItems: [], expectedMissingDocuments: [], overallConfidence: 0, summary: 'Predictive step engine unavailable.' });
    const supervisorViewReport = unwrap(supervisorResult, { generatedAt: new Date().toISOString(), stationName: stationName ?? '', totalFIRs: multi.length, pendingFIRs: 0, criticalFIRs: 0, overdueInvestigations: 0, avgInvestigationScore: 0, gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 }, officerSummaries: [], crimeTrends: [], criticalAlerts: [], stationRecommendations: [], isReadOnly: true as const, summary: 'Supervisor engine unavailable.' });

    // ── Record audit entry ──────────────────────────────────────────────────
    AuditTransparencyEngine.record({
      firId,
      module:            'audit-transparency',
      rulesExecuted:     ['l6-continuous-monitor', 'l6-event-intelligence', 'l6-timeline-replay', 'l6-risk-heatmap', 'l6-smart-reminder', 'l6-dependency-graph', 'l6-decision-assistant', 'l6-explainable-ai', 'l6-readiness-dashboard', 'l6-multifir-linker', 'l6-knowledge-learning', 'l6-predictive-step', 'l6-supervisor-view'],
      modulesConsulted:  ['continuous-monitor', 'event-intelligence', 'timeline-replay', 'risk-heatmap', 'smart-reminder', 'dependency-graph', 'decision-assistant', 'explainable-ai', 'readiness-dashboard', 'multifir-linker', 'knowledge-learning', 'predictive-step', 'supervisor-view'],
      recommendationIds: [
        ...decisionAssistantReport.decisions.map((d) => d.id),
        ...explainableAIReport.recommendations.map((r) => r.id),
        ...reminderReport.reminders.map((r) => r.id),
      ],
      sessionId:         sid,
      processingMs:      totalMs,
    });

    const auditReport = AuditTransparencyEngine.getReport(firId);
    const contextVersion = ContinuousMonitorEngine.getVersion();

    // ── Aggregate advisory ─────────────────────────────────────────────────
    const advisory = [
      `Level-6 IDSS — ${totalMs}ms | Grade: ${readinessReport.overallGrade} | Risk: ${riskHeatmapReport.overallRiskLevel.toUpperCase()}`,
      `${eventReport.criticalEventCount} critical event(s) | ${reminderReport.overdueCount} overdue reminder(s)`,
      'Read-only advisory. Officer confirmation required for all actions.',
    ].join('\n');

    const report: Level6IntelligenceReport = {
      id:            `l6-${firId ?? 'station'}-${Date.now()}`,
      generatedAt:   new Date().toISOString(),
      sessionId:     sid,
      firId,
      firNumber,
      contextVersion,
      monitorReport,
      eventReport,
      timelineReplayReport,
      riskHeatmapReport,
      reminderReport,
      dependencyGraphReport,
      decisionAssistantReport,
      explainableAIReport,
      readinessReport,
      multiFIRLinkerReport,
      knowledgeLearningReport,
      predictiveStepReport,
      supervisorViewReport:  multi.length > 1 ? supervisorViewReport : undefined,
      auditReport,
      isOfflineMode:          false,
      contextConfidencePct:   Math.round(ctx.confidence.overallScore),
      advisory,
    };

    cache = { report, cachedAt: Date.now(), firId, sessionId: sid };
    return report;
  }
}

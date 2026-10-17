/**
 * InvestigationIntelligenceEngine.ts
 * Master orchestrator — runs all 11 intelligence engines in parallel,
 * merges outputs into InvestigationIntelligenceReport.
 *
 * Performance: InvestigationContext is built ONCE and shared.
 * Engines run via Promise.allSettled (non-blocking, failure-isolated).
 *
 * SAFETY:
 * - NEVER saves, deletes, approves, rejects, signs or creates records.
 * - Advisory only. Every action requires officer confirmation.
 * - Consumes only InvestigationContext. No direct DB / repository access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  InvestigationIntelligenceReport,
  IntelligenceHealthReport,
  PlaybookValidationReport,
  LegalComplianceReport,
  EvidenceGraphReport,
  ContradictionReport,
  TimelinePredictionReport,
  ChargeSheetReport,
  InvestigationScoreReport,
  RiskPredictionReport,
  SupervisorReport,
  IntelligenceRecommendationReport,
  HealthStatus,
} from './IntelligenceTypes';

import { CrimePlaybookEngine }                from './CrimePlaybookEngine';
import { LegalComplianceEngine }              from './LegalComplianceEngine';
import { EvidenceGraphEngine }                from './EvidenceGraphEngine';
import { ContradictionEngine }                from './ContradictionEngine';
import { TimelinePredictionEngine }           from './TimelinePredictionEngine';
import { ChargeSheetEngine }                  from './ChargeSheetEngine';
import { InvestigationScoreEngine }           from './InvestigationScoreEngine';
import { RiskPredictionEngine }               from './RiskPredictionEngine';
import { SupervisorEngine }                   from './SupervisorEngine';
import { IntelligenceRecommendationEngine }   from './IntelligenceRecommendationEngine';
import { IntelligenceExplanationEngine }      from './IntelligenceExplanationEngine';
import * as Crypto from 'expo-crypto';

// ── Helpers ────────────────────────────────────────────────────────────────────

function unwrap<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function healthStatus(score: number): HealthStatus {
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'pending';
  return 'critical';
}

// ── Default fallback values (type-safe) ────────────────────────────────────────

const DEFAULT_COMPLIANCE: LegalComplianceReport = {
  compliancePct: 0, totalChecks: 0, passedChecks: 0, failedChecks: 0,
  legalRisks: [], missingProcedures: [], criticalCount: 0, highCount: 0,
  summary: 'Compliance engine unavailable.',
};

const DEFAULT_EVIDENCE: EvidenceGraphReport = {
  nodes: [], edges: [], strengthScore: 0, issues: [],
  presentNodeCount: 0, totalNodeCount: 9, orphanCount: 0, brokenLinkCount: 0,
  summary: 'Evidence graph engine unavailable.',
};

const DEFAULT_CONTRADICTIONS: ContradictionReport = {
  totalContradictions: 0, criticalCount: 0, warningCount: 0, infoCount: 0,
  contradictions: [], summary: 'Contradiction engine unavailable.',
};

const DEFAULT_TIMELINE: TimelinePredictionReport = {
  completedItems: [], pendingItems: [], overdueItems: [], predictedNextSteps: [],
  nextLogicalStep: 'Timeline engine unavailable.',
  overdueSummary: '', predictedWorkflow: [], summary: 'Timeline engine unavailable.',
};

const DEFAULT_CHARGESHEET: ChargeSheetReport = {
  readinessPct: 0, totalItems: 0, presentItems: 0,
  criticalBlockers: [], missingItems: [], completedItems: [], nextSteps: [],
  summary: 'Charge sheet engine unavailable.',
};

const DEFAULT_SCORE: InvestigationScoreReport = {
  overallScore: 0, grade: 'F', label: 'Score engine unavailable.',
  investigationQuality: { name: 'Investigation Quality', score: 0, weight: 0.25, grade: 'F', items: [] },
  evidenceStrength:     { name: 'Evidence Strength',     score: 0, weight: 0.20, grade: 'F', items: [] },
  documentation:        { name: 'Documentation',          score: 0, weight: 0.15, grade: 'F', items: [] },
  legalCompliance:      { name: 'Legal Compliance',       score: 0, weight: 0.20, grade: 'F', items: [] },
  courtReadiness:       { name: 'Court Readiness',        score: 0, weight: 0.10, grade: 'F', items: [] },
  timelineDiscipline:   { name: 'Timeline Discipline',    score: 0, weight: 0.10, grade: 'F', items: [] },
  trend: 'unknown', summary: 'Score engine unavailable.',
};

const DEFAULT_RISK: RiskPredictionReport = {
  overallRiskLevel: 'low', risks: [], criticalRiskCount: 0, highRiskCount: 0,
  defaultBailRisk: null, topPriorityRisk: null,
  summary: 'Risk engine unavailable.',
};

const DEFAULT_RECOMMENDATION: IntelligenceRecommendationReport = {
  recommendations: [], topPriority: null, blockingCount: 0, urgentCount: 0,
  summary: 'Recommendation engine unavailable.',
};

// ── Master Engine ─────────────────────────────────────────────────────────────

export class InvestigationIntelligenceEngine {
  /**
   * Run all 11 intelligence engines in parallel against the provided context.
   * Individual engine failures are isolated and do not crash the report.
   */
  static async generate(
    ctx: InvestigationContext,
    sessionId: string
  ): Promise<InvestigationIntelligenceReport> {
    const id = Crypto.randomUUID();
    const generatedAt = new Date().toISOString();

    // ── Parallel execution of all engines ─────────────────────────────────────
    const [
      playbookResult,
      complianceResult,
      evidenceResult,
      contradictionResult,
      timelineResult,
      chargeSheetResult,
      scoreResult,
      riskResult,
      supervisorResult,
      recommendationResult,
    ] = await Promise.allSettled([
      Promise.resolve(CrimePlaybookEngine.evaluate(ctx)),
      Promise.resolve(LegalComplianceEngine.evaluate(ctx)),
      Promise.resolve(EvidenceGraphEngine.evaluate(ctx)),
      Promise.resolve(ContradictionEngine.evaluate(ctx)),
      Promise.resolve(TimelinePredictionEngine.evaluate(ctx)),
      Promise.resolve(ChargeSheetEngine.evaluate(ctx)),
      Promise.resolve(InvestigationScoreEngine.evaluate(ctx)),
      Promise.resolve(RiskPredictionEngine.evaluate(ctx)),
      Promise.resolve(SupervisorEngine.evaluate(ctx)),
      Promise.resolve(IntelligenceRecommendationEngine.evaluate(ctx)),
    ]);

    // ── Unwrap with fallbacks ─────────────────────────────────────────────────
    const playbookReport      = unwrap<PlaybookValidationReport | null>(playbookResult,     null);
    const complianceReport    = unwrap(complianceResult,     DEFAULT_COMPLIANCE);
    const evidenceGraphReport = unwrap(evidenceResult,       DEFAULT_EVIDENCE);
    const contradictionReport = unwrap(contradictionResult,  DEFAULT_CONTRADICTIONS);
    const timelineReport      = unwrap(timelineResult,       DEFAULT_TIMELINE);
    const chargeSheetReport   = unwrap(chargeSheetResult,    DEFAULT_CHARGESHEET);
    const scoreReport         = unwrap(scoreResult,          DEFAULT_SCORE);
    const riskReport          = unwrap(riskResult,           DEFAULT_RISK);
    const supervisorReport    = unwrap<SupervisorReport | null>(supervisorResult, null);
    const rawRecommendations  = unwrap(recommendationResult, DEFAULT_RECOMMENDATION);

    // ── Enrich recommendations with full explainability ────────────────────────
    const enrichedRecs = IntelligenceExplanationEngine.enrichRecommendations(
      rawRecommendations.recommendations,
      ctx
    );
    const recommendationReport: IntelligenceRecommendationReport = {
      ...rawRecommendations,
      recommendations: enrichedRecs,
    };

    // ── Build critical issues list ────────────────────────────────────────────
    const criticalIssues: string[] = [
      ...complianceReport.legalRisks
        .filter((r) => r.severity === 'critical')
        .map((r) => r.ruleTitle),
      ...contradictionReport.contradictions
        .filter((c) => c.type === 'critical')
        .map((c) => c.title),
      ...(riskReport.defaultBailRisk ? [riskReport.defaultBailRisk.title] : []),
      ...chargeSheetReport.criticalBlockers.slice(0, 3).map((b) => b.title),
    ].slice(0, 8);

    // ── Build pending work list ───────────────────────────────────────────────
    const pendingWork: string[] = [
      ...timelineReport.overdueItems.slice(0, 3).map((i) => i.title),
      ...timelineReport.pendingItems.slice(0, 3).map((i) => i.title),
    ].slice(0, 6);

    // ── Health report ─────────────────────────────────────────────────────────
    const overallScore = scoreReport.overallScore;
    const grade        = scoreReport.grade;

    const executiveSummary = IntelligenceExplanationEngine.generateExecutiveSummary({
      firNumber:           ctx.fir?.fir_number,
      crimeType:           ctx.fir?.crime_type,
      overallScore,
      grade,
      criticalIssues,
      pendingWork,
      chargeSheetPct:      chargeSheetReport.readinessPct,
      compliancePct:       complianceReport.compliancePct,
      evidenceScore:       evidenceGraphReport.strengthScore,
      topRecommendation:   recommendationReport.topPriority?.title ?? null,
    });

    const advisory = IntelligenceExplanationEngine.generateAdvisory(recommendationReport);

    const evidenceStatus =
      evidenceGraphReport.strengthScore >= 70
        ? '✅ Evidence chain strong'
        : evidenceGraphReport.strengthScore >= 40
          ? '🟡 Evidence chain partially established'
          : '🔴 Evidence chain weak or broken';

    const today = new Date().toISOString().split('T')[0];
    const nextCourtDate = ctx.courtDocs
      .filter((d) => d.status === 'Pending' && d.deadline_date >= today)
      .map((d) => d.deadline_date)
      .sort()[0];
    const courtStatus = nextCourtDate
      ? `Next court date: ${nextCourtDate}`
      : 'No upcoming court deadlines';

    const healthReport: IntelligenceHealthReport = {
      generatedAt,
      firId:            ctx.fir?.id,
      firNumber:        ctx.fir?.fir_number,
      officerName:      ctx.officer.name,
      policeStation:    ctx.officer.policeStation,
      executiveSummary,
      overallHealthScore:  overallScore,
      grade,
      healthStatus:     healthStatus(overallScore),
      criticalIssues,
      pendingWork,
      evidenceStatus,
      courtStatus,
      chargeSheetReadinessPct: chargeSheetReport.readinessPct,
      legalRiskCount:   complianceReport.legalRisks.length,
      recommendedNextActions: enrichedRecs.slice(0, 5),
      advisory,
    };

    return {
      id,
      generatedAt,
      sessionId,
      firId:       ctx.fir?.id,
      firNumber:   ctx.fir?.fir_number,
      offlineMode: false,

      playbookReport,
      complianceReport,
      evidenceGraphReport,
      contradictionReport,
      timelineReport,
      chargeSheetReport,
      scoreReport,
      riskReport,
      supervisorReport,
      recommendationReport,

      healthReport,

      contextConfidencePct: ctx.confidence.overallScore,
    };
  }
}

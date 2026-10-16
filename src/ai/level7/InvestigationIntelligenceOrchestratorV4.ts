/**
 * InvestigationIntelligenceOrchestratorV4.ts
 * Level-7 master orchestrator — runs all 12 L7 engines in parallel via Promise.allSettled.
 * Falls back gracefully per engine. Reuses L1–L6 context. No duplicate repository calls.
 *
 * SAFETY: Read-only. Offline-first. No DB writes. No auto-save.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { Level7IntelligenceReport } from './L7Types';

import { RuleEngineStudio }            from './RuleEngineStudio';
import { PolicyVersionManager }        from './PolicyVersionManager';
import { ScenarioSimulator }           from './ScenarioSimulator';
import { EvidenceStrengthEngine }      from './EvidenceStrengthEngine';
import { ChargeSheetValidator }        from './ChargeSheetValidator';
import { CourtReadinessEngine }        from './CourtReadinessEngine';
import { InvestigationKnowledgeGraph } from './InvestigationKnowledgeGraph';
import { NLInvestigationEngine }       from './NLInvestigationEngine';
import { L7ExplainableAIEngine }       from './L7ExplainableAIEngine';
import { InvestigationQualityIndex }   from './InvestigationQualityIndex';
import { SupervisorIntelligenceEngine }from './SupervisorIntelligenceEngine';
import { AILearningLayer }             from './AILearningLayer';
import { L7PerformanceLayer }          from './L7PerformanceLayer';
import { L7AuditEngine }               from './L7AuditEngine';

export class InvestigationIntelligenceOrchestratorV4 {
  /**
   * Run all L7 engines against a single FIR context.
   * Uses smart cache — returns cached result if context version unchanged.
   */
  static async run(
    ctx: InvestigationContext,
    opts?: {
      /** Additional contexts for supervisor analysis */
      supervisorContexts?: InvestigationContext[];
      /** Station name for supervisor report */
      stationName?: string;
      /** Force refresh, bypass cache */
      forceRefresh?: boolean;
    },
  ): Promise<Level7IntelligenceReport> {
    const firId      = ctx.activeFirId ?? 'unknown';
    const ctxVersion = L7PerformanceLayer.contextVersion(ctx);
    const startMs    = Date.now();

    // ── Cache check ────────────────────────────────────────────────────────────
    if (!opts?.forceRefresh) {
      const cached = L7PerformanceLayer.getCached(firId, ctxVersion);
      if (cached) {
        L7AuditEngine.log('L7_CACHE_HIT', { firId });
        return cached;
      }
    }
    L7AuditEngine.log('L7_CACHE_MISS', { firId });

    // ── Run all engines in parallel ────────────────────────────────────────────
    const { results, errors } = await L7PerformanceLayer.runParallel([
      { id: 'ruleEngine',    fn: () => RuleEngineStudio.evaluate(ctx)         },
      { id: 'scenario',      fn: () => ScenarioSimulator.analyzeAll(ctx)       },
      { id: 'evidence',      fn: () => EvidenceStrengthEngine.analyze(ctx)     },
      { id: 'chargeSheet',   fn: () => ChargeSheetValidator.validate(ctx)      },
      { id: 'courtReadiness',fn: () => CourtReadinessEngine.analyze(ctx)       },
      { id: 'knowledgeGraph',fn: () => InvestigationKnowledgeGraph.build(ctx)  },
      { id: 'nlReport',      fn: () => NLInvestigationEngine.generateReport(ctx) },
      { id: 'explainable',   fn: () => L7ExplainableAIEngine.analyze(ctx)      },
      { id: 'policyReport',  fn: () => PolicyVersionManager.generateReport()   },
      { id: 'learningReport',fn: () => AILearningLayer.generateReport(ctx)     },
    ]);

    // Evidence + charge-sheet results feed quality index
    const evidenceReport    = results.get('evidence')       as Awaited<ReturnType<typeof EvidenceStrengthEngine.analyze>>    | undefined;
    const chargeSheetReport = results.get('chargeSheet')    as Awaited<ReturnType<typeof ChargeSheetValidator.validate>>     | undefined;
    const courtReport       = results.get('courtReadiness') as Awaited<ReturnType<typeof CourtReadinessEngine.analyze>>      | undefined;

    const { results: qualityResults, errors: qualityErrors } = await L7PerformanceLayer.runParallel([
      {
        id: 'qualityIndex',
        fn: () => InvestigationQualityIndex.analyze(ctx, evidenceReport, chargeSheetReport, courtReport),
      },
      {
        id: 'supervisor',
        fn: () => SupervisorIntelligenceEngine.analyze(
          opts?.supervisorContexts ?? [ctx],
          opts?.stationName,
        ),
      },
    ]);

    Object.assign(errors, qualityErrors);

    // ── Assemble final report ──────────────────────────────────────────────────
    const report: Level7IntelligenceReport = {
      generatedAt:    new Date().toISOString(),
      firId,
      contextVersion: ctxVersion,
      processingMs:   Date.now() - startMs,

      ruleEngineReport:     (results.get('ruleEngine')       as Level7IntelligenceReport['ruleEngineReport'])     ?? fallback_ruleEngine(),
      scenarioReport:       (results.get('scenario')         as Level7IntelligenceReport['scenarioReport'])       ?? fallback_scenario(firId),
      evidenceReport:       evidenceReport                                                                         ?? fallback_evidence(firId),
      chargeSheetReport:    chargeSheetReport                                                                      ?? fallback_chargeSheet(firId),
      courtReadinessReport: courtReport                                                                            ?? fallback_court(firId),
      knowledgeGraphReport: (results.get('knowledgeGraph')   as Level7IntelligenceReport['knowledgeGraphReport']) ?? fallback_graph(firId),
      policyReport:         (results.get('policyReport')     as Level7IntelligenceReport['policyReport'])         ?? fallback_policy(),
      nlReport:             (results.get('nlReport')         as Level7IntelligenceReport['nlReport'])             ?? fallback_nl(firId),
      explainableReport:    (results.get('explainable')      as Level7IntelligenceReport['explainableReport'])    ?? fallback_xai(firId),
      qualityReport:        (qualityResults.get('qualityIndex') as Level7IntelligenceReport['qualityReport'])     ?? fallback_quality(firId),
      supervisorReport:     qualityResults.get('supervisor') as Level7IntelligenceReport['supervisorReport'],
      learningReport:       (results.get('learningReport')   as Level7IntelligenceReport['learningReport'])       ?? fallback_learning(),

      engineErrors: errors,
    };

    // ── Audit & cache ──────────────────────────────────────────────────────────
    L7AuditEngine.log('L7_REPORT_GENERATED', {
      firId,
      detail: `${14 - Object.keys(errors).length}/14 engines succeeded in ${report.processingMs}ms`,
    });
    L7PerformanceLayer.store(firId, ctxVersion, report);

    return report;
  }
}

// ── Minimal fallback factories ────────────────────────────────────────────────

function fallback_ruleEngine(): Level7IntelligenceReport['ruleEngineReport'] {
  return {
    generatedAt: new Date().toISOString(),
    totalRules: 0, enabledRules: 0, firedRules: 0, passedRules: 0,
    rulesByCategory: {} as never, violations: [], passed: [], overallCompliance: 0,
  };
}
function fallback_scenario(firId: string): Level7IntelligenceReport['scenarioReport'] {
  return { generatedAt: new Date().toISOString(), firId, scenarios: [], results: [] };
}
function fallback_evidence(firId: string): Level7IntelligenceReport['evidenceReport'] {
  return {
    generatedAt: new Date().toISOString(), firId,
    allegations: [], overallScore: 0, overallGrade: 'F',
    weakEvidence: [], missingEvidence: [], contradictions: [], recommendations: [],
  };
}
function fallback_chargeSheet(firId: string): Level7IntelligenceReport['chargeSheetReport'] {
  return {
    generatedAt: new Date().toISOString(), firId,
    readyState: 'Not Ready', overallScore: 0, checks: [],
    missingItems: [], criticalMissing: [], recommendations: [], estimatedDaysToReady: 0,
  };
}
function fallback_court(firId: string): Level7IntelligenceReport['courtReadinessReport'] {
  return {
    generatedAt: new Date().toISOString(), firId,
    readyState: 'Not Ready', score: 0, checklist: [],
    pendingDocs: [], warrants: [], summons: [], criticalIssues: [], recommendations: [],
  };
}
function fallback_graph(firId: string): Level7IntelligenceReport['knowledgeGraphReport'] {
  return {
    generatedAt: new Date().toISOString(), firId,
    nodes: [], edges: [], clusters: [], stats: { nodeCount: 0, edgeCount: 0, clusterCount: 0 },
  };
}
function fallback_policy(): Level7IntelligenceReport['policyReport'] {
  return {
    generatedAt: new Date().toISOString(),
    activePacks: [], allPacks: [], latestVersion: '0.0.0', totalRules: 0, enabledRules: 0,
  };
}
function fallback_nl(firId: string): Level7IntelligenceReport['nlReport'] {
  return { generatedAt: new Date().toISOString(), firId, answers: [], suggestedQuestions: [] };
}
function fallback_xai(firId: string): Level7IntelligenceReport['explainableReport'] {
  return {
    generatedAt: new Date().toISOString(), firId,
    recommendations: [], topPriority: null,
    blackBoxRisk: 'Engine unavailable.',
  };
}
function fallback_quality(firId: string): Level7IntelligenceReport['qualityReport'] {
  return {
    generatedAt: new Date().toISOString(), firId,
    investigationScore: 0, evidenceScore: 0, complianceScore: 0,
    documentationScore: 0, timelineScore: 0, courtReadinessScore: 0,
    chargeSheetScore: 0, riskScore: 0, overallScore: 0,
    overallGrade: 'F', trend: 'stable', dimensions: [],
    criticalIssues: [], keyStrengths: [],
  };
}
function fallback_learning(): Level7IntelligenceReport['learningReport'] {
  return {
    generatedAt: new Date().toISOString(),
    topLaws: [], topFormats: [], topKnowledge: [], topQuestions: [], improvementHints: [],
  };
}

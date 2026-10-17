/**
 * ReasoningEngine.ts
 * Master orchestrator for the Enterprise Investigation Reasoning System.
 *
 * Execution order:
 *   1. RuleEngine          — rule-based findings
 *   2. PolicyEngine        — BNSS/CrPC compliance deadline checks
 *   3. ComplianceEngine    — mandatory proceeding checks
 *   4. ConsistencyEngine   — cross-module contradictions + timeline gaps
 *   5. TimelineEngine      — full timeline + gap analysis
 *   6. EvidenceDependencyEngine — dependency graph
 *   7. RiskEngine          — risk categorisation
 *   8. ConfidenceEngine    — per-finding confidence scores
 *   9. ExplanationEngine   — full explanations
 *  10. RecommendationEngine— decision cards
 *  11. HealthEngine        — full health report
 *  12. AuditLog            — immutable audit record
 *
 * SAFETY:
 *   • Read-only. Never writes to any repository.
 *   • AI NEVER makes legal decisions.
 *   • Investigating Officer is always the final decision maker.
 *   • All outputs are advisory only.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { ReasoningReport, Finding, AuditRecord } from './ReasoningTypes';

// Use platform crypto — available in React Native (Hermes) and Node
const randomUUID = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

import { RuleEngine } from './RuleEngine';
import { PolicyEngine } from './PolicyEngine';
import { ComplianceEngine } from './ComplianceEngine';
import { ConsistencyEngine } from './ConsistencyEngine';
import { TimelineEngine } from './TimelineEngine';
import { PlaybookStepEngine } from './PlaybookStepEngine';
import { EvidenceDependencyEngine } from './EvidenceDependencyEngine';
import { RiskEngine } from './RiskEngine';
import { ConfidenceEngine } from './ConfidenceEngine';
import { ExplanationEngine } from './ExplanationEngine';
import { RecommendationEngine } from './RecommendationEngine';
import { HealthEngine } from './HealthEngine';

export { type ReasoningReport } from './ReasoningTypes';

export class ReasoningEngine {
  /**
   * Run the full reasoning pipeline against an InvestigationContext.
   * Returns a complete ReasoningReport.
   *
   * @param ctx   — pre-built InvestigationContext (from InvestigationContextBuilder)
   * @param sessionId — current AI session ID for audit trail
   */
  static run(ctx: InvestigationContext, sessionId: string): ReasoningReport {
    const reportId = randomUUID();
    const generatedAt = new Date().toISOString();

    // ── Stage 1–3: Rule, Policy, Compliance Findings ──────────────────────
    const { findings: ruleFindings, evaluatedCount, firedCount } = RuleEngine.evaluate(ctx);
    const policyFindings = PolicyEngine.evaluate(ctx);
    const complianceFindings = ComplianceEngine.evaluate(ctx);

    // ── Stage 4: Cross-module consistency ────────────────────────────────
    const { findings: consistencyFindings, timelineGaps: consistencyGaps } = ConsistencyEngine.evaluate(ctx);

    // ── Stage 5: Timeline analysis ────────────────────────────────────────
    const { gaps: timelineGaps, findings: timelineFindings } = TimelineEngine.analyze(ctx);

    // ── Playbook Step reasoning ───────────────────────────────────────────
    const playbookFindings = PlaybookStepEngine.evaluate(ctx);

    // Merge all findings
    const allFindings: Finding[] = [
      ...ruleFindings,
      ...policyFindings,
      ...complianceFindings,
      ...consistencyFindings,
      ...timelineFindings,
      ...playbookFindings,
    ];
    // Dedup by ruleId (keep highest severity)
    const dedupedFindings = ReasoningEngine._dedup(allFindings);

    // Merge all timeline gaps
    const allTimelineGaps = [...consistencyGaps, ...timelineGaps];
    const dedupedGaps = ReasoningEngine._dedupGaps(allTimelineGaps);

    // ── Stage 6: Evidence dependency graph ───────────────────────────────
    const dependencyGraph = EvidenceDependencyEngine.build(ctx);

    // ── Stage 7: Risk assessment ─────────────────────────────────────────
    const risks = RiskEngine.assess(dedupedFindings, ctx);

    // ── Stage 8: Confidence scoring (implicit in explanations) ───────────
    // ── Stage 9: Explanations ────────────────────────────────────────────
    const explanationMap = ExplanationEngine.explainAll(dedupedFindings, ctx);
    const confidenceScores = Array.from(explanationMap.values()).map((e) => e.confidence);
    const aggregateConfidence = ConfidenceEngine.aggregate(confidenceScores);

    // ── Stage 10: Decision cards ──────────────────────────────────────────
    const decisionCards = RecommendationEngine.buildDecisionCards(dedupedFindings, risks, ctx);

    // ── Stage 11: Health report ───────────────────────────────────────────
    const healthReport = HealthEngine.compute(ctx, dedupedFindings, dedupedGaps);

    // ── Stage 12: Audit record (immutable, no conversation history) ───────
    const auditRecord: AuditRecord = {
      id: randomUUID(),
      firId: ctx.activeFirId,
      firNumber: ctx.fir?.fir_number,
      sessionId,
      runAt: generatedAt,
      triggeredRuleIds: dedupedFindings.map((f) => f.ruleId),
      findingCount: dedupedFindings.length,
      riskCount: risks.length,
      overallHealthScore: healthReport.overallScore,
      contextConfidenceScore: ctx.confidence.overallScore,
      offlineMode: false,
      summary: ReasoningEngine._auditSummary(ctx, dedupedFindings, healthReport.overallScore),
    };

    // ── Executive summary ─────────────────────────────────────────────────
    const executiveSummary = ReasoningEngine._executiveSummary(ctx, dedupedFindings, risks, healthReport.overallScore, dedupedGaps);
    const nextPriorityAction = decisionCards[0]?.items[0] ?? 'Review investigation status.';

    return {
      id: reportId,
      generatedAt,
      firId: ctx.activeFirId,
      firNumber: ctx.fir?.fir_number,
      sessionId,
      offlineMode: false,
      findings: dedupedFindings,
      risks,
      timelineGaps: dedupedGaps,
      dependencyGraph,
      decisionCards,
      healthReport,
      auditRecord,
      executiveSummary,
      nextPriorityAction,
      contextConfidence: aggregateConfidence,
      rulesEvaluated: evaluatedCount,
      rulesFired: firedCount,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Remove duplicate findings — keep the one with highest severity */
  private static _dedup(findings: Finding[]): Finding[] {
    const seen = new Map<string, Finding>();
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    for (const f of findings) {
      const existing = seen.get(f.ruleId);
      if (!existing || (order[f.severity] ?? 4) < (order[existing.severity] ?? 4)) {
        seen.set(f.ruleId, f);
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
    );
  }

  private static _dedupGaps(gaps: import('./ReasoningTypes').TimelineGap[]): import('./ReasoningTypes').TimelineGap[] {
    const seen = new Set<string>();
    return gaps.filter((g) => {
      const key = `${g.gapType}-${g.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private static _executiveSummary(
    ctx: InvestigationContext,
    findings: Finding[],
    risks: import('./ReasoningTypes').RiskItem[],
    healthScore: number,
    gaps: import('./ReasoningTypes').TimelineGap[]
  ): string {
    const parts: string[] = [];

    if (ctx.fir) {
      parts.push(`**FIR ${ctx.fir.fir_number}** | ${ctx.fir.crime_type} | Sections: ${ctx.fir.section} | Status: ${ctx.fir.status}`);
    }

    parts.push(`\n**Investigation Health: ${healthScore}/100**`);
    parts.push(`${findings.filter((f) => f.severity === 'critical').length} critical, ${findings.filter((f) => f.severity === 'high').length} high, ${findings.filter((f) => f.severity === 'medium').length} medium findings.`);

    if (risks.filter((r) => r.level === 'critical').length > 0) {
      parts.push(`\n🔴 **Critical Risks:** ${risks.filter((r) => r.level === 'critical').map((r) => r.title).join(', ')}`);
    }

    if (gaps.filter((g) => g.severity === 'critical').length > 0) {
      parts.push(`\n⚠️ **Timeline Issues:** ${gaps.filter((g) => g.severity === 'critical').map((g) => g.title).join(', ')}`);
    }

    parts.push(`\n_All recommendations are advisory. The Investigating Officer remains fully responsible for all legal and operational decisions._`);

    return parts.join('\n');
  }

  private static _auditSummary(
    ctx: InvestigationContext,
    findings: Finding[],
    healthScore: number
  ): string {
    return `Reasoning run for FIR ${ctx.fir?.fir_number ?? 'N/A'}. Health: ${healthScore}/100. ${findings.length} finding(s). Critical: ${findings.filter((f) => f.severity === 'critical').length}. Context confidence: ${ctx.confidence.overallScore}%.`;
  }
}

/**
 * InvestigationIntelligenceOrchestratorV2.ts
 * Level-5 master orchestrator. Runs all new modules in parallel via
 * Promise.allSettled, merges outputs into Level5IntelligenceReport.
 *
 * Consumes InvestigationContext only — no direct DB access.
 * Reuses cached L4 InvestigationIntelligenceReport when available.
 *
 * SAFETY: Read-only advisory. Never modifies investigation records.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { Level5IntelligenceReport } from './L5Types';

import { InvestigationMemoryEngine }  from './InvestigationMemoryEngine';
import { PredictiveInvestigationEngine } from './PredictiveInvestigationEngine';
import { InvestigationKnowledgeGraph }   from './InvestigationKnowledgeGraph';
import { AIAuditEngine }                 from './AIAuditEngine';
import { AIProviderManager }             from './AIProviderManager';
import { MultiFIRIntelligenceEngine }    from './MultiFIRIntelligenceEngine';

// ── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, { report: Level5IntelligenceReport; ts: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(ctx: InvestigationContext): string {
  return `${ctx.fir?.id ?? 'no-fir'}:${ctx.builtAt}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function uid(): string {
  return `l5-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class InvestigationIntelligenceOrchestratorV2 {
  /**
   * Run all Level-5 modules in parallel for a single FIR context.
   * Pass `allContexts` to also generate Multi-FIR station-wide insights.
   */
  static async run(
    ctx: InvestigationContext,
    allContexts?: InvestigationContext[],
    stationName = 'Station'
  ): Promise<Level5IntelligenceReport> {
    // ── Cache hit ────────────────────────────────────────────────────────────
    const key     = cacheKey(ctx);
    const cached  = cache.get(key);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.report;

    const sessionId = ctx.sessionId ?? uid();
    const firId     = ctx.fir?.id;
    const firNumber = ctx.fir?.fir_number;

    // ── Parallel execution ────────────────────────────────────────────────────
    const [
      memoryResult,
      predictiveResult,
      graphResult,
      auditResult,
      multiFIRResult,
    ] = await Promise.allSettled([
      // 1. Investigation Memory (sync, wrap in promise)
      Promise.resolve(InvestigationMemoryEngine.evaluate(ctx)),
      // 2. Predictive Investigation
      Promise.resolve(PredictiveInvestigationEngine.analyze(ctx)),
      // 3. Knowledge Graph
      Promise.resolve(InvestigationKnowledgeGraph.build(ctx)),
      // 4. AI Audit Report
      Promise.resolve(AIAuditEngine.buildReport({ firId })),
      // 5. Multi-FIR (only when all contexts provided)
      allContexts && allContexts.length > 0
        ? Promise.resolve(MultiFIRIntelligenceEngine.analyze(allContexts, stationName))
        : Promise.resolve(null),
    ]);

    // ── Defaults ──────────────────────────────────────────────────────────────
    const emptyPredictive = PredictiveInvestigationEngine.analyze(ctx);
    const emptyGraph      = InvestigationKnowledgeGraph.build(ctx);

    const memoryReport    = settled(memoryResult,   InvestigationMemoryEngine.evaluate(ctx));
    const predictiveReport = settled(predictiveResult, emptyPredictive);
    const knowledgeGraphReport = settled(graphResult, emptyGraph);
    const auditReport     = settled(auditResult,    AIAuditEngine.buildReport());
    const multiFIRReport  = settled(multiFIRResult, null) ?? undefined;

    // ── Provider used ─────────────────────────────────────────────────────────
    const providerUsed = AIProviderManager.getDefaultProvider().type;

    // ── Advisory ─────────────────────────────────────────────────────────────
    const advisory =
      '⚖️ AI Level-5 advisory. All recommendations require explicit officer confirmation. ' +
      'AI never saves, deletes, or modifies investigation records.';

    const report: Level5IntelligenceReport = {
      id:                   uid(),
      generatedAt:          new Date().toISOString(),
      sessionId,
      firId,
      firNumber,
      memoryReport,
      predictiveReport,
      knowledgeGraphReport,
      multiFIRReport,
      auditReport,
      providerUsed,
      contextConfidencePct: Math.round((ctx.confidence?.overallScore ?? 70)),
      isOfflineMode:        !AIProviderManager.hasOnlineProvider(),
      advisory,
    };

    cache.set(key, { report, ts: Date.now() });
    return report;
  }

  /** Invalidate cache for a FIR (e.g. after data changes). */
  static invalidate(firId: string): void {
    for (const [k] of cache) {
      if (k.startsWith(firId)) cache.delete(k);
    }
  }
}

/**
 * RuleEngine.ts
 * Evaluates all applicable InvestigationRules against a fully-built
 * InvestigationContext and produces a list of Findings.
 *
 * SAFETY: Read-only. No DB access. No writes. Pure analysis.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { Finding } from './ReasoningTypes';
import { INVESTIGATION_RULES, getApplicableRules } from './rules';
import type { InvestigationRule } from './ReasoningTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the karyvahi list contains a completed item matching any pattern */
function hasCompletedKaryvahi(ctx: InvestigationContext, patterns: string[]): boolean {
  return ctx.karyvahi.completed.some((k) =>
    patterns.some((p) => k.name.toLowerCase().includes(p.toLowerCase()))
  );
}

/** Returns true if ANY karyvahi (completed or pending) matches any pattern */
function hasPresentKaryvahi(ctx: InvestigationContext, patterns: string[]): boolean {
  return ctx.karyvahi.all.some((k) =>
    patterns.some((p) => k.name.toLowerCase().includes(p.toLowerCase()))
  );
}

/** Returns true if case diary has at least one entry */
function hasCaseDiary(ctx: InvestigationContext): boolean {
  return ctx.caseDiaries.length > 0;
}

/** Returns true if court docs contain any of the required doc types */
function hasCourtDocType(ctx: InvestigationContext, types: string[]): boolean {
  return ctx.courtDocs.some((d) =>
    types.some((t) => d.doc_type?.toLowerCase().includes(t.toLowerCase()))
  );
}

// ── Core evaluator ────────────────────────────────────────────────────────────

export class RuleEngine {
  private static _idCounter = 0;

  private static newId(): string {
    return `finding-${Date.now()}-${++RuleEngine._idCounter}`;
  }

  /**
   * Evaluate all rules against the context.
   * Returns only the rules that FIRED (i.e. violations / gaps detected).
   */
  static evaluate(ctx: InvestigationContext): {
    findings: Finding[];
    evaluatedCount: number;
    firedCount: number;
  } {
    RuleEngine._idCounter = 0;
    const { fir } = ctx;

    // Determine which rules to evaluate
    const rulesToCheck = fir
      ? getApplicableRules(fir.crime_type ?? '', fir.section ?? '')
      : INVESTIGATION_RULES.filter((r) => !r.onlyWhenPending);

    const findings: Finding[] = [];
    const now = new Date().toISOString();

    for (const rule of rulesToCheck) {
      // Gate: only-when-pending
      if (rule.onlyWhenPending && fir?.status !== 'Pending') continue;

      // Gate: FIR must be present for FIR-specific rules
      if ((rule.requiredProceedingsPresent || rule.requiredProceedingsCompleted) && !fir) continue;

      let fired = false;

      // Check 1: Required proceedings must be PRESENT
      if (rule.requiredProceedingsPresent) {
        const present = hasPresentKaryvahi(ctx, rule.requiredProceedingsPresent);
        if (!present) fired = true;
      }

      // Check 2: Required proceedings must be COMPLETED
      if (!fired && rule.requiredProceedingsCompleted) {
        const completed = hasCompletedKaryvahi(ctx, rule.requiredProceedingsCompleted);
        if (!completed) fired = true;
      }

      // Check 3: Case diary required
      if (!fired && rule.requiresCaseDiary) {
        if (!hasCaseDiary(ctx)) fired = true;
      }

      // Check 4: Required court doc types
      if (!fired && rule.requiredCourtDocTypes) {
        // Rule fires if there are court docs but NONE match required types
        if (ctx.courtDocs.length > 0 && !hasCourtDocType(ctx, rule.requiredCourtDocTypes)) {
          fired = true;
        }
      }

      if (fired) {
        findings.push({
          id: RuleEngine.newId(),
          ruleId: rule.id,
          ruleTitle: rule.title,
          severity: rule.severity,
          title: rule.title,
          detail: rule.description,
          recommendation: rule.recommendation,
          modulesAnalysed: rule.modulesAnalysed,
          legalReference: rule.legalReference,
          generatedAt: now,
        });
      }
    }

    // Sort: critical → high → medium → low → info
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    findings.sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));

    return { findings, evaluatedCount: rulesToCheck.length, firedCount: findings.length };
  }
}

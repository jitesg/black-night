/**
 * RiskEngine.ts
 * Categorises investigation findings into risk items.
 * Each risk item has: level, title, reason, impact, recommendation, confidence.
 *
 * Severity mapping:  critical → critical, high → high, medium → medium, low → low
 *
 * SAFETY: Read-only. No DB access. Pure computation.
 */

import type { Finding, RiskItem, RiskLevel } from './ReasoningTypes';
import type { InvestigationContext } from '../InvestigationContext';
import { nylDaysUntilDeadline } from '@/lib/db/nyayalayRepo';

export class RiskEngine {
  static assess(findings: Finding[], ctx: InvestigationContext): RiskItem[] {
    const risks: RiskItem[] = [];
    let counter = 0;

    // ── Severity → Risk level map ──────────────────────────────────────────
    const toRiskLevel = (s: Finding['severity']): RiskLevel =>
      s === 'critical' ? 'critical' : s === 'high' ? 'high' : s === 'medium' ? 'medium' : 'low';

    // ── Convert high+critical findings → risk items ────────────────────────
    for (const f of findings) {
      if (f.severity === 'info' || f.severity === 'low') continue;
      risks.push({
        id: `risk-${++counter}`,
        level: toRiskLevel(f.severity),
        title: f.title,
        reason: f.detail,
        impact: RiskEngine._impact(f, ctx),
        recommendation: f.recommendation,
        confidence: RiskEngine._confidence(f, ctx),
        findingIds: [f.id],
      });
    }

    // ── Aggregate low-severity findings as a single grouped risk ──────────
    const lowFindings = findings.filter((f) => f.severity === 'low' || f.severity === 'info');
    if (lowFindings.length >= 3) {
      risks.push({
        id: `risk-${++counter}`,
        level: 'low',
        title: `${lowFindings.length} Minor Documentation Gaps`,
        reason: 'Multiple minor inconsistencies detected across modules.',
        impact: 'May affect documentation quality and admissibility of records.',
        recommendation: 'Review and resolve each minor gap to maintain investigation quality.',
        confidence: 70,
        findingIds: lowFindings.map((f) => f.id),
      });
    }

    // ── Synthetic risks from context state ────────────────────────────────

    // Risk: No FIR at all
    if (!ctx.fir) {
      risks.push({
        id: `risk-${++counter}`,
        level: 'critical',
        title: 'No Active FIR',
        reason: 'No FIR is open in the current context.',
        impact: 'All investigation actions are legally invalid without a registered FIR.',
        recommendation: 'Register FIR immediately for the reported offence.',
        confidence: 100,
        findingIds: [],
      });
    }

    // Risk: Court approaching with low health score
    const criticalCourt = ctx.courtDocs.filter((d) => {
      if (!d.deadline_date || d.status === 'Finished') return false;
      return nylDaysUntilDeadline(d.deadline_date, d.status) <= 5;
    });
    if (criticalCourt.length > 0 && ctx.caseHealth.score < 60) {
      risks.push({
        id: `risk-${++counter}`,
        level: 'critical',
        title: 'Court Date Approaching — Investigation Incomplete',
        reason: `${criticalCourt.length} court deadline(s) within 5 days while investigation health is ${ctx.caseHealth.score}%.`,
        impact: 'Inability to present complete investigation may result in adverse court orders.',
        recommendation: 'Immediately complete critical pending actions before court date.',
        confidence: 90,
        findingIds: [],
      });
    }

    // Sort: critical → high → medium → low
    const order: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    risks.sort((a, b) => order[a.level] - order[b.level]);

    return risks;
  }

  private static _impact(f: Finding, _ctx: InvestigationContext): string {
    const impacts: Record<string, string> = {
      'RULE-001': 'Medical evidence may become inadmissible. Prosecution weakened.',
      'RULE-002': 'Witness testimony unavailable for trial. Case may collapse.',
      'RULE-003': 'Scene evidence lost. Reconstruction impossible.',
      'RULE-004': 'Seized evidence may be challenged for improper procedure.',
      'RULE-005': 'Arrest may be declared illegal. Accused could seek bail immediately.',
      'RULE-006': 'Bail conditions unverifiable. Legal exposure for investigating officer.',
      'RULE-007': 'Failure to appear in court. Contempt proceedings possible.',
      'RULE-008': 'Forensic evidence chain incomplete. Admissibility at risk.',
      'RULE-009': 'Arrest/action without notice may be struck down by High Court.',
      'RULE-010': 'Investigation record incomplete. Court may draw adverse inference.',
      'RULE-011': 'Charge sheet delay. Bail by default under BNSS.',
      'POL-001': 'Entire investigation legally invalid without FIR.',
      'POL-002': 'Accused may claim harassment. Investigation credibility damaged.',
      'POL-003': 'Contempt of court. Officer personally liable.',
    };
    return impacts[f.ruleId] ?? 'Investigation integrity and legal outcome may be compromised.';
  }

  private static _confidence(f: Finding, ctx: InvestigationContext): number {
    // Confidence based on data availability
    const dataScore = ctx.confidence.overallScore;
    const base = f.severity === 'critical' ? 90 : f.severity === 'high' ? 80 : 70;
    // Reduce confidence if context data is sparse
    return Math.max(50, Math.round(base * (dataScore / 100) * 0.4 + base * 0.6));
  }
}

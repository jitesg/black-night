/**
 * ConfidenceEngine.ts
 * Computes a ConfidenceScore for any finding or recommendation.
 *
 * Principles:
 * • Never pretend certainty
 * • Always list what evidence supports and what is missing
 * • Provide alternative possibilities when confidence is < 85
 *
 * SAFETY: Read-only. Pure computation.
 */

import type { ConfidenceScore, Finding } from './ReasoningTypes';
import type { InvestigationContext } from '../InvestigationContext';

export class ConfidenceEngine {
  /**
   * Compute a ConfidenceScore for a specific finding in context.
   */
  static scoreFor(finding: Finding, ctx: InvestigationContext): ConfidenceScore {
    const contextScore = ctx.confidence.overallScore; // 0–100

    // Base confidence by severity
    const severityBase: Record<string, number> = {
      critical: 90, high: 80, medium: 70, low: 60, info: 50,
    };
    const base = severityBase[finding.severity] ?? 70;

    // Modulate by how much context data we have
    const dataMultiplier = 0.4 + 0.6 * (contextScore / 100);
    const raw = Math.round(base * dataMultiplier);
    const value = Math.min(95, Math.max(45, raw)); // cap at 95 — never claim 100%

    const evidenceUsed = ConfidenceEngine._evidenceUsed(finding, ctx);
    const missingInformation = ctx.confidence.missingFields.slice(0, 4);
    const alternativePossibilities = value < 85
      ? ConfidenceEngine._alternatives(finding)
      : [];

    const explanation = ConfidenceEngine._explain(finding, value, contextScore, missingInformation);

    return { value, evidenceUsed, missingInformation, alternativePossibilities, explanation };
  }

  /**
   * Aggregate confidence for an entire reasoning report.
   */
  static aggregate(scores: ConfidenceScore[]): number {
    if (scores.length === 0) return 0;
    const avg = scores.reduce((sum, s) => sum + s.value, 0) / scores.length;
    return Math.round(Math.min(95, avg));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private static _evidenceUsed(finding: Finding, ctx: InvestigationContext): string[] {
    const evidence: string[] = [];
    for (const mod of finding.modulesAnalysed) {
      switch (mod) {
        case 'FIR':
          if (ctx.fir) evidence.push(`FIR ${ctx.fir.fir_number} (${ctx.fir.crime_type})`);
          break;
        case 'Karyvahi':
          if (ctx.karyvahi.all.length > 0) {
            evidence.push(`${ctx.karyvahi.all.length} Karyvahi records (${ctx.karyvahi.completed.length} completed)`);
          }
          break;
        case 'CaseDiary':
          if (ctx.caseDiaries.length > 0) evidence.push(`${ctx.caseDiaries.length} Case Diary entries`);
          break;
        case 'Court':
          if (ctx.courtDocs.length > 0) evidence.push(`${ctx.courtDocs.length} Court document(s)`);
          break;
        case 'GD':
          if (ctx.gdEntries.length > 0) evidence.push(`${ctx.gdEntries.length} GD entries`);
          break;
        case 'PrarthnaPatra':
          if (ctx.prarthnaPatra.length > 0) evidence.push(`${ctx.prarthnaPatra.length} Prarthna Patra(s)`);
          break;
        case 'Nirodhatmak':
          if (ctx.nirodhatmak.length > 0) evidence.push(`${ctx.nirodhatmak.length} Nirodhatmak records`);
          break;
        case 'Knowledge':
          if (ctx.relevantKnowledge.length > 0) evidence.push(`${ctx.relevantKnowledge.length} knowledge articles`);
          break;
      }
    }
    return evidence.length > 0 ? evidence : ['Context data from available modules'];
  }

  private static _alternatives(finding: Finding): string[] {
    const altMap: Record<string, string[]> = {
      'RULE-001': [
        'Medical examination may have been conducted but not recorded as Karyvahi.',
        'MLC report may be in the paper file but not digitised.',
      ],
      'RULE-002': [
        'Witness statements may exist in paper case diary but not digitally recorded.',
        'Witnesses may have been contacted but statements not yet recorded.',
      ],
      'RULE-003': [
        'Scene inspection may have been conducted informally without Karyvahi entry.',
      ],
      'RULE-004': [
        'Seizure memo may be in paper file but not entered in the system.',
      ],
      'RULE-005': [
        'Arrest memo may exist physically but not yet uploaded to the system.',
      ],
      'COMP-001': [
        'Investigation may be proceeding informally without digital Karyvahi entries.',
      ],
    };
    return altMap[finding.ruleId] ?? [
      'The required action may have been completed in physical records but not digitised.',
      'There may be a valid operational reason not yet captured in the system.',
    ];
  }

  private static _explain(
    finding: Finding,
    value: number,
    contextScore: number,
    missing: string[]
  ): string {
    const certainty = value >= 85 ? 'high' : value >= 70 ? 'moderate' : 'limited';
    const missingNote = missing.length > 0
      ? ` Some data unavailable: ${missing.slice(0, 2).join(', ')}.`
      : '';
    return `Confidence is ${certainty} (${value}%) based on ${Math.round(contextScore)}% context data availability.${missingNote} The AI analysis is advisory only — the investigating officer should verify all findings.`;
  }
}

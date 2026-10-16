/**
 * ExplanationEngine.ts
 * Generates structured Explanations for every finding/recommendation.
 *
 * Each explanation answers:
 *   • Why this recommendation?
 *   • Which evidence supports it?
 *   • Which rules triggered?
 *   • Which modules were analysed?
 *   • What is the legal basis?
 *   • What is the confidence?
 *
 * SAFETY: Read-only. Pure computation.
 */

import type { Explanation, Finding } from './ReasoningTypes';
import type { InvestigationContext } from '../InvestigationContext';
import { ConfidenceEngine } from './ConfidenceEngine';

export class ExplanationEngine {
  static explain(finding: Finding, ctx: InvestigationContext): Explanation {
    const confidence = ConfidenceEngine.scoreFor(finding, ctx);

    return {
      recommendationId: finding.id,
      whyThisRecommendation: ExplanationEngine._why(finding, ctx),
      supportingEvidence: ExplanationEngine._supportingEvidence(finding, ctx),
      triggeredRules: [finding.ruleId],
      modulesAnalysed: finding.modulesAnalysed,
      legalBasis: finding.legalReference,
      confidence,
    };
  }

  /** Batch: explain all findings at once */
  static explainAll(
    findings: Finding[],
    ctx: InvestigationContext
  ): Map<string, Explanation> {
    const map = new Map<string, Explanation>();
    for (const f of findings) {
      map.set(f.id, ExplanationEngine.explain(f, ctx));
    }
    return map;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private static _why(finding: Finding, ctx: InvestigationContext): string {
    const parts: string[] = [];

    // Rule-specific explanations
    const specificWhy: Record<string, string> = {
      'RULE-001': `The FIR involves ${ctx.fir?.crime_type ?? 'injury-related offences'} which legally require medical evidence. Without it, prosecution may fail at trial.`,
      'RULE-002': `Witness statements are the backbone of criminal prosecution. Without corroborating testimony, the case relies solely on the complainant's account.`,
      'RULE-003': `Crime scene inspection is the first mandatory step of any field investigation. Evidence of the offence must be scientifically documented.`,
      'RULE-004': `Any evidence seized must be documented through a Panchnama in the presence of independent witnesses to establish chain of custody.`,
      'RULE-005': `An arrest without a proper memo violates BNSS Section 47. The arrested person and their family must be formally notified.`,
      'RULE-006': `Bail orders must be on record so that bail conditions can be monitored and violations reported to the court.`,
      'RULE-007': `Police must appear in court with complete records on the scheduled date. Failure constitutes contempt.`,
      'RULE-008': `Forensic evidence links physical clues to the accused. Without FSL reports, scientific evidence cannot be presented.`,
      'RULE-010': `BNSS Section 193 makes daily case diary a statutory obligation. Gaps in the diary weaken the investigation record.`,
      'RULE-011': `BNSS prescribes 60/90 days for filing charge sheet. Delay results in accused getting bail by default.`,
      'COMP-001': `A pending FIR with zero investigation steps suggests the case is not being pursued, which is both legally problematic and unfair to the victim.`,
      'POL-003': `Missing a court deadline exposes the investigating officer to contempt proceedings and may lead to adverse orders.`,
    };

    parts.push(specificWhy[finding.ruleId] ?? finding.detail);

    // Context-specific context
    if (ctx.fir) {
      parts.push(`This applies specifically to FIR ${ctx.fir.fir_number} (${ctx.fir.crime_type}, Sections: ${ctx.fir.section}).`);
    }

    return parts.join(' ');
  }

  private static _supportingEvidence(finding: Finding, ctx: InvestigationContext): string[] {
    const evidence: string[] = [];

    for (const mod of finding.modulesAnalysed) {
      switch (mod) {
        case 'FIR':
          if (ctx.fir) {
            evidence.push(`FIR ${ctx.fir.fir_number}: crime type "${ctx.fir.crime_type}", sections "${ctx.fir.section}", status "${ctx.fir.status}"`);
          } else {
            evidence.push('No active FIR found in context');
          }
          break;
        case 'Karyvahi': {
          const total = ctx.karyvahi.all.length;
          const done = ctx.karyvahi.completed.length;
          evidence.push(`Karyvahi: ${total} total, ${done} completed, ${total - done} pending`);
          // List relevant names
          const rel = ctx.karyvahi.all.filter((k) =>
            finding.modulesAnalysed.includes('Karyvahi')
          ).slice(0, 3);
          if (rel.length > 0) evidence.push(`Recent Karyvahi: ${rel.map((k) => k.name).join(', ')}`);
          break;
        }
        case 'CaseDiary':
          evidence.push(`Case Diary: ${ctx.caseDiaries.length} entries found`);
          if (ctx.caseDiaries.length > 0) {
            const last = ctx.caseDiaries[ctx.caseDiaries.length - 1];
            if (last.preparation_date) evidence.push(`Last entry: ${last.preparation_date}`);
          }
          break;
        case 'Court':
          evidence.push(`Court Documents: ${ctx.courtDocs.length} records`);
          break;
        case 'GD':
          evidence.push(`GD: ${ctx.gdEntries.length} entries`);
          break;
        case 'PrarthnaPatra':
          evidence.push(`Prarthna Patra: ${ctx.prarthnaPatra.length} petitions`);
          break;
        case 'Nirodhatmak':
          evidence.push(`Nirodhatmak: ${ctx.nirodhatmak.length} records`);
          break;
        default:
          evidence.push(`${mod}: data reviewed`);
      }
    }

    // Missing fields note
    if (ctx.confidence.missingFields.length > 0) {
      evidence.push(`Note: Some data unavailable — ${ctx.confidence.missingFields.slice(0, 2).join(', ')}`);
    }

    return evidence;
  }
}

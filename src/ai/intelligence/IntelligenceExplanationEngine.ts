/**
 * IntelligenceExplanationEngine.ts
 * Attaches full explainability metadata to every recommendation.
 * Every recommendation exposes: Reason, Context, Rule, Dependencies,
 * Confidence %, and Expected Outcome.
 *
 * SAFETY: Read-only. No DB access. No writes.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  SmartRecommendation,
  IntelligenceRecommendationReport,
  IntelligenceHealthReport,
  IntelGrade,
} from './IntelligenceTypes';

// ── Explanation templates keyed by action ─────────────────────────────────────

const EXPLANATION_CONTEXT: Record<string, {
  reason: string;
  rule: string;
  outcome: string;
  dependencies: string[];
}> = {
  'file-charge-sheet': {
    reason: 'Charge sheet must be filed within 60/90 days of arrest to prevent default bail under BNSS Section 479.',
    rule: 'BNSS Section 479 — Default Bail on Failure to File Charge Sheet',
    outcome: 'Prevents accused from obtaining default bail. Advances case to trial stage.',
    dependencies: ['FIR Registration', 'Arrest', 'Witness Statements', 'Medical Report', 'Evidence Seizure'],
  },
  'record-witness-statement': {
    reason: 'Witness statements are primary prosecution evidence. Without recorded statements, the case lacks corroboration.',
    rule: 'BNSS Section 180 — Investigation Officer must record statements of persons acquainted with facts.',
    outcome: 'Provides legally admissible corroborating evidence. Strengthens prosecution case.',
    dependencies: ['FIR Registration', 'Scene Inspection'],
  },
  'obtain-medical-report': {
    reason: 'Medical evidence (MLC/Post-Mortem) is mandatory for offences involving bodily injury or death.',
    rule: 'BNSS Section 198 — Medical examination of injured persons is a statutory requirement.',
    outcome: 'Establishes nature and extent of injuries. Critical evidence for charge sheet.',
    dependencies: ['FIR Registration'],
  },
  'collect-cctv': {
    reason: 'CCTV footage provides objective digital evidence of crime occurrence, accused presence, and timeline.',
    rule: 'Digital Evidence Protocol — Collection of available digital evidence is a standard investigation step.',
    outcome: 'Provides objective corroboration. Reduces dependence on witness testimony alone.',
    dependencies: ['FIR Registration', 'Scene Inspection'],
  },
  'prepare-seizure-memo': {
    reason: 'Seized evidence without a Seizure Memo/Panchnama is procedurally defective and may be excluded by court.',
    rule: 'BNSS Section 187 — All seizures must be documented with panchnama in presence of witnesses.',
    outcome: 'Makes seized evidence legally admissible. Protects investigation from procedural challenges.',
    dependencies: ['Scene Inspection'],
  },
  'update-case-diary': {
    reason: 'Case Diary is a statutory record of investigation. Failure to maintain it is a legal violation.',
    rule: 'BNSS Section 193 — Investigating Officer must maintain a Case Diary recording all investigation steps.',
    outcome: 'Fulfils statutory duty. Creates legally admissible investigation record. Avoids court criticism.',
    dependencies: ['FIR Registration'],
  },
  'apply-nbw': {
    reason: 'Accused who cannot be arrested requires NBW from court to secure presence for trial.',
    rule: 'BNSS Section 84 — Court may issue Non-Bailable Warrant for accused who fails to appear.',
    outcome: 'Enables arrest of absconding accused. Allows investigation and trial to proceed.',
    dependencies: ['Court Production'],
  },
  'followup-fsl': {
    reason: 'FSL report provides scientific corroboration of evidence. Pending reports delay charge sheet.',
    rule: 'BNSS Section 349 — Forensic examination of material evidence is mandatory.',
    outcome: 'Scientific backing for evidence claims. Required for strong charge sheet.',
    dependencies: ['Seizure Memo / Panchnama', 'FSL Referral'],
  },
  'conduct-scene-exam': {
    reason: 'Scene inspection is the foundation of physical evidence collection.',
    rule: 'Standard Investigation Procedure — Scene of crime must be inspected immediately after FIR.',
    outcome: 'Identifies and preserves physical clues. Establishes crime scene as evidence.',
    dependencies: ['FIR Registration'],
  },
  'arrest-accused': {
    reason: 'Accused must be arrested with proper documentation to ensure lawful detention.',
    rule: 'BNSS Section 47 — Arrest procedure with memo and intimation to family is mandatory.',
    outcome: 'Secures accused for investigation and trial. Prevents absconding.',
    dependencies: ['FIR Registration', 'Witness Identification'],
  },
  'produce-in-court': {
    reason: 'Every arrested person must be produced before magistrate within 24 hours of arrest.',
    rule: 'BNSS Section 56 — Detention beyond 24 hours without court order is unlawful.',
    outcome: 'Ensures lawful detention. Obtains judicial custody/remand order.',
    dependencies: ['Arrest', 'Arrest Memo'],
  },
  'submit-compliance': {
    reason: 'Court compliance documents must be submitted on due dates to avoid adverse orders.',
    rule: 'BNSS — Court orders are legally binding. Non-compliance may result in contempt.',
    outcome: 'Maintains court compliance. Protects investigation from adverse orders.',
    dependencies: ['Court Production'],
  },
  'other': {
    reason: 'Recommended action based on investigation analysis.',
    rule: 'Standard Investigation Procedure',
    outcome: 'Improves investigation quality and documentation.',
    dependencies: [],
  },
};

export class IntelligenceExplanationEngine {
  /**
   * Enrich each recommendation with its full explainability metadata.
   * Returns a new array — original objects are not mutated.
   */
  static enrichRecommendations(
    recommendations: SmartRecommendation[],
    _ctx: InvestigationContext
  ): SmartRecommendation[] {
    return recommendations.map((rec) => {
      const tmpl = EXPLANATION_CONTEXT[rec.action] ?? EXPLANATION_CONTEXT['other'];
      return {
        ...rec,
        reason:           rec.reason || tmpl.reason,
        applicableRule:   rec.applicableRule || tmpl.rule,
        expectedOutcome:  rec.expectedOutcome || tmpl.outcome,
        dependencies:     rec.dependencies.length > 0 ? rec.dependencies : tmpl.dependencies,
      };
    });
  }

  /** Generate the master health report advisory section */
  static generateAdvisory(report: IntelligenceRecommendationReport): string {
    const lines: string[] = [
      '⚖️ ADVISORY: All recommendations below are for informational and decision-support purposes only.',
      'The AI Engine provides analysis based on available investigation data.',
      'Every action requires explicit confirmation by the Investigating Officer or authorized supervisor.',
      'The AI never saves, deletes, approves, rejects, signs or creates official records automatically.',
      '',
    ];
    if (report.blockingCount > 0) {
      lines.push(`🔴 ${report.blockingCount} blocking action(s) identified that must be resolved before charge sheet can proceed.`);
    }
    if (report.urgentCount > 0) {
      lines.push(`⚡ ${report.urgentCount} urgent action(s) require immediate attention.`);
    }
    return lines.join('\n');
  }

  /** Generate executive summary text from engine outputs */
  static generateExecutiveSummary(params: {
    firNumber: string | undefined;
    crimeType: string | undefined;
    overallScore: number;
    grade: IntelGrade;
    criticalIssues: string[];
    pendingWork: string[];
    chargeSheetPct: number;
    compliancePct: number;
    evidenceScore: number;
    topRecommendation: string | null;
  }): string {
    const {
      firNumber, crimeType, overallScore, grade, criticalIssues,
      chargeSheetPct, compliancePct, evidenceScore, topRecommendation
    } = params;

    const gradeLabel =
      grade === 'A' ? 'Excellent' :
      grade === 'B' ? 'Good'      :
      grade === 'C' ? 'Fair'      :
      grade === 'D' ? 'Poor'      : 'Critical';

    let summary =
      `FIR ${firNumber ?? 'Unknown'} (${crimeType ?? 'Unknown Crime'}): ` +
      `Overall investigation health is ${gradeLabel} (${overallScore}/100). ` +
      `Charge sheet readiness: ${chargeSheetPct}%, ` +
      `Legal compliance: ${compliancePct}%, ` +
      `Evidence strength: ${evidenceScore}/100. `;

    if (criticalIssues.length > 0) {
      summary += `Critical issues: ${criticalIssues.slice(0, 3).join('; ')}. `;
    }

    if (topRecommendation) {
      summary += `Immediate action: ${topRecommendation}.`;
    }

    return summary;
  }
}

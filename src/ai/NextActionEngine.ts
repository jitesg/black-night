/**
 * NextActionEngine.ts
 * Derives the best next investigation step from a fully built InvestigationContext.
 * Pure computation — no async, no DB calls, no side effects.
 */

import type { InvestigationContext, NextAction, CaseHealth } from './InvestigationContext';
import type { AIDraft } from './AITypes';

export interface NextActionReport {
  primaryAction: NextAction | null;
  allActions: NextAction[];
  caseHealth: CaseHealth;
  caseReadiness: CaseReadinessReport;
  investigationSummary: string;
}

export interface CaseReadinessReport {
  readyForChargeSheet: boolean;
  blockers: string[];
  completedMilestones: string[];
  pendingMilestones: string[];
  readinessScore: number;   // 0–100
}

export class NextActionEngine {
  /**
   * Compute the primary next action and full investigation summary.
   * Uses pre-built InvestigationContext — no DB access.
   */
  static analyze(ctx: InvestigationContext): NextActionReport {
    const allActions = ctx.nextActions;
    const primaryAction = allActions.find((a) => a.priority === 'critical')
      ?? allActions.find((a) => a.priority === 'high')
      ?? allActions[0]
      ?? null;

    const caseReadiness = NextActionEngine.assessReadiness(ctx);
    const investigationSummary = NextActionEngine.buildSummary(ctx, caseReadiness);

    return { primaryAction, allActions, caseHealth: ctx.caseHealth, caseReadiness, investigationSummary };
  }

  /** Assess how ready the investigation is for charge sheet / court. */
  static assessReadiness(ctx: InvestigationContext): CaseReadinessReport {
    const blockers: string[] = [];
    const completedMilestones: string[] = [];
    const pendingMilestones: string[] = [];

    const k = ctx.karyvahi;

    // Milestones — check by name pattern
    const milestones: Array<{ label: string; pattern: RegExp }> = [
      { label: 'FIR Registration',         pattern: /fir|mukadma|registration/i },
      { label: 'Complainant Statement',     pattern: /bayan vadi|complainant statement|वादी.*बयान|बयान.*वादी/i },
      { label: 'Crime Scene Inspection',   pattern: /ghatnasthal|scene inspection|घटनास्थल/i },
      { label: 'Witness Statements',       pattern: /gavah|witness|बयान|गवाह/i },
      { label: 'Evidence Collection',      pattern: /evidence|panchnama|seizure|पंचनामा|जब्ती|साक्ष्य/i },
      { label: 'Medical/FSL Reports',      pattern: /medical|fsl|forensic|report/i },
      { label: 'Accused Examination',      pattern: /accused|aaropit|dharasana/i },
      { label: 'Arrest Proceedings',       pattern: /arrest|giraftari/i },
    ];

    // FIR is the baseline
    if (ctx.fir) {
      completedMilestones.push('FIR Registration');
    } else {
      pendingMilestones.push('FIR Registration');
      blockers.push('No FIR is currently open — open a FIR to begin investigation tracking.');
    }

    milestones.slice(1).forEach(({ label, pattern }) => {
      const found = k.all.find((a) => pattern.test(a.name));
      if (found) {
        if (found.is_completed === 1) completedMilestones.push(label);
        else pendingMilestones.push(label);
      }
    });

    // Blockers from health
    ctx.caseHealth.pendingStatements.forEach((s) => blockers.push(`Statement pending: ${s}`));
    ctx.caseHealth.missingEvidence.forEach((e) => blockers.push(`Evidence missing: ${e}`));
    ctx.caseHealth.courtActionsRequired.forEach((c) => blockers.push(`Court action required: ${c}`));

    const readinessScore = ctx.caseHealth.readinessForChargeSheet
      ? 100
      : Math.min(
          Math.round(
            (completedMilestones.length /
              Math.max(completedMilestones.length + pendingMilestones.length, 1)) * 100
          ),
          95
        );

    return {
      readyForChargeSheet: ctx.caseHealth.readinessForChargeSheet,
      blockers,
      completedMilestones,
      pendingMilestones,
      readinessScore,
    };
  }

  /** Build a rich, structured investigation summary paragraph. */
  static buildSummary(ctx: InvestigationContext, readiness: CaseReadinessReport): string {
    const parts: string[] = [];
    const { fir, karyvahi, caseHealth, officer } = ctx;

    // Header
    parts.push(`**Investigation Status Report**`);
    parts.push(`Officer: ${officer.name} | PS: ${officer.policeStation}`);

    if (fir) {
      parts.push(`\n**Case:** FIR ${fir.fir_number} | Crime: ${fir.crime_type} | Sections: ${fir.section}`);
      parts.push(`Complainant: ${fir.complainant_name} | Status: ${fir.status}`);
    }

    // Health
    parts.push(`\n**Investigation Health:** ${caseHealth.score}/100 (Grade ${caseHealth.grade}) — ${caseHealth.label}`);
    parts.push(`Actions: ${caseHealth.completedItems} completed, ${caseHealth.pendingItems} pending, ${caseHealth.criticalItems} critical`);

    // Readiness
    if (readiness.completedMilestones.length > 0) {
      parts.push(`\n✓ **Completed:** ${readiness.completedMilestones.join(', ')}`);
    }
    if (readiness.pendingMilestones.length > 0) {
      parts.push(`🟡 **Pending:** ${readiness.pendingMilestones.join(', ')}`);
    }
    if (readiness.blockers.length > 0) {
      parts.push(`🔴 **Blockers:** ${readiness.blockers.slice(0, 3).join('; ')}`);
    }

    // Court
    if (caseHealth.courtActionsRequired.length > 0) {
      parts.push(`\n⚠️ **Court Action Required:** ${caseHealth.courtActionsRequired[0]}`);
    }

    // Readiness for charge sheet
    parts.push(`\n**Charge Sheet Readiness:** ${readiness.readyForChargeSheet ? '✓ Ready' : `${readiness.readinessScore}% — ${readiness.blockers.length} blocker(s) remain`}`);

    // Missing data note
    if (ctx.confidence.missingFields.length > 0) {
      parts.push(`\n_Unavailable: ${ctx.confidence.missingFields.slice(0, 3).join(', ')}_`);
    }

    return parts.join('\n');
  }

  /** Generate a draft prompt enriched with full case context. */
  static buildDraftContext(ctx: InvestigationContext): string {
    if (!ctx.fir) return '';
    const { fir, karyvahi, caseDiaries, caseHealth } = ctx;
    return [
      `FIR: ${fir.fir_number} | Sections: ${fir.section} | Crime: ${fir.crime_type}`,
      `Complainant: ${fir.complainant_name}`,
      `Karyvahi: ${karyvahi.completed.length}/${karyvahi.all.length} complete`,
      `Case Diaries: ${caseDiaries.length}`,
      `Health Score: ${caseHealth.score}/100`,
      caseHealth.pendingStatements.length > 0
        ? `Pending Statements: ${caseHealth.pendingStatements.join(', ')}`
        : '',
      caseHealth.missingEvidence.length > 0
        ? `Missing Evidence: ${caseHealth.missingEvidence.join(', ')}`
        : '',
    ].filter(Boolean).join('\n');
  }
}

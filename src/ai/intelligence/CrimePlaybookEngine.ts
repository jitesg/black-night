/**
 * CrimePlaybookEngine.ts
 * Validates investigation progress against configured crime playbooks.
 *
 * SAFETY: Read-only. Consumes InvestigationContext only. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  PlaybookValidationReport,
  PlaybookStepResult,
  PlaybookStepStatus,
  CrimeCategory,
} from './IntelligenceTypes';
import { ALL_PLAYBOOKS, findPlaybook } from './playbooks';
import type { PlaybookStep, CrimePlaybook } from './IntelligenceTypes';

export class CrimePlaybookEngine {
  static evaluate(ctx: InvestigationContext): PlaybookValidationReport | null {
    if (!ctx.fir) return null;

    const playbook = findPlaybook(ctx.fir.crime_type, ctx.fir.section);
    if (!playbook) {
      // Use a minimal generic playbook
      return CrimePlaybookEngine._genericReport(ctx);
    }
    return CrimePlaybookEngine._validateAgainst(ctx, playbook);
  }

  private static _validateAgainst(
    ctx: InvestigationContext,
    playbook: CrimePlaybook
  ): PlaybookValidationReport {
    const allKaryvahiNames = ctx.karyvahi.all.map((k) => k.name.toLowerCase());
    const completedKaryvahiNames = ctx.karyvahi.completed.map((k) => k.name.toLowerCase());
    const courtDocTypes = ctx.courtDocs.map((d) => d.doc_type.toLowerCase());
    const hasCaseDiary = ctx.caseDiaries.length > 0;

    const stepResults: PlaybookStepResult[] = playbook.steps.map((step) => {
      const status = CrimePlaybookEngine._checkStep(
        step,
        allKaryvahiNames,
        completedKaryvahiNames,
        courtDocTypes,
        hasCaseDiary
      );
      return { step, status, evidence: CrimePlaybookEngine._findEvidence(step, completedKaryvahiNames) };
    });

    const completed  = stepResults.filter((r) => r.status === 'completed').length;
    const pending    = stepResults.filter((r) => r.status === 'pending').length;
    const critical   = stepResults.filter((r) => r.status === 'critical-missing').length;
    const optional   = stepResults.filter((r) => r.status === 'optional-missing').length;
    const total      = stepResults.length;
    const coveragePct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const summary =
      `${playbook.crimeCategory} Playbook: ${coveragePct}% coverage. ` +
      `${completed}/${total} steps completed. ` +
      (critical > 0 ? `⚠️ ${critical} critical steps missing. ` : '') +
      (pending > 0 ? `${pending} steps pending. ` : '');

    return {
      crimeCategory: playbook.crimeCategory as CrimeCategory,
      playbookId: playbook.id,
      totalSteps: total,
      completedSteps: completed,
      pendingMandatory: pending,
      criticalMissing: critical,
      optionalMissing: optional,
      coveragePct,
      stepResults,
      summary,
    };
  }

  private static _checkStep(
    step: PlaybookStep,
    allNames: string[],
    completedNames: string[],
    courtDocTypes: string[],
    hasCaseDiary: boolean
  ): PlaybookStepStatus {
    // Case diary check
    if (step.requiresCaseDiary) {
      return hasCaseDiary ? 'completed' : step.isMandatory ? 'critical-missing' : 'optional-missing';
    }
    // Court doc type check
    if (step.courtDocTypes?.length) {
      const found = step.courtDocTypes.some((t) => courtDocTypes.includes(t.toLowerCase()));
      if (found) return 'completed';
    }
    // Karyvahi pattern match
    if (step.karyvahiPattern) {
      const re = new RegExp(step.karyvahiPattern, 'i');
      if (completedNames.some((n) => re.test(n))) return 'completed';
      if (allNames.some((n) => re.test(n))) return 'pending';
    }
    return step.isMandatory ? 'critical-missing' : 'optional-missing';
  }

  private static _findEvidence(step: PlaybookStep, completedNames: string[]): string | undefined {
    if (!step.karyvahiPattern) return undefined;
    const re = new RegExp(step.karyvahiPattern, 'i');
    return completedNames.find((n) => re.test(n));
  }

  /** Generic report when no specific playbook matches */
  private static _genericReport(ctx: InvestigationContext): PlaybookValidationReport {
    const completed = ctx.karyvahi.completed.length;
    const total = Math.max(ctx.karyvahi.all.length, 1);
    const coveragePct = Math.round((completed / total) * 100);
    return {
      crimeCategory: 'Custom',
      playbookId: 'generic',
      totalSteps: total,
      completedSteps: completed,
      pendingMandatory: ctx.karyvahi.pending.length,
      criticalMissing: 0,
      optionalMissing: 0,
      coveragePct,
      stepResults: [],
      summary: `Generic playbook: ${coveragePct}% investigation steps completed. No specific playbook found for this crime type.`,
    };
  }

  /** Return all available playbook crime categories */
  static availablePlaybooks(): string[] {
    return ALL_PLAYBOOKS.map((p) => p.crimeCategory);
  }
}

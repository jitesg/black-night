import type { InvestigationContext } from '../InvestigationContext';
import type { Finding, Severity } from './ReasoningTypes';
import type { ChecklistItem } from '@/lib/db/checklistRepo';
import type { FIRKaryvahi } from '@/lib/db/firKaryvahiRepo';
import type { FIR } from '@/lib/db/firRepo';

export const IMMEDIATE_GRACE_DAYS = 2;
export const INGREDIENT_CHECK_DAYS = 15;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getFirAgeInDays(fir?: FIR): number {
  if (!fir) return 0;
  let timeMs = 0;
  if (fir.date_of_information) {
    const parsed = new Date(fir.date_of_information).getTime();
    if (!isNaN(parsed) && parsed > 0) {
      timeMs = parsed;
    }
  }
  if (!timeMs && fir.created_at) {
    timeMs = fir.created_at > 1e11 ? fir.created_at : fir.created_at * 1000;
  }
  if (!timeMs) return 0;
  return Math.max(0, Math.floor((Date.now() - timeMs) / (1000 * 60 * 60 * 24)));
}

export class PlaybookStepEngine {
  /**
   * Pure, synchronous reasoning engine that evaluates investigation progress
   * against structured playbook steps. Advisory only — no database writes.
   */
  static evaluate(ctx: InvestigationContext): Finding[] {
    // a) Old-FIR guard: if no karyvahi in ctx.karyvahi.all has a step_code
    // (the FIR was created before the playbook existed), return [] - never flood
    // older FIRs with false "pending" warnings.
    const allKaryvahi = ctx.karyvahi?.all ?? [];
    const hasAnyStepCode = allKaryvahi.some(
      (k) => typeof k.step_code === 'string' && k.step_code.trim().length > 0
    );
    if (!hasAnyStepCode) {
      return [];
    }

    const playbookSteps = ctx.playbookSteps ?? [];
    if (playbookSteps.length === 0) {
      return [];
    }

    const age = getFirAgeInDays(ctx.fir);
    const nowIso = new Date().toISOString();
    const findings: Finding[] = [];

    interface EvaluatedStep {
      step: ChecklistItem;
      status: 'done' | 'pending' | 'skipped';
    }

    const evaluatedSteps: EvaluatedStep[] = [];

    // Step status: match each step to ctx.karyvahi.all by step_code first,
    // else by task_name vs karyvahi name (trim, lowercase, collapse spaces).
    // Done = is_completed === 1 or status === 'COMPLETED'. Skip a step whose
    // matched karyvahi has status 'NOT_APPLICABLE'. No match = pending.
    for (const step of playbookSteps) {
      let matched: FIRKaryvahi | undefined;
      if (step.step_code) {
        matched = allKaryvahi.find((k) => k.step_code === step.step_code);
      }
      if (!matched && step.task_name) {
        const normStepName = normalize(step.task_name);
        matched = allKaryvahi.find((k) => normalize(k.name) === normStepName);
      }

      if (matched) {
        if (matched.status === 'NOT_APPLICABLE') {
          evaluatedSteps.push({ step, status: 'skipped' });
          continue;
        }
        if (matched.is_completed === 1 || matched.status === 'COMPLETED') {
          evaluatedSteps.push({ step, status: 'done' });
          continue;
        }
      }

      evaluatedSteps.push({ step, status: 'pending' });
    }

    // d) Per pending step findings
    for (const { step, status } of evaluatedSteps) {
      if (status !== 'pending') continue;

      // CONDITIONAL -> no finding (its condition cannot be checked automatically)
      if (step.priority === 'CONDITIONAL') {
        continue;
      }

      let severity: Severity = 'low';
      if (step.phase === 'CLOSURE') {
        severity = 'low';
      } else if (step.priority === 'RECOMMENDED') {
        severity = 'low';
      } else if (step.phase === 'IMMEDIATE' && step.priority === 'MANDATORY') {
        severity = age < IMMEDIATE_GRACE_DAYS ? 'high' : 'critical';
      } else if (step.phase === 'INVESTIGATION' && step.priority === 'MANDATORY') {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      const ruleId = 'PLAYBOOK_' + (step.step_code || step.id || step.sort_order);

      findings.push({
        id: `PLAYBOOK_${step.step_code || step.sort_order}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ruleId,
        ruleTitle: 'Investigation Playbook',
        severity,
        title: step.task_name,
        detail: step.risk_text || '',
        recommendation: step.care_text || '',
        modulesAnalysed: ['Karyvahi'],
        legalReference: step.legal_basis || undefined,
        generatedAt: nowIso,
      });
    }

    // e) Ingredient gap: once age >= INGREDIENT_CHECK_DAYS, for each proves
    // value in OFFENCE / IDENTITY / INTENT that has MANDATORY or RECOMMENDED
    // steps, if NONE of those steps is done, add ONE 'critical' finding with
    // ruleId 'PLAYBOOK_GAP_' + proves, title "अभियोजन का तत्व कमज़ोर: " +
    // (OFFENCE -> "अपराध का घटित होना", IDENTITY -> "आरोपी से जुड़ाव",
    // INTENT -> "इरादा/मकसद"), detail listing those pending task_names.
    if (age >= INGREDIENT_CHECK_DAYS) {
      const provesTargets: Array<{
        key: 'OFFENCE' | 'IDENTITY' | 'INTENT';
        label: string;
      }> = [
        { key: 'OFFENCE', label: 'अपराध का घटित होना' },
        { key: 'IDENTITY', label: 'आरोपी से जुड़ाव' },
        { key: 'INTENT', label: 'इरादा/मकसद' },
      ];

      for (const { key, label } of provesTargets) {
        const targetSteps = evaluatedSteps.filter(
          ({ step }) =>
            step.proves === key &&
            (step.priority === 'MANDATORY' || step.priority === 'RECOMMENDED')
        );

        if (targetSteps.length > 0) {
          const anyDone = targetSteps.some(({ status }) => status === 'done');
          if (!anyDone) {
            const pendingNames = targetSteps
              .filter(({ status }) => status === 'pending')
              .map(({ step }) => step.task_name)
              .join(', ');

            findings.push({
              id: `PLAYBOOK_GAP_${key}_${Date.now()}`,
              ruleId: 'PLAYBOOK_GAP_' + key,
              ruleTitle: 'Investigation Playbook',
              severity: 'critical',
              title: `अभियोजन का तत्व कमज़ोर: ${label}`,
              detail: `लंबित आवश्यक कदम: ${pendingNames}`,
              recommendation: `इस तत्व को न्यायालय में सिद्ध करने के लिए संबंधित लंबित कदमों को प्राथमिकता से पूर्ण करें।`,
              modulesAnalysed: ['Karyvahi'],
              generatedAt: nowIso,
            });
          }
        }
      }
    }

    return findings;
  }
}

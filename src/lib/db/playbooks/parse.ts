import { logger } from '@/lib/logger';
import type { PlaybookStep } from './index';
import { fmtSteps, fmtDocs } from './playbookTexts';

const PHASE_RANKS: Record<string, number> = {
  IMMEDIATE: 0,
  INVESTIGATION: 1,
  CLOSURE: 2,
};

export function parseStepLines(raw: string): PlaybookStep[] {
  const lines = raw.split('\n');
  const result: PlaybookStep[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(' | ');
    if (parts.length !== 14) {
      logger.warn(
        `[playbookParse] Skipping line ${i + 1}: expected 14 fields separated by ' | ', got ${parts.length}. Line: "${line.slice(0, 60)}..."`
      );
      continue;
    }

    const [
      step_code,
      ordStr,
      task_name,
      phase,
      priority,
      proves,
      condition_note,
      legal_basis,
      why_text,
      court_text,
      care_text,
      risk_text,
      stepsRaw,
      docsRaw,
    ] = parts.map((p) => p.trim());

    const clean = (val: string) => (val === '-' ? '' : val);

    const ord = parseInt(ordStr, 10) || 0;
    const cleanPhase = clean(phase).toUpperCase();
    const phaseRank = PHASE_RANKS[cleanPhase] ?? 0;
    const sort_order = 1000 + phaseRank * 1000 + ord;

    const cleanWhy = clean(why_text);
    const cleanSteps = clean(stepsRaw);
    const cleanDocs = clean(docsRaw);

    const step: PlaybookStep = {
      step_code: clean(step_code),
      sort_order,
      task_name: clean(task_name),
      phase: clean(phase),
      priority: clean(priority),
      proves: clean(proves),
      condition_note: clean(condition_note),
      legal_basis: clean(legal_basis),
      why_text: cleanWhy,
      brief_description: cleanWhy,
      court_text: clean(court_text),
      care_text: clean(care_text),
      risk_text: clean(risk_text),
      steps_text: fmtSteps(cleanSteps),
      docs_text: fmtDocs(cleanDocs),
    };

    result.push(step);
  }

  return result;
}

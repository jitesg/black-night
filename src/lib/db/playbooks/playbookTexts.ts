import { RAW as MURDER_RAW } from './murderTexts';
import { RAW as MURDER_RAW_2 } from './murderTexts2';
import { RAW as ATTEMPT_RAW } from './attemptTexts';
import { RAW as ATTEMPT_RAW_2 } from './attemptTexts2';

export function fmtSteps(s: string): string {
  if (!s) return '';
  const parts = s
    .split('¶')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parts.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
}

export function fmtDocs(s: string): string {
  if (!s) return '';
  const parts = s
    .split('¶')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parts.map((item) => `• ${item}`).join('\n');
}

const ALL_RAW: Record<string, { steps: string; docs: string }> = {
  ...MURDER_RAW,
  ...MURDER_RAW_2,
  ...ATTEMPT_RAW,
  ...ATTEMPT_RAW_2,
};

export const PLAYBOOK_TEXTS: Record<
  string,
  { steps_text: string; docs_text: string }
> = Object.fromEntries(
  Object.entries(ALL_RAW).map(([code, entry]) => [
    code,
    {
      steps_text: fmtSteps(entry.steps),
      docs_text: fmtDocs(entry.docs),
    },
  ])
);

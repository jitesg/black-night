import type { PlaybookSeedRow } from '../playbookSeed';
import { MURDER_STEPS } from './murder';
import { ATTEMPT_MURDER_STEPS } from './attemptMurder';

export type { PlaybookSeedRow };
export type PlaybookStep = PlaybookSeedRow;

export const PLAYBOOKS: Array<{ crimeId: string; steps: PlaybookSeedRow[] }> = [
  { crimeId: 'murder', steps: MURDER_STEPS },
  { crimeId: 'attempt_to_murder', steps: ATTEMPT_MURDER_STEPS },
];

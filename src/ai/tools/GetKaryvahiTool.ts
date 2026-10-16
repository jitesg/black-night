/**
 * GetKaryvahiTool.ts — Reads investigation actions via firKaryvahiRepo.
 */
import { getKaryvahiByFIR } from '@/lib/db/firKaryvahiRepo';
import type { AITool } from '../AITypes';

export interface GetKaryvahiInput {
  firId: string;
}

export interface GetKaryvahiOutput {
  karyvahi: unknown[];
  completed: number;
  pending: number;
}

export const GetKaryvahiTool: AITool<GetKaryvahiInput, GetKaryvahiOutput> = {
  name: 'GetKaryvahiTool',
  description: 'Retrieves investigation Karyvahi (actions) for a FIR.',
  async execute({ firId }) {
    const items = await getKaryvahiByFIR(firId, 'AI');
    const completed = items.filter((k) => k.is_completed === 1).length;
    const pending = items.filter((k) => k.is_completed !== 1).length;
    return { karyvahi: items, completed, pending };
  },
};

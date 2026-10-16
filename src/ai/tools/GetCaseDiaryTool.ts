/**
 * GetCaseDiaryTool.ts — Reads case diary via caseDiaryRepo.
 */
import { getCaseDiariesByFIR } from '@/lib/db/caseDiaryRepo';
import type { AITool } from '../AITypes';

export interface GetCaseDiaryInput {
  firId: string;
}

export interface GetCaseDiaryOutput {
  diaries: unknown[];
  count: number;
}

export const GetCaseDiaryTool: AITool<GetCaseDiaryInput, GetCaseDiaryOutput> = {
  name: 'GetCaseDiaryTool',
  description: 'Retrieves Case Diary entries for a FIR.',
  async execute({ firId }) {
    const diaries = await getCaseDiariesByFIR(firId);
    return { diaries, count: diaries.length };
  },
};

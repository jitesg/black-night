/**
 * GetFIRTool.ts — Reads FIR data via firRepo.
 */
import { getAllFIRs, getFIRById, searchFIRs } from '@/lib/db/firRepo';
import type { AITool } from '../AITypes';

export interface GetFIRInput {
  firId?: string;
  query?: string;
  limit?: number;
}

export interface GetFIROutput {
  firs: unknown[];
  count: number;
}

export const GetFIRTool: AITool<GetFIRInput, GetFIROutput> = {
  name: 'GetFIRTool',
  description: 'Retrieves FIR / Mukadma records. Pass firId for a single record, query for search, or omit for all.',
  async execute(input) {
    if (input.firId) {
      const fir = await getFIRById(input.firId);
      return { firs: fir ? [fir] : [], count: fir ? 1 : 0 };
    }
    if (input.query) {
      const results = await searchFIRs(input.query);
      const limited = results.slice(0, input.limit ?? 10);
      return { firs: limited, count: limited.length };
    }
    const all = await getAllFIRs();
    const limited = all.slice(0, input.limit ?? 20);
    return { firs: limited, count: limited.length };
  },
};

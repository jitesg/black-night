/**
 * GetGDTool.ts — Reads General Diary entries via gdRepo.
 */
import { getAllGdEntries, searchGdEntries } from '@/lib/db/gdRepo';
import type { AITool } from '../AITypes';

export interface GetGDInput {
  query?: string;
  limit?: number;
}

export interface GetGDOutput {
  entries: unknown[];
  count: number;
}

export const GetGDTool: AITool<GetGDInput, GetGDOutput> = {
  name: 'GetGDTool',
  description: 'Retrieves General Diary (GD) entries. Pass query for search or omit for recent entries.',
  async execute({ query, limit = 10 }) {
    // searchGdEntries(query, filterTag) — pass empty string for no type filter
    const entries = query
      ? (await searchGdEntries(query, '')).slice(0, limit)
      : (await getAllGdEntries()).slice(0, limit);
    return { entries, count: entries.length };
  },
};

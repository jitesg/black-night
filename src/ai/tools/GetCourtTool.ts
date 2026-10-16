/**
 * GetCourtTool.ts — Reads court / nyayalay data via nyayalayRepo.
 * NyayalayDocument uses fir_number (string), not a fir_id FK.
 */
import { getAllNyayalayDocuments, searchNyayalayDocuments } from '@/lib/db/nyayalayRepo';
import type { AITool } from '../AITypes';

export interface GetCourtInput {
  firNumber?: string;
  limit?: number;
}

export interface GetCourtOutput {
  documents: unknown[];
  count: number;
}

export const GetCourtTool: AITool<GetCourtInput, GetCourtOutput> = {
  name: 'GetCourtTool',
  description: 'Retrieves Nyayalay (court work) documents, optionally filtered by FIR number.',
  async execute({ firNumber, limit = 20 }) {
    const all = firNumber
      ? await searchNyayalayDocuments(firNumber)
      : (await getAllNyayalayDocuments()).slice(0, limit);
    const docs = all.slice(0, limit);
    return { documents: docs, count: docs.length };
  },
};

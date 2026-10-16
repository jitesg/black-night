/**
 * GetKnowledgeTool.ts — Reads knowledge articles via knowledgeRepo.
 */
import { searchKnowledgeAll, getKnowledgeByCategory } from '@/lib/db/knowledgeRepo';
import type { AITool } from '../AITypes';

export interface GetKnowledgeInput {
  query?: string;
  limit?: number;
}

export interface GetKnowledgeOutput {
  articles: unknown[];
  count: number;
}

export const GetKnowledgeTool: AITool<GetKnowledgeInput, GetKnowledgeOutput> = {
  name: 'GetKnowledgeTool',
  description: 'Retrieves knowledge base articles. Pass query for search.',
  async execute({ query, limit = 10 }) {
    const articles = query
      ? (await searchKnowledgeAll(query)).slice(0, limit)
      : (await getKnowledgeByCategory('')).slice(0, limit);
    return { articles, count: articles.length };
  },
};

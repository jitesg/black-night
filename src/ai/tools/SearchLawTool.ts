/**
 * SearchLawTool.ts — Searches knowledge base for legal references.
 */
import { searchKnowledgeAll } from '@/lib/db/knowledgeRepo';
import type { AITool } from '../AITypes';

export interface SearchLawInput {
  query: string;
  limit?: number;
}

export interface SearchLawOutput {
  results: Array<{ id: string; title: string; category: string; snippet: string }>;
  count: number;
}

export const SearchLawTool: AITool<SearchLawInput, SearchLawOutput> = {
  name: 'SearchLawTool',
  description: 'Searches legal knowledge base using natural language query.',
  async execute({ query, limit = 8 }) {
    const entries = await searchKnowledgeAll(query);
    const results = entries.slice(0, limit).map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      snippet: (e.description ?? '').slice(0, 200),
    }));
    return { results, count: results.length };
  },
};

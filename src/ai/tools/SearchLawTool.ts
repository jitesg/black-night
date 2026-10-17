/**
 * SearchLawTool.ts — Searches knowledge base for legal references.
 */
import { searchKnowledgeSmart } from '@/lib/db/knowledgeRepo';
import {
  searchLaw as searchLawLibrary,
  getSection,
  parseSectionRef,
  extractRefs,
  getLinks,
  type LawLinksResult,
} from '@/lib/law/lawLibrary';
import { getSimple, type SimpleExplainEntry } from '@/lib/law/simpleExplain';
import type { AITool } from '../AITypes';

export interface SearchLawInput {
  query: string;
  limit?: number;
}

export interface SearchLawOutput {
  results: Array<{
    id: string;
    title: string;
    category: string;
    snippet: string;
    links?: LawLinksResult;
    simple_explanation?: SimpleExplainEntry | null;
  }>;
  count: number;
}

export const SearchLawTool: AITool<SearchLawInput, SearchLawOutput> = {
  name: 'SearchLawTool',
  description: 'Searches legal knowledge base using natural language query.',
  async execute({ query, limit = 8 }) {
    const results: SearchLawOutput['results'] = [];
    const seenIds = new Set<string>();

    // 1. If query contains a direct section reference, return that exact section FIRST with full text up to 1200 chars
    const directRef = parseSectionRef(query) ?? (extractRefs(query)[0] || null);
    if (directRef) {
      const exactSec = getSection(directRef.act, directRef.n);
      if (exactSec) {
        const id = `law:${directRef.act}:${directRef.n}`;
        seenIds.add(id);
        results.push({
          id,
          title: `${directRef.act} ${directRef.n} — ${exactSec.title}`,
          category: 'Official law',
          snippet: exactSec.text.slice(0, 1200),
          links: getLinks(directRef.act, directRef.n),
          simple_explanation: getSimple(directRef.act, directRef.n),
        });
      }
    }

    // 2. Query official Law Library (limit 5) and prepend results
    const lawHits = searchLawLibrary(query, { limit: 5 });
    for (const hit of lawHits) {
      const id = `law:${hit.act}:${hit.n}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        results.push({
          id,
          title: `${hit.act} ${hit.n} — ${hit.title}`,
          category: 'Official law',
          snippet: hit.snippet.slice(0, 220),
          links: getLinks(hit.act, hit.n),
          simple_explanation: getSimple(hit.act, hit.n),
        });
      }
    }

    // 3. Add existing knowledge-base results
    const entries = await searchKnowledgeSmart(query, limit);
    for (const e of entries) {
      if (results.length >= limit + 5) break;
      results.push({
        id: e.id,
        title: e.title,
        category: e.category,
        snippet: (e.description ?? '').slice(0, 400),
      });
    }

    return { results, count: results.length };
  },
};


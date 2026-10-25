/**
 * searchSuggestRepo.ts — known values per screen for search suggestions and
 * "क्या आपका मतलब …?" (names, मु0अ0सं0, गाँव, प्रकार, शीर्षक …). Cached for 60 s.
 */
import { getDatabase } from './database';
import { getMergedKnowledgeList } from './knowledgeRepo';
import { didYouMean, rankSuggestions } from '@/lib/searchSuggest';

export type SuggestScope = 'all' | 'fir' | 'nyayalay' | 'pp' | 'nk' | 'knowledge' | 'formats' | 'gd' | 'halka' | null;

/** Screen path → which values to suggest (null = no suggestions on that screen). */
export function scopeForPath(path: string | null | undefined): SuggestScope {
  const p = path ?? '';
  if (p.includes('select-format') || p.startsWith('/formats')) return 'formats';
  if (p === '/' || p.startsWith('/home')) return 'all';
  if (p.startsWith('/mukadma')) return 'fir';
  if (p.startsWith('/nyayalay')) return 'nyayalay';
  if (p.startsWith('/prarthna-patra')) return 'pp';
  if (p.startsWith('/nirodhatmak')) return 'nk';
  if (p.startsWith('/knowledge/law')) return null; // the Law library has its own section search
  if (p.startsWith('/knowledge')) return 'knowledge';
  if (p.startsWith('/gd')) return 'gd';
  if (p.startsWith('/halka')) return 'halka';
  return null;
}

async function col(sql: string): Promise<string[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ v: string | null }>(sql);
    return rows.map((r) => (r.v ?? '').trim()).filter((v) => v && v.length <= 160);
  } catch {
    return [];
  }
}

const LOADERS: Record<Exclude<SuggestScope, null | 'all'>, () => Promise<string[]>> = {
  fir: async () => (await Promise.all([
    col(`SELECT fir_number AS v FROM firs WHERE deleted_at IS NULL`),
    col(`SELECT complainant_name AS v FROM firs WHERE deleted_at IS NULL`),
    col(`SELECT DISTINCT crime_type AS v FROM firs WHERE deleted_at IS NULL`),
    col(`SELECT DISTINCT ghatnasthal AS v FROM firs WHERE deleted_at IS NULL`),
    col(`SELECT name AS v FROM fir_accused WHERE deleted_at IS NULL`),
  ])).flat(),
  nyayalay: async () => (await Promise.all([
    col(`SELECT registration_number AS v FROM nyayalay_documents WHERE deleted_at IS NULL`),
    col(`SELECT DISTINCT court_name AS v FROM nyayalay_documents WHERE deleted_at IS NULL`),
    col(`SELECT fir_number AS v FROM nyayalay_documents WHERE deleted_at IS NULL`),
    col(`SELECT name AS v FROM nyayalay_persons WHERE deleted_at IS NULL`),
  ])).flat(),
  pp: async () => (await Promise.all([
    col(`SELECT registration_number AS v FROM prarthna_patra WHERE deleted_at IS NULL`),
    col(`SELECT DISTINCT petition_type AS v FROM prarthna_patra WHERE deleted_at IS NULL`),
    col(`SELECT name AS v FROM prarthna_patra_complainants WHERE deleted_at IS NULL`),
    col(`SELECT DISTINCT village AS v FROM prarthna_patra_complainants WHERE deleted_at IS NULL`),
    col(`SELECT name AS v FROM prarthna_patra_accused WHERE deleted_at IS NULL`),
  ])).flat(),
  nk: async () => (await Promise.all([
    col(`SELECT DISTINCT village_name AS v FROM nirodhatmak_karyvahi WHERE deleted_at IS NULL`),
    col(`SELECT DISTINCT proceeding_type AS v FROM nirodhatmak_karyvahi WHERE deleted_at IS NULL`),
    col(`SELECT DISTINCT format_title AS v FROM nirodhatmak_karyvahi WHERE deleted_at IS NULL`),
  ])).flat(),
  knowledge: async () => {
    try { return (await getMergedKnowledgeList()).map((k) => k.title).filter((t) => t && t.length <= 160); } catch { return []; }
  },
  formats: () => col(`SELECT title AS v FROM predefined_formats WHERE deleted_at IS NULL`),
  gd: () => col(`SELECT DISTINCT gd_type AS v FROM gd_entries WHERE deleted_at IS NULL`),
  halka: async () => (await Promise.all([
    col(`SELECT name AS v FROM gram_panchayats WHERE deleted_at IS NULL`),
    col(`SELECT name AS v FROM hamlets WHERE deleted_at IS NULL`),
    col(`SELECT name AS v FROM persons WHERE deleted_at IS NULL`),
  ])).flat(),
};

const cache = new Map<string, { at: number; pool: Promise<string[]> }>();

export function getSuggestionPool(scope: SuggestScope): Promise<string[]> {
  if (!scope) return Promise.resolve([]);
  const hit = cache.get(scope);
  if (hit && Date.now() - hit.at < 60_000) return hit.pool;
  const pool = scope === 'all'
    ? Promise.all((['fir', 'nyayalay', 'pp', 'nk', 'halka', 'knowledge'] as const).map((s) => getSuggestionPool(s))).then((l) => l.flat())
    : LOADERS[scope]();
  cache.set(scope, { at: Date.now(), pool });
  return pool;
}

export async function suggestFor(scope: SuggestScope, query: string, limit = 8): Promise<string[]> {
  if (!scope || !query.trim()) return [];
  return rankSuggestions(await getSuggestionPool(scope), query, limit);
}

export async function didYouMeanFor(scope: SuggestScope, query: string): Promise<string | null> {
  if (!scope || !query.trim()) return null;
  return didYouMean(await getSuggestionPool(scope), query);
}

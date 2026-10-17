import { FARD_FILES } from './registry';
import { parseFardLines } from './parse';
import type { FardEntry } from './types';

let cachedEntries: FardEntry[] | null = null;

function getAllParsed(): FardEntry[] {
  if (!cachedEntries) {
    const allText = FARD_FILES.join('\n');
    cachedEntries = parseFardLines(allText);
  }
  return cachedEntries;
}

/** Returns all Fard entries except the baseline COMMON entry. */
export function getFardEntries(): FardEntry[] {
  return getAllParsed().filter((e) => e.code !== 'COMMON');
}

/** Returns the baseline COMMON entry ('हर फर्द के ज़रूरी तत्व'). */
export function getCommon(): FardEntry | undefined {
  return getAllParsed().find((e) => e.code === 'COMMON');
}

/** Returns a specific Fard entry by code. */
export function getFardEntry(code: string): FardEntry | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase();
  return getAllParsed().find((e) => e.code.toUpperCase() === upper);
}

/**
 * Searches Fard entries by query across name, keywords, and purpose.
 * Devanagari-safe, case-insensitive.
 */
export function searchFard(q: string): FardEntry[] {
  const query = (q || '').trim().toLowerCase();
  const entries = getFardEntries();
  if (!query) return entries;

  return entries.filter((e) => {
    const nameMatch = e.name.toLowerCase().includes(query);
    const purposeMatch = e.purpose.toLowerCase().includes(query);
    const keywordMatch = e.keywords.some((k) => k.toLowerCase().includes(query));
    const legalMatch = e.legal.toLowerCase().includes(query);
    return nameMatch || purposeMatch || keywordMatch || legalMatch;
  });
}

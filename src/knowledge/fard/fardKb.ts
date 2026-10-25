import { FARD_FILES } from './registry';
import { parseFardLines } from './parse';
import type { FardEntry } from './types';
import { smartMatch } from '@/lib/searchUtils';

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
  const entries = getFardEntries();
  if (!(q || '').trim()) return entries;
  // Word-by-word, Hindi-aware (searchUtils): every word in name / purpose / keywords / legal / code.
  return entries.filter((e) => smartMatch(q, [e.name, e.purpose, e.keywords.join(' '), e.legal, e.code]));
}

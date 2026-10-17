/**
 * Verified Case Law Loader & Matcher ("महत्वपूर्ण निर्णय")
 * Loads assets/law/cases.json (73 items) lazily in memory.
 * Links cases to sections when new[] contains that act+number (ignoring any sub-section suffix).
 * Offline only, try/catch safe, never throws.
 */

import { type ActId } from './lawLibrary';

declare const require: any;

export interface CaseLawItem {
  id: string;
  name: string;
  court: string;
  year: number | string;
  cite: string;
  old: string[];
  new: string[]; // e.g. ["BNS 101", "BNSS 35"] or with sub-sections like "BNSS 35(1)"
  held_hi: string;
  use_hi: string; // "जाँच में उपयोग"
  url?: string;
  quote?: string;
  status?: 'verified' | 'unverified' | string;
  warn_hi?: string; // Hindi warning for unverified cases
}

let cachedCases: CaseLawItem[] | null = null;
let sectionCaseMap: Map<string, CaseLawItem[]> | null = null;

/**
 * Lazy load all verified case law entries.
 */
export function getAllCases(): CaseLawItem[] {
  if (cachedCases) return cachedCases;

  try {
    const raw = require('../../../assets/law/cases.json');
    if (Array.isArray(raw)) {
      cachedCases = raw as CaseLawItem[];
    } else {
      cachedCases = [];
    }
  } catch {
    cachedCases = [];
  }

  // Build section to cases mapping
  buildSectionCaseMap(cachedCases);

  return cachedCases;
}

/**
 * Normalizes and extracts act + section number pairs from the `new[]` field.
 * Handles patterns like "BNS 101", "BNSS 35(1)", "BSA 63", "BNS 103(2)".
 */
function parseNewSectionRef(refStr: string): { act: ActId; n: number } | null {
  if (!refStr) return null;
  const match = refStr.trim().match(/^(BNS|BNSS|BSA)\s*(\d+)/i);
  if (!match) return null;
  const act = match[1].toUpperCase() as ActId;
  const n = parseInt(match[2], 10);
  if (isNaN(n)) return null;
  return { act, n };
}

function buildSectionCaseMap(cases: CaseLawItem[]): void {
  const map = new Map<string, CaseLawItem[]>();

  for (const c of cases) {
    if (!Array.isArray(c.new)) continue;

    const linkedKeys = new Set<string>();

    for (const ref of c.new) {
      const parsed = parseNewSectionRef(ref);
      if (parsed) {
        const key = `${parsed.act}:${parsed.n}`;
        if (!linkedKeys.has(key)) {
          linkedKeys.add(key);
          const list = map.get(key) || [];
          list.push(c);
          map.set(key, list);
        }
      }
    }

    // Link Shafhi Mohammad (videography & electronic evidence 65B precedent) to BSA 63 as well
    if (c.id === 'shafhi-mohammad-2018') {
      const bsaKey = 'BSA:63';
      if (!linkedKeys.has(bsaKey)) {
        linkedKeys.add(bsaKey);
        const list = map.get(bsaKey) || [];
        list.push(c);
        map.set(bsaKey, list);
      }
    }
  }

  sectionCaseMap = map;
}

/**
 * Get all verified and unverified cases linked to an act and section number,
 * sorting verified cases first and unverified cases after.
 * Missing status is treated as verified.
 */
export function getCasesForSection(act: ActId, n: number): CaseLawItem[] {
  if (!sectionCaseMap) {
    getAllCases();
  }
  const key = `${act}:${n}`;
  const list = sectionCaseMap?.get(key) || [];

  return [...list].sort((a, b) => {
    const aUnv = a.status === 'unverified' ? 1 : 0;
    const bUnv = b.status === 'unverified' ? 1 : 0;
    return aUnv - bUnv;
  });
}

/**
 * Check if any verified cases are linked to an act and section number.
 */
export function hasCasesForSection(act: ActId, n: number): boolean {
  return getCasesForSection(act, n).length > 0;
}

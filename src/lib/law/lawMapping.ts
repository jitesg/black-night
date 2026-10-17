/**
 * lawMapping.ts
 *
 * Bidirectional mapping between old laws (IPC, CrPC, IEA) and new laws (BNS, BNSS, BSA).
 * Sourced from official comparison tables (Kerala Prisons Dept and UP Police).
 * Lazy-loads assets/law/law_map.json. Never throws.
 */

import { type ActId } from './lawLibrary';

declare const require: any;

export type OldActId = 'IPC' | 'CrPC' | 'IEA';

export interface LawMapData {
  fwd: {
    BNS: Record<string, string[]>;
    BNSS: Record<string, string[]>;
    BSA: Record<string, string[]>;
  };
  rev: {
    IPC: Record<string, [string, string][]>;
    CrPC: Record<string, [string, string][]>;
    IEA: Record<string, [string, string][]>;
  };
}

export interface OldLawReference {
  oldAct: OldActId;
  oldSections: string[];
  isNewProvision: boolean;
  displayText: string;
}

export interface NewSectionTarget {
  act: ActId;
  n: number;
}

let cachedLawMap: LawMapData | null = null;

export function getLawMapData(): LawMapData | null {
  if (cachedLawMap) return cachedLawMap;
  try {
    cachedLawMap = require('../../../assets/law/law_map.json') as LawMapData;
    return cachedLawMap;
  } catch {
    return null;
  }
}

/**
 * Returns the corresponding legacy enactment name for a new enactment.
 * BNS -> IPC, BNSS -> CrPC, BSA -> IEA
 */
export function getOldActForNew(act: ActId): OldActId {
  switch (act) {
    case 'BNS': return 'IPC';
    case 'BNSS': return 'CrPC';
    case 'BSA': return 'IEA';
  }
}

/**
 * Returns the legacy section mapping for a new section.
 */
export function getOldLawForNew(act: ActId, n: number): OldLawReference {
  const oldAct = getOldActForNew(act);
  const data = getLawMapData();
  if (!data?.fwd || !data.fwd[act]) {
    return { oldAct, oldSections: [], isNewProvision: false, displayText: '' };
  }

  const list = data.fwd[act][String(n)];
  if (list === undefined) {
    return { oldAct, oldSections: [], isNewProvision: false, displayText: '' };
  }

  if (Array.isArray(list) && list.length === 0) {
    return {
      oldAct,
      oldSections: [],
      isNewProvision: true,
      displayText: 'नया प्रावधान',
    };
  }

  const joined = list.join(', ');
  return {
    oldAct,
    oldSections: list,
    isNewProvision: false,
    displayText: `पूर्व धारा: ${oldAct} ${joined}`,
  };
}

/**
 * Returns list of new sections that map from an old section.
 */
export function getNewSectionsForOld(oldAct: OldActId, oldSec: string): NewSectionTarget[] {
  const data = getLawMapData();
  if (!data?.rev || !data.rev[oldAct]) return [];

  const key = oldSec.trim().toUpperCase();
  const rawList = data.rev[oldAct][key];
  if (!Array.isArray(rawList)) return [];

  const targets: NewSectionTarget[] = [];
  const seen = new Set<string>();

  for (const item of rawList) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const act = item[0] as ActId;
    const n = parseInt(String(item[1]), 10);
    if (!act || isNaN(n) || n <= 0) continue;
    const targetKey = `${act}:${n}`;
    if (!seen.has(targetKey)) {
      seen.add(targetKey);
      targets.push({ act, n });
    }
  }

  return targets;
}

export interface ParsedOldLawQuery {
  oldAct: OldActId;
  oldSec: string;
}

/**
 * Parses user search query to detect legacy law references:
 * e.g. "IPC 302", "ipc302", "302 ipc", "CrPC 154", "crpc 41", "IEA 65B", "section 420 ipc", "498a ipc", "65b"
 */
export function parseOldLawQuery(query: string): ParsedOldLawQuery | null {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim();
  if (!q) return null;

  // Pattern 1: Explicit old act name + section, e.g. "IPC 302", "ipc302", "section 420 ipc", "498a ipc", "CrPC 154", "crpc 41", "IEA 65B"
  // Normalize whitespace and look for IPC, CrPC, IEA
  const matchIpc = q.match(/(?:(?:section|sec|dhara|धारा)\s*)?ipc\s*([0-9]+[a-z]?)|([0-9]+[a-z]?)\s*ipc/i);
  if (matchIpc) {
    const sec = (matchIpc[1] || matchIpc[2] || '').trim().toUpperCase();
    if (sec) return { oldAct: 'IPC', oldSec: sec };
  }

  const matchCrpc = q.match(/(?:(?:section|sec|dhara|धारा)\s*)?crpc\s*([0-9]+[a-z]?)|([0-9]+[a-z]?)\s*crpc/i);
  if (matchCrpc) {
    const sec = (matchCrpc[1] || matchCrpc[2] || '').trim().toUpperCase();
    if (sec) return { oldAct: 'CrPC', oldSec: sec };
  }

  const matchIea = q.match(/(?:(?:section|sec|dhara|धारा)\s*)?iea\s*([0-9]+[a-z]?)|([0-9]+[a-z]?)\s*iea/i);
  if (matchIea) {
    const sec = (matchIea[1] || matchIea[2] || '').trim().toUpperCase();
    if (sec) return { oldAct: 'IEA', oldSec: sec };
  }

  // Pattern 2: Standalone alphanumeric query like "65b", "65B", "498a", "498A" (has letter, not a bare number)
  const alphaNumMatch = q.match(/^([0-9]{1,4}[a-z])$/i);
  if (alphaNumMatch) {
    const sec = alphaNumMatch[1].toUpperCase();
    const data = getLawMapData();
    if (data?.rev) {
      // Check if known in IEA (e.g. 65B)
      if (data.rev.IEA && data.rev.IEA[sec]) {
        return { oldAct: 'IEA', oldSec: sec };
      }
      // Check if known in IPC (e.g. 498A)
      if (data.rev.IPC && data.rev.IPC[sec]) {
        return { oldAct: 'IPC', oldSec: sec };
      }
      // Check if known in CrPC
      if (data.rev.CrPC && data.rev.CrPC[sec]) {
        return { oldAct: 'CrPC', oldSec: sec };
      }
    }
  }

  return null;
}

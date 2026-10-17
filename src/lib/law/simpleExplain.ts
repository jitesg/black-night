/**
 * simpleExplain.ts
 *
 * Provides simplified Hindi explanations for statutory sections:
 * - Summary (s)
 * - Key elements / points (k)
 * - Practical police note (p)
 * - Concrete example (e)
 *
 * Lazy-loads assets/law/simple_hi.json on first access.
 * Pure logic — offline and cached.
 */

import { logger } from '../logger';
import type { ActId } from './lawLibrary';

declare const require: any;

export interface SimpleExplainEntry {
  s: string;
  k: string[];
  p: string;
  e: string;
}

type SimpleData = Record<string, Record<string, SimpleExplainEntry>>;

let simpleCache: SimpleData | null = null;
let hasAttemptedLoad = false;

function loadSimpleData(): SimpleData | null {
  if (simpleCache) return simpleCache;
  if (hasAttemptedLoad) return null;
  hasAttemptedLoad = true;

  try {
    simpleCache = require('../../../assets/law/simple_hi.json') as SimpleData;
    return simpleCache;
  } catch (err) {
    logger.warn('[simpleExplain] Failed to load simple_hi.json:', err);
    return null;
  }
}

/**
 * Returns the simplified Hindi explanation for a section, or null if not available.
 */
export function getSimple(act: ActId, n: number): SimpleExplainEntry | null {
  try {
    const data = loadSimpleData();
    if (!data) return null;
    const actData = data[act];
    if (!actData) return null;
    const entry = actData[String(n)];
    return entry || null;
  } catch (err) {
    logger.warn(`[simpleExplain] Error getting simple explanation for ${act} ${n}:`, err);
    return null;
  }
}

/**
 * Checks whether a section has a simplified Hindi explanation.
 */
export function hasSimple(act: ActId, n: number): boolean {
  try {
    const data = loadSimpleData();
    if (!data) return false;
    const actData = data[act];
    if (!actData) return false;
    return Boolean(actData[String(n)]);
  } catch {
    return false;
  }
}

/**
 * Returns all simple explanation entries across all acts (for search indexing).
 */
export function getAllSimpleData(): SimpleData | null {
  return loadSimpleData();
}

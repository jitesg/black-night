/**
 * L7PerformanceLayer.ts
 * Level-7: Smart cache + incremental context refresh + zero duplicate repository calls.
 *
 * SAFETY: Read-only. Advisory only. In-memory cache. No DB writes.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { Level7IntelligenceReport } from './L7Types';

interface CacheEntry {
  report: Level7IntelligenceReport;
  contextVersion: number;
  cachedAt: number;
}

// Configurable TTL
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const _cache = new Map<string, CacheEntry>();

export const L7PerformanceLayer = {
  /** Returns cached report if context version matches and TTL not expired */
  getCached(firId: string, contextVersion: number): Level7IntelligenceReport | null {
    const entry = _cache.get(firId);
    if (!entry) return null;
    const expired = Date.now() - entry.cachedAt > CACHE_TTL_MS;
    const stale   = entry.contextVersion !== contextVersion;
    if (expired || stale) {
      _cache.delete(firId);
      return null;
    }
    return entry.report;
  },

  /** Stores a computed report */
  store(firId: string, contextVersion: number, report: Level7IntelligenceReport): void {
    _cache.set(firId, { report, contextVersion, cachedAt: Date.now() });
  },

  /** Invalidate by FIR (call when investigation data changes) */
  invalidate(firId: string): void {
    _cache.delete(firId);
  },

  /** Invalidate all (e.g. after bulk update) */
  invalidateAll(): void {
    _cache.clear();
  },

  /** Returns cache stats for debugging */
  stats(): { size: number; keys: string[] } {
    return { size: _cache.size, keys: [..._cache.keys()] };
  },

  /** Runs heterogeneous engine functions in parallel with per-engine error capture. */
  async runParallel(
    tasks: Array<{ id: string; fn: () => Promise<unknown> | unknown }>,
  ): Promise<{ results: Map<string, unknown>; errors: Record<string, string> }> {
    const results = new Map<string, unknown>();
    const errors: Record<string, string> = {};

    const settled = await Promise.allSettled(
      tasks.map((t) => Promise.resolve().then(() => t.fn()))
    );

    settled.forEach((s, i) => {
      const id = tasks[i].id;
      if (s.status === 'fulfilled') results.set(id, s.value);
      else errors[id] = s.reason instanceof Error ? s.reason.message : String(s.reason);
    });

    return { results, errors };
  },

  /** Builds a stable context version from key fields */
  contextVersion(ctx: InvestigationContext): number {
    return (
      (ctx.karyvahi.all.length * 1000) +
      (ctx.caseDiaries.length * 100)   +
      (ctx.courtDocs.length * 10)      +
      (ctx.overdueItems.length)
    );
  },
};

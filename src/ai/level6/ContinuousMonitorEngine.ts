/**
 * ContinuousMonitorEngine.ts
 * Level-6: Continuously watches investigation data and detects changes.
 * Triggers intelligence regeneration when modules change.
 *
 * SAFETY: Read-only. Never writes to any repository or database.
 * No auto-save. No direct SQLite access. Uses InvestigationContext only.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  ContinuousMonitorReport,
  MonitorSnapshot,
  MonitoredModule,
} from './L6Types';

const MAX_HISTORY = 20;

// ── In-memory snapshot store (per FIR, per session) ──────────────────────────
const snapshotStore = new Map<string, MonitorSnapshot[]>();
let contextVersionCounter = 0;

function storeKey(firId?: string): string {
  return firId ?? '__no_fir__';
}

function detectChangedModules(
  ctx: InvestigationContext,
  prev?: MonitorSnapshot
): MonitoredModule[] {
  if (!prev) return [];
  const changed: MonitoredModule[] = [];
  // Heuristic: compare counts/timestamps in context
  const prevBuiltAt = new Date(prev.capturedAt).getTime();
  const ctxBuiltAt  = ctx.builtAt;
  if (ctxBuiltAt > prevBuiltAt) {
    // Check each module by proxy field
    if (ctx.fir) changed.push('fir');
    if (ctx.caseDiaries.length > 0) changed.push('case-diary');
    if (ctx.courtDocs.length  > 0) changed.push('court-work');
    if (ctx.karyvahi.all.length > 0) changed.push('karyvahi');
    if (ctx.nirodhatmak.length > 0) changed.push('evidence');
    if (ctx.analytics)            changed.push('analytics');
    if (ctx.overdueItems.length > 0) changed.push('deadlines');
  }
  return changed;
}

export class ContinuousMonitorEngine {
  /**
   * Record a new snapshot and return the full monitor report.
   * Call this every time InvestigationContext is rebuilt.
   */
  static record(ctx: InvestigationContext): ContinuousMonitorReport {
    const key  = storeKey(ctx.activeFirId);
    const history = snapshotStore.get(key) ?? [];
    const prev    = history[history.length - 1];

    contextVersionCounter += 1;
    const changedModules = detectChangedModules(ctx, prev);
    const allModules: MonitoredModule[] = [
      'fir', 'case-diary', 'court-work', 'karyvahi', 'evidence', 'analytics', 'deadlines',
    ];

    const snapshot: MonitorSnapshot = {
      firId:          ctx.activeFirId,
      capturedAt:     new Date(ctx.builtAt).toISOString(),
      modules:        allModules,
      contextVersion: contextVersionCounter,
      changeDetected: changedModules.length > 0,
      changedModules,
      triggerReason:  changedModules.length > 0
        ? `Changes detected in: ${changedModules.join(', ')}`
        : 'Periodic refresh — no changes detected.',
    };

    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    snapshotStore.set(key, history);

    const intelligenceIsStale = changedModules.length > 0;
    const now = new Date().toISOString();

    return {
      generatedAt:        now,
      firId:              ctx.activeFirId,
      lastSnapshot:       snapshot,
      snapshotHistory:    [...history],
      totalRebuildCount:  contextVersionCounter,
      lastRebuildAt:      snapshot.capturedAt,
      intelligenceIsStale,
      staleSince:         intelligenceIsStale ? snapshot.capturedAt : undefined,
      summary: intelligenceIsStale
        ? `Investigation data changed in ${changedModules.length} module(s). Intelligence refresh recommended.`
        : 'Investigation data is current. No changes detected since last intelligence run.',
    };
  }

  /** Reset snapshot history for a given FIR (e.g. on FIR switch). */
  static reset(firId?: string): void {
    snapshotStore.delete(storeKey(firId));
  }

  /** Get current context version counter. */
  static getVersion(): number {
    return contextVersionCounter;
  }
}

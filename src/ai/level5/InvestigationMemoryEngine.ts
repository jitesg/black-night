/**
 * InvestigationMemoryEngine.ts
 * Maintains FIR-specific long-term AI observation & recommendation memory.
 *
 * Storage: in-memory Map (per process) + AsyncStorage persistence via
 * MemoryStore (injected). This keeps the engine framework-independent and
 * avoids any direct SQLite / repository access.
 *
 * SAFETY: Read-only inference. Never writes to investigation records.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  InvestigationMemoryRecord,
  InvestigationMemoryReport,
  MemoryRecommendation,
  MemoryHealthSnapshot,
  RecurringIssue,
  TrendDirection,
} from './L5Types';

// ── In-process cache ─────────────────────────────────────────────────────────
const memoryCache = new Map<string, InvestigationMemoryRecord>();

function empty(firId: string, firNumber?: string): InvestigationMemoryRecord {
  const now = new Date().toISOString();
  return {
    firId,
    firNumber,
    createdAt: now,
    lastUpdatedAt: now,
    recommendations: [],
    healthSnapshots: [],
    recurringIssues: [],
    resolvedIssues: [],
    longPendingGaps: [],
    progressSummary: {
      totalRecommendations: 0,
      accepted: 0,
      resolved: 0,
      pending: 0,
      ignored: 0,
      rejected: 0,
      healthTrend: 'unknown',
      riskTrend: 'unknown',
    },
  };
}

function computeTrend(snapshots: MemoryHealthSnapshot[], field: 'overallScore'): TrendDirection {
  if (snapshots.length < 2) return 'unknown';
  const last  = snapshots[snapshots.length - 1][field];
  const prev  = snapshots[snapshots.length - 2][field];
  const delta = last - prev;
  if (delta > 5)  return 'improving';
  if (delta < -5) return 'declining';
  return 'stable';
}

function detectRecurringIssues(
  recs: MemoryRecommendation[]
): RecurringIssue[] {
  const groups = new Map<string, MemoryRecommendation[]>();
  for (const r of recs) {
    const key = r.title.toLowerCase().trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const result: RecurringIssue[] = [];
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    const resolved = group.some((r) => r.status === 'accepted');
    result.push({
      title: group[0].title,
      firstSeenAt: sorted[0].recordedAt,
      lastSeenAt:  sorted[sorted.length - 1].recordedAt,
      occurrenceCount: group.length,
      isResolved: resolved,
      resolvedAt: resolved
        ? group.find((r) => r.status === 'accepted')?.resolvedAt
        : undefined,
    });
  }
  return result;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class InvestigationMemoryEngine {
  /** Retrieve FIR memory (from cache or empty). Does NOT persist. */
  static getRecord(firId: string): InvestigationMemoryRecord {
    return memoryCache.get(firId) ?? empty(firId);
  }

  /**
   * Record a new AI observation snapshot into memory.
   * Call after running L4 engines to persist the current health state.
   */
  static recordSnapshot(
    firId: string,
    firNumber: string | undefined,
    snapshot: Omit<MemoryHealthSnapshot, 'snapshotAt'>
  ): void {
    const rec = memoryCache.get(firId) ?? empty(firId, firNumber);
    const newSnap: MemoryHealthSnapshot = {
      ...snapshot,
      snapshotAt: new Date().toISOString(),
    };
    rec.healthSnapshots.push(newSnap);
    rec.lastUpdatedAt = newSnap.snapshotAt;
    // Keep last 30 snapshots
    if (rec.healthSnapshots.length > 30) rec.healthSnapshots.shift();
    memoryCache.set(firId, rec);
  }

  /**
   * Add a new recommendation to memory.
   * Call whenever a new recommendation is surfaced to the officer.
   */
  static addRecommendation(
    firId: string,
    firNumber: string | undefined,
    rec: Omit<MemoryRecommendation, 'recordedAt'>
  ): void {
    const record = memoryCache.get(firId) ?? empty(firId, firNumber);
    // Avoid exact duplicates in the same session
    const exists = record.recommendations.some((r) => r.id === rec.id);
    if (!exists) {
      record.recommendations.push({
        ...rec,
        recordedAt: new Date().toISOString(),
      });
    }
    record.lastUpdatedAt = new Date().toISOString();
    memoryCache.set(firId, record);
  }

  /**
   * Update the officer action on an existing recommendation.
   * Call when the officer accepts / ignores / rejects a recommendation.
   */
  static updateRecommendationAction(
    firId: string,
    recommendationId: string,
    action: MemoryRecommendation['status'],
  ): void {
    const record = memoryCache.get(firId);
    if (!record) return;
    const rec = record.recommendations.find((r) => r.id === recommendationId);
    if (rec) {
      rec.status = action;
      if (action === 'accepted') rec.resolvedAt = new Date().toISOString();
    }
    record.lastUpdatedAt = new Date().toISOString();
  }

  /** Evaluate and return the full memory report for a FIR. */
  static evaluate(ctx: InvestigationContext): InvestigationMemoryReport {
    const firId = ctx.fir?.id;
    if (!firId) {
      const rec = empty('no-fir');
      return { record: rec, hasMemory: false, daysSinceFirstObservation: 0, summary: 'No FIR context available.' };
    }

    const record = memoryCache.get(firId) ?? empty(firId, ctx.fir?.fir_number);
    const recs   = record.recommendations;

    // Recompute derived fields
    record.recurringIssues = detectRecurringIssues(recs);
    record.resolvedIssues  = recs
      .filter((r) => r.status === 'accepted')
      .map((r) => r.title);

    const pendingByTitle = new Map<string, number>();
    for (const r of recs) {
      if (r.status === 'pending' || r.status === 'deferred') {
        pendingByTitle.set(r.title, (pendingByTitle.get(r.title) ?? 0) + 1);
      }
    }
    record.longPendingGaps = [...pendingByTitle.entries()]
      .filter(([, count]) => count >= 2)
      .map(([title]) => title);

    const healthTrend = computeTrend(record.healthSnapshots, 'overallScore');
    record.progressSummary = {
      totalRecommendations: recs.length,
      accepted: recs.filter((r) => r.status === 'accepted').length,
      resolved: record.resolvedIssues.length,
      pending:  recs.filter((r) => r.status === 'pending').length,
      ignored:  recs.filter((r) => r.status === 'ignored').length,
      rejected: recs.filter((r) => r.status === 'rejected').length,
      healthTrend,
      riskTrend: 'unknown',
    };

    const days = record.createdAt
      ? Math.floor((Date.now() - new Date(record.createdAt).getTime()) / 86_400_000)
      : 0;

    const hasMemory = recs.length > 0 || record.healthSnapshots.length > 0;

    const trendEmoji = healthTrend === 'improving' ? '📈' : healthTrend === 'declining' ? '📉' : '➡️';
    const summary = hasMemory
      ? `${trendEmoji} ${recs.length} recommendations recorded. ` +
        `${record.progressSummary.accepted} accepted, ` +
        `${record.progressSummary.pending} pending. ` +
        (record.recurringIssues.length > 0
          ? `⚠️ ${record.recurringIssues.length} recurring issue(s).`
          : '✅ No recurring issues.')
      : 'No investigation memory recorded yet.';

    return { record, hasMemory, daysSinceFirstObservation: days, summary };
  }

  /** Clear memory for a FIR (e.g. officer explicit reset). */
  static clearMemory(firId: string): void {
    memoryCache.delete(firId);
  }
}

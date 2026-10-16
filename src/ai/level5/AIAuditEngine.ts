/**
 * AIAuditEngine.ts
 * Records all AI recommendations and officer actions in an immutable audit log.
 *
 * Storage: in-memory (per process). Callers may persist via AsyncStorage.
 * Never modifies investigation records — audit-only.
 *
 * SAFETY: Read-only advisory append-only store.
 */

import type {
  AuditEntry,
  AIAuditReport,
  AuditFilter,
  OfficerAction,
  L5ModuleId,
} from './L5Types';

// ── In-process store ──────────────────────────────────────────────────────────
const auditLog: AuditEntry[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class AIAuditEngine {
  /**
   * Record a new AI recommendation event.
   * Call whenever a recommendation is surfaced to the officer.
   */
  static record(
    params: Omit<AuditEntry, 'id' | 'timestamp' | 'officerAction' | 'officerActionAt'>
  ): AuditEntry {
    const entry: AuditEntry = {
      ...params,
      id:           uid(),
      timestamp:    new Date().toISOString(),
      officerAction: 'pending',
    };
    auditLog.push(entry);
    return entry;
  }

  /**
   * Update the officer action on a recorded recommendation.
   * Call when the officer accepts, ignores, or rejects a recommendation.
   */
  static updateAction(
    entryId: string,
    action: OfficerAction
  ): boolean {
    const entry = auditLog.find((e) => e.id === entryId);
    if (!entry) return false;
    entry.officerAction   = action;
    entry.officerActionAt = new Date().toISOString();
    return true;
  }

  /**
   * Retrieve audit entries with optional filters.
   */
  static getEntries(filter?: AuditFilter): AuditEntry[] {
    let entries = [...auditLog];
    if (filter?.firId)          entries = entries.filter((e) => e.firId === filter.firId);
    if (filter?.module)         entries = entries.filter((e) => e.module === filter.module);
    if (filter?.officerAction)  entries = entries.filter((e) => e.officerAction === filter.officerAction);
    if (filter?.fromDate)       entries = entries.filter((e) => e.timestamp >= filter.fromDate!);
    if (filter?.toDate)         entries = entries.filter((e) => e.timestamp <= filter.toDate!);
    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Build a full AIAuditReport with aggregate statistics.
   */
  static buildReport(filter?: AuditFilter): AIAuditReport {
    const entries = AIAuditEngine.getEntries(filter);
    const total   = entries.length;

    const accepted  = entries.filter((e) => e.officerAction === 'accepted').length;
    const ignored   = entries.filter((e) => e.officerAction === 'ignored').length;
    const rejected  = entries.filter((e) => e.officerAction === 'rejected').length;
    const pending   = entries.filter((e) => e.officerAction === 'pending').length;
    const acted     = accepted + ignored + rejected;
    const acceptanceRate = acted > 0 ? Math.round((accepted / acted) * 100) : 0;

    const summary = total === 0
      ? 'No AI recommendations recorded yet.'
      : `${total} AI recommendation(s) recorded. ` +
        `${accepted} accepted, ${ignored} ignored, ${rejected} rejected, ${pending} pending. ` +
        `Acceptance rate: ${acceptanceRate}%.`;

    return { entries, totalEntries: total, acceptedCount: accepted, ignoredCount: ignored, rejectedCount: rejected, pendingCount: pending, acceptanceRate, summary };
  }

  /**
   * Convenience: record and immediately return the entry's ID.
   */
  static recordRecommendation(
    firId: string | undefined,
    firNumber: string | undefined,
    module: L5ModuleId,
    title: string,
    reason: string,
    confidence: number,
    supportingContext: string,
    applicableRule: string,
    sessionId: string
  ): string {
    const entry = AIAuditEngine.record({
      firId, firNumber, module,
      recommendationTitle:   title,
      recommendationReason:  reason,
      confidence,
      supportingContext,
      applicableRule,
      sessionId,
    });
    return entry.id;
  }

  /** Total audit entry count (for badge display). */
  static totalCount(): number {
    return auditLog.length;
  }

  /** Pending action count (for badge display). */
  static pendingCount(): number {
    return auditLog.filter((e) => e.officerAction === 'pending').length;
  }
}

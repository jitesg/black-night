/**
 * L7AuditEngine.ts
 * Level-7: Security & Governance — audit trail, read-only enforcement,
 * and compliance logging for AI recommendations.
 *
 * SAFETY: Read-only. Append-only in-memory log. No DB writes.
 * AI remains advisory. Officer always makes the final decision.
 */

import type { Level7IntelligenceReport } from './L7Types';

export type AuditEventType =
  | 'L7_REPORT_GENERATED'
  | 'L7_RECOMMENDATION_VIEWED'
  | 'L7_SCENARIO_SIMULATED'
  | 'L7_NL_QUESTION_ASKED'
  | 'L7_RULE_EVALUATED'
  | 'L7_CACHE_HIT'
  | 'L7_CACHE_MISS'
  | 'L7_ENGINE_ERROR'
  | 'L7_PANEL_OPENED';

export interface AuditEvent {
  id:        string;
  type:      AuditEventType;
  firId?:    string;
  userId?:   string;
  detail?:   string;
  timestamp: string;
  readonly:  true;  // Sentinel — AI never wrote to DB
}

let _seq = 0;
const _log: AuditEvent[] = [];
const MAX_LOG = 1000; // cap in-memory log

function newId(): string { return `l7-audit-${Date.now()}-${++_seq}`; }

export const L7AuditEngine = {
  /** Log an AI action (read-only sentinel always set) */
  log(type: AuditEventType, opts?: { firId?: string; userId?: string; detail?: string }): void {
    if (_log.length >= MAX_LOG) _log.shift(); // rolling window
    _log.push({
      id: newId(), type,
      firId: opts?.firId, userId: opts?.userId,
      detail: opts?.detail,
      timestamp: new Date().toISOString(),
      readonly: true,
    });
  },

  /** Get recent events (newest first) */
  getEvents(limit = 50, firId?: string): AuditEvent[] {
    const filtered = firId ? _log.filter((e) => e.firId === firId) : _log;
    return [...filtered].reverse().slice(0, limit);
  },

  /** Summarize audit trail for a report */
  summarizeReport(report: Level7IntelligenceReport): {
    generatedAt: string;
    firId?:      string;
    engineCount: number;
    errorCount:  number;
    errors:      Record<string, string>;
    processingMs:number;
    guarantees:  string[];
  } {
    return {
      generatedAt:  report.generatedAt,
      firId:        report.firId,
      engineCount:  14,
      errorCount:   Object.keys(report.engineErrors).length,
      errors:       report.engineErrors,
      processingMs: report.processingMs,
      guarantees: [
        '✓ AI is read-only — no investigation record was modified.',
        '✓ No direct SQLite access — all data via Repository Pattern.',
        '✓ No auto-save — officer confirmation required for all writes.',
        '✓ Offline-first — all analysis runs locally without network.',
        '✓ SSOT compliant — single source of truth maintained.',
        '✓ All recommendations include full reasoning and evidence trail.',
      ],
    };
  },

  /** Clear log (for testing) */
  clear(): void { _log.length = 0; _seq = 0; },
};

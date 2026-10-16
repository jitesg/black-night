/**
 * AuditTransparencyEngine.ts
 * Level-6: Maintains in-memory AI audit trail for every engine run.
 * Records context version, reasoning version, rules executed, modules consulted,
 * recommendation IDs, timestamps, and processing time.
 *
 * SAFETY: Read-only. modifiedData = false always. Never writes to any DB.
 */

import type { L6AuditEntry, L6AuditReport, L6ModuleId } from './L6Types';
import { ContinuousMonitorEngine } from './ContinuousMonitorEngine';

// ── In-memory audit log (session-scoped) ──────────────────────────────────────
const auditLog: L6AuditEntry[] = [];
let entryCounter = 0;

export class AuditTransparencyEngine {
  /**
   * Record a single engine invocation.
   * Called by L6 orchestrator after each engine runs.
   */
  static record(params: {
    firId?:              string;
    module:              L6ModuleId;
    rulesExecuted:       string[];
    modulesConsulted:    L6ModuleId[];
    recommendationIds:   string[];
    sessionId:           string;
    processingMs:        number;
    reasoningVersion?:   string;
  }): L6AuditEntry {
    entryCounter += 1;
    const entry: L6AuditEntry = {
      id:                 `l6-audit-${entryCounter}`,
      firId:              params.firId,
      module:             params.module,
      contextVersion:     ContinuousMonitorEngine.getVersion(),
      reasoningVersion:   params.reasoningVersion ?? 'l6-v1.0',
      rulesExecuted:      params.rulesExecuted,
      modulesConsulted:   params.modulesConsulted,
      recommendationIds:  params.recommendationIds,
      timestamp:          new Date().toISOString(),
      sessionId:          params.sessionId,
      processingMs:       params.processingMs,
      modifiedData:       false,
    };
    auditLog.push(entry);
    return entry;
  }

  /** Generate a full audit report (optionally filtered by firId). */
  static getReport(firId?: string): L6AuditReport {
    const entries = firId
      ? auditLog.filter((e) => e.firId === firId || !e.firId)
      : [...auditLog];

    // Module coverage: count entries per module
    const moduleCoverage: Partial<Record<L6ModuleId, number>> = {};
    for (const e of entries) {
      moduleCoverage[e.module] = (moduleCoverage[e.module] ?? 0) + 1;
    }

    const totalRules = entries.reduce((s, e) => s + e.rulesExecuted.length, 0);
    const avgMs      = entries.length > 0
      ? Math.round(entries.reduce((s, e) => s + e.processingMs, 0) / entries.length)
      : 0;

    return {
      generatedAt:        new Date().toISOString(),
      entries:            entries.slice(-50),   // last 50 entries
      totalEntries:       entries.length,
      moduleCoverage,
      rulesExecutedTotal: totalRules,
      avgProcessingMs:    avgMs,
      summary: entries.length === 0
        ? 'No audit entries recorded yet.'
        : `${entries.length} audit entries. ${Object.keys(moduleCoverage).length} module(s) consulted. Avg processing: ${avgMs}ms.`,
    };
  }

  /** Clear audit log (e.g. on session reset). */
  static reset(): void {
    auditLog.length = 0;
    entryCounter    = 0;
  }
}

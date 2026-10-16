/**
 * devOptionsStore.ts — Feature flags + developer audit log for Developer Options.
 *
 * All flags are in-memory only:
 *  - They reset on app restart (intentional — no persistent debug state in prod).
 *  - They never affect business logic or repository code.
 *  - They are only read by DevOptions UI components.
 *
 * Audit log is a ring-buffer (max 200 entries) stored in memory.
 * A future version can persist to AsyncStorage under a __DEV__ guard.
 *
 * SECURITY: Never persisted in production. __DEV__ gate on all callers.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeatureFlags {
  developerMode: boolean;
  debugLogs: boolean;
  performanceMonitor: boolean;
  sqlLogging: boolean;
  aiDebug: boolean;
  searchDebug: boolean;
  navigationDebug: boolean;
  animationDebug: boolean;
}

export interface DevAuditEntry {
  id: string;
  timestamp: string;        // ISO 8601
  action: string;
  section: string;
  outcome: 'success' | 'cancelled' | 'error';
  detail?: string;
}

// ── Default flags ─────────────────────────────────────────────────────────────

const DEFAULT_FLAGS: FeatureFlags = {
  developerMode: false,
  debugLogs: false,
  performanceMonitor: false,
  sqlLogging: false,
  aiDebug: false,
  searchDebug: false,
  navigationDebug: false,
  animationDebug: false,
};

// ── Store (singleton, in-memory) ─────────────────────────────────────────────

let _flags: FeatureFlags = { ...DEFAULT_FLAGS };
let _auditLog: DevAuditEntry[] = [];
const MAX_LOG = 200;

let _listeners: Array<() => void> = [];

function _notify() {
  _listeners.forEach((fn) => fn());
}

// ── Flag API ──────────────────────────────────────────────────────────────────

export function getFlags(): FeatureFlags {
  return { ..._flags };
}

export function setFlag(key: keyof FeatureFlags, value: boolean): void {
  _flags = { ..._flags, [key]: value };
  _addAudit({
    action: `Toggle ${key}`,
    section: 'Feature Flags',
    outcome: 'success',
    detail: `${key} → ${value}`,
  });
  _notify();
}

export function resetFlags(): void {
  _flags = { ...DEFAULT_FLAGS };
  _addAudit({ action: 'Reset all feature flags', section: 'Feature Flags', outcome: 'success' });
  _notify();
}

// ── Audit log API ─────────────────────────────────────────────────────────────

export function _addAudit(entry: Omit<DevAuditEntry, 'id' | 'timestamp'>): void {
  const e: DevAuditEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  _auditLog = [e, ..._auditLog].slice(0, MAX_LOG);
  _notify();
}

export function getAuditLog(): DevAuditEntry[] {
  return [..._auditLog];
}

export function clearAuditLog(): void {
  _auditLog = [];
  _notify();
}

// ── Subscription ──────────────────────────────────────────────────────────────

export function subscribeDevOptions(fn: () => void): () => void {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((l) => l !== fn); };
}

// ── React hook ───────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';

export function useDevOptions() {
  const [flags, setFlagsState] = useState<FeatureFlags>(getFlags);
  const [auditLog, setAuditLogState] = useState<DevAuditEntry[]>(getAuditLog);

  useEffect(() => {
    const unsub = subscribeDevOptions(() => {
      setFlagsState(getFlags());
      setAuditLogState(getAuditLog());
    });
    return unsub;
  }, []);

  const toggle = useCallback((key: keyof FeatureFlags) => {
    setFlag(key, !_flags[key]);
  }, []);

  return { flags, auditLog, toggle, resetFlags };
}

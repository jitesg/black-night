/**
 * appLogger.ts — App-Wide Structured Debug & Diagnostic System
 *
 * ARCHITECTURE
 * ─────────────
 * Centralised singleton event store. Every module, screen, repo, service,
 * and DB operation funnels through ONE API — logEvent(). Events are stored
 * in a ring-buffer (MAX_ENTRIES = 1000, newest first). Listeners are notified
 * on every write so the Debug Console live-updates without polling.
 *
 * PRODUCTION SAFETY
 * ──────────────────
 * All logging is gated on __DEV__. In a production build every exported
 * function is a no-op — zero overhead, zero data exposure.
 *
 * CATEGORIES
 * ───────────
 *  SCREEN   — screen open / close / focus / blur
 *  NAV      — navigation push / replace / pop
 *  ACTION   — button tap / tab change / form open / save / delete / search / filter / sort
 *  REPO     — repository method call with timing + row count
 *  DB       — raw SQL query with timing + result
 *  ERROR    — caught exceptions + stack traces
 *  PERF     — screen load time / render count / memory snapshot
 *  CRASH    — unhandled runtime errors (last 100 logs attached automatically)
 *  AUTH     — authentication events
 *  SYNC     — sync / seed / analytics refresh events
 */

import { useState, useEffect } from 'react';
import Constants from 'expo-constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogCategory =
  | 'SCREEN'
  | 'NAV'
  | 'ACTION'
  | 'REPO'
  | 'DB'
  | 'ERROR'
  | 'PERF'
  | 'CRASH'
  | 'AUTH'
  | 'SYNC';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface AppLogEntry {
  /** Monotonically incrementing numeric ID — unique within a session. */
  id: number;
  /** Unix ms timestamp. */
  timestamp: number;
  /** ISO-8601 date-time string for display. */
  isoTime: string;
  category: LogCategory;
  level: LogLevel;
  /** Top-level module: Mukadma | Nyayalay | GD | PrarthnaPatra | Halka | Knowledge | Dev | Auth | etc. */
  module: string;
  /** Screen name, e.g. "FIRList", "AddNyayalay". */
  screen: string;
  /** Human description of what happened. */
  action: string;
  /** Any additional structured payload. */
  detail?: Record<string, unknown>;
  /** Document or entity ID involved (FIR ID, GD ID, Nyayalay doc ID, etc.). */
  entityId?: string;
  /** Execution time in ms (repo calls, DB queries, screen loads). */
  execMs?: number;
  /** Number of rows returned by a DB/repo call. */
  rowsReturned?: number;
  /** SQL query text (populated for DB category only). */
  sql?: string;
  /** Human-readable result summary. */
  result?: string;
  success: boolean;
  /** Error message (populated for ERROR / CRASH categories). */
  errorMessage?: string;
  /** Stack trace string (populated for ERROR / CRASH categories). */
  stackTrace?: string;
  /** For CRASH entries: snapshot of the 100 entries that preceded the crash. */
  precedingLogs?: AppLogEntry[];
}

// ── Internal state ────────────────────────────────────────────────────────────

const MAX_ENTRIES = 1000;

let _entries: AppLogEntry[] = [];
let _counter = 0;
const _listeners = new Set<() => void>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function _notify(): void {
  _listeners.forEach((fn) => fn());
}

function _makeEntry(
  partial: Omit<AppLogEntry, 'id' | 'timestamp' | 'isoTime' | 'success'> &
    { success?: boolean },
): AppLogEntry {
  const now = Date.now();
  return {
    id: ++_counter,
    timestamp: now,
    isoTime: new Date(now).toISOString(),
    success: partial.success ?? true,
    ...partial,
  };
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Emit a single structured log event.
 * No-op in production (__DEV__ === false).
 *
 * `success` defaults to true so callers that don't pass it don't need to.
 */
export function logEvent(
  partial: Omit<AppLogEntry, 'id' | 'timestamp' | 'isoTime' | 'success'> & { success?: boolean },
): void {
  if (!__DEV__) return;
  const entry = _makeEntry(partial);
  _entries = [entry, ..._entries].slice(0, MAX_ENTRIES);
  _notify();
}

/**
 * Shorthand helpers — cover the most common call patterns so callers
 * don't need to repeat category/level every time.
 */

export const AppLogger = {
  // ── Screen lifecycle ────────────────────────────────────────────────────

  screenOpen(module: string, screen: string, entityId?: string): void {
    logEvent({ category: 'SCREEN', level: 'info', module, screen, action: 'Screen Open', entityId, detail: { event: 'focus' } });
  },

  screenClose(module: string, screen: string, durationMs?: number, entityId?: string): void {
    logEvent({ category: 'SCREEN', level: 'info', module, screen, action: 'Screen Close', execMs: durationMs, entityId, detail: { event: 'blur' } });
  },

  // ── Navigation ──────────────────────────────────────────────────────────

  navigate(from: string, to: string, method: 'push' | 'replace' | 'back' | 'reset' = 'push'): void {
    logEvent({ category: 'NAV', level: 'info', module: 'Navigation', screen: from, action: `Navigate ${method}: ${to}`, detail: { from, to, method } });
  },

  // ── User actions ────────────────────────────────────────────────────────

  buttonTap(module: string, screen: string, button: string, entityId?: string): void {
    logEvent({ category: 'ACTION', level: 'info', module, screen, action: `Tap: ${button}`, entityId });
  },

  tabChange(module: string, screen: string, tab: string): void {
    logEvent({ category: 'ACTION', level: 'info', module, screen, action: `Tab Change → ${tab}` });
  },

  formOpen(module: string, screen: string, formName: string, entityId?: string): void {
    logEvent({ category: 'ACTION', level: 'info', module, screen, action: `Form Open: ${formName}`, entityId });
  },

  formSave(module: string, screen: string, formName: string, success: boolean, entityId?: string, detail?: Record<string, unknown>): void {
    logEvent({ category: 'ACTION', level: success ? 'info' : 'error', module, screen, action: `Form Save: ${formName}`, success, entityId, detail });
  },

  formEdit(module: string, screen: string, field: string, entityId?: string): void {
    logEvent({ category: 'ACTION', level: 'debug', module, screen, action: `Field Edit: ${field}`, entityId });
  },

  deleteAction(module: string, screen: string, target: string, entityId?: string): void {
    logEvent({ category: 'ACTION', level: 'warn', module, screen, action: `Delete: ${target}`, entityId });
  },

  search(module: string, screen: string, query: string, rowsReturned?: number): void {
    logEvent({ category: 'ACTION', level: 'info', module, screen, action: `Search: "${query}"`, rowsReturned });
  },

  filter(module: string, screen: string, filters: Record<string, unknown>): void {
    logEvent({ category: 'ACTION', level: 'info', module, screen, action: 'Filter Applied', detail: filters });
  },

  sort(module: string, screen: string, field: string, direction: 'asc' | 'desc'): void {
    logEvent({ category: 'ACTION', level: 'info', module, screen, action: `Sort: ${field} ${direction}` });
  },

  checklistToggle(module: string, screen: string, item: string, checked: boolean, entityId?: string): void {
    logEvent({ category: 'ACTION', level: 'info', module, screen, action: `Checklist Toggle: "${item}" → ${checked ? 'checked' : 'unchecked'}`, entityId });
  },

  datePicker(module: string, screen: string, field: string, value: string, entityId?: string): void {
    logEvent({ category: 'ACTION', level: 'info', module, screen, action: `Date Picker: ${field} = ${value}`, entityId });
  },

  richEditor(module: string, screen: string, field: string, charCount: number, entityId?: string): void {
    logEvent({ category: 'ACTION', level: 'debug', module, screen, action: `Rich Editor: ${field} (${charCount} chars)`, entityId });
  },

  autoFill(module: string, screen: string, fieldsPopulated: number, entityId?: string): void {
    logEvent({ category: 'ACTION', level: 'info', module, screen, action: `Auto Fill: ${fieldsPopulated} fields`, entityId });
  },

  reportGeneration(module: string, screen: string, templateName: string, success: boolean, execMs?: number, entityId?: string): void {
    logEvent({ category: 'ACTION', level: success ? 'info' : 'error', module, screen, action: `Report Generation: ${templateName}`, success, execMs, entityId });
  },

  fileSelection(module: string, screen: string, fileName: string, entityId?: string): void {
    logEvent({ category: 'ACTION', level: 'info', module, screen, action: `File Selected: ${fileName}`, entityId });
  },

  // ── Repository calls ────────────────────────────────────────────────────

  repoCall(
    module: string,
    method: string,
    params?: Record<string, unknown>,
    execMs?: number,
    rowsReturned?: number,
    success: boolean = true,
    error?: string,
  ): void {
    logEvent({
      category: 'REPO',
      level: success ? 'info' : 'error',
      module,
      screen: module,
      action: `Repo: ${method}`,
      detail: params ? { params } : undefined,
      execMs,
      rowsReturned,
      success,
      errorMessage: error,
    });
  },

  // ── DB / SQL ────────────────────────────────────────────────────────────

  dbQuery(
    module: string,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION',
    sql: string,
    execMs?: number,
    rowsReturned?: number,
    success: boolean = true,
    error?: string,
  ): void {
    logEvent({
      category: 'DB',
      level: success ? 'debug' : 'error',
      module,
      screen: module,
      action: `DB ${operation}`,
      sql: sql.slice(0, 300),
      execMs,
      rowsReturned,
      success,
      errorMessage: error,
    });
  },

  // ── Error / Exception ───────────────────────────────────────────────────

  error(module: string, screen: string, action: string, err: unknown, entityId?: string): void {
    const [msg, stack] = _extractError(err);
    logEvent({ category: 'ERROR', level: 'error', module, screen, action, success: false, errorMessage: msg, stackTrace: stack, entityId });
  },

  warn(module: string, screen: string, action: string, detail?: Record<string, unknown>): void {
    logEvent({ category: 'ERROR', level: 'warn', module, screen, action, success: true, detail });
  },

  // ── Performance ─────────────────────────────────────────────────────────

  screenLoadTime(module: string, screen: string, ms: number): void {
    logEvent({ category: 'PERF', level: ms > 2000 ? 'warn' : 'info', module, screen, action: 'Screen Load Time', execMs: ms });
  },

  renderCount(module: string, screen: string, count: number): void {
    logEvent({ category: 'PERF', level: count > 30 ? 'warn' : 'debug', module, screen, action: `Render Count: ${count}`, detail: { count } });
  },

  // ── Auth ────────────────────────────────────────────────────────────────

  auth(action: string, success: boolean, detail?: Record<string, unknown>): void {
    logEvent({ category: 'AUTH', level: success ? 'info' : 'error', module: 'Auth', screen: 'Auth', action, success, detail });
  },

  // ── Sync / Seed / Analytics ─────────────────────────────────────────────

  sync(action: string, detail?: Record<string, unknown>, success: boolean = true): void {
    logEvent({ category: 'SYNC', level: success ? 'info' : 'error', module: 'Sync', screen: 'Sync', action, success, detail });
  },

  // ── Crash capture ───────────────────────────────────────────────────────

  crash(errorMessage: string, stackTrace: string, screen: string, action: string): void {
    if (!__DEV__) return;
    const preceding = _entries.slice(0, 100);
    logEvent({
      category: 'CRASH',
      level: 'error',
      module: 'CRASH',
      screen,
      action,
      success: false,
      errorMessage,
      stackTrace,
      precedingLogs: preceding,
    });
  },
};

// ── Subscription API ──────────────────────────────────────────────────────────

export function subscribeAppLogs(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getAppLogSnapshot(): AppLogEntry[] {
  return _entries;
}

export function clearAppLogs(): void {
  _entries = [];
  _notify();
}

// ── React hook ────────────────────────────────────────────────────────────────

export function useAppLogs(): AppLogEntry[] {
  const [entries, setEntries] = useState<AppLogEntry[]>(() => getAppLogSnapshot());
  useEffect(() => {
    setEntries(getAppLogSnapshot());
    const unsub = subscribeAppLogs(() => setEntries(getAppLogSnapshot()));
    return unsub;
  }, []);
  return entries;
}

// ── Device / App meta (used in export reports) ────────────────────────────────

export interface AppMeta {
  appName: string;
  appVersion: string;
  buildNumber: string;
  platform: string;
  osVersion: string;
  device: string;
  environment: string;
  sessionStart: string;
}

const _sessionStart = new Date().toISOString();

export function getAppMeta(): AppMeta {
  return {
    appName: (Constants.expoConfig?.name ?? 'InvestSuite'),
    appVersion: (Constants.expoConfig?.version ?? '1.0.0'),
    buildNumber: String(Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? 'N/A'),
    platform: process.env.EXPO_OS ?? 'android',
    osVersion: '14',
    device: `${process.env.EXPO_OS ?? 'android'} mobile`,
    environment: __DEV__ ? 'Development' : 'Production',
    sessionStart: _sessionStart,
  };
}

// ── Internals ─────────────────────────────────────────────────────────────────

function _extractError(err: unknown): [string, string] {
  if (err instanceof Error) return [err.message, err.stack ?? ''];
  return [String(err), ''];
}

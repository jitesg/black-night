/**
 * debugLogStore.ts — In-app console log capture
 *
 * Intercepts console.log / console.warn / console.error at module-load time
 * and pushes every call into an in-memory ring buffer (max 500 entries).
 * The original console methods are still called — nothing is suppressed.
 *
 * Usage
 *   // Install once at app startup (root _layout.tsx):
 *   import '@/lib/debugLogStore';       // side-effect import installs interceptor
 *
 *   // React screens:
 *   import { useDebugLogs, clearDebugLogs } from '@/lib/debugLogStore';
 *   const entries = useDebugLogs();     // re-renders when new lines arrive
 *
 *   // Anywhere (non-React):
 *   import { getDebugLogSnapshot } from '@/lib/debugLogStore';
 *   const snap = getDebugLogSnapshot();
 */

import { useState, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogLevel = 'log' | 'warn' | 'error' | 'info';

export interface DebugLogEntry {
  id: string;           // monotonically incrementing string id
  timestamp: number;    // Date.now()
  level: LogLevel;
  message: string;      // all args stringified and joined with space
}

// ── Internal state ────────────────────────────────────────────────────────────

const MAX_ENTRIES = 500;

let _entries: DebugLogEntry[] = [];
let _counter = 0;
const _listeners = new Set<() => void>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function _stringify(args: unknown[]): string {
  return args
    .map((a) => {
      if (a === null) return 'null';
      if (a === undefined) return 'undefined';
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(' ');
}

function _push(level: LogLevel, args: unknown[]): void {
  const entry: DebugLogEntry = {
    id: String(++_counter),
    timestamp: Date.now(),
    level,
    message: _stringify(args),
  };
  // Prepend so index-0 is always newest; trim to ring-buffer size
  _entries = [entry, ..._entries].slice(0, MAX_ENTRIES);
  _listeners.forEach((fn) => fn());
}

// ── Console interceptor (installed once at module-load time) ──────────────────

let _installed = false;

function _install(): void {
  if (_installed) return;
  _installed = true;

  /* eslint-disable no-console */
  const _origLog   = console.log.bind(console);
  const _origWarn  = console.warn.bind(console);
  const _origError = console.error.bind(console);
  const _origInfo  = console.info.bind(console);

  console.log = (...args: unknown[]) => { _origLog(...args);   _push('log',   args); };
  console.warn  = (...args: unknown[]) => { _origWarn(...args);  _push('warn',  args); };
  console.error = (...args: unknown[]) => { _origError(...args); _push('error', args); };
  console.info  = (...args: unknown[]) => { _origInfo(...args);  _push('info',  args); };
  /* eslint-enable no-console */
}

// Install only in DEV builds — production binaries must never buffer console
// output in memory (data-exposure risk + unnecessary overhead).
if (__DEV__) {
  _install();
} else {
  // Release builds: drop console.log/info/debug entirely. Each call still
  // formatted its arguments and wrote to the Android system log, and many sit
  // in hot paths (renders, DB queries), costing frame time. Warnings and
  // errors are kept.
  /* eslint-disable no-console */
  const noop = () => { /* silenced in release */ };
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  /* eslint-enable no-console */
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns a snapshot of all captured entries (newest first). */
export function getDebugLogSnapshot(): DebugLogEntry[] {
  return _entries;
}

/** Clears the in-memory ring buffer and notifies subscribers. */
export function clearDebugLogs(): void {
  _entries = [];
  _listeners.forEach((fn) => fn());
}

/**
 * Subscribe to changes. Returns an unsubscribe function.
 * Called once per new entry batch — use getDebugLogSnapshot() inside
 * the callback to get the current list.
 */
export function subscribeDebugLogs(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/**
 * React hook — returns the current entries array and re-renders whenever
 * new entries arrive. Safe to call from any component.
 */
export function useDebugLogs(): DebugLogEntry[] {
  const [entries, setEntries] = useState<DebugLogEntry[]>(() => getDebugLogSnapshot());

  useEffect(() => {
    // Sync on mount in case entries arrived between render and effect
    setEntries(getDebugLogSnapshot());
    const unsub = subscribeDebugLogs(() => {
      setEntries(getDebugLogSnapshot());
    });
    return unsub;
  }, []);

  return entries;
}

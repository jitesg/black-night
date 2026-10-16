/**
 * debugReport.ts — Complete Debug Report Generator
 *
 * Assembles a fully-structured report from AppLogger's ring-buffer
 * and returns both a JSON payload and a human-readable TXT string.
 *
 * Report sections:
 *  1. App Info & Device Info
 *  2. Session Summary (entry counts by category)
 *  3. Navigation Timeline
 *  4. Database Operations (DB category)
 *  5. Repository Calls (REPO category)
 *  6. Screen Lifecycle (SCREEN category)
 *  7. User Actions (ACTION category)
 *  8. Auth Events
 *  9. Sync Events
 * 10. Errors & Warnings (ERROR category)
 * 11. Performance Metrics (PERF category)
 * 12. Crash Logs (CRASH category — includes preceding 100 entries)
 * 13. Full Log (all entries, newest first)
 *
 * Usage:
 *   const { json, txt } = generateDebugReport();
 *   await Clipboard.setStringAsync(txt);
 */

import { getAppLogSnapshot, getAppMeta, type AppLogEntry, type LogCategory } from './appLogger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DebugReportSection {
  title: string;
  entries: AppLogEntry[];
}

export interface DebugReport {
  meta: ReturnType<typeof getAppMeta>;
  generatedAt: string;
  totalEntries: number;
  summary: Record<LogCategory, number>;
  navTimeline: AppLogEntry[];
  dbOps: AppLogEntry[];
  repoCalls: AppLogEntry[];
  screenEvents: AppLogEntry[];
  userActions: AppLogEntry[];
  authEvents: AppLogEntry[];
  syncEvents: AppLogEntry[];
  errorsAndWarnings: AppLogEntry[];
  performance: AppLogEntry[];
  crashes: AppLogEntry[];
  fullLog: AppLogEntry[];
}

// ── Generator ─────────────────────────────────────────────────────────────────

export function generateDebugReport(): { json: string; txt: string; report: DebugReport } {
  const all = getAppLogSnapshot();
  const meta = getAppMeta();
  const generatedAt = new Date().toISOString();

  const byCategory = (cat: LogCategory) => all.filter((e) => e.category === cat);

  const summary = {} as Record<LogCategory, number>;
  const cats: LogCategory[] = ['SCREEN', 'NAV', 'ACTION', 'REPO', 'DB', 'ERROR', 'PERF', 'CRASH', 'AUTH', 'SYNC'];
  cats.forEach((c) => { summary[c] = byCategory(c).length; });

  const report: DebugReport = {
    meta,
    generatedAt,
    totalEntries: all.length,
    summary,
    navTimeline: byCategory('NAV'),
    dbOps: byCategory('DB'),
    repoCalls: byCategory('REPO'),
    screenEvents: byCategory('SCREEN'),
    userActions: byCategory('ACTION'),
    authEvents: byCategory('AUTH'),
    syncEvents: byCategory('SYNC'),
    errorsAndWarnings: byCategory('ERROR'),
    performance: byCategory('PERF'),
    crashes: byCategory('CRASH'),
    fullLog: all,
  };

  const json = JSON.stringify(report, null, 2);
  const txt = _buildTxt(report);

  return { json, txt, report };
}

// ── TXT formatter ─────────────────────────────────────────────────────────────

function _line(char = '─', len = 72): string {
  return char.repeat(len);
}

function _header(title: string): string {
  return `\n${_line('═')}\n  ${title.toUpperCase()}\n${_line('═')}\n`;
}

function _subHeader(title: string): string {
  return `\n${_line()}\n  ${title}\n${_line()}\n`;
}

function _entryLine(e: AppLogEntry): string {
  const t = new Date(e.timestamp).toLocaleTimeString('en-IN', { hour12: false });
  const lvl = e.level.toUpperCase().padEnd(5);
  const cat = e.category.padEnd(8);
  const mod = (e.module || '').padEnd(16).slice(0, 16);
  const scr = (e.screen || '').padEnd(20).slice(0, 20);
  const ok  = e.success ? '✓' : '✗';
  const dur = e.execMs !== undefined ? ` [${e.execMs}ms]` : '';
  const rows = e.rowsReturned !== undefined ? ` rows=${e.rowsReturned}` : '';
  const err = e.errorMessage ? `\n    ⚠ ${e.errorMessage}` : '';
  const sql = e.sql ? `\n    SQL: ${e.sql.slice(0, 120)}` : '';
  const stk = e.stackTrace ? `\n    STACK: ${e.stackTrace.split('\n').slice(0, 3).join(' | ')}` : '';
  return `${t}  ${lvl} ${cat} ${mod} ${scr}  ${ok}  #${e.id}  ${e.action}${dur}${rows}${err}${sql}${stk}`;
}

function _buildTxt(r: DebugReport): string {
  const lines: string[] = [];

  lines.push(_header('InvestSuite Debug Report'));

  // App & device info
  lines.push(_subHeader('1. App & Device Info'));
  const m = r.meta;
  lines.push(`App Name    : ${m.appName}`);
  lines.push(`Version     : ${m.appVersion}  Build: ${m.buildNumber}`);
  lines.push(`Platform    : ${m.platform}  OS: ${m.osVersion}`);
  lines.push(`Device      : ${m.device}`);
  lines.push(`Environment : ${m.environment}`);
  lines.push(`Session Start: ${m.sessionStart}`);
  lines.push(`Report Time : ${r.generatedAt}`);

  // Summary
  lines.push(_subHeader('2. Session Summary'));
  lines.push(`Total Events: ${r.totalEntries}`);
  Object.entries(r.summary).forEach(([cat, count]) => {
    lines.push(`  ${cat.padEnd(10)} : ${count}`);
  });

  // Crashes (highest priority — shown near top)
  if (r.crashes.length > 0) {
    lines.push(_subHeader('3. CRASH LOGS ⚠'));
    r.crashes.forEach((e) => {
      lines.push(_entryLine(e));
      if (e.precedingLogs && e.precedingLogs.length > 0) {
        lines.push('  ── Preceding 100 logs ──');
        e.precedingLogs.slice(0, 100).forEach((p) => lines.push('  ' + _entryLine(p)));
      }
    });
  }

  // Errors & Warnings
  lines.push(_subHeader('4. Errors & Warnings'));
  if (r.errorsAndWarnings.length === 0) {
    lines.push('  (none)');
  } else {
    r.errorsAndWarnings.forEach((e) => lines.push(_entryLine(e)));
  }

  // Navigation Timeline
  lines.push(_subHeader('5. Navigation Timeline'));
  if (r.navTimeline.length === 0) {
    lines.push('  (none)');
  } else {
    r.navTimeline.forEach((e) => lines.push(_entryLine(e)));
  }

  // Screen Events
  lines.push(_subHeader('6. Screen Lifecycle'));
  if (r.screenEvents.length === 0) {
    lines.push('  (none)');
  } else {
    r.screenEvents.forEach((e) => lines.push(_entryLine(e)));
  }

  // User Actions
  lines.push(_subHeader('7. User Actions'));
  if (r.userActions.length === 0) {
    lines.push('  (none)');
  } else {
    r.userActions.forEach((e) => lines.push(_entryLine(e)));
  }

  // Repository Calls
  lines.push(_subHeader('8. Repository Calls'));
  if (r.repoCalls.length === 0) {
    lines.push('  (none)');
  } else {
    r.repoCalls.forEach((e) => lines.push(_entryLine(e)));
  }

  // DB Operations
  lines.push(_subHeader('9. Database Operations'));
  if (r.dbOps.length === 0) {
    lines.push('  (none)');
  } else {
    r.dbOps.forEach((e) => lines.push(_entryLine(e)));
  }

  // Auth
  lines.push(_subHeader('10. Auth Events'));
  if (r.authEvents.length === 0) {
    lines.push('  (none)');
  } else {
    r.authEvents.forEach((e) => lines.push(_entryLine(e)));
  }

  // Sync
  lines.push(_subHeader('11. Sync / Seed / Analytics'));
  if (r.syncEvents.length === 0) {
    lines.push('  (none)');
  } else {
    r.syncEvents.forEach((e) => lines.push(_entryLine(e)));
  }

  // Performance
  lines.push(_subHeader('12. Performance'));
  if (r.performance.length === 0) {
    lines.push('  (none)');
  } else {
    r.performance.forEach((e) => lines.push(_entryLine(e)));
  }

  // Full log
  lines.push(_subHeader('13. Full Log (all entries, newest first)'));
  if (r.fullLog.length === 0) {
    lines.push('  (no events captured)');
  } else {
    r.fullLog.forEach((e) => lines.push(_entryLine(e)));
  }

  lines.push(`\n${_line('═')}\n  END OF REPORT\n${_line('═')}\n`);
  return lines.join('\n');
}

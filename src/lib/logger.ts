/**
 * logger.ts — Production-safe internal logger + AppLogger bridge.
 *
 * In development (__DEV__ === true):  logs are forwarded to console AND to
 * the structured AppLogger ring-buffer so they appear in the Debug Console.
 * In production  (__DEV__ === false): all output is silenced to avoid
 * exposing internal paths, query strings, or stack traces in release builds.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.warn('Something non-fatal', error);
 *   logger.error('Critical failure', context);
 *
 * Tagged usage (preferred — enables module-level filtering):
 *   logger.module('Mukadma').warn('Missing FIR', { firId });
 */

/* eslint-disable no-console */
import { logEvent } from './appLogger';

const noop = () => { /* silenced in production */ };

function _tag(level: 'info' | 'warn' | 'error' | 'debug', module: string, args: unknown[]): void {
  const message = args
    .map((a) => {
      if (a === null) return 'null';
      if (a === undefined) return 'undefined';
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(' ');
  logEvent({
    category: level === 'error' ? 'ERROR' : 'SCREEN',
    level: level === 'debug' ? 'debug' : level,
    module,
    screen: module,
    action: message,
    success: level !== 'error',
    errorMessage: level === 'error' ? message : undefined,
  });
}

function _makeTagged(module: string) {
  return {
    log:   __DEV__ ? (...args: unknown[]) => { console.log(`[${module}]`, ...args);   _tag('info',  module, args); } : noop,
    warn:  __DEV__ ? (...args: unknown[]) => { console.warn(`[${module}]`, ...args);  _tag('warn',  module, args); } : noop,
    error: __DEV__ ? (...args: unknown[]) => { console.error(`[${module}]`, ...args); _tag('error', module, args); } : noop,
    debug: __DEV__ ? (...args: unknown[]) => { console.log(`[${module}][DEBUG]`, ...args); _tag('debug', module, args); } : noop,
  };
}

export const logger = {
  log:   __DEV__ ? (...args: unknown[]) => { console.log(...args);         _tag('info',  'App', args); } : noop,
  warn:  __DEV__ ? (...args: unknown[]) => { console.warn(...args);        _tag('warn',  'App', args); } : noop,
  error: __DEV__ ? (...args: unknown[]) => { console.error(...args);       _tag('error', 'App', args); } : noop,
  debug: __DEV__ ? (...args: unknown[]) => { console.log('[DEBUG]', ...args); _tag('debug', 'App', args); } : noop,
  /** Returns a module-scoped logger: all entries tagged with the module name. */
  module: (mod: string) => _makeTagged(mod),
};

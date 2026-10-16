/**
 * withRepoLogger.ts — Transparent repository call wrapper.
 *
 * Wraps any async repository function so every call is automatically
 * logged with: method name, param summary, execution time, row count,
 * success/failure, and error message.
 *
 * Usage:
 *   // Wrap a single call ad-hoc:
 *   const firs = await withRepoLogger('Mukadma', 'getAllFIRs', () => getAllFIRs());
 *
 *   // Wrap an entire repo object (all methods instrumented):
 *   const repo = wrapRepo('Nyayalay', { getAllDocs, createDoc, updateDoc });
 *   const docs = await repo.getAllDocs(workspaceId);
 *
 * No-op wrapper in production — the original function is called directly.
 */

import { AppLogger } from './appLogger';

/**
 * Wraps a single async function with AppLogger.repoCall instrumentation.
 * @param module   Top-level module name, e.g. "Mukadma"
 * @param method   Method name, e.g. "getAllFIRs"
 * @param fn       The actual async function to call
 * @param params   Optional parameter summary for the log entry
 */
export async function withRepoLogger<T>(
  module: string,
  method: string,
  fn: () => Promise<T>,
  params?: Record<string, unknown>,
): Promise<T> {
  if (!__DEV__) return fn();

  const start = Date.now();
  try {
    const result = await fn();
    const execMs = Date.now() - start;
    const rows = Array.isArray(result) ? result.length : result !== null && result !== undefined ? 1 : 0;
    AppLogger.repoCall(module, method, params, execMs, rows, true);
    return result;
  } catch (err: unknown) {
    const execMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    AppLogger.repoCall(module, method, params, execMs, 0, false, msg);
    throw err;
  }
}

/**
 * Wraps all methods of a repo object with withRepoLogger.
 * The return type mirrors the original repo type exactly.
 */
type AsyncFn = (...args: unknown[]) => Promise<unknown>;
type RepoShape = Record<string, AsyncFn>;
type WrappedRepo<T extends RepoShape> = T;

export function wrapRepo<T extends RepoShape>(module: string, repo: T): WrappedRepo<T> {
  if (!__DEV__) return repo;

  const wrapped: RepoShape = {};
  for (const [key, fn] of Object.entries(repo)) {
    wrapped[key] = async (...args: unknown[]) => {
      return withRepoLogger(module, key, () => fn(...args), { argsCount: args.length });
    };
  }
  return wrapped as WrappedRepo<T>;
}

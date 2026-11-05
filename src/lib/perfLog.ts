/**
 * Lightweight real perf numbers for Dev options → Performance (optimisation pass). In-memory only, no UI change elsewhere.
 * `bootAt` is taken when this module is first imported (first line of index.ts).
 */
const bootAt = Date.now();
const marks: Record<string, number> = {};

/** Duration (ms) for a named measurement — e.g. seedMs, lastSearchMs. */
export function perfSet(name: string, ms: number): void { marks[name] = Math.round(ms); }
/** "Time since app start" mark, recorded once (e.g. firstScreen). */
export function perfMarkOnce(name: string): void { if (marks[name] == null) marks[name] = Date.now() - bootAt; }
export function perfSnapshot(): Record<string, number> { return { ...marks }; }

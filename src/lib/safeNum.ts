/**
 * safeNum.ts — Guarantees analytics values are always safe integers.
 *
 * Prevents NaN, null, undefined, Infinity, and negative counts from
 * appearing in any analytics card or productivity metric display.
 *
 * Usage:
 *   import { safeNum } from '@/lib/safeNum';
 *   <Text>{safeNum(analytics.total)}</Text>
 *
 * safeNum(undefined) → 0
 * safeNum(NaN)       → 0
 * safeNum(-5)        → 0  (counts cannot be negative)
 * safeNum(3.7)       → 3  (floor, not round)
 * safeNum(42)        → 42
 */
export function safeNum(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  if (!isFinite(n) || isNaN(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

/**
 * safePct — Returns a percentage clamped to [0, 100].
 * Prevents NaN from division by zero.
 */
export function safePct(numerator: unknown, denominator: unknown): number {
  const n = safeNum(numerator);
  const d = safeNum(denominator);
  if (d === 0) return 0;
  return Math.min(100, Math.round((n / d) * 100));
}

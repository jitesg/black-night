/**
 * Screen-size rule for the orientation policy (owner, option ख): a phone stays portrait, a tablet (or an opened foldable)
 * may turn. Android's own tablet line = smallest width ≥ 600 dp. Pure — tests scripts/test_screen_size.ts.
 */
export const TABLET_MIN_DP = 600;

/** true = large screen (tablet / opened foldable) → free rotation; false = phone → portrait only. */
export function isLargeScreen(width: number, height: number): boolean {
  const w = Number(width); const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
  return Math.min(w, h) >= TABLET_MIN_DP;
}

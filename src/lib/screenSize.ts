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

/**
 * Tablet layout (owner: Home = B "दो कॉलम", every other screen = A "बीच में सीमित चौड़ाई"). Phones: nothing changes.
 * CONTENT_MAX_DP = width of a normal screen on a tablet (centred, the sides show the background colour);
 * HOME_WIDE_MAX_DP = Home in two columns, used only when the window is at least HOME_TWO_COL_MIN_DP wide (tablet lying).
 */
export const CONTENT_MAX_DP = 720;
export const HOME_WIDE_MAX_DP = 1040;
export const HOME_TWO_COL_MIN_DP = 900;

/** Left / right padding that centres the content at `maxContent` dp — 0 on a phone or when the window is narrower. */
export function sidePadding(width: number, height: number, maxContent: number = CONTENT_MAX_DP): number {
  if (!isLargeScreen(width, height)) return 0;
  const w = Number(width);
  const m = Number(maxContent);
  if (!Number.isFinite(m) || m <= 0 || w <= m) return 0;
  return Math.floor((w - m) / 2);
}

/** Home shows two columns (design B) — only a large screen that is wide enough (a tablet lying down). */
export function homeTwoColumns(width: number, height: number): boolean {
  return isLargeScreen(width, height) && Number(width) >= HOME_TWO_COL_MIN_DP;
}

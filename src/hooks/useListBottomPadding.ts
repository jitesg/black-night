/**
 * useListBottomPadding — shared hook for all module list screens.
 *
 * Returns the paddingBottom value to add to a FlatList / ScrollView
 * contentContainerStyle so that list content is never obscured by the
 * bottom navigation bar or home-indicator area.
 *
 * Formula: device safe-area bottom inset + a fixed gap above the nav bar.
 * The gap constant (80dp) was derived from the formats/index.tsx fix in v375
 * and matches the observed rendered height of the bottom tab bar plus breathing room.
 *
 * All four module list screens (GD, FIR, Nirodhatmak, Nyayalay) import from
 * here so the calculation lives in exactly one place.
 */

/** Approximate rendered height of the bottom nav bar in dp. */
const BOTTOM_NAV_HEIGHT = 80;

/** Minimum padding to apply even on screens without a nav bar (e.g. iPad split-view). */
const MIN_PADDING = 32;

export function useListBottomPadding(): number {
  // The root view already sits above the system navigation bar (KeyboardInsetView),
  // so only the in-app gap is needed here.
  return Math.max(BOTTOM_NAV_HEIGHT, MIN_PADDING);
}

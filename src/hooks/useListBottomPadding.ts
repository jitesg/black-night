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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Approximate rendered height of the bottom nav bar in dp. */
const BOTTOM_NAV_HEIGHT = 80;

/** Minimum padding to apply even on screens without a nav bar (e.g. iPad split-view). */
const MIN_PADDING = 32;

export function useListBottomPadding(): number {
  const { bottom } = useSafeAreaInsets();
  return Math.max(bottom + BOTTOM_NAV_HEIGHT, MIN_PADDING);
}

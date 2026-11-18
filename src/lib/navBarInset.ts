/**
 * Height of the Android navigation bar (back / home buttons) for Modals.
 * Screens are kept above it by KeyboardInsetView; a Modal is its own window
 * drawn edge-to-edge, so its outermost view pads by this amount.
 *
 * Owner's bug (build 46): this was read ONCE when the app started (initialWindowMetrics). On the owner's phone that first
 * reading was 0, so every Modal ("कैसे भरें", the full-screen editor, वाक्यांश लाइब्रेरी …) slid under the 3 buttons while the
 * normal screens — measured live — were fine. Now KeyboardInsetView (root, every render) passes the live inset in via
 * `setNavBarInset`, and `NAV_BAR_INSET` is a live binding: every Modal reads the current value when it renders.
 */
import { initialWindowMetrics } from 'react-native-safe-area-context';

export let NAV_BAR_INSET: number = initialWindowMetrics?.insets.bottom ?? 0;

/** Called with the live bottom inset (KeyboardInsetView). */
export function setNavBarInset(bottom: number): void {
  if (Number.isFinite(bottom) && bottom >= 0) NAV_BAR_INSET = bottom;
}

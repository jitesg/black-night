/**
 * Height of the Android navigation bar (back / home buttons) for Modals.
 * Screens are kept above it by KeyboardInsetView; a Modal is its own window
 * drawn edge-to-edge, so its outermost view pads by this amount.
 */
import { initialWindowMetrics } from 'react-native-safe-area-context';

export const NAV_BAR_INSET: number = initialWindowMetrics?.insets.bottom ?? 0;

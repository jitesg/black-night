/**
 * Header Design Tokens — Material Design 3 · Minimal Aesthetic
 *
 * All dimensions in dp (device-independent pixels).
 * Total visible AppHeader height = safeGap + appBarHeight + bottomPad = 56dp content
 * + system safe-area-top.
 *
 * Usage:
 *   import { H } from '@/lib/headerTokens';
 *   // paddingTop: insets.top + H.safeGap
 */

export const H = {
  /** Gap between safe-area top edge and first app-bar content row */
  safeGap: 0,

  /** App-bar content row height — 44dp row so total header ≈ 56dp usable */
  appBarHeight: 44,

  /** Fixed height for the universal search bar */
  searchHeight: 48,

  /** Vertical gap between app-bar row and search bar */
  searchGap: 8,

  /** Padding below all header content before screen body */
  bottomPad: 8,

  /** Horizontal padding for all header content */
  horizontalPad: 16,

  /** Gap between items inside the app-bar row */
  rowGap: 8,

  /** Touch-target size for icon buttons (back, actions) */
  iconBtnSize: 40,

  /** Icon button corner radius — pill shape */
  iconBtnRadius: 20,

  /** Navigation + action icon size */
  iconSize: 22,

  // ── Semantic colours (MD3 Minimal — no navy, no saffron) ─────────────────

  /** App-bar background — pure white (light) / near-black (dark handled by className) */
  surface: '#FFFFFF' as const,

  /** Primary text on headers */
  onSurface: '#111827' as const,

  /** Muted / secondary text */
  onSurfaceMuted: '#6B7280' as const,

  /** Hairline divider */
  divider: '#E5E7EB' as const,

  /** Icon button hover/active bg */
  iconBtnBg: 'rgba(0,0,0,0.05)' as const,

  // ── Legacy aliases — kept so existing callers don't break ────────────────
  /** @deprecated Use semantic className tokens instead */
  navy: '#111827' as const,

  /** @deprecated Use semantic className tokens instead */
  saffron: '#2563EB' as const,
} as const;

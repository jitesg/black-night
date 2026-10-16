/**
 * Typography & Spacing Tokens — single source of truth for all InvestSuite text styles and layout.
 *
 * ARCHITECTURE
 * ────────────
 * Follows the exact same `as const` object pattern used by src/lib/headerTokens.ts.
 * Every screen, component, and module imports from this file — no hardcoded
 * fontSize, lineHeight, fontWeight, padding, margin, or gap values anywhere.
 *
 * FONT FAMILY DECISION
 * ────────────────────
 * Audit result: src/app/_layout.tsx loads no custom font (no useFonts / expo-font call).
 * app.json only lists "expo-font" as a plugin with no font asset declarations.
 * Decision: use each platform's native system font for maximum readability and zero bundle cost.
 *   iOS     → SF Pro     (Apple HIG standard)
 *   Android → Roboto     (Material Design 3 / Samsung One UI standard)
 *   Web     → system-ui  (browser default system stack)
 * No font files are bundled.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * Apple Human Interface Guidelines · Samsung One UI · Material Design 3
 * Result: clean, compact, professional, readable, accessible.
 * All paired foreground/background combinations meet WCAG AA (≥4.5:1).
 *
 * SCALE RATIONALE (Apple HIG × MD3 hybrid, optimised for Devanagari + Latin)
 * ──────────────────────────────────────────────────────────────────────────
 * largeTitle  34/41/700 — App-level page titles (sparingly)
 * title1      28/34/700 — Major section entry screens
 * title2      22/28/600 — Standard screen titles (ScreenHeader / ModuleHeader)
 * title3      20/25/600 — Card titles / section group headers
 * headline    17/22/600 — List item primary text, list card titles
 * body        16/22/400 — Default body text, form fields, FlatList rows
 * callout     15/20/400 — Secondary descriptive text, subtitles
 * subhead     14/20/400 — Input field text, table cells, form labels
 * footnote    13/18/400 — Helper text, error messages, action buttons
 * caption1    12/16/400 — Metadata, timestamps, badges, count labels
 * caption2    11/15/400 — Fine labels, sub-counts, tiny helper text
 * micro       10/14/600 — Uppercase chip labels, section headers, tab bar labels
 *
 * USAGE
 * ─────
 *   import { T } from '@/lib/typography';
 *   <Text style={T.headline}>FIR Title</Text>
 *   <View style={{ padding: T.space.md, minHeight: T.minTouchTarget }}>
 */

import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

// ─── Font family ──────────────────────────────────────────────────────────────
// Android: 'sans-serif' = Roboto, which has limited Devanagari glyph coverage
// causing inconsistent weight/baseline between Hindi and Latin text.
// We load NotoSansDevanagari (a variable font covering all weights) in
// src/app/_layout.tsx and reference it here so ALL Text in the app uses a
// single consistent font that covers both scripts equally well.
//
// iOS: SF Pro has full Devanagari support natively — no custom font needed.
// Web: system-ui fallback is fine for preview; native APK/IPA is what matters.
const SYSTEM_FONT = Platform.select({
  ios:     'System',          // SF Pro — full Devanagari support built-in
  android: 'NotoSansDevanagari', // loaded via useFonts in _layout.tsx
  default: 'System',          // Web: system-ui
});

// ─── Scale ────────────────────────────────────────────────────────────────────
// Each entry is a complete TextStyle subset — spread directly into style props.
// fontFamily is always explicit so React Native never falls back to a legacy default.

export const T = {

  // ── Type scale ─────────────────────────────────────────────────────────────

  /** 34pt · 700 — Rare app-level entry screens (splash, onboarding, error screens). */
  largeTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize:   34,
    lineHeight: 41,
    fontWeight: '700',
  } satisfies TextStyle,

  /** 28pt · 700 — Major section headers, top-of-module titles. */
  title1: {
    fontFamily: SYSTEM_FONT,
    fontSize:   28,
    lineHeight: 34,
    fontWeight: '700',
  } satisfies TextStyle,

  /** 22pt · 600 — Standard screen titles in ScreenHeader / ModuleHeader. */
  title2: {
    fontFamily: SYSTEM_FONT,
    fontSize:   22,
    lineHeight: 28,
    fontWeight: '600',
  } satisfies TextStyle,

  /** 20pt · 600 — Card section titles, collapsible group headers. */
  title3: {
    fontFamily: SYSTEM_FONT,
    fontSize:   20,
    lineHeight: 25,
    fontWeight: '600',
  } satisfies TextStyle,

  /** 17pt · 600 — List item primary titles, emphasized body text, form section labels. */
  headline: {
    fontFamily: SYSTEM_FONT,
    fontSize:   17,
    lineHeight: 22,
    fontWeight: '600',
  } satisfies TextStyle,

  /** 16pt · 400 — Default body text, FlatList item text, form field content. */
  body: {
    fontFamily: SYSTEM_FONT,
    fontSize:   16,
    lineHeight: 22,
    fontWeight: '400',
  } satisfies TextStyle,

  /** 15pt · 400 — Secondary descriptive text, module subtitles. */
  callout: {
    fontFamily: SYSTEM_FONT,
    fontSize:   15,
    lineHeight: 20,
    fontWeight: '400',
  } satisfies TextStyle,

  /** 14pt · 400 — Input field text, table cells, form labels, button labels. */
  subhead: {
    fontFamily: SYSTEM_FONT,
    fontSize:   14,
    lineHeight: 20,
    fontWeight: '400',
  } satisfies TextStyle,

  /** 13pt · 400 — Helper text, error messages, secondary action text. */
  footnote: {
    fontFamily: SYSTEM_FONT,
    fontSize:   13,
    lineHeight: 18,
    fontWeight: '400',
  } satisfies TextStyle,

  /** 12pt · 400 — Metadata, timestamps, badge text, module count labels. */
  caption1: {
    fontFamily: SYSTEM_FONT,
    fontSize:   12,
    lineHeight: 16,
    fontWeight: '400',
  } satisfies TextStyle,

  /** 11pt · 400 — Fine labels, sub-counts, drawer version text, tiny helper text. */
  caption2: {
    fontFamily: SYSTEM_FONT,
    fontSize:   11,
    lineHeight: 15,
    fontWeight: '400',
  } satisfies TextStyle,

  /** 10pt · 600 · UPPERCASE — Chip labels, section group headers, tab bar labels, filter pills. */
  micro: {
    fontFamily:    SYSTEM_FONT,
    fontSize:      10,
    lineHeight:    14,
    fontWeight:    '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } satisfies TextStyle,

  // ── Header title (MD3 AppHeader — 56dp total height) ─────────────────────
  /** 17pt · 600 — AppHeader title (MD3 Title Medium spec). */
  headerTitle: {
    fontFamily: SYSTEM_FONT,
    fontSize:   17,
    lineHeight: 22,
    fontWeight: '600',
  } satisfies TextStyle,

  /** 11pt · 500 · uppercase — AppHeader subtitle label above the title. */
  headerSubtitle: {
    fontFamily:    SYSTEM_FONT,
    fontSize:      11,
    lineHeight:    14,
    fontWeight:    '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } satisfies TextStyle,

  /** 11pt · 400 — AppHeader count label below the title. */
  headerCount: {
    fontFamily: SYSTEM_FONT,
    fontSize:   11,
    lineHeight: 15,
    fontWeight: '400',
  } satisfies TextStyle,

  // ── Font family export (for monospace overrides in code/debug views) ─────
  /**
   * Monospace stack for debug consoles, raw JSON, markdown code blocks.
   * NOT for body text — only for verbatim technical output.
   */
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  } satisfies TextStyle,

  // ── Spacing scale (dp) ────────────────────────────────────────────────────
  space: {
    /** 4dp — tight gap between icon and label, chip internal padding */
    xs: 4,
    /** 8dp — gap between related elements, form field gap, row gap */
    sm: 8,
    /** 16dp — standard screen horizontal padding, card internal padding */
    md: 16,
    /** 24dp — section vertical gap, between-card spacing */
    lg: 24,
    /** 32dp — large section breathing room, screen bottom padding */
    xl: 32,
  } as const,

  // ── Touch target ──────────────────────────────────────────────────────────
  /**
   * 48dp — minimum tappable control size per Apple HIG, Material Design 3,
   * and WCAG 2.5.5 (Target Size). Use for every interactive element:
   * buttons, icon buttons, list rows, chips, toggles.
   */
  minTouchTarget: 48,

  // ── Font weight helpers (string literal type for React Native TextStyle) ──
  weight: {
    regular:   '400' as const,
    medium:    '500' as const,
    semibold:  '600' as const,
    bold:      '700' as const,
    extrabold: '800' as const,
    black:     '900' as const,
  },

} as const;

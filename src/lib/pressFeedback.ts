/**
 * Which touch feedback a Pressable gets (owner, sample C) — pure rules used by selectableText.tsx; tests
 * scripts/test_press_feedback.ts. `style` = the flattened style object, or 'fn' when the Pressable uses a style function.
 */
export interface PressInfo {
  android: boolean;
  disabled?: unknown;
  hasPress: boolean;
  /** the Pressable sets android_ripple itself (even null) */
  ownRipple: boolean;
  style: Record<string, unknown> | 'fn';
}

export function pressFeedback(p: PressInfo): { ripple: boolean; scale: boolean } {
  const none = { ripple: false, scale: false };
  if (!p.android || p.disabled || !p.hasPress) return none;
  if (p.style === 'fn') return { ripple: !p.ownRipple, scale: false };
  const f = p.style;
  const rounded = Number(f.borderRadius ?? f.borderTopLeftRadius ?? 0) > 0;
  // full-screen / absolute layers: sheet backdrops, "tap outside to close", keyboard-dismiss areas
  if (f.position === 'absolute' || (Number(f.flex ?? 0) >= 1 && !rounded)) return none;
  return { ripple: !p.ownRipple, scale: rounded && f.transform == null };
}

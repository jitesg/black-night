/**
 * App-wide selectable text (long-press → Select / Copy / Translate).
 *
 * Imported first in the root index.ts. It replaces the `Text` export of
 * react-native with a wrapper that turns `selectable` on, and wraps the
 * Pressable / Touchable* exports so text INSIDE buttons, cards and list rows
 * stays non-selectable (otherwise a long-press would start a selection instead
 * of pressing the button). Rules:
 *   • an explicit `selectable` prop always wins
 *   • text with its own onPress / onLongPress is not selectable
 *   • text inside a Pressable / Touchable is not selectable
 * TextInputs already support select / copy / paste on their own.
 *
 * Android only: text that can wrap always uses textBreakStrategy "highQuality"
 * ("simple" splits a letter from its matra); Hindi text gets a line height of
 * at least 1.5 × fontSize (also when includeFontPadding is off), so the top
 * matras (ि ी े ै ँ) and bottom ones (ु ू ृ ्र) are not cut; and the phone's
 * font-size setting is capped at 1.2× so very large system fonts don't push
 * text out of buttons, pills and headers.
 */
import React, { createContext, forwardRef, useContext } from 'react';

const NoSelectContext = createContext(false);

// Real RN module object (the getters we override live on it).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rnModule = require('react-native') as Record<string, unknown>;

type AnyProps = Record<string, unknown> & { children?: unknown };

function patch(name: string, make: (orig: React.ComponentType<AnyProps>) => unknown): void {
  const orig = rnModule[name] as React.ComponentType<AnyProps> | undefined;
  if (!orig || (orig as { __selectPatched?: boolean }).__selectPatched) return;
  const next = make(orig) as { __selectPatched?: boolean; displayName?: string };
  next.__selectPatched = true;
  next.displayName = (orig as { displayName?: string }).displayName ?? name;
  try {
    Object.defineProperty(rnModule, name, { get: () => next, configurable: true, enumerable: true });
  } catch { /* export not configurable — leave as is */ }
}

const IS_ANDROID = (rnModule.Platform as { OS?: string } | undefined)?.OS === 'android';
const flatten = (rnModule.StyleSheet as { flatten: (s: unknown) => Record<string, unknown> | undefined }).flatten;
/** Devanagari needs ~1.5× the font size per line, or matras (ि े ु ्र) get cut. */
const MIN_LINE_RATIO = 1.45;
const FIX_LINE_RATIO = 1.5;
/** Phone font size ("Display → Font size") is honoured up to this factor. */
const MAX_FONT_SCALE = 1.2;
const DEVANAGARI = /[\u0900-\u097F\uA8E0-\uA8FF]/;

/** true when the text (or a nested Text) has Hindi letters; numbers / English stay as they are. */
function hasDevanagari(children: unknown, depth = 0): boolean {
  if (children == null || typeof children === 'boolean' || depth > 4) return false;
  if (typeof children === 'string') return DEVANAGARI.test(children);
  if (typeof children === 'number') return false;
  if (Array.isArray(children)) return children.some((c) => hasDevanagari(c, depth + 1));
  const props = (children as { props?: { children?: unknown } }).props;
  return props ? hasDevanagari(props.children, depth + 1) : false;
}

patch('Text', (OrigText) => forwardRef<unknown, AnyProps>(function SelectableText(props, ref) {
  const noSelect = useContext(NoSelectContext);
  const selectable = props.selectable !== undefined
    ? props.selectable
    : !noSelect && !props.onPress && !props.onLongPress;
  if (!IS_ANDROID) return React.createElement(OrigText, { ...props, selectable, ref });

  // Hindi text cut on Android (owner's screenshots, build 21):
  //  • textBreakStrategy "simple" breaks a line between a letter and its matra
  //    ("चेकलिस्ट" → "चकालस्ट" + the matras on a hidden 2nd line), so text that
  //    may wrap always uses "highQuality"; "simple" is kept only on one-line
  //    labels (pills), where it just trims the extra space;
  //  • a lineHeight too small for the font clips the top / bottom matras →
  //    raise it to 1.4 × fontSize.
  //  • very large phone font sizes overflow fixed-height rows → cap the scale.
  let style = props.style;
  if (style && hasDevanagari(props.children)) {
    const flat = flatten(style);
    const fs = Number(flat?.fontSize) || 14;
    const lh = Number(flat?.lineHeight);
    const tight = lh > 0 ? lh < fs * MIN_LINE_RATIO : flat?.includeFontPadding === false;
    if (tight) style = [style, { lineHeight: Math.ceil(fs * FIX_LINE_RATIO) }];
  }
  return React.createElement(OrigText, {
    maxFontSizeMultiplier: MAX_FONT_SCALE,
    ...props,
    style,
    textBreakStrategy: props.numberOfLines === 1 && props.textBreakStrategy === 'simple' ? 'simple' : 'highQuality',
    selectable,
    ref,
  });
}));

function wrapPressable(Orig: React.ComponentType<AnyProps>) {
  return forwardRef<unknown, AnyProps>(function NoSelectPressable(props, ref) {
    const c = props.children;
    const children = typeof c === 'function'
      ? (state: unknown) => React.createElement(NoSelectContext.Provider, { value: true }, (c as (s: unknown) => React.ReactNode)(state))
      : React.createElement(NoSelectContext.Provider, { value: true }, c as React.ReactNode);
    return React.createElement(Orig, { ...props, ref, children } as AnyProps);
  });
}

for (const name of ['Pressable', 'TouchableOpacity', 'TouchableHighlight']) patch(name, wrapPressable);

// TouchableWithoutFeedback clones its single child, so it must stay the direct parent.
patch('TouchableWithoutFeedback', (Orig) => forwardRef<unknown, AnyProps>(function NoSelectTWF(props, ref) {
  const child = React.Children.only(props.children as React.ReactElement<AnyProps>);
  const wrapped = React.isValidElement(child)
    ? React.cloneElement(child, undefined, React.createElement(NoSelectContext.Provider, { value: true }, child.props.children as React.ReactNode))
    : child;
  return React.createElement(Orig, { ...props, ref }, wrapped);
}));

export {};

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
 * Android only: every Text also gets textBreakStrategy="simple" and a minimum
 * line height of 1.4 × fontSize, so Hindi lines and matras are not cut.
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
/** Devanagari needs ~1.4× the font size per line, or matras (ि े ु ्र) get cut. */
const MIN_LINE_RATIO = 1.35;
const FIX_LINE_RATIO = 1.4;

patch('Text', (OrigText) => forwardRef<unknown, AnyProps>(function SelectableText(props, ref) {
  const noSelect = useContext(NoSelectContext);
  const selectable = props.selectable !== undefined
    ? props.selectable
    : !noSelect && !props.onPress && !props.onLongPress;
  if (!IS_ANDROID) return React.createElement(OrigText, { ...props, selectable, ref });

  // Hindi text cut on Android (owner's report):
  //  • the default "highQuality" line breaking measures Devanagari lines too
  //    short, so the last letters of a line are cut → use "simple" everywhere;
  //  • a lineHeight too small for the font clips the top / bottom matras →
  //    raise it to 1.4 × fontSize.
  let style = props.style;
  if (style) {
    const flat = flatten(style);
    const fs = Number(flat?.fontSize);
    const lh = Number(flat?.lineHeight);
    if (fs > 0 && lh > 0 && lh < fs * MIN_LINE_RATIO) style = [style, { lineHeight: Math.ceil(fs * FIX_LINE_RATIO) }];
  }
  return React.createElement(OrigText, {
    ...props,
    style,
    textBreakStrategy: props.textBreakStrategy ?? 'simple',
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

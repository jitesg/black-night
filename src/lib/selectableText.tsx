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

patch('Text', (OrigText) => forwardRef<unknown, AnyProps>(function SelectableText(props, ref) {
  const noSelect = useContext(NoSelectContext);
  const selectable = props.selectable !== undefined
    ? props.selectable
    : !noSelect && !props.onPress && !props.onLongPress;
  return React.createElement(OrigText, { ...props, selectable, ref });
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

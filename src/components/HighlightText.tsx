import React, { memo, useMemo } from 'react';
import { Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { buildFuzzyHighlightSegments } from '@/lib/searchUtils';
import { THEME } from '@/lib/theme';

interface HighlightTextProps {
  text: string;
  query: string;
  style?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  typoTolerant?: boolean;
}

export const HighlightText = memo(function HighlightText({
  text,
  query,
  style,
  highlightStyle,
  numberOfLines,
  typoTolerant = false,
}: HighlightTextProps) {
  // Mirror the active palette so highlight colours flip with the theme.
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const DEFAULT_HIGHLIGHT: TextStyle = {
    backgroundColor: palette.accent,
    color:           palette.accentForeground,
    borderRadius:    2,
  };

  // Ensure the base text color is always the card-foreground token so titles
  // remain readable on both light (#FFFFFF) and dark (#1E293B) card surfaces.
  // Without this, React Native's default Text color (#000) renders as near-black
  // text on dark cards — failing WCAG AA contrast.
  const baseColor: TextStyle = { color: palette.cardForeground };

  // Segment computation is expensive for long strings — memoize on text + query + typoTolerant.
  const segments = useMemo(
    () => buildFuzzyHighlightSegments(text, query, typoTolerant),
    [text, query, typoTolerant]
  );

  // Fast path: no match → render plain text; avoids creating any <Text> children.
  const hasHighlight = segments.some((s) => s.highlighted);
  if (!hasHighlight) {
    return (
      <Text style={[baseColor, style]} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  // Stable keys: combine char offset of each segment's start position with a
  // content fingerprint so keys survive list re-ordering without using random values.
  let offset = 0;
  return (
    <Text style={[baseColor, style]} numberOfLines={numberOfLines}>
      {segments.map((seg) => {
        const key = `${offset}-${seg.highlighted ? 'h' : 'p'}-${seg.text.slice(0, 8)}`;
        offset += seg.text.length;
        return seg.highlighted ? (
          <Text key={key} style={[DEFAULT_HIGHLIGHT, highlightStyle]}>
            {seg.text}
          </Text>
        ) : (
          // Plain segment: inherits color + typography from parent <Text>.
          <Text key={key}>{seg.text}</Text>
        );
      })}
    </Text>
  );
});

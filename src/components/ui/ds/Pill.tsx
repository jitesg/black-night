/**
 * Pill — the one standard "chip / tag / badge" look for the whole app.
 *
 * Standard properties (also exported as PILL so other chips can match):
 *   xs: height 20, horizontal padding 8,  font 11   (compact card footers)
 *   sm: height 24, horizontal padding 10, font 12   (tags, small badges)
 *   md: height 30, horizontal padding 12, font 13   (filter chips)
 *   radius 999, label on ONE line, trimmed, centred vertically.
 *
 * Android note: Hindi (Devanagari) labels were measured wider than the text
 * with the default "highQuality" break strategy, leaving odd empty space
 * inside chips (e.g. "आबकारी", "आपराधिक"). Pills use textBreakStrategy
 * "simple" and no font padding so the chip hugs its text.
 *
 * Colours come from the theme, so light and dark mode both work.
 */
import React, { memo } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export const PILL = {
  xs: { height: 20, paddingHorizontal: 8, fontSize: 11, lineHeight: 14, gap: 3 },
  sm: { height: 24, paddingHorizontal: 10, fontSize: 12, lineHeight: 16, gap: 4 },
  md: { height: 30, paddingHorizontal: 12, fontSize: 13, lineHeight: 18, gap: 6 },
  radius: 999,
  textProps: { numberOfLines: 1, textBreakStrategy: 'simple' as const },
} as const;

export type PillTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface PillProps {
  label: string;
  size?: 'xs' | 'sm' | 'md';
  /** Named tone, or pass `color` for a module accent colour. */
  tone?: PillTone;
  color?: string;
  /** Filled look for the selected state of a filter chip. */
  selected?: boolean;
  /** Outlined look (filter chips that are not selected). */
  outline?: boolean;
  icon?: React.ReactNode;
  /** Small count shown after the label. */
  count?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const TONES: Record<PillTone, { light: string; dark: string }> = {
  neutral: { light: '#475569', dark: '#CBD5E1' },
  primary: { light: '#4F46E5', dark: '#A5B4FC' },
  success: { light: '#15803D', dark: '#4ADE80' },
  warning: { light: '#B45309', dark: '#FCD34D' },
  danger:  { light: '#DC2626', dark: '#F87171' },
  info:    { light: '#0369A1', dark: '#67E8F9' },
};

export const Pill = memo(function Pill({
  label, size = 'sm', tone = 'neutral', color, selected = false, outline = false,
  icon, count, onPress, style, accessibilityLabel,
}: PillProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = THEME[colorScheme ?? 'light'];
  const s = PILL[size];
  const accent = color ?? TONES[tone][isDark ? 'dark' : 'light'];

  const bg = selected
    ? accent
    : outline
      ? 'transparent'
      : tone === 'neutral' && !color ? c.secondary : `${accent}${isDark ? '2E' : '1A'}`;
  const fg = selected ? (isDark ? '#0F172A' : '#FFFFFF') : tone === 'neutral' && !color ? c.secondaryForeground : accent;
  const border = selected ? accent : outline ? c.border : 'transparent';

  const body = (
    <>
      {icon}
      <Text
        {...PILL.textProps}
        style={{ flexShrink: 1, fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: '600', color: fg, includeFontPadding: false }}
      >
        {label.trim()}
      </Text>
      {count != null && count > 0 ? (
        <Text {...PILL.textProps} style={{ fontSize: s.fontSize - 1, lineHeight: s.lineHeight, fontWeight: '700', color: fg, opacity: 0.8, includeFontPadding: false }}>
          {count}
        </Text>
      ) : null}
    </>
  );

  const boxStyle: StyleProp<ViewStyle> = [
    {
      flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
      height: s.height, paddingHorizontal: s.paddingHorizontal, gap: s.gap,
      borderRadius: PILL.radius, backgroundColor: bg, borderWidth: 1, borderColor: border,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={accessibilityLabel ?? label}
        hitSlop={6}
        className="active:opacity-70"
        style={boxStyle}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={boxStyle} accessibilityLabel={accessibilityLabel}>{body}</View>;
});

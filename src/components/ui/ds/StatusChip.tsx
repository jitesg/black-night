/**
 * StatusChip — compact semantic badge for status indication.
 * Height: 24dp · Pill shape · 5 variants
 */
import { memo } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { PILL } from './Pill';

export type StatusChipVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'active';

export interface StatusChipProps {
  label: string;
  variant?: StatusChipVariant;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export const StatusChip = memo(function StatusChip({
  label,
  variant = 'neutral',
  icon,
  style,
}: StatusChipProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const variantStyles: Record<StatusChipVariant, { bg: string; text: string }> = {
    success: isDark
      ? { bg: 'rgba(74,222,128,0.2)', text: '#4ADE80' }
      : { bg: 'rgba(22,163,74,0.12)', text: '#15803D' },
    warning: isDark
      ? { bg: 'rgba(252,211,77,0.2)', text: '#FCD34D' }
      : { bg: 'rgba(217,119,6,0.12)', text: '#B45309' },
    error: isDark
      ? { bg: 'rgba(248,113,113,0.2)', text: '#F87171' }
      : { bg: 'rgba(220,38,38,0.12)', text: '#DC2626' },
    info: isDark
      ? { bg: 'rgba(103,232,249,0.2)', text: '#67E8F9' }
      : { bg: 'rgba(2,132,199,0.12)', text: '#0369A1' },
    active: isDark
      ? { bg: 'rgba(167,139,250,0.2)', text: '#A78BFA' }
      : { bg: 'rgba(109,40,217,0.12)', text: '#6D28D9' },
    neutral: isDark
      ? { bg: 'rgba(148,163,184,0.2)', text: c.mutedForeground }
      : { bg: 'rgba(107,114,128,0.12)', text: c.mutedForeground },
  };

  const cfg = variantStyles[variant];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: PILL.sm.gap,
          height: PILL.sm.height,
          paddingHorizontal: PILL.sm.paddingHorizontal,
          borderRadius: PILL.radius,
          backgroundColor: cfg.bg,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {icon}
      <Text {...PILL.textProps} style={{ fontSize: PILL.sm.fontSize, lineHeight: PILL.sm.lineHeight, color: cfg.text, fontWeight: '600', includeFontPadding: false }}>
        {label}
      </Text>
    </View>
  );
});

/**
 * AppCard — Soft Indigo surface card.
 *
 * Variants:
 *   elevated  — card bg + Tailwind shadow (iOS + Android safe, no legacy shadow* props)
 *   filled    — off-white muted bg, no shadow
 *   outlined  — transparent bg + hairline border
 */
import { memo } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useColorScheme } from 'nativewind';
import { cn } from '@/lib/utils';
import { THEME } from '@/lib/theme';

export interface AppCardProps {
  variant?: 'elevated' | 'filled' | 'outlined';
  padding?: number;
  radius?: number;
  children: React.ReactNode;
  style?: ViewStyle;
  className?: string;
}

export const AppCard = memo(function AppCard({
  variant = 'elevated',
  padding = 16,
  radius = 20,
  children,
  style,
  className,
}: AppCardProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  const base: ViewStyle = {
    borderRadius: radius,
    padding,
    ...(({ borderCurve: 'continuous' } as unknown) as ViewStyle),
  };

  const variantStyle: ViewStyle =
    variant === 'elevated'
      ? { backgroundColor: c.card }
      : variant === 'filled'
      ? { backgroundColor: c.muted }
      : {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: c.border,
        };

  // Tailwind shadow classes — rendered natively by NativeWind; no legacy shadow* props.
  const shadowClass = variant === 'elevated' ? 'shadow-sm shadow-black/5' : undefined;

  return (
    <View className={cn(shadowClass, className)} style={[base, variantStyle, style]}>
      {children}
    </View>
  );
});

/**
 * Badge — notification dot / count badge.
 * Renders as an overlay on a parent — position: absolute top-right.
 */
import { memo } from 'react';
import { Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { T } from '@/lib/typography';

export interface BadgeProps {
  count?: number;
  dot?: boolean;
  color?: string;
}

export const Badge = memo(function Badge({
  count,
  dot = false,
  color,
}: BadgeProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  const badgeBg = color ?? (colorScheme === 'dark' ? '#F87171' : '#DC2626');
  const badgeTextColor = color ? '#FFFFFF' : (colorScheme === 'dark' ? '#0F172A' : '#FFFFFF');

  if (dot) {
    return (
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: badgeBg,
          position: 'absolute',
          top: -2,
          right: -2,
        }}
      />
    );
  }

  if (!count || count === 0) return null;

  return (
    <View
      style={{
        minWidth: count > 9 ? 20 : 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: badgeBg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        position: 'absolute',
        top: -4,
        right: -4,
      }}
    >
      <Text style={{ ...T.caption2, color: badgeTextColor, fontWeight: '700' }}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
});

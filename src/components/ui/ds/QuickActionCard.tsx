/**
 * QuickActionCard — compact action tile.
 * Soft Indigo palette: translucent indigo icon tray, solid indigo icon.
 */
import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export interface QuickActionCardProps {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
  color?: string;
  badge?: number | string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const QuickActionCard = memo(function QuickActionCard({
  icon: Icon, label, onPress, color,
  badge, disabled = false, size = 'md',
}: QuickActionCardProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  const dim = size === 'sm' ? 40 : 48;
  const iconSize = size === 'sm' ? 18 : 22;
  const activeColor = color ?? c.primary;
  // 12 % alpha tint of the accent colour for the icon container background
  const iconBg = `${activeColor}1F`;
  const badgeBg = colorScheme === 'dark' ? '#F87171' : '#DC2626';
  const badgeTextColor = colorScheme === 'dark' ? '#0F172A' : '#FFFFFF';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ opacity: disabled ? 0.4 : 1, alignItems: 'center', gap: 6 }}
      className="active:opacity-60"
    >
      {/* Icon container — translucent accent tint, rounded-full */}
      <View style={{
        width: dim, height: dim,
        borderRadius: dim / 2,
        backgroundColor: iconBg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={iconSize} color={activeColor} />
        {badge != null ? (
          <View style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 16, height: 16, borderRadius: 8,
            backgroundColor: badgeBg,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 3,
          }}>
            <Text style={{ fontSize: 9, fontWeight: '700', color: badgeTextColor }}>
              {String(badge)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Label */}
      <Text
        numberOfLines={2}
        style={{
          fontSize: 11, fontWeight: '500',
          color: c.foreground,
          textAlign: 'center', lineHeight: 14, maxWidth: 64,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
});

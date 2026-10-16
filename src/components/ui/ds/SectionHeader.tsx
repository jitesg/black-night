/**
 * SectionHeader — minimal section divider with optional trailing action.
 * Height: 40dp · Title Medium · Hairline top divider optional
 */
import { memo } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { T } from '@/lib/typography';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  divider?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const SectionHeader = memo(function SectionHeader({
  title,
  actionLabel,
  onAction,
  divider = false,
  style,
  icon,
}: SectionHeaderProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const actionColor = colorScheme === 'dark' ? '#FBBF24' : '#B45309';

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 8,
          ...(divider && { borderTopWidth: 0.5, borderTopColor: c.border }),
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={{ ...T.footnote, fontWeight: '600', color: c.mutedForeground, flex: 1, textTransform: 'uppercase', letterSpacing: 0.8 }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} className="active:opacity-60">
          <Text style={{ ...T.footnote, fontWeight: '600', color: actionColor }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

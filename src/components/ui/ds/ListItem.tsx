/**
 * ListItem — MD3 List tile.
 * Height: 56dp (1-line) / 72dp (2-line) / auto (3-line)
 * Ripple · Leading icon/avatar · Trailing action · Optional divider
 */
import { memo } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { T } from '@/lib/typography';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  tertiary?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  divider?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export const ListItem = memo(function ListItem({
  title,
  subtitle,
  tertiary,
  leading,
  trailing,
  onPress,
  divider = true,
  disabled = false,
  style,
  accessibilityLabel,
}: ListItemProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const minH = subtitle ? (tertiary ? 88 : 72) : 56;

  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          minHeight: minH,
          gap: 16,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {/* Leading */}
      {leading ? (
        <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
          {leading}
        </View>
      ) : null}

      {/* Text block */}
      <View style={{ flex: 1, justifyContent: 'center', gap: 2 }}>
        <Text
          numberOfLines={2}
          style={{ ...T.headline, color: c.foreground }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={{ ...T.footnote, color: c.mutedForeground }}
          >
            {subtitle}
          </Text>
        ) : null}
        {tertiary ? (
          <Text
            numberOfLines={1}
            style={{ ...T.caption1, color: c.mutedForeground }}
          >
            {tertiary}
          </Text>
        ) : null}
      </View>

      {/* Trailing */}
      {trailing ? (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {trailing}
        </View>
      ) : null}
    </View>
  );

  const dividerLine = divider ? (
    <View
      style={{
        height: 1,
        backgroundColor: c.border,
        marginLeft: leading ? 72 : 16,
      }}
    />
  ) : null;

  if (onPress) {
    return (
      <View>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel ?? title}
          accessibilityRole="button"
          android_ripple={{
            color: colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            borderless: false,
          }}
          className="active:opacity-80"
        >
          {content}
        </Pressable>
        {dividerLine}
      </View>
    );
  }

  return (
    <View>
      {content}
      {dividerLine}
    </View>
  );
});

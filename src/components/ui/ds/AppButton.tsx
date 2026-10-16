/**
 * AppButton — MD3 Button component.
 *
 * Variants: primary | secondary | outlined | text
 * Height: 48dp · Radius: 12dp
 * States: default · loading · disabled
 */
import { memo } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { T } from '@/lib/typography';

const NO_WEB_OUTLINE = Platform.select({
  web: ({ outlineStyle: 'none', outlineWidth: 0 } as unknown) as ViewStyle,
  default: {},
});

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outlined' | 'text';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export const AppButton = memo(function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
  accessibilityLabel,
}: AppButtonProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  const buttonStyles = {
    // Primary — vibrant indigo fill, high-contrast label
    primary: {
      bg: c.primary,
      text: c.primaryForeground,
      border: 'transparent',
    },
    // Secondary — surface fill, foreground label
    secondary: {
      bg: c.secondary,
      text: c.secondaryForeground,
      border: 'transparent',
    },
    // Outlined — primary hairline border, primary label
    outlined: {
      bg: 'transparent',
      text: c.primary,
      border: c.primary,
    },
    // Ghost text — no bg/border, primary label
    text: {
      bg: 'transparent',
      text: c.primary,
      border: 'transparent',
    },
  }[variant];

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className="active:opacity-70"
      style={[
        {
          height: 48,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 20,
          backgroundColor: buttonStyles.bg,
          borderWidth: buttonStyles.border === 'transparent' ? 0 : 1,
          borderColor: buttonStyles.border,
          alignSelf: fullWidth ? undefined : 'flex-start',
          opacity: isDisabled ? 0.45 : 1,
          ...(({ borderCurve: 'continuous' } as unknown) as object),
        },
        NO_WEB_OUTLINE,
        style,
      ]}
    >
      <View style={{ opacity: loading ? 0 : 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text
          style={{
            ...T.subhead,
            color: buttonStyles.text,
            fontWeight: '600',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      {loading && (
        <ActivityIndicator
          size="small"
          color={buttonStyles.text}
          style={{ position: 'absolute' }}
        />
      )}
    </Pressable>
  );
});

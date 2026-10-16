/**
 * EmptyState — every module's zero-data fallback.
 * Icon/Illustration · Title · Description · Primary action
 */
import { memo } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { T } from '@/lib/typography';
import { AppButton } from './AppButton';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  return (
    <View
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          paddingVertical: 48,
          gap: 16,
        },
        style,
      ]}
    >
      {icon ? (
        <View style={{ opacity: 0.35, marginBottom: 8 }}>
          {icon}
        </View>
      ) : null}

      <Text
        style={{
          ...T.title3,
          color: c.foreground,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>

      {description ? (
        <Text
          style={{
            ...T.callout,
            color: c.mutedForeground,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          onPress={onAction}
          variant="outlined"
          style={{ marginTop: 8 }}
        />
      ) : null}
    </View>
  );
});

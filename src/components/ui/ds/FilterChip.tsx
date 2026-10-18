/**
 * FilterChip — MD3 Filter/Input chip.
 * Height: 32dp · Toggle-able · Optional leading icon · Optional trailing close
 */
import { memo } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { PILL } from './Pill';

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  leading?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
}

export const FilterChip = memo(function FilterChip({
  label,
  selected = false,
  onPress,
  onRemove,
  leading,
  disabled = false,
  style,
}: FilterChipProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  const activeColor = colorScheme === 'dark' ? c.primary : c.foreground;
  const activeTextColor = colorScheme === 'dark' ? '#0F172A' : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      className="active:opacity-70"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: PILL.md.gap,
          height: PILL.md.height,
          paddingHorizontal: PILL.md.paddingHorizontal,
          borderRadius: PILL.radius,
          borderWidth: 1,
          backgroundColor: selected ? activeColor : 'transparent',
          borderColor: selected ? activeColor : c.border,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {leading ? (
        <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
          {leading}
        </View>
      ) : null}
      <Text
        {...PILL.textProps}
        style={{
          fontSize: PILL.md.fontSize,
          lineHeight: PILL.md.lineHeight,
          includeFontPadding: false,
          fontWeight: '500',
          color: selected ? activeTextColor : c.foreground,
        }}
      >
        {label}
      </Text>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          className="active:opacity-50"
        >
          <X size={12} color={selected ? activeTextColor : c.mutedForeground} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

/**
 * AddFromFormatCard — the one "प्रारूप से जोड़ें" (Add from format) action
 * used across modules (GD, Nyayalay, Prarthna Patra, Nirodhatmak), so it
 * looks the same everywhere:
 *   dashed accent border · template icon (left) · title · hint · chevron (right)
 */
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, LayoutTemplate } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

interface Props {
  title: string;
  /** Short hint under the title, e.g. "विवरण स्वतः भरें" or the last used format */
  subtitle?: string;
  onPress: () => void;
  /** Module accent colour; defaults to the app primary colour */
  color?: string;
  disabled?: boolean;
  className?: string;
}

export function AddFromFormatCard({ title, subtitle, onPress, color, disabled, className }: Props) {
  const { colorScheme } = useColorScheme();
  const palette = THEME[colorScheme ?? 'light'];
  const accent = color ?? palette.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={`flex-row items-center gap-3 border border-dashed rounded-xl px-4 py-3 active:opacity-70 ${disabled ? 'opacity-50' : ''} ${className ?? ''}`}
      style={{ borderColor: accent, borderCurve: 'continuous', backgroundColor: `${accent}0D` }}
    >
      <View
        className="w-9 h-9 rounded-lg items-center justify-center"
        style={{ backgroundColor: `${accent}1F` }}
      >
        <LayoutTemplate size={18} color={accent} />
      </View>
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="text-sm font-semibold" style={{ color: accent }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={accent} />
    </Pressable>
  );
}

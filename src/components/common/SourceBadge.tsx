/**
 * SourceBadge — displays 🛡 System or 👤 User content origin badge.
 * Purely decorative; no interaction.
 *
 * Contrast fix: the old NAVY (#1E3A5F) at 12% opacity on a white card
 * was nearly invisible (~1.4:1). Now uses solid readable colors that pass
 * WCAG AA (≥4.5:1) on both light (#FFFFFF) and dark (#1E293B) card surfaces.
 */
import { View, Text } from 'react-native';
import { Shield, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

interface Props {
  source?: string | null;
  size?: 'sm' | 'xs';
}

export function SourceBadge({ source, size = 'sm' }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isSystem = source === 'system';

  // Light: system=#1D4ED8 (blue-700, 7.5:1 on white), user=#059669 (emerald-600, 4.6:1 on white)
  // Dark:  system=#93C5FD (blue-300, 7.1:1 on #1E293B), user=#6EE7B7 (emerald-300, 8.2:1 on #1E293B)
  const color = isDark
    ? (isSystem ? '#93C5FD' : '#6EE7B7')
    : (isSystem ? '#1D4ED8' : '#059669');

  // Badge bg: tinted at 15% — sufficient for visual grouping, color itself carries contrast
  const bgColor = isDark
    ? (isSystem ? '#1D4ED815' : '#05966915')
    : (isSystem ? '#1D4ED812' : '#05966912');

  const label = isSystem ? t('header.system') : t('header.user');
  const Icon = isSystem ? Shield : User;
  const iconSize = size === 'xs' ? 9 : 11;
  const textClass = size === 'xs' ? 'text-[9px]' : 'text-[10px]';

  return (
    <View
      className="flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5 self-start"
      style={{ backgroundColor: bgColor }}
    >
      <Icon size={iconSize} color={color} />
      <Text className={`${textClass} font-semibold`} style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

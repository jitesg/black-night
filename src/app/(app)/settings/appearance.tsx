/**
 * Appearance Settings Screen — Theme selection
 *
 * Calls colorScheme.set() from nativewind so the entire app repaints
 * immediately (no restart needed). The choice is also persisted via
 * useSettingsStore so _layout.tsx can re-apply it on the next cold boot.
 */
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Sun, Moon, Smartphone, CheckCircle2 } from 'lucide-react-native';
import { colorScheme, useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';

type ThemeOption = {
  value: 'light' | 'dark' | 'system';
  labelKey: string;
  descKey: string;
  icon: typeof Sun;
  color: string;
};

const THEMES: ThemeOption[] = [
  { value: 'light',  labelKey: 'settings.appearance.light',  descKey: 'settings.appearance.lightDesc',  icon: Sun,       color: '#F59E0B' },
  { value: 'dark',   labelKey: 'settings.appearance.dark',   descKey: 'settings.appearance.darkDesc',   icon: Moon,      color: '#818CF8' },
  { value: 'system', labelKey: 'settings.appearance.system', descKey: 'settings.appearance.systemDesc', icon: Smartphone, color: '#10B981' },
];

export default function AppearanceScreen() {
  const { settings, update } = useSettingsStore();
  const { colorScheme: active } = useColorScheme();
  const { t } = useTranslation();

  const handleSelect = (value: 'light' | 'dark' | 'system') => {
    // 1. Apply immediately — NativeWind repropagates to all className consumers.
    colorScheme.set(value);
    // 2. Persist for cold-boot restore in _layout.tsx.
    update('theme', value);
  };

  // For the selected-border colour we want the border token of the active theme
  // rather than a hardcoded light-only value.
  const borderDefault = active === 'dark' ? '#334155' : '#E5E7EB';

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('settings.appearance.title')} subtitle={t('settings.appearance.subtitle')} showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.appearance.theme')}</Text>
        {THEMES.map((themeItem) => {
          const selected = settings.theme === themeItem.value;
          const Icon = themeItem.icon;
          return (
            <Pressable
              key={themeItem.value}
              onPress={() => handleSelect(themeItem.value)}
              className="flex-row items-center gap-4 bg-card border border-border rounded-2xl p-4 mb-3 active:opacity-70"
              style={{ borderCurve: 'continuous', borderLeftWidth: selected ? 3 : 1, borderLeftColor: selected ? themeItem.color : borderDefault }}
            >
              <View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: `${themeItem.color}20` }}>
                <Icon size={20} color={themeItem.color} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">{t(themeItem.labelKey)}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">{t(themeItem.descKey)}</Text>
              </View>
              {selected && <CheckCircle2 size={20} color={themeItem.color} />}
            </Pressable>
          );
        })}

        {/* Future-ready section */}
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 mt-4">{t('settings.appearance.futureFeatures')}</Text>
        {[
          { labelKey: 'settings.appearance.accentColor',   descKey: 'settings.appearance.accentColorDesc' },
          { labelKey: 'settings.appearance.dynamicTheme',  descKey: 'settings.appearance.dynamicThemeDesc' },
        ].map((f) => (
          <View key={f.labelKey} className="flex-row items-center gap-4 bg-muted/40 border border-border rounded-2xl p-4 mb-3" style={{ borderCurve: 'continuous' }}>
            <View className="flex-1">
              <Text className="text-base font-semibold text-muted-foreground">{t(f.labelKey)}</Text>
              <Text className="text-xs text-muted-foreground/60 mt-0.5">{t(f.descKey)}</Text>
            </View>
            <View className="px-2.5 py-1 rounded-full bg-muted">
              <Text className="text-xs font-semibold text-muted-foreground">{t('settings.appearance.comingSoon')}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

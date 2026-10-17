/**
 * Language Selection Screen
 */
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import i18n from '@/lib/i18n';

type LangOption = { value: 'en' | 'hi'; labelKey: string; native: string; descKey: string };

const LANGS: LangOption[] = [
  { value: 'en', labelKey: 'settings.language.english', native: 'English', descKey: 'settings.language.englishDesc' },
  { value: 'hi', labelKey: 'settings.language.hindi', native: 'हिन्दी', descKey: 'settings.language.hindiDesc' },
];

export default function LanguageScreen() {
  const { settings, update } = useSettingsStore();
  const { t } = useTranslation();

  const handleSelect = (lang: LangOption) => {
    // 1. Persist to AsyncStorage (so next app launch reads the right language).
    update('language', lang.value);
    // 2. Tell i18next immediately — this triggers re-renders in every component
    //    using useTranslation() via react-i18next's internal event emitter.
    //    This is the authoritative live-switch; step 1 is just persistence.
    i18n.changeLanguage(lang.value);
    router.back();
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('settings.language.title')} subtitle={t('settings.language.subtitle')} showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.language.selectLanguage')}</Text>

        {LANGS.map((lang) => {
          const selected = settings.language === lang.value;
          return (
            <Pressable
              key={lang.value}
              onPress={() => handleSelect(lang)}
              className="flex-row items-center gap-4 bg-card border border-border rounded-2xl p-4 mb-3 active:opacity-70"
              style={{ borderCurve: 'continuous', borderLeftWidth: selected ? 3 : 1, borderLeftColor: selected ? '#F59E0B' : '#E5E7EB' }}
            >
              <View
                className="w-12 h-12 rounded-xl items-center justify-center"
                style={{ backgroundColor: selected ? '#F59E0B15' : '#F3F4F6' }}
              >
                <Text className="text-xl font-bold" style={{ color: selected ? '#F59E0B' : '#9CA3AF' }}>
                  {lang.value === 'en' ? 'A' : 'अ'}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">{lang.native}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">{t(lang.descKey)}</Text>
              </View>
              {selected && <CheckCircle2 size={20} color="#2563EB" />}
            </Pressable>
          );
        })}

        <View className="bg-muted/50 rounded-2xl p-4 mt-2" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs text-muted-foreground leading-5">
            {t('settings.language.disclaimer')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

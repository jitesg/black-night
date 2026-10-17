/**
 * Search Preferences Screen
 */
import { View, Text, ScrollView, Switch } from 'react-native';
import { Search, History, Sparkles, Type, Brain, Zap, Highlighter, Gauge } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type SettingsState } from '@/hooks/useSettingsStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';

type SearchPrefKey = keyof Pick<SettingsState,
  'searchHistory' | 'smartSuggestions' | 'autocomplete' | 'predictiveSearch' |
  'typoTolerance' | 'highlightMatches' | 'instantSearch'
>;

const PREFS: { key: SearchPrefKey; labelKey: string; descKey: string; icon: typeof Search; color: string }[] = [
  { key: 'searchHistory',    labelKey: 'settings.search.history',        descKey: 'settings.search.historyDesc',        icon: History,     color: '#6B7280' },
  { key: 'smartSuggestions', labelKey: 'settings.search.suggestions',    descKey: 'settings.search.suggestionsDesc',    icon: Sparkles,    color: '#2563EB' },
  { key: 'autocomplete',     labelKey: 'settings.search.autocomplete',   descKey: 'settings.search.autocompleteDesc',   icon: Type,        color: '#1D4ED8' },
  { key: 'predictiveSearch', labelKey: 'settings.search.predictive',     descKey: 'settings.search.predictiveDesc',     icon: Brain,       color: '#7C3AED' },
  { key: 'typoTolerance',    labelKey: 'settings.search.typoTolerance',  descKey: 'settings.search.typoToleranceDesc',  icon: Zap,         color: '#10B981' },
  { key: 'highlightMatches', labelKey: 'settings.search.highlight',      descKey: 'settings.search.highlightDesc',      icon: Highlighter, color: '#F59E0B' },
  { key: 'instantSearch',    labelKey: 'settings.search.instant',        descKey: 'settings.search.instantDesc',        icon: Gauge,       color: '#0891B2' },
];

export default function SearchPrefsScreen() {
  const { settings, update } = useSettingsStore();
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('settings.search.title')} showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.search.behavior')}</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
          {PREFS.map((pref, idx) => {
            const Icon = pref.icon;
            const val = settings[pref.key];
            return (
              <View
                key={pref.key}
                className={`flex-row items-center gap-3 px-4 py-4 ${idx < PREFS.length - 1 ? 'border-b border-border' : ''}`}
              >
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${pref.color}15` }}>
                  <Icon size={16} color={pref.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{t(pref.labelKey)}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5 leading-4">{t(pref.descKey)}</Text>
                </View>
                <Switch
                  value={val}
                  onValueChange={(v) => update(pref.key, v)}
                  trackColor={{ false: '#E5E7EB', true: `${'#F59E0B'}60` }}
                  thumbColor={val ? '#F59E0B' : '#9CA3AF'}
                />
              </View>
            );
          })}
        </View>

        <View className="bg-muted/50 rounded-2xl p-4 mt-4" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs text-muted-foreground leading-5">
            {t('settings.search.disclaimer')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

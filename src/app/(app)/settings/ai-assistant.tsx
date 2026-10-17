/**
 * AI Assistant Settings Screen
 */
import { View, Text, ScrollView, Switch } from 'react-native';
import { Sparkles, FileEdit, Library, FileBarChart, Lock } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type SettingsState } from '@/hooks/useSettingsStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';

type AIKey = keyof Pick<SettingsState,
  'aiSuggestions' | 'aiDraftAssistance' | 'aiKnowledgeSearch' | 'aiReportGeneration' | 'aiRestrictCaseData'
>;

interface AIItem {
  key: AIKey;
  labelKey: string;
  descKey: string;
  icon: typeof Sparkles;
  color: string;
}

const AI_ITEMS: AIItem[] = [
  {
    key: 'aiSuggestions',
    icon: Sparkles,
    color: '#7C3AED',
    labelKey: 'settings.ai.suggestions',
    descKey: 'settings.ai.suggestionsDesc',
  },
  {
    key: 'aiDraftAssistance',
    icon: FileEdit,
    color: '#1D4ED8',
    labelKey: 'settings.ai.draftAssistance',
    descKey: 'settings.ai.draftAssistanceDesc',
  },
  {
    key: 'aiKnowledgeSearch',
    icon: Library,
    color: '#0F766E',
    labelKey: 'settings.ai.knowledgeSearch',
    descKey: 'settings.ai.knowledgeSearchDesc',
  },
  {
    key: 'aiReportGeneration',
    icon: FileBarChart,
    color: '#D97706',
    labelKey: 'settings.ai.reportGeneration',
    descKey: 'settings.ai.reportGenerationDesc',
  },
  {
    key: 'aiRestrictCaseData',
    icon: Lock,
    color: '#6B7280',
    labelKey: 'settings.ai.privacy',
    descKey: 'settings.ai.privacyDesc',
  },
];

export default function AiAssistantScreen() {
  const { settings, update } = useSettingsStore();
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('settings.ai.title')} subtitle={t('settings.ai.subtitle')} showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.ai.aiFeatures')}</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
          {AI_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const value = settings[item.key];
            return (
              <View
                key={item.key}
                className={`flex-row items-center gap-3 px-4 py-4 ${idx < AI_ITEMS.length - 1 ? 'border-b border-border' : ''}`}
              >
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                  <Icon size={16} color={item.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{t(item.labelKey)}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5 leading-4">{t(item.descKey)}</Text>
                </View>
                <Switch
                  value={value}
                  onValueChange={(v) => update(item.key, v)}
                  trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: `${'#F59E0B'}60` }}
                  thumbColor={value ? '#F59E0B' : (isDark ? '#6B7280' : '#9CA3AF')}
                />
              </View>
            );
          })}
        </View>

        <View className="bg-muted/50 rounded-2xl p-4 mt-4" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs text-muted-foreground leading-5">
            {t('settings.ai.disclaimer')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

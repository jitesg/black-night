/**
 * Search Preferences Screen
 */
import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { Search, History, Sparkles, Type, Brain, Zap, Highlighter, Gauge } from 'lucide-react-native';
import { useSettingsStore, type SettingsState } from '@/hooks/useSettingsStore';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

type SearchPrefKey = keyof Pick<SettingsState,
  'searchHistory' | 'smartSuggestions' | 'autocomplete' | 'predictiveSearch' |
  'typoTolerance' | 'highlightMatches' | 'instantSearch'
>;

const PREFS: { key: SearchPrefKey; label: string; desc: string; icon: typeof Search; color: string }[] = [
  { key: 'searchHistory',    label: 'Search History',    desc: 'Remember recent searches for quick access',        icon: History,    color: '#6B7280' },
  { key: 'smartSuggestions', label: 'Smart Suggestions', desc: 'Intelligent suggestions based on your work',        icon: Sparkles,   color: '#2563EB' },
  { key: 'autocomplete',     label: 'Autocomplete',      desc: 'Complete search terms as you type',                icon: Type,       color: '#1D4ED8' },
  { key: 'predictiveSearch', label: 'Predictive Search', desc: 'Predict and show relevant results early',           icon: Brain,      color: '#7C3AED' },
  { key: 'typoTolerance',    label: 'Typo Tolerance',    desc: 'Find results even with minor spelling errors',      icon: Zap,        color: '#10B981' },
  { key: 'highlightMatches', label: 'Highlight Matches', desc: 'Bold matching text in search results',             icon: Highlighter, color: '#F59E0B' },
  { key: 'instantSearch',    label: 'Instant Search',    desc: 'Search results update as you type each character', icon: Gauge,      color: '#0891B2' },
];

export default function SearchPrefsScreen() {
  const { settings, update } = useSettingsStore();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Search Preferences" showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Search Behavior</Text>
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
                  <Text className="text-sm font-semibold text-foreground">{pref.label}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5 leading-4">{pref.desc}</Text>
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
            Search preferences apply to Universal Search used across all modules — FIR, GD, Nyayalay, Prarthna Patra, Knowledge Base, and more.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

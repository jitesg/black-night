/**
 * AI Assistant Settings Screen
 */
import { useState } from 'react';
import { View, Text, ScrollView, Switch, TextInput, Pressable, Linking, ActivityIndicator } from 'react-native';
import { Sparkles, FileEdit, Library, FileBarChart, Lock, KeyRound } from 'lucide-react-native';
import { getGeminiKey, setGeminiKey, testGeminiKey } from '@/ai/geminiDirect';
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

        <GeminiKeyCard isDark={isDark} />

        <View className="bg-muted/50 rounded-2xl p-4 mt-4" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs text-muted-foreground leading-5">
            {t('settings.ai.disclaimer')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/** The officer's own free Gemini API key: the Copilot then asks Gemini directly. */
function GeminiKeyCard({ isDark }: { isDark: boolean }) {
  const saved = getGeminiKey();
  const [key, setKey] = useState(saved);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    saved ? { ok: true, text: 'Key सहेजी हुई है — Copilot सीधे Gemini से जवाब लेगा।' } : null,
  );
  const [busy, setBusy] = useState(false);
  const masked = saved ? `${saved.slice(0, 6)}…${saved.slice(-4)}` : '';

  const save = async () => {
    if (!key.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const model = await testGeminiKey(key.trim());
      setStatus({ ok: true, text: `Key ठीक है${model ? ` (${model})` : ''} — सहेज दी गई। अब Copilot सीधे Gemini से जवाब लेगा।` });
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setGeminiKey('');
    setKey('');
    setStatus({ ok: true, text: 'Key हटा दी गई। Copilot पहले वाले ऑनलाइन सर्वर से जवाब लेगा।' });
  };

  return (
    <View className="bg-card border border-border rounded-2xl p-4 mt-4 gap-3" style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-center gap-3">
        <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#2563EB15' }}>
          <KeyRound size={16} color="#2563EB" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">अपनी Gemini API key</Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            {saved ? `सहेजी हुई key: ${masked}` : 'मुफ़्त key डालने पर Copilot सीधे Google Gemini से जवाब देगा।'}
          </Text>
        </View>
      </View>
      <TextInput
        value={key}
        onChangeText={setKey}
        placeholder="AIza… वाली key यहाँ paste करें"
        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground"
      />
      <View className="flex-row gap-2">
        <Pressable
          onPress={save}
          disabled={busy || !key.trim()}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 active:opacity-70"
          style={{ backgroundColor: '#2563EB', opacity: busy || !key.trim() ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text className="text-sm font-bold text-white">{busy ? 'जाँच रहे हैं…' : 'जाँचें और सहेजें'}</Text>
        </Pressable>
        {saved ? (
          <Pressable onPress={remove} className="rounded-xl px-4 py-3 border border-border active:opacity-70">
            <Text className="text-sm font-semibold text-destructive">हटाएँ</Text>
          </Pressable>
        ) : null}
      </View>
      {status ? (
        <Text className="text-xs" style={{ color: status.ok ? (isDark ? '#4ADE80' : '#15803D') : (isDark ? '#F87171' : '#DC2626') }}>
          {status.text}
        </Text>
      ) : null}
      <Pressable onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} className="active:opacity-70">
        <Text className="text-xs font-semibold" style={{ color: '#2563EB' }}>
          मुफ़्त key कैसे बनाएँ: aistudio.google.com/apikey खोलें → Google खाते से login → &quot;Create API key&quot; → key copy करके ऊपर paste करें।
        </Text>
      </Pressable>
      <Text className="text-[11px] text-muted-foreground">
        Key सिर्फ़ इसी फ़ोन में रहती है (backup में नहीं जाती)। सवाल के साथ भेजा गया context Google को जाता है — केस की जानकारी न भेजनी हो तो ऊपर &quot;AI गोपनीयता सेटिंग्स&quot; वाला विकल्प चालू रखें।
      </Text>
    </View>
  );
}

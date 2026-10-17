import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  HelpCircle,
  Clock,
  Scale,
  ListOrdered,
  FilePenLine,
  AlertTriangle,
  Gavel,
  FileText,
  ChevronLeft,
} from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { getFardEntry } from '@/knowledge/fard/fardKb';

export default function FardDetailScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();

  const entry = code ? getFardEntry(code) : undefined;

  if (!entry) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader
          title={t('fard.title', 'फर्द ज्ञान')}
          showBack
        />
        <View className="flex-1 items-center justify-center p-6 gap-3">
          <Text className="text-base font-semibold text-foreground text-center">
            {t('fard.entryNotFound', 'फर्द प्रविष्टि नहीं मिली')}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1.5 px-4 py-2 rounded-xl bg-primary active:opacity-80"
          >
            <ChevronLeft size={16} color="#FFFFFF" />
            <Text className="text-sm font-semibold text-primary-foreground">
              {t('fard.backToFard', 'वापस फर्द सूची')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={entry.name}
        subtitle={entry.code === 'COMMON' ? t('fard.pinnedBadge', 'ज़रूरी मार्गदर्शिका') : undefined}
        showBack
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }}
      >
        <View className="gap-4">
          {/* 1. क्या है (purpose) */}
          {Boolean(entry.purpose) && (
            <View
              className="bg-card border border-border rounded-2xl p-4 gap-2.5 shadow-sm shadow-black/5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-lg bg-indigo-500/10 items-center justify-center">
                  <HelpCircle size={15} color="#6366F1" />
                </View>
                <Text className="text-sm font-bold text-foreground">
                  {t('fard.sections.purpose', 'क्या है')}
                </Text>
              </View>
              <Text className="text-sm text-foreground/90 leading-6 pl-1">
                {entry.purpose}
              </Text>
            </View>
          )}

          {/* 2. कब बनती है (when) */}
          {Boolean(entry.when) && (
            <View
              className="bg-card border border-border rounded-2xl p-4 gap-2.5 shadow-sm shadow-black/5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-lg bg-teal-500/10 items-center justify-center">
                  <Clock size={15} color="#0D9488" />
                </View>
                <Text className="text-sm font-bold text-foreground">
                  {t('fard.sections.when', 'कब बनती है')}
                </Text>
              </View>
              <Text className="text-sm text-foreground/90 leading-6 pl-1">
                {entry.when}
              </Text>
            </View>
          )}

          {/* 3. कानूनी आधार (legal) */}
          {Boolean(entry.legal) && (
            <View
              className="bg-card border border-border rounded-2xl p-4 gap-2.5 shadow-sm shadow-black/5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-lg bg-blue-500/10 items-center justify-center">
                  <Scale size={15} color="#2563EB" />
                </View>
                <Text className="text-sm font-bold text-foreground">
                  {t('fard.sections.legal', 'कानूनी आधार')}
                </Text>
              </View>
              <View className="bg-muted/40 rounded-xl p-3 border border-border/50">
                <Text className="text-xs font-semibold text-primary leading-5">
                  {entry.legal}
                </Text>
              </View>
            </View>
          )}

          {/* 4. ज़रूरी बातें (essentials, numbered list) */}
          {entry.essentials.length > 0 && (
            <View
              className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-lg bg-emerald-500/10 items-center justify-center">
                  <ListOrdered size={15} color="#059669" />
                </View>
                <Text className="text-sm font-bold text-foreground">
                  {t('fard.sections.essentials', 'ज़रूरी बातें')}
                </Text>
                <View className="ml-auto bg-muted rounded-full px-2 py-0.5">
                  <Text className="text-[11px] font-semibold text-muted-foreground">
                    {entry.essentials.length}
                  </Text>
                </View>
              </View>

              <View className="gap-2.5 pt-1">
                {entry.essentials.map((item, idx) => (
                  <View key={`essential-${idx}`} className="flex-row items-start gap-2.5">
                    <View className="w-5 h-5 rounded-full bg-primary/10 items-center justify-center mt-0.5 shrink-0">
                      <Text className="text-[11px] font-bold text-primary">
                        {idx + 1}
                      </Text>
                    </View>
                    <Text className="text-sm text-foreground/90 leading-5.5 flex-1">
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 5. लिखने का तरीका (wording, bullets) */}
          {entry.wording.length > 0 && (
            <View
              className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-lg bg-violet-500/10 items-center justify-center">
                  <FilePenLine size={15} color="#7C3AED" />
                </View>
                <Text className="text-sm font-bold text-foreground">
                  {t('fard.sections.wording', 'लिखने का तरीका')}
                </Text>
              </View>

              <View className="gap-2.5 pt-1">
                {entry.wording.map((item, idx) => (
                  <View key={`wording-${idx}`} className="flex-row items-start gap-2.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 shrink-0" />
                    <Text className="text-sm text-foreground/90 leading-5.5 flex-1">
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 6. आम गलतियाँ (mistakes, bullets) */}
          {entry.mistakes.length > 0 && (
            <View
              className="bg-card border border-amber-500/30 rounded-2xl p-4 gap-3 shadow-sm shadow-black/5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-lg bg-amber-500/15 items-center justify-center">
                  <AlertTriangle size={15} color="#D97706" />
                </View>
                <Text className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {t('fard.sections.mistakes', 'आम गलतियाँ')}
                </Text>
              </View>

              <View className="gap-2.5 pt-1">
                {entry.mistakes.map((item, idx) => (
                  <View key={`mistake-${idx}`} className="flex-row items-start gap-2.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                    <Text className="text-sm text-foreground/90 leading-5.5 flex-1">
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 7. कोर्ट में किस पर सवाल उठता है (court, bullets) */}
          {entry.court.length > 0 && (
            <View
              className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-lg bg-rose-500/10 items-center justify-center">
                  <Gavel size={15} color="#E11D48" />
                </View>
                <Text className="text-sm font-bold text-foreground">
                  {t('fard.sections.court', 'कोर्ट में किस पर सवाल उठता है')}
                </Text>
              </View>

              <View className="gap-2.5 pt-1">
                {entry.court.map((item, idx) => (
                  <View key={`court-${idx}`} className="flex-row items-start gap-2.5">
                    <View className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0" />
                    <Text className="text-sm text-foreground/90 leading-5.5 flex-1">
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 8. संबंधित दस्तावेज़ (docs, bullets) */}
          {entry.docs.length > 0 && (
            <View
              className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-sm shadow-black/5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-lg bg-sky-500/10 items-center justify-center">
                  <FileText size={15} color="#0284C7" />
                </View>
                <Text className="text-sm font-bold text-foreground">
                  {t('fard.sections.docs', 'संबंधित दस्तावेज़')}
                </Text>
              </View>

              <View className="gap-2 pt-1">
                {entry.docs.map((item, idx) => (
                  <View
                    key={`doc-${idx}`}
                    className="flex-row items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/30 border border-border/40"
                  >
                    <View className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                    <Text className="text-xs font-semibold text-foreground flex-1">
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

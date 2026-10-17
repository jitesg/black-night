import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pin, BookOpen, ChevronRight, Scale } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { getCommon, getFardEntries, searchFard } from '@/knowledge/fard/fardKb';
import type { FardEntry } from '@/knowledge/fard/types';

export default function FardListScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const commonEntry = getCommon();
  const fardEntries: FardEntry[] = query.trim()
    ? searchFard(query)
    : getFardEntries();

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('fard.title', 'फर्द ज्ञान')}
        subtitle={t('fard.subtitle', 'फर्द और ज़रूरी दस्तावेज़')}
        showBack
      />

      {/* Search Bar */}
      <View className="px-4 pt-3 pb-2 border-b border-border bg-background">
        <SearchBar
          value={query}
          onChangeText={handleSearch}
          placeholder={t('fard.searchPlaceholder', 'फर्द खोजें (नाम, उद्देश्य, कानूनी आधार…)')}
          variant="light"
          returnKeyType="search"
          accessibilityLabel={t('fard.searchAccessibility', 'फर्द खोजें')}
          collapsible
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
      >
        {/* Pinned Card: COMMON ('हर फर्द के ज़रूरी तत्व') */}
        {commonEntry && (
          <View className="mb-6">
            <View className="flex-row items-center gap-1.5 mb-2.5 px-1">
              <Pin size={13} color="#6366F1" />
              <Text className="text-xs font-bold uppercase tracking-wider text-primary">
                {t('fard.pinnedBadge', 'ज़रूरी मार्गदर्शिका')}
              </Text>
            </View>

            <Pressable
              onPress={() => router.push(`/(app)/knowledge/fard/${commonEntry.code}` as never)}
              className="bg-card border-2 border-primary/30 rounded-2xl p-4 gap-2.5 active:opacity-75 shadow-sm shadow-black/5"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-row items-center gap-2.5 flex-1" style={{ minWidth: 0 }}>
                  <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
                    <Scale size={18} color="#6366F1" />
                  </View>
                  <Text className="text-base font-bold text-foreground flex-1" numberOfLines={1}>
                    {commonEntry.name}
                  </Text>
                </View>
                <ChevronRight size={18} color="#6366F1" />
              </View>

              <Text className="text-xs text-muted-foreground leading-5" numberOfLines={2}>
                {commonEntry.purpose}
              </Text>

              {commonEntry.legal ? (
                <View className="flex-row items-center gap-1.5 pt-1 border-t border-border/50">
                  <Text className="text-[11px] font-medium text-primary" numberOfLines={1}>
                    {commonEntry.legal}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        )}

        {/* List of Fard entries */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between px-1 mb-1">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('fard.allEntries', 'सभी फर्द प्रारूप')}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {t('fard.resultCount', { count: fardEntries.length, defaultValue: `${fardEntries.length} फर्द उपलब्ध` })}
            </Text>
          </View>

          {fardEntries.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => router.push(`/(app)/knowledge/fard/${item.code}` as never)}
              className="bg-card border border-border rounded-2xl p-4 gap-2 active:opacity-75"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-3 flex-1" style={{ minWidth: 0 }}>
                  <View className="w-9 h-9 rounded-xl bg-muted items-center justify-center">
                    <BookOpen size={16} color="#6366F1" />
                  </View>
                  <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.legal ? (
                      <Text className="text-[11px] text-muted-foreground mt-0.5" numberOfLines={1}>
                        {item.legal.split(';')[0]}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <ChevronRight size={16} color="#9CA3AF" />
              </View>

              <Text className="text-xs text-muted-foreground leading-4.5 pl-12" numberOfLines={2}>
                {item.purpose}
              </Text>
            </Pressable>
          ))}

          {fardEntries.length === 0 && (
            <View className="items-center py-12 gap-2">
              <Text className="text-sm font-semibold text-foreground">
                {t('fard.noResults', 'कोई फर्द नहीं मिला')}
              </Text>
              <Text className="text-xs text-muted-foreground text-center px-6">
                {t('fard.noResultsHint', 'अलग खोज शब्द का प्रयास करें।')}
              </Text>
              {query ? (
                <Pressable
                  onPress={handleClear}
                  className="mt-2 px-4 py-1.5 rounded-full bg-primary/10 active:opacity-70"
                >
                  <Text className="text-xs font-semibold text-primary">
                    {t('common.clear', 'साफ़ करें')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

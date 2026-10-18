import { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, FlatList, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { BookOpen, Scale, Shield, FileCheck2, ChevronRight, Bookmark } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { THEME } from '@/lib/theme';
import { ACTS, searchLaw, type ActId, type LawSearchResult } from '@/lib/law/lawLibrary';
import { hasSimple } from '@/lib/law/simpleExplain';

export default function LawLibraryIndexScreen() {
  const { t, i18n } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isHi = i18n.language === 'hi';

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LawSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      const results = searchLaw(text, { limit: 40 });
      setSearchResults(results);
      setSearching(false);
    }, 300);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const results = searchLaw(query, { limit: 40 });
    setSearchResults(results);
    setSearching(false);
  }, [query]);

  const actCards: Array<{
    id: ActId;
    icon: typeof Scale;
    color: string;
    bg: string;
  }> = [
    { id: 'BNS', icon: Scale, color: '#1D4ED8', bg: '#1D4ED815' },
    { id: 'BNSS', icon: Shield, color: '#0F766E', bg: '#0F766E15' },
    { id: 'BSA', icon: FileCheck2, color: '#B45309', bg: '#B4530915' },
  ];

  const isSearchActive = query.trim().length > 0;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('knowledge.law.title', 'विधि पुस्तकालय')}
        subtitle={t('knowledge.law.subtitle', 'BNS · BNSS · BSA (2023)')}
        showBack
      />

      {/* Global Search Bar */}
      <View className="px-4 pt-3 pb-2 border-b border-border bg-background">
        <SearchBar
          value={query}
          onChangeText={handleSearch}
          onSubmitEditing={handleSearchSubmit}
          placeholder={t('knowledge.law.searchPlaceholder', 'धारा नंबर या शब्द खोजें (उदा. 103, murder, arrest)…')}
          variant="light"
          returnKeyType="search"
          accessibilityLabel={t('knowledge.law.searchPlaceholder', 'धारा नंबर या शब्द खोजें')}
        />
      </View>

      {/* Search results mode */}
      {isSearchActive ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => `${item.act}-${item.n}`}
          contentContainerClassName="px-4 py-4 gap-3 pb-12"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.mutedForeground }}>
              {searching
                ? t('knowledge.searching', 'खोज जारी है…')
                : t('knowledge.resultCount', { count: searchResults.length, defaultValue: `${searchResults.length} परिणाम` })}
            </Text>
          }
          renderItem={({ item, index }) => {
            const actColor = item.act === 'BNS' ? '#1D4ED8' : item.act === 'BNSS' ? '#0F766E' : '#B45309';
            const hasOldLawMatches = searchResults.some((r) => !!r.oldLawMapping);
            const firstNonOldLawIndex = searchResults.findIndex((r) => !r.oldLawMapping);

            // Highlight matched search words in snippet
            const renderSnippetWithHighlight = (snippet: string, searchQuery: string) => {
              if (!searchQuery.trim()) return <Text>{snippet}</Text>;
              const words = searchQuery.trim().split(/\s+/).filter((w) => w.length >= 2);
              if (words.length === 0) return <Text>{snippet}</Text>;
              const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
              const parts = snippet.split(pattern);
              return (
                <Text>
                  {parts.map((part, pIdx) => {
                    const isMatch = words.some((w) => w.toLowerCase() === part.toLowerCase());
                    return (
                      <Text
                        key={pIdx}
                        style={{
                          fontWeight: isMatch ? '700' : '400',
                          color: isMatch ? (colorScheme === 'dark' ? '#F97316' : '#EA580C') : undefined,
                        }}
                      >
                        {part}
                      </Text>
                    );
                  })}
                </Text>
              );
            };

            // Dedicated group rendering for old law matches ("नई धारा")
            if (item.oldLawMapping) {
              return (
                <View className="gap-2">
                  {index === 0 && (
                    <View className="flex-row items-center gap-2 mb-0.5">
                      <View className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1">
                        <Text textBreakStrategy="simple" className="text-xs font-bold text-amber-700 dark:text-amber-400">
                          नई धारा
                        </Text>
                      </View>
                      <Text className="text-xs text-muted-foreground font-medium">
                        (पुराने कानून से मिलान)
                      </Text>
                    </View>
                  )}
                  <Pressable
                    onPress={() => router.push(`/(app)/knowledge/law/${item.act}/${item.n}` as never)}
                    className="flex-row items-start bg-amber-500/5 border border-amber-500/30 rounded-2xl p-4 gap-3 active:opacity-70 shadow-sm shadow-black/5"
                    style={{ borderCurve: 'continuous', minHeight: 44 }}
                  >
                    <View
                      className="w-12 h-12 rounded-xl items-center justify-center pt-0.5"
                      style={{ backgroundColor: `${actColor}20`, borderCurve: 'continuous' }}
                    >
                      <Text className="text-[10px] font-bold uppercase" style={{ color: actColor }}>
                        {item.act}
                      </Text>
                      <Text className="text-sm font-black" style={{ color: actColor }}>
                        {item.n}
                      </Text>
                    </View>

                    <View className="flex-1 gap-1" style={{ minWidth: 0 }}>
                      <Text className="text-sm font-bold text-foreground leading-5">
                        {item.oldLawMapping.displayLabel}
                      </Text>
                      {item.snippet ? (
                        <Text className="text-xs text-muted-foreground leading-4" numberOfLines={2}>
                          {item.snippet}
                        </Text>
                      ) : null}
                    </View>

                    <ChevronRight size={18} color={C.mutedForeground} className="mt-1" />
                  </Pressable>
                </View>
              );
            }

            return (
              <View className="gap-2">
                {hasOldLawMatches && index === firstNonOldLawIndex && (
                  <View className="mt-3 mb-0.5">
                    <Text className="text-xs font-bold uppercase tracking-widest" style={{ color: C.mutedForeground }}>
                      {t('knowledge.otherResults', 'अन्य परिणाम')}
                    </Text>
                  </View>
                )}
                <Pressable
                  onPress={() => router.push(`/(app)/knowledge/law/${item.act}/${item.n}` as never)}
                  className="flex-row items-start bg-card border border-border rounded-2xl p-4 gap-3 active:opacity-70"
                  style={{ borderCurve: 'continuous', minHeight: 44 }}
                >
                  {/* Number in rounded badge on the left */}
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center pt-0.5"
                    style={{ backgroundColor: `${actColor}15`, borderCurve: 'continuous' }}
                  >
                    <Text className="text-[10px] font-bold uppercase" style={{ color: actColor }}>
                      {item.act}
                    </Text>
                    <Text className="text-sm font-extrabold" style={{ color: actColor }}>
                      {item.n}
                    </Text>
                  </View>

                  {/* Content: Title on 2 lines max + highlighted snippet */}
                  <View className="flex-1 gap-1" style={{ minWidth: 0 }}>
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-sm font-semibold text-foreground flex-1 leading-5" numberOfLines={2}>
                        {item.title}
                      </Text>
                      {hasSimple(item.act, item.n) && (
                        <View
                          className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25"
                          style={{ borderCurve: 'continuous' }}
                        >
                          <Text className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            सरल
                          </Text>
                        </View>
                      )}
                    </View>

                    {item.snippet ? (
                      <Text className="text-xs text-muted-foreground leading-4" numberOfLines={2}>
                        {renderSnippetWithHighlight(item.snippet, query)}
                      </Text>
                    ) : null}
                  </View>

                  <ChevronRight size={18} color={C.mutedForeground} className="mt-1" />
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            !searching ? (
              <View className="items-center py-20 gap-2">
                <Text className="text-base font-semibold text-foreground">
                  {t('knowledge.noResults', 'कोई परिणाम नहीं')}
                </Text>
                <Text className="text-sm text-muted-foreground text-center px-8">
                  {t('knowledge.noResultsHint', 'अलग कीवर्ड आज़माएं')}
                </Text>
              </View>
            ) : null
          }
        />
      ) : (
        /* Normal 3 Acts + 4th Card View */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-4 py-4 gap-4 pb-28"
        >
          {/* Small official notice banner */}
          <View
            className="p-3.5 rounded-2xl border border-border bg-muted/40 gap-1"
            style={{ borderCurve: 'continuous' }}
          >
            <Text className="text-xs text-muted-foreground leading-5">
              ⚖️ {t('knowledge.law.officialNote', 'आधिकारिक अंग्रेज़ी पाठ (गजट 25-12-2023). हिंदी पाठ सत्यापित होने पर जोड़ा जाएगा।')}
            </Text>
          </View>

          {/* 3 Main Act Cards */}
          <View className="gap-3">
            {actCards.map(({ id, icon: Icon, color, bg }) => {
              const meta = ACTS[id];
              return (
                <Pressable
                  key={id}
                  onPress={() => router.push(`/(app)/knowledge/law/${id}` as never)}
                  className="bg-card border border-border rounded-2xl p-5 gap-3 active:opacity-70"
                  style={{ borderCurve: 'continuous', minHeight: 44 }}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-row items-center gap-3 flex-1" style={{ minWidth: 0 }}>
                      <View
                        className="w-12 h-12 rounded-xl items-center justify-center"
                        style={{ backgroundColor: bg }}
                      >
                        <Icon size={24} color={color} />
                      </View>
                      <View className="flex-1" style={{ minWidth: 0 }}>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-[17px] font-bold text-foreground">
                            {id}
                          </Text>
                          <View
                            className="rounded-full px-2.5 py-1"
                            style={{ backgroundColor: bg }}
                          >
                            <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color }}>
                              {meta.shortHi}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                          {meta.citation}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={20} color={C.mutedForeground} />
                  </View>

                  <View className="gap-1 pt-1 border-t border-border/50">
                    <Text className="text-sm font-semibold text-foreground">
                      {isHi ? meta.nameHi : meta.nameEn}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {isHi ? meta.nameEn : meta.nameHi}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between pt-1">
                    <View
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: bg }}
                    >
                      <Text textBreakStrategy="simple" className="text-xs font-bold" style={{ color }}>
                        {t('knowledge.law.actSections', { count: meta.total, defaultValue: `${meta.total} धाराएं` })}
                      </Text>
                    </View>
                    <Text className="text-xs font-semibold" style={{ color }}>
                      {t('knowledge.law.jumpBtn', 'देखें')} →
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* 4th Card: अन्य अधिनियम / मेरे नोट (opens existing list?category=Law) */}
          <Pressable
            onPress={() => router.push('/(app)/knowledge/list?category=Law' as never)}
            className="bg-card border border-border rounded-2xl p-5 gap-3 active:opacity-70 mt-1"
            style={{ borderCurve: 'continuous', minHeight: 44 }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1" style={{ minWidth: 0 }}>
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center bg-purple-500/10"
                >
                  <Bookmark size={24} color="#7C3AED" />
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Text className="text-[15px] font-bold text-foreground">
                    {t('knowledge.law.otherActs', 'अन्य अधिनियम / मेरे नोट')}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={2}>
                    {t('knowledge.law.otherActsDesc', 'मोटर वाहन, NDPS, आबकारी, शस्त्र व अन्य अधिनियम')}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={C.mutedForeground} />
            </View>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

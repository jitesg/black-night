import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import { stripHtmlTags } from '@/lib/stringUtils';
import {
  ActivityIndicator, FlatList, Pressable,
  ScrollView, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import { SearchBar } from '@/components/SearchBar';
import { HighlightText } from '@/components/HighlightText';
import {
  getKnowledgeAnalytics, searchKnowledgeAll,
  type KnowledgeAnalytics, type KnowledgeEntry,
} from '@/lib/db/knowledgeRepo';
import {
  KNOWLEDGE_CATEGORIES, ANALYTICS_LABELS,
  type KnowledgeCategory,
} from '@/lib/knowledgeConstants';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

const K_COLOR = '#0F766E';
const ACCENT = '#1E3A5F';
function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Analytics Card ───────────────────────────────────────────────────────
function AnalyticsCard({
  label, categoryId, count, onPress,
}: {
  label: string; categoryId: string; count: number; onPress: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const K_COLOR = colorScheme === 'dark' ? '#14B8A6' : '#0F766E';
  const cat = KNOWLEDGE_CATEGORIES.find((c) => c.id === categoryId);
  const color = cat?.color ?? K_COLOR;
  const Icon = cat?.icon;
  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-2xl p-4 gap-2 active:opacity-70"
      style={{ borderCurve: 'continuous', width: 130 }}
    >
      {Icon && (
        <View
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={16} color={color} />
        </View>
      )}
      <Text className="text-2xl font-bold text-foreground">{count}</Text>
      <Text className="text-xs text-muted-foreground leading-4">{label}</Text>
    </Pressable>
  );
}

// ─── Category Row ─────────────────────────────────────────────────────────
function CategoryRow({ cat }: { cat: KnowledgeCategory }) {
  const Icon = cat.icon;
  const handlePress = () => {
    if (cat.id === 'Checklist') {
      router.push('/(app)/knowledge/checklists' as never);
    } else if (cat.id === 'Investigation Guides') {
      router.push('/(app)/knowledge/investigation-guides' as never);
    } else {
      router.push(`/(app)/knowledge/list?category=${encodeURIComponent(cat.id)}` as never);
    }
  };
  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-4 px-5 py-4 bg-card border border-border rounded-2xl active:opacity-70"
      style={{ borderCurve: 'continuous' }}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${cat.color}15` }}
      >
        <Icon size={18} color={cat.color} />
      </View>
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="text-base font-semibold text-foreground">{cat.label}</Text>
        <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
          {cat.subcategories.slice(0, 3).join(' · ')}
          {cat.subcategories.length > 3 ? ' …' : ''}
        </Text>
      </View>
      <View
        className="rounded-full px-2.5 py-0.5"
        style={{ backgroundColor: `${cat.color}15` }}
      >
        <Text className="text-xs font-semibold" style={{ color: cat.color }}>
          {cat.subcategories.length}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Search Result Row ────────────────────────────────────────────────────
function SearchResultRow({
  item, query, highlight, typoTolerant,
}: {
  item: KnowledgeEntry; query: string; highlight: boolean; typoTolerant?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const cat = KNOWLEDGE_CATEGORIES.find((c) => c.id === item.category);
  return (
    <Pressable
      onPress={() => router.push(`/(app)/knowledge/${item.id}` as never)}
      className="bg-card border border-border rounded-2xl px-4 py-3 gap-1 active:opacity-70"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-center gap-2">
        <View
          className="rounded-full px-2 py-0.5"
          style={{ backgroundColor: `${cat?.color ?? C.mutedForeground}15` }}
        >
          <Text className="text-xs font-semibold" style={{ color: cat?.color ?? C.mutedForeground }}>
            {item.category}
          </Text>
        </View>
        {item.subcategory ? (
          <Text className="text-xs text-muted-foreground">{item.subcategory}</Text>
        ) : null}
      </View>
      {highlight
        ? <HighlightText text={item.title} query={query} style={{ fontSize: 14, fontWeight: '600', lineHeight: 20 }} numberOfLines={1} typoTolerant={typoTolerant} />
        : <Text style={{ fontSize: 14, fontWeight: '600', lineHeight: 20 }} numberOfLines={1}>{item.title}</Text>
      }
      {item.description ? (
        highlight
          ? <HighlightText text={stripHtmlTags(item.description)} query={query} style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={2} typoTolerant={typoTolerant} />
          : <Text style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={2}>{stripHtmlTags(item.description)}</Text>
      ) : null}
      <Text className="text-xs text-muted-foreground">{fmtTs(item.updated_at)}</Text>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function KnowledgeHomeScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const { settings } = useSettingsStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [analytics, setAnalytics] = useState<KnowledgeAnalytics>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeEntry[]>([]);
  const [searching, setSearching] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          const counts = await getKnowledgeAnalytics();
          setAnalytics(counts);
        } catch (e) {
          logger.warn('[Knowledge] analytics error:', e);
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // BUG-H3 FIX: handleSearch was an async function called on every keystroke
  // with no debounce — fired a DB query per character typed.
  // Now debounced with a 300 ms timer; previous pending search is cancelled
  // before each new one so only the final keystroke in a burst hits the DB.
  // When instantSearch is OFF the timer is skipped — search fires only on submit.
  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) { setSearchResults([]); return; }
    if (!settings.instantSearch) return; // submit-only mode
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchKnowledgeAll(
          text,
          settings.typoTolerance ? { typoTolerance: true } : undefined,
        );
        setSearchResults(res);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [settings.instantSearch, settings.typoTolerance]);

  const handleSearchSubmit = useCallback(async () => {
    if (!query.trim()) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearching(true);
    try {
      const res = await searchKnowledgeAll(
        query,
        settings.typoTolerance ? { typoTolerance: true } : undefined,
      );
      setSearchResults(res);
    } finally {
      setSearching(false);
    }
  }, [query, settings.typoTolerance]);

  const showSearch = query.trim().length > 0;

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AppHeader title={t('knowledge.title')} subtitle={t('knowledge.subtitle')} onMenuPress={() => setDrawerOpen(true)} />
      <View className="px-4 pt-3 pb-2 border-b border-border bg-background">
        <SearchBar
          value={query}
          onChangeText={handleSearch}
          onSubmitEditing={handleSearchSubmit}
          placeholder={t('knowledge.searchPlaceholder')}
          variant="light"
          returnKeyType="search"
          accessibilityLabel={t('knowledge.searchAccessibility')}
          collapsible
        />
      </View>

      {showSearch ? (
        /* Search results */
        <FlatList
          removeClippedSubviews={true}
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-6 py-4 gap-3 pb-10"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.mutedForeground }}>
              {searching ? t('knowledge.searching') : t('knowledge.resultCount', { count: searchResults.length })}
            </Text>
          }
          renderItem={({ item }) => <SearchResultRow item={item} query={query} highlight={settings.highlightMatches} typoTolerant={settings.typoTolerance} />}
          ListEmptyComponent={
            !searching ? (
              <View className="items-center py-20 gap-2">
                <Text className="text-base font-semibold text-foreground">{t('knowledge.noResults')}</Text>
                <Text className="text-sm text-muted-foreground text-center px-8">
                  {t('knowledge.noResultsHint')}
                </Text>
              </View>
            ) : null
          }
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
        >
          {/* Analytics Dashboard */}
          <View className="px-6 pt-5 gap-3">
            <Text className="text-xs font-bold uppercase tracking-widest" style={{ color: C.mutedForeground }}>
              {t('knowledge.sectionAnalytics')}
            </Text>
            {loading ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-3 pr-2"
              >
                {ANALYTICS_LABELS.map(({ label, categoryId }) => (
                  <AnalyticsCard
                    key={categoryId}
                    label={label}
                    categoryId={categoryId}
                    count={analytics[categoryId] ?? 0}
                    onPress={() =>
                      router.push(
                        `/(app)/knowledge/list?category=${encodeURIComponent(categoryId)}` as never
                      )
                    }
                  />
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── Categories ── */}
          <View className="px-6 pt-6 gap-3">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('knowledge.sectionCategories')}
            </Text>
            {KNOWLEDGE_CATEGORIES.map((cat) => (
              <CategoryRow key={cat.id} cat={cat} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

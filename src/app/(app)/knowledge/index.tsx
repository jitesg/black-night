import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import { stripHtmlTags } from '@/lib/stringUtils';
import { getEntryPreviewText } from '@/lib/knowledge/knowledgeDisplay';
import {
  ActivityIndicator, BackHandler, FlatList, Pressable,
  ScrollView, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, BookOpen, ClipboardList, FileText, Gavel, ListChecks, Scale, SearchCheck } from 'lucide-react-native';
import { KnowledgeTileGrid, RecentVisitChips, SavedVisitList, SectionTitle, type KnowledgeTile } from '@/components/knowledge/KnowledgeHomeParts';
import { useKnowledgeVisitLists } from '@/lib/knowledge/knowledgeVisits';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import { SearchBar } from '@/components/SearchBar';
import { HighlightText } from '@/components/HighlightText';
import {
  getKnowledgeAnalytics, warmKnowledgeSearch,
  type KnowledgeAnalytics, type KnowledgeEntry,
} from '@/lib/db/knowledgeRepo';
import { seedReady, onSeedComplete } from '@/lib/db/seedManager';
import {
  KNOWLEDGE_CATEGORIES, getCategoryLabel,
} from '@/lib/knowledgeConstants';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { isSensitiveId } from '@/lib/regulations/regCore';
import { KNOWLEDGE_HIT_COLOR, searchAllKnowledge, type KnowledgeHit } from '@/lib/knowledgeSearchAll';
import { buildCaseItems } from '@/lib/cases/caseCore';
import { getRegIndex } from '@/lib/regulations/regIndex';
import { useGoHome } from '@/lib/goHome';

function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
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
          className="rounded-full px-2.5 py-1"
          style={{ backgroundColor: `${cat?.color ?? C.mutedForeground}15` }}
        >
          <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: cat?.color ?? C.mutedForeground }}>
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
      {item.description && !isSensitiveId(item.id) ? (
        highlight
          ? <HighlightText text={getEntryPreviewText(stripHtmlTags(item.description))} query={query} style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={2} typoTolerant={typoTolerant} />
          : <Text style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={2}>{getEntryPreviewText(stripHtmlTags(item.description))}</Text>
      ) : null}
      <Text className="text-xs text-muted-foreground">{fmtTs(item.updated_at)}</Text>
    </Pressable>
  );
}

// ─── Other knowledge hits (sections, फर्द, चेकलिस्ट, BNS संदर्भ) ───────────────
function HitRow({ hit, query }: { hit: KnowledgeHit; query: string }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const color = KNOWLEDGE_HIT_COLOR[hit.kind];
  return (
    <Pressable
      onPress={() => router.push(hit.route as never)}
      className="bg-card border border-border rounded-2xl px-4 py-3 gap-1 active:opacity-70"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-center gap-2">
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}${colorScheme === 'dark' ? '33' : '15'}` }}>
          <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: colorScheme === 'dark' ? C.foreground : color }}>{hit.badge}</Text>
        </View>
      </View>
      <HighlightText text={hit.title} query={query} style={{ fontSize: 14, fontWeight: '600', lineHeight: 20 }} numberOfLines={2} />
      {hit.subtitle ? <HighlightText text={hit.subtitle} query={query} style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={2} /> : null}
    </Pressable>
  );
}

// Court Judgment also holds the police case notes (न्यायिक निर्णय hub).
const CASE_NOTES_TOTAL = buildCaseItems(getRegIndex(), []).length;

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
  // One search over the whole module (entries, BNS/BNSS/BSA sections, फर्द, चेकलिस्ट, BNS संदर्भ).
  const [searchResults, setSearchResults] = useState<KnowledgeHit[]>([]);
  const [searching, setSearching] = useState(false);

  const goHome = useGoHome();
  // Back → Dashboard: module root screens always return to home, never exit app.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goHome(); // back to the Home below (no new Home) — src/lib/goHome.ts
      return true;
    });
    return () => sub.remove();
  }, [goHome]));

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      (async () => {
        setLoading(true);
        try {
          // Await seedReady before the first query if seeding is in flight
          await Promise.race([
            seedReady,
            new Promise((resolve) => setTimeout(resolve, 800)),
          ]);
          const counts = await getKnowledgeAnalytics();
          if (isMounted) setAnalytics(counts);
        } catch (e) {
          logger.warn('[Knowledge] analytics error:', e);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();

      // Auto re-query when seeding completes
      const unsubscribe = onSeedComplete(async () => {
        if (!isMounted) return;
        try {
          const counts = await getKnowledgeAnalytics();
          if (isMounted) setAnalytics(counts);
        } catch (e) {
          logger.warn('[Knowledge] onSeedComplete analytics error:', e);
        }
      });

      return () => {
        isMounted = false;
        unsubscribe();
      };
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
        const res = await searchAllKnowledge(text, { typoTolerance: settings.typoTolerance });
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
      const res = await searchAllKnowledge(query, { typoTolerance: settings.typoTolerance });
      setSearchResults(res);
    } finally {
      setSearching(false);
    }
  }, [query, settings.typoTolerance]);

  // Opened with ?q=… (e.g. "BNS 103" from BNS संदर्भ): run that search once.
  const { q: initialQ } = useLocalSearchParams<{ q?: string }>();
  useEffect(() => {
    const q0 = typeof initialQ === 'string' ? initialQ.trim() : '';
    if (!q0) return;
    setQuery(q0);
    setSearching(true);
    searchAllKnowledge(q0, { typoTolerance: settings.typoTolerance })
      .then(setSearchResults)
      .catch(() => {})
      .finally(() => setSearching(false));
    // only when the param changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

  // ज्ञानकोष होम tiles (owner, part 1) — same routes as the old analytics cards / category rows / फर्द card;
  // जाँच गाइड + चेकलिस्ट (screens were only reachable from search) get their own tiles.
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => { setFocusTick((n) => n + 1); }, []));
  const visits = useKnowledgeVisitLists(focusTick);
  const tiles = useMemo<KnowledgeTile[]>(() => {
    const n = (id: string) => (analytics[id] ?? 0);
    const list = (id: string) => `/(app)/knowledge/list?category=${encodeURIComponent(id)}`;
    return [
      { key: 'law', label: getCategoryLabel('Law', t), sub: t('knowledge.homeLayout.lawSub', { n: `${358 + 531 + 170 + n('Law')}` }), icon: Scale,
        route: '/(app)/knowledge/law', light: ['#0F766E', '#115E59'], dark: ['#0F766E', '#134E4A'] },
      { key: 'court', label: getCategoryLabel('Court Judgment', t), sub: t('knowledge.homeLayout.courtSub', { n: n('Court Judgment') + CASE_NOTES_TOTAL }), icon: Gavel,
        route: list('Court Judgment'), light: ['#7C3AED', '#5B21B6'], dark: ['#6D28D9', '#4C1D95'] },
      { key: 'sop', label: getCategoryLabel('SOP', t), sub: t('knowledge.homeLayout.countSub', { n: n('SOP') }), icon: ClipboardList,
        route: list('SOP'), light: ['#2563EB', '#1E40AF'], dark: ['#1E40AF', '#1E3A8A'] },
      { key: 'fard', label: t('knowledge.homeLayout.fard'), sub: t('knowledge.homeLayout.fardSub'), icon: BookOpen,
        route: '/(app)/knowledge/fard', light: ['#92400E', '#78350F'], dark: ['#78350F', '#451A03'] },
      { key: 'circular', label: getCategoryLabel('Circular', t), sub: t('knowledge.homeLayout.countSub', { n: n('Circular') }), icon: Bell,
        route: list('Circular'), light: ['#D97706', '#B45309'], dark: ['#B45309', '#78350F'] },
      { key: 'format', label: getCategoryLabel('Police Format', t), sub: t('knowledge.homeLayout.countSub', { n: n('Police Format') }), icon: FileText,
        route: list('Police Format'), light: ['#4F46E5', '#3730A3'], dark: ['#4338CA', '#312E81'] },
      { key: 'guides', label: t('knowledge.homeLayout.guides'), sub: t('knowledge.homeLayout.guidesSub'), icon: SearchCheck,
        route: '/(app)/knowledge/investigation-guides', light: ['#DB2777', '#9D174D'], dark: ['#BE185D', '#831843'] },
      { key: 'checklists', label: t('knowledge.categories.Checklist'), sub: t('knowledge.homeLayout.checklistSub'), icon: ListChecks,
        route: '/(app)/knowledge/checklists', light: ['#16A34A', '#15803D'], dark: ['#15803D', '#14532D'] },
    ];
  }, [analytics, t]);

  const showSearch = query.trim().length > 0;

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AppHeader title={t('knowledge.title')} subtitle={t('knowledge.subtitle')} onMenuPress={() => setDrawerOpen(true)} />
      <View className="px-4 pt-3 pb-2 border-b border-border bg-background">
        <SearchBar
          value={query}
          noResults={!searching && !!query.trim() && searchResults.length === 0}
          onChangeText={handleSearch}
          onSubmitEditing={handleSearchSubmit}
          onFocus={() => { warmKnowledgeSearch().catch(() => {}); }}
          placeholder={t('knowledge.searchPlaceholder')}
          variant="light"
          returnKeyType="search"
          accessibilityLabel={t('knowledge.searchAccessibility')}
        />
      </View>

      {showSearch ? (
        /* Search results */
        <FlatList keyboardShouldPersistTaps="handled"
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
          renderItem={({ item }) => item.entry
            ? <SearchResultRow item={item.entry} query={query} highlight={settings.highlightMatches} typoTolerant={settings.typoTolerance} />
            : <HitRow hit={item} query={query} />}
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
        <ScrollView keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
        >
          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 20 }}>
            {/* New layout (owner, part 1): 🕘 हाल में देखा · 📂 विभाग tiles (count inside — no second list) · ⭐ सहेजे गए */}
            <RecentVisitChips items={visits.recent} title={t('knowledge.homeLayout.recent')} />
            <View>
              <SectionTitle text={t('knowledge.homeLayout.sections')} />
              {loading ? <ActivityIndicator size="small" color={C.primary} style={{ marginBottom: 8 }} /> : null}
              <KnowledgeTileGrid tiles={tiles} />
            </View>
            <SavedVisitList
              items={visits.saved}
              title={t('knowledge.homeLayout.saved')}
              moreLabel={(n) => t('knowledge.homeLayout.moreSaved', { n })}
              lessLabel={t('knowledge.homeLayout.less')}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

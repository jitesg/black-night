import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stripFormatMarkers } from '@/lib/formatMarkers';
import { stripHtmlTags } from '@/lib/stringUtils';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, BackHandler, FlatList, ScrollView,
  Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import {
  Plus,
  LayoutTemplate,
} from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import { ActiveFilterChips, FilterSearchButton, FilterSheet, activeFilterCount, type FilterGroupDef, type FilterValues } from '@/components/common/FilterSheet';
import {
  toggleFavorite, deleteFormat,
  type FormatWithMeta,
} from '@/lib/db/predefinedFormatRepo';
import { getPublishedFormats, searchPublishedFormats } from '@/lib/db/sysFormatRepo';
import { seedReady, onSeedComplete } from '@/lib/db/seedManager';
import { FormatCard } from '@/components/formats/FormatCard';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { BottomSheet } from '@/components/ui/ds/BottomSheet';

// ─── Design tokens ────────────────────────────────────────────────────────────
const INDIGO = '#6366F1';
// Inactive filter/source chip: visible solid surface that passes contrast on both themes.
// Light: slate-100 (#F1F5F9) with slate-600 (#475569) text — 4.6:1 on white bg
// Dark:  slate-700 (#334155) with slate-300 (#CBD5E1) text — 7.1:1 on #0F172A bg
// We resolve these per-render via the theme, not hardcoded here.

// ─── Constants ────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  'All', 'GD', 'Case Diary', 'Narrative', 'Nyayalay', 'Prarthna Patra', 'BNSS Karyavahi', 'Any',
  'Favorites', 'Recently Used', 'Recently Added', 'Created By Me',
];

// Source filter options (additive — sits above format-type filters)
const SOURCE_FILTERS = ['All', 'System', 'User'] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number];

function getFilterOptionLabel(filter: string, t: (k: string) => string): string {
  switch (filter) {
    case 'All': return t('format.filter.all');
    case 'GD': return t('format.type.gd');
    case 'Case Diary': return t('format.type.caseDiary');
    case 'Narrative': return t('format.type.narrative');
    case 'Nyayalay': return t('format.type.nyayalay');
    case 'Prarthna Patra': return t('format.type.prarthnaPatra');
    case 'BNSS Karyavahi': return t('format.type.bnssKaryavahi');
    case 'Any': return t('format.type.any');
    case 'Favorites': return t('format.filter.favorites');
    case 'Recently Used': return t('format.filter.recentlyUsed');
    case 'Recently Added': return t('format.filter.recentlyAdded');
    case 'Created By Me': return t('format.filter.createdByMe');
    default: return filter;
  }
}

// ─── Filter count helpers ─────────────────────────────────────────────────────
function buildFilterCounts(
  data: FormatWithMeta[],
  sf: SourceFilter,
): Record<string, number> {
  const visible = sf === 'System' ? data.filter(f => f.source === 'system')
    : sf === 'User'   ? data.filter(f => f.source !== 'system')
    : data;

  const counts: Record<string, number> = { All: visible.length };
  for (const f of visible) {
    counts[f.format_type] = (counts[f.format_type] ?? 0) + 1;
  }
  counts['Favorites']      = visible.filter(f => f.is_favorite).length;
  counts['Created By Me']  = visible.filter(f => f.source !== 'system').length;
  return counts;
}

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function FormatsScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formats, setFormats] = useState<FormatWithMeta[]>([]);
  const [allFormats, setAllFormats] = useState<FormatWithMeta[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FormatWithMeta | null>(null);
  const [previewFormat, setPreviewFormat] = useState<FormatWithMeta | null>(null);
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'dark' ? THEME.dark : THEME.light;
  // Safe-area insets — used for FlatList bottom padding and layout
  const insets = useSafeAreaInsets();

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Per-category counts — derived from allFormats + current sourceFilter ──
  // Recomputed whenever the full dataset or source tab changes so badges stay
  // accurate without any extra DB query.
  const filterCounts = buildFilterCounts(allFormats, sourceFilter);

  const loadData = useCallback(async (
    q = queryRef.current,
    filter = activeFilterRef.current,
    sf = sourceFilterRef.current,
  ) => {
    try {
      const results = q.trim() || filter !== 'All'
        ? await searchPublishedFormats(q, filter, 'me')
        : await getPublishedFormats('me');
      // Apply source tab filter in JS — no extra DB query needed
      const filtered = sf === 'System' ? results.filter(f => f.source === 'system')
        : sf === 'User' ? results.filter(f => f.source !== 'system')
        : results;
      setAllFormats(results);
      setFormats(filtered);
    } catch (e) {
      logger.warn('[Formats] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // BUG-C2c FIX: useFocusEffect must NOT depend on query/activeFilter/sourceFilter.
  // Same double-load-per-keystroke pattern as gd/index.tsx and nirodhatmak/index.tsx.
  // Refs shadow the current state values so the stable loadData callback always
  // reads the latest values without being recreated on every state change.
  const queryRef = useRef(query);
  const activeFilterRef = useRef(activeFilter);
  const sourceFilterRef = useRef(sourceFilter);
  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => { activeFilterRef.current = activeFilter; }, [activeFilter]);
  useEffect(() => { sourceFilterRef.current = sourceFilter; }, [sourceFilter]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  const firstLoadRef = useRef(true);
  useFocusEffect(useCallback(() => {
    let isMounted = true;
    // Spinner only on the first load; later visits refresh in place so the
    // list isn't torn down (keeps scroll position, no flash).
    if (firstLoadRef.current) { firstLoadRef.current = false; setLoading(true); }
    (async () => {
      await Promise.race([
        seedReady,
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
      if (isMounted) {
        loadData(queryRef.current, activeFilterRef.current, sourceFilterRef.current);
      }
    })();

    const unsubscribe = onSeedComplete(() => {
      if (isMounted) {
        loadData(queryRef.current, activeFilterRef.current, sourceFilterRef.current);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadData]));

  // Back → Dashboard: module root screens always return to home, never exit app.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(app)/home' as never);
      return true;
    });
    return () => sub.remove();
  }, []));

  const handleSearch = (text: string) => {
    setQuery(text);
    queryRef.current = text;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(
      () => loadData(text, activeFilterRef.current, sourceFilterRef.current),
      300,
    );
  };

  const handleSourceFilter = (sf: SourceFilter) => {
    setSourceFilter(sf);
    sourceFilterRef.current = sf;
    // When a format-type or special filter is active, the DB result set is
    // already filtered — re-run the full query so counts are correct for the
    // new source tab instead of re-slicing a possibly-filtered allFormats.
    loadData(queryRef.current, activeFilterRef.current, sf);
  };

  // ── Design C filter sheet: the same type / special filter (one at a time) + System / User ──
  const filterGroups = useMemo<FilterGroupDef[]>(() => [
    {
      key: 'f', label: t('format.list.filterBtn'),
      options: FILTER_OPTIONS.filter((f) => f !== 'All').map((f) => {
        const n = filterCounts[f];
        return { value: f, label: n ? `${getFilterOptionLabel(f, t)} (${n})` : getFilterOptionLabel(f, t) };
      }),
    },
    {
      key: 'source', label: t('filter.type', 'प्रकार'),
      options: [{ value: 'System', label: t('format.list.sourceSystem') }, { value: 'User', label: t('format.list.sourceUser') }],
    },
  ], [t, filterCounts]);
  const filterValues = useMemo<FilterValues>(
    () => ({ f: activeFilter === 'All' ? null : activeFilter, source: sourceFilter === 'All' ? null : sourceFilter }),
    [activeFilter, sourceFilter],
  );
  const applyFilters = (v: FilterValues) => {
    const f = (v.f as string | null) ?? 'All';
    const sf = ((v.source as SourceFilter | null) ?? 'All');
    setActiveFilter(f); activeFilterRef.current = f;
    setSourceFilter(sf); sourceFilterRef.current = sf;
    loadData(queryRef.current, f, sf);
  };
  const removeFilter = (key: string) => {
    if (key === 'f') applyFilters({ f: null, source: sourceFilterRef.current === 'All' ? null : sourceFilterRef.current });
    else handleSourceFilter('All');
  };

  const handleFavorite = useCallback(async (format: FormatWithMeta) => {
    await toggleFavorite(format.id, format.is_favorite);
    const updater = (list: FormatWithMeta[]) =>
      list.map((f) =>
        f.id === format.id
          ? { ...f, is_favorite: format.is_favorite ? 0 : 1 }
          : f
      );
    // In the पसंदीदा view, an un-starred format leaves the list right away
    const removing = activeFilterRef.current === 'Favorites' && format.is_favorite;
    setFormats((list) => removing ? list.filter((f) => f.id !== format.id) : updater(list));
    setAllFormats(updater);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteFormat(deleteTarget.id);
    setFormats((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    setAllFormats((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    setDeleteTarget(null);
  }, [deleteTarget]);

  // HOOKS RULE FIX: hoisted from renderItem={useCallback(...)} inside the
  // loading ternary. Calling a hook inside a conditional JSX branch violates
  // Rules of Hooks and causes "Rendered more hooks than during the previous render".
  const renderFormatItem = useCallback(({ item }: { item: FormatWithMeta }) => (
    <FormatCard
      format={item}
      query={query}
      onPress={() => router.push(`/(app)/formats/fill?formatId=${item.id}` as never)}
      onFavorite={() => handleFavorite(item)}
      onPreview={() => setPreviewFormat(item)}
      onEdit={() => router.push(`/(app)/formats/add-format?editId=${item.id}` as never)}
      onDelete={() => setDeleteTarget(item)}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [query, handleFavorite]);

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AppHeader
        title={t('format.list.title')}
        subtitle={t('format.list.subtitle')}
        onMenuPress={() => setDrawerOpen(true)}
        actions={
          <HeaderIconBtn icon={Plus} onPress={() => router.push('/(app)/formats/add-format' as never)} label={t('format.list.addFormat')} color="#2563EB" />
        }
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {/* Search + filter (design C, owner): ⚙︎ in the box, chosen filters as chips, sheet from the bottom */}
        <SearchBar
          value={query}
          noResults={!loading && !!query.trim() && formats.length === 0}
          onChangeText={handleSearch}
          placeholder={t('format.list.searchPlaceholder')}
          variant="navy"
          accessibilityLabel={t('format.list.searchAccessibility')}
          trailing={<FilterSearchButton count={activeFilterCount(filterValues)} onPress={() => setShowFilters(true)} accent={INDIGO} />}
        />
        <ActiveFilterChips groups={filterGroups} values={filterValues} onRemove={removeFilter} accent={INDIGO} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={INDIGO} />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          data={formats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 80,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData().catch(() => setRefreshing(false));
          }}
          renderItem={renderFormatItem}
          ListEmptyComponent={
            <View className="items-center justify-center py-24 gap-4">
              <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{ backgroundColor: `${INDIGO}15` }}>
                <LayoutTemplate size={30} color={INDIGO} />
              </View>
              <Text className="text-base font-semibold text-foreground">
                {query.trim() || activeFilter !== 'All' ? t('format.list.noFormatsFound') : t('format.list.noFormatsYet')}
              </Text>
              <Text className="text-sm text-muted-foreground text-center px-10">
                {query.trim() || activeFilter !== 'All'
                  ? t('format.list.tryFilter')
                  : t('format.list.tapToCreate')}
              </Text>
            </View>
          }
        />
      )}

      <FilterSheet
        visible={showFilters}
        groups={filterGroups}
        values={filterValues}
        onApply={applyFilters}
        onClose={() => setShowFilters(false)}
        accent={INDIGO}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('format.list.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('format.list.deleteDesc', { title: deleteTarget?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}>
              <Text>{t('format.list.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">{t('format.list.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Phase 2: Template preview bottom sheet with scrubbed variables */}
      <BottomSheet
        visible={!!previewFormat}
        onClose={() => setPreviewFormat(null)}
        title={previewFormat ? `${previewFormat.title} (${t('common.preview')})` : ''}
        snapHeight={480}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 32 }}
        >
          <Text style={{ fontSize: 14, lineHeight: 24, color: palette.foreground }}>
            {stripFormatMarkers(stripHtmlTags(previewFormat?.vivran ?? '')).replace(/\{\{.*?\}\}/g, '....')}
          </Text>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

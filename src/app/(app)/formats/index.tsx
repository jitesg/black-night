import { useCallback, useEffect, useRef, useState } from 'react';
import { stripHtmlTags } from '@/lib/stringUtils';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, BackHandler, FlatList, Pressable, ScrollView,
  Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import {
  Plus, Star, Filter, X,
  LayoutTemplate, Shield, User,
} from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
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

  // Inactive chip tokens — solid readable surface instead of near-transparent rgba.
  // Light: muted bg (#F1F5F9) + slate-600 text (#475569) → 4.6:1 on white ✓
  // Dark:  slate-700 bg (#334155) + slate-300 text (#CBD5E1) → 7.1:1 on navy ✓
  const chipInactiveBg   = colorScheme === 'dark' ? '#334155' : '#F1F5F9';
  const chipInactiveText = colorScheme === 'dark' ? '#CBD5E1' : '#475569';
  const chipInactiveBorder = colorScheme === 'dark' ? '#475569' : '#CBD5E1';

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

  const handleFilter = (f: string) => {
    // Tap active chip again → clear back to All
    const next = f === activeFilter ? 'All' : f;
    setActiveFilter(next);
    activeFilterRef.current = next;
    setShowFilters(false);
    loadData(queryRef.current, next, sourceFilterRef.current);
  };

  const handleSourceFilter = (sf: SourceFilter) => {
    setSourceFilter(sf);
    sourceFilterRef.current = sf;
    // When a format-type or special filter is active, the DB result set is
    // already filtered — re-run the full query so counts are correct for the
    // new source tab instead of re-slicing a possibly-filtered allFormats.
    loadData(queryRef.current, activeFilterRef.current, sf);
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
        {/* Search row — SearchBar (h=48) and Filter button share same h=48 for baseline alignment */}
        <View className="flex-row gap-2 items-center">
          <SearchBar
            value={query}
            onChangeText={handleSearch}
            placeholder={t('format.list.searchPlaceholder')}
            variant="navy"
            containerStyle={{ flex: 1 }}
            accessibilityLabel={t('format.list.searchAccessibility')}
            collapsible
          />
          {/* Filter button — h=48 matches SearchBar; solid bg with visible border when inactive */}
          <Pressable
            onPress={() => {
              if (activeFilter !== 'All') {
                handleFilter('All');
                setShowFilters(false);
              } else {
                setShowFilters((v) => !v);
              }
            }}
            className="flex-row items-center gap-1.5 px-3 rounded-xl active:opacity-70"
            style={{
              height: 48,
              backgroundColor: activeFilter !== 'All' ? INDIGO : chipInactiveBg,
              borderWidth: 1,
              borderColor: activeFilter !== 'All' ? INDIGO : chipInactiveBorder,
            }}
            accessibilityLabel={activeFilter !== 'All' ? t('format.list.activeFilterClear', { filter: getFilterOptionLabel(activeFilter, t) }) : t('format.list.openFilters')}
            accessibilityRole="button"
          >
            {activeFilter !== 'All' ? (
              <>
                <Text className="text-xs font-semibold" style={{ color: '#fff' }} numberOfLines={1}>
                  {getFilterOptionLabel(activeFilter, t)}
                </Text>
                <X size={12} color="#fff" />
              </>
            ) : (
              <>
                <Filter size={13} color={chipInactiveText} />
                <Text className="text-xs font-semibold" style={{ color: chipInactiveText }}>
                  {t('format.list.filterBtn')}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Filter chips */}
        {showFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
            {FILTER_OPTIONS.map((f) => {
              const isActive = activeFilter === f;
              const count = filterCounts[f];
              const showBadge = count !== undefined && count > 0;
              return (
                <Pressable
                  key={f}
                  onPress={() => handleFilter(f)}
                  className="mx-1 flex-row items-center rounded-full active:opacity-70 px-3 py-1.5"
                  style={{
                    backgroundColor: isActive ? INDIGO : chipInactiveBg,
                    borderWidth: 1,
                    borderColor: isActive ? INDIGO : chipInactiveBorder,
                    gap: 5,
                  }}
                >
                  <Text textBreakStrategy="simple"
                    className="text-xs font-semibold"
                    style={{ color: isActive ? '#fff' : chipInactiveText }}
                  >
                    {getFilterOptionLabel(f, t)}
                  </Text>
                  {showBadge && (
                    <View
                      className="rounded-full items-center justify-center"
                      style={{
                        backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : `${INDIGO}20`,
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 4,
                      }}
                    >
                      <Text textBreakStrategy="simple"
                        className="font-semibold"
                        style={{ fontSize: 10, color: isActive ? '#fff' : INDIGO, lineHeight: 14 }}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Source filter tabs: All / System / User */}
        <View className="flex-row gap-1.5">
          {SOURCE_FILTERS.map((sf) => (
            <Pressable
              key={sf}
              onPress={() => handleSourceFilter(sf)}
              className="flex-row items-center gap-1 rounded-full active:opacity-70 px-2.5 py-1"
              style={{
                backgroundColor: sourceFilter === sf ? INDIGO : chipInactiveBg,
                borderWidth: 1,
                borderColor: sourceFilter === sf ? INDIGO : chipInactiveBorder,
              }}
            >
              {sf !== 'All' && (sf === 'System'
                ? <Shield size={11} color={sourceFilter === sf ? '#fff' : chipInactiveText} />
                : <User size={11} color={sourceFilter === sf ? '#fff' : chipInactiveText} />)}
              <Text textBreakStrategy="simple"
                className="text-xs font-semibold"
                style={{ color: sourceFilter === sf ? '#fff' : chipInactiveText }}
              >
                {sf === 'System' ? t('format.list.sourceSystem') : sf === 'User' ? t('format.list.sourceUser') : t('format.list.sourceAll')}
              </Text>
            </Pressable>
          ))}
          {/* Always-visible favourites chip (same as the पसंदीदा filter) */}
          <Pressable
            onPress={() => handleFilter('Favorites')}
            accessibilityRole="button"
            accessibilityState={{ selected: activeFilter === 'Favorites' }}
            accessibilityLabel={t('format.filter.favorites')}
            className="flex-row items-center gap-1 rounded-full active:opacity-70 px-2.5 py-1"
            style={{
              backgroundColor: activeFilter === 'Favorites' ? '#D97706' : chipInactiveBg,
              borderWidth: 1,
              borderColor: activeFilter === 'Favorites' ? '#D97706' : chipInactiveBorder,
            }}
          >
            <Star size={11} color={activeFilter === 'Favorites' ? '#fff' : '#D97706'} fill={activeFilter === 'Favorites' ? '#fff' : '#D97706'} />
            <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: activeFilter === 'Favorites' ? '#fff' : chipInactiveText }}>
              {t('format.filter.favorites')}{filterCounts['Favorites'] ? ` (${filterCounts['Favorites']})` : ''}
            </Text>
          </Pressable>
        </View>
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
            paddingBottom: Math.max(insets.bottom + 80, 32),
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
          <Text style={{ fontSize: 14, lineHeight: 24, color: '#374151' }}>
            {stripHtmlTags(previewFormat?.vivran ?? '').replace(/\{\{.*?\}\}/g, '....')}
          </Text>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

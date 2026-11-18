// Bug 7 fix: removed unused imports — Clock, CheckCircle, AlertCircle.
import { logger } from '@/lib/logger';
import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import {
  BackHandler, View, Text, FlatList, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/lib/typography';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { attachmentCounts } from '@/lib/db/attachmentRepo';
import { CardActionMenu, CardMenuButton, dmy, useCardMenu } from '@/components/common/CardActionMenu';
import { OFFICE_BLUE, OFFICE_DELETE_WARNING, OfficeCardTag, isFromOffice } from '@/office/OfficeOrigin';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import {
  Plus, FileText, ChevronDown, X,
} from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import { ActiveFilterChips, FilterSearchButton, FilterSheet, activeFilterCount, type FilterGroupDef, type FilterValues } from '@/components/common/FilterSheet';
import { HighlightText } from '@/components/HighlightText';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  getAllPrarthnaPatra,
  searchPrarthnaPatra,
  getDashboardAnalytics,
  deletePrarthnaPatra,
  daysUntilDeadline,
  PETITION_TYPES,
  PETITION_TYPE_LABELS,
  type PrarthnaPatra,
  type PPDashboardAnalytics,
  type PetitionType,
  ppCardPeople,
  type PPCardPerson,
} from '@/lib/db/prarthnaPatraRepo';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/hooks/useSettingsStore';

// ── Filter types ─────────────────────────────────────────────────────────
const ACCENT = '#1E3A5F';
/** Active filter colour — same blue as the old प्रार्थना पत्र filter chips. */
const PP_FILTER_ACCENT = '#2D52B8';
type StatusFilter = 'All' | 'Pending' | 'Nistarit' | 'Finished';
type TimeFilter = 'Today' | 'This Week' | 'Overdue' | null;

const STATUS_LABEL_KEY = {
  All: 'common.all',
  Pending: 'fir.list.filterPending',
  Nistarit: 'prarthnaPatra.status.nistarit',
  Finished: 'fir.list.filterFinished',
} as const;

const TIME_FILTER_KEYS: Record<NonNullable<TimeFilter>, string> = {
  'Today': 'filters.today',
  'This Week': 'filters.thisWeek',
  'Overdue': 'prarthnaPatra.filters.overdue',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfWeekStr() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Analytics card (compact) ───────────────────────────────────────────────

function AnalyticsCard({
  label, total, pending, nistarit, finished, dueToday, overdue, selected, onPress,
}: {
  label: string; total: number; pending: number; nistarit: number;
  finished: number; dueToday?: number; overdue?: number;
  selected?: boolean; onPress?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      className="bg-card border rounded-2xl p-2.5 mr-2 active:opacity-70"
      style={{
        borderColor: selected ? '#7C3AED' : '#94A3B855',
        borderWidth: selected ? 1.5 : 1,
        borderCurve: 'continuous',
        minWidth: 120,
      }}
    >
      <Text className="text-xs font-semibold text-muted-foreground mb-1.5" numberOfLines={1}>{label}</Text>
      <View className="flex-row items-baseline gap-1">
        <Text className="text-lg font-bold text-foreground">{total}</Text>
        <Text className="text-xs text-muted-foreground">{t('prarthnaPatra.analytics.statTotal').toLowerCase()}</Text>
      </View>
      <View className="flex-row gap-2 mt-1.5 pt-1.5 border-t border-border flex-wrap">
        <View>
          <Text className="text-xs font-semibold" style={{ color: '#92400E' }}>{pending}</Text>
          <Text style={{ ...T.micro, color: '#9CA3AF' }}>{t('fir.list.filterPending')}</Text>
        </View>
        <View>
          <Text className="text-xs font-semibold" style={{ color: '#065F46' }}>{nistarit + finished}</Text>
          <Text style={{ ...T.micro, color: '#9CA3AF' }}>{t('prarthnaPatra.analytics.statNist')}</Text>
        </View>
        {overdue !== undefined && overdue > 0 && (
          <View>
            <Text className="text-xs font-semibold" style={{ color: '#DC2626' }}>{overdue}</Text>
            <Text style={{ ...T.micro, color: '#9CA3AF' }}>{t('prarthnaPatra.analytics.statOd')}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── Petition card ─────────────────────────────────────────────────────────

// owner (card design B — same as न्यायालय): status colours per theme, लंबित / समय निकला / निस्तारित
const PP_STATUS = {
  light: { done: ['#D1FAE5', '#065F46'], over: ['#FEE2E2', '#991B1B'], pend: ['#FEF3C7', '#92400E'] },
  dark: { done: ['#052E16', '#6EE7B7'], over: ['#450A0A', '#FCA5A5'], pend: ['#451A03', '#FCD34D'] },
} as const;
const PP_DAY = { light: { done: '#065F46', left: '#1D4ED8', over: '#DC2626' }, dark: { done: '#6EE7B7', left: '#93C5FD', over: '#F87171' } } as const;

const PPCard = memo(function PPCard({
  pp, query, highlight, typoTolerant, onDelete, attachCount, person,
}: {
  pp: PrarthnaPatra; query: string; highlight: boolean; typoTolerant?: boolean; onDelete: (id: string) => void;
  /** संलग्न कागज़ count (owner) → "📎 n" */
  attachCount?: number;
  /** first आवेदक + village + how many (ppCardPeople) */
  person?: PPCardPerson;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const C = THEME[scheme];
  const [deleteOpen, setDeleteOpen] = useState(false);
  const menu = useCardMenu();
  const days = daysUntilDeadline(pp.deadline_date, pp.status);
  const done = pp.status === 'Nistarit' || pp.status === 'Finished';
  // same rule as before: समय निकला from the deadline day on (the old "अतिदेय" badge)
  const state: 'done' | 'over' | 'pend' = done ? 'done' : days <= 0 ? 'over' : 'pend';
  const [badgeBg, badgeFg] = PP_STATUS[scheme][state];
  const statusWord = done ? t('prarthnaPatra.status.nistarit') : state === 'over' ? 'समय निकला' : 'लंबित';

  const dayLabel = done
    ? t('prarthnaPatra.status.nistarit')
    : days > 0 ? t('prarthnaPatra.dayLabel.daysLeft', { count: days })
    : days === 0 ? t('prarthnaPatra.dayLabel.dueToday')
    : `${Math.abs(days)} दिन ऊपर`;
  const dayColor = PP_DAY[scheme][done ? 'done' : days > 0 ? 'left' : 'over'];

  // Big name = first आवेदक ("व n अन्य" for more); no name → the type label as before
  const name = person?.name
    ? (person.count > 1 ? `${person.name} व ${person.count - 1} अन्य` : person.name)
    : PETITION_TYPE_LABELS[pp.petition_type];
  const subLine = [person?.village ? `ग्राम ${person.village}` : '', `प्राप्ति ${dmy(pp.date_of_receipt)}`].filter(Boolean).join(' · ');
  const titleStyle = { fontSize: 16, fontWeight: '700' as const, lineHeight: 24, color: C.cardForeground, marginTop: 8 };
  const view = () => router.push(`/(app)/prarthna-patra/${pp.id}` as never);

  return (
    <>
      <Pressable
        onPress={view}
        onLongPress={menu.openAt}
        className="bg-card border border-border rounded-2xl p-4 mb-3 active:opacity-70"
        style={{ borderCurve: 'continuous', ...(isFromOffice(pp) ? { borderWidth: 2, borderColor: OFFICE_BLUE[scheme] } : {}) }}
      >
        {/* Top: type · status · ⋮ */}
        <View className="flex-row items-center gap-2">
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: C.accent, flexShrink: 1 }}>
            <Text textBreakStrategy="simple" numberOfLines={1} className="text-xs font-semibold" style={{ color: C.accentForeground }}>{pp.petition_type}</Text>
          </View>
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: badgeBg, marginLeft: 'auto' }}>
            <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: badgeFg }}>{statusWord}</Text>
          </View>
          <CardMenuButton btnRef={menu.btnRef} onPress={menu.openAt} />
        </View>

        {highlight
          ? <HighlightText text={name} query={query} style={titleStyle} numberOfLines={1} typoTolerant={typoTolerant} />
          : <Text style={titleStyle} numberOfLines={1}>{name}</Text>}
        <Text className="text-xs text-muted-foreground" numberOfLines={1} style={{ marginTop: 1 }}>{subLine}</Text>

        {/* Bottom strip: days · 📎 · अंतिम तिथि */}
        <View className="flex-row items-center gap-3 border-t border-border" style={{ marginTop: 10, paddingTop: 9 }}>
          <Text className="text-xs font-semibold" style={{ color: dayColor }}>{dayLabel}</Text>
          {attachCount ? <Text className="text-xs text-muted-foreground">📎 {attachCount}</Text> : null}
          <Text className="text-xs text-muted-foreground ml-auto">अंतिम {dmy(pp.deadline_date)}</Text>
        </View>
        {/* कार्यालय से आया (चरण ग) */}
        <OfficeCardTag row={pp} />
      </Pressable>

      {/* ⋮ / press-and-hold menu (owner: देखें / संपादित करें / हटाएँ) */}
      <CardActionMenu
        anchor={menu.anchor}
        onClose={menu.close}
        onView={view}
        onEdit={() => router.push(`/(app)/prarthna-patra/add?editId=${pp.id}` as never)}
        onDelete={() => setDeleteOpen(true)}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('prarthnaPatra.list.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('prarthnaPatra.list.deleteDesc', { regNo: PETITION_TYPE_LABELS[pp.petition_type] })}
              {isFromOffice(pp) ? `\n\n${OFFICE_DELETE_WARNING}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteOpen(false)}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onPress={() => { setDeleteOpen(false); onDelete(pp.id); }}
            >
              <Text className="text-destructive-foreground">{t('common.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

// ── Main screen ───────────────────────────────────────────────────────────

export default function PrarthnaPatraScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { settings } = useSettingsStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<PrarthnaPatra[]>([]);
  const [analytics, setAnalytics] = useState<PPDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  // Bug 6 fix: holds async search results from searchPrarthnaPatra().
  // null means "no active query" — fall back to full items list.
  const [searchResults, setSearchResults] = useState<PrarthnaPatra[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(null);
  const [categoryFilter, setCategoryFilter] = useState<PetitionType | null>(null);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  // Design C (owner): स्थिति, तारीख, प्रकार — the same filters as the old chip row, now in the filter sheet.
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const filterGroups = useMemo<FilterGroupDef[]>(() => [
    { key: 'status', label: t('filter.status', 'स्थिति'), options: (['Pending', 'Nistarit'] as StatusFilter[]).map((f) => ({ value: f, label: t(STATUS_LABEL_KEY[f]) })) },
    { key: 'time', label: t('filter.date', 'तारीख'), options: (['Today', 'This Week', 'Overdue'] as NonNullable<TimeFilter>[]).map((v) => ({ value: v, label: t(TIME_FILTER_KEYS[v]) })) },
    { key: 'type', label: t('filter.type', 'प्रकार'), options: PETITION_TYPES.map((v) => ({ value: v, label: v })) },
  ], [t]);
  const filterValues = useMemo<FilterValues>(
    () => ({ status: statusFilter === 'All' ? null : statusFilter, time: timeFilter, type: categoryFilter }),
    [statusFilter, timeFilter, categoryFilter],
  );
  const applyFilters = (v: FilterValues) => {
    setStatusFilter(((v.status as StatusFilter | null) ?? 'All'));
    setTimeFilter(((v.time ?? null) as TimeFilter));
    setCategoryFilter(((v.type ?? null) as PetitionType | null));
  };
  const removeFilter = (key: string) => {
    if (key === 'status') setStatusFilter('All');
    else if (key === 'time') setTimeFilter(null);
    else setCategoryFilter(null);
  };

  const progress = useSharedValue(analyticsExpanded ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(analyticsExpanded ? 1 : 0, { duration: 200 });
  }, [analyticsExpanded, progress]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  const [attachCounts, setAttachCounts] = useState<Record<string, number>>({});
  // first आवेदक per पत्र for the card's big name (owner, card design B)
  const [people, setPeople] = useState<Record<string, PPCardPerson>>({});
  const firstLoadRef = useRef(true);
  const load = useCallback(async () => {
    // Spinner only on the first load; later visits refresh in place so the
    // list isn't torn down (keeps scroll position, no flash).
    if (firstLoadRef.current) { firstLoadRef.current = false; setLoading(true); }
    try {
      const [all, dash, counts, ppl] = await Promise.all([
        getAllPrarthnaPatra(), getDashboardAnalytics(), attachmentCounts('pp').catch(() => ({})),
        ppCardPeople().catch(() => ({} as Record<string, PPCardPerson>)),
      ]);
      setItems(all);
      setAttachCounts(counts);
      setPeople(ppl);
      setAnalytics(dash);
    } catch (e) {
      logger.error('[PrarthnaPatra] Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Back → Dashboard: module root screens always return to home, never exit app.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(app)/home' as never);
      return true;
    });
    return () => sub.remove();
  }, []));

  // Debounced DB search: fires 300 ms after the user stops typing.
  // A cancellation flag prevents stale results from a slower earlier query
  // overwriting results from a faster newer one.
  // When instantSearch is OFF, search only fires on submit (Enter/search icon).
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    if (!settings.instantSearch) return; // submit-only: handled by handleSearchSubmit
    let cancelled = false;
    searchTimer.current = setTimeout(async () => {
      const results = await searchPrarthnaPatra(
        query.trim(),
        settings.typoTolerance ? { typoTolerance: true } : undefined,
      );
      if (!cancelled) setSearchResults(results);
    }, 300);
    return () => {
      cancelled = true;
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, settings.instantSearch, settings.typoTolerance]);

  const handleSearchSubmit = useCallback(async () => {
    if (!query.trim()) return;
    const results = await searchPrarthnaPatra(
      query.trim(),
      settings.typoTolerance ? { typoTolerance: true } : undefined,
    );
    setSearchResults(results);
  }, [query, settings.typoTolerance]);

  // Fix 6: after delete, re-run the active search query so ghost items
  // (deleted entries still visible in searchResults) are removed immediately.
  const handleDelete = useCallback(async (id: string) => {
    await deletePrarthnaPatra(id);
    await load();
    if (query.trim()) {
      const results = await searchPrarthnaPatra(
        query.trim(),
        settings.typoTolerance ? { typoTolerance: true } : undefined,
      );
      setSearchResults(results);
    }
  }, [load, query, settings.typoTolerance]);

  const handleCategoryCardPress = useCallback((type: PetitionType) => {
    setCategoryFilter((prev) => prev === type ? null : type);
  }, []);

  const today = todayStr();
  const weekStart = startOfWeekStr();

  // Bug 6 fix: when a search query is active, start from searchResults
  // (populated by the debounced useEffect via searchPrarthnaPatra which also
  // searches complainant/accused names). Otherwise use the full items list.
  // Status / time / category filters unconditionally apply on top of either
  // source — so clearing the query retains any active filter chips.
  const filtered = useMemo(() => {
    let list: PrarthnaPatra[] = searchResults ?? items;

    if (statusFilter !== 'All') {
      list = list.filter((p) => (statusFilter === 'Nistarit' ? p.status === 'Nistarit' || p.status === 'Finished' : p.status === statusFilter));
    }

    if (timeFilter === 'Today') {
      list = list.filter((p) => p.date_of_receipt === today);
    } else if (timeFilter === 'This Week') {
      list = list.filter((p) => p.date_of_receipt >= weekStart && p.date_of_receipt <= today);
    } else if (timeFilter === 'Overdue') {
      list = list.filter((p) => p.status === 'Pending' && p.deadline_date < today);
    }

    if (categoryFilter) {
      list = list.filter((p) => p.petition_type === categoryFilter);
    }

    return list;
  }, [searchResults, items, statusFilter, timeFilter, categoryFilter, today, weekStart]);

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <FilterSheet
        visible={showFilterSheet}
        groups={filterGroups}
        values={filterValues}
        onApply={applyFilters}
        onClose={() => setShowFilterSheet(false)}
        accent={PP_FILTER_ACCENT}
      />
      <AppHeader
        title={t('prarthnaPatra.title')}
        subtitle={t('prarthnaPatra.list.count', { count: filtered.length })}
        onMenuPress={() => setDrawerOpen(true)}
        actions={
          <HeaderIconBtn
            icon={Plus}
            onPress={() => router.push('/(app)/prarthna-patra/add' as never)}
            label={t('prarthnaPatra.list.addPetition')}
          />
        }
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          removeClippedSubviews
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-4 pb-28"
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await load();
          if (query.trim()) {
            const results = await searchPrarthnaPatra(
              query.trim(),
              settings.typoTolerance ? { typoTolerance: true } : undefined,
            );
            setSearchResults(results);
          }
          setRefreshing(false);
        }}
        ListHeaderComponent={
          <View>
            {/* ── Analytics ── */}
            {analytics && (
              <Animated.View className="mt-3 mb-2">
                {/* Collapsible Analytics Header + Summary */}
                <View className="mb-3">
                  <Pressable
                    onPress={() => setAnalyticsExpanded((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={t('prarthnaPatra.analytics.toggle')}
                    className="py-1"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted-foreground font-medium tracking-widest uppercase">
                        {t('prarthnaPatra.analytics.title')}
                      </Text>
                      <Animated.View style={chevronStyle}>
                        <ChevronDown size={16} color="#6B7280" />
                      </Animated.View>
                    </View>
                    {!analyticsExpanded && (
                      <Text
                        numberOfLines={1}
                        className="text-xs text-muted-foreground mt-1"
                      >
                        {t('prarthnaPatra.analytics.summary', {
                          total: analytics.overall.total,
                          pending: analytics.overall.pending,
                          nistarit: analytics.overall.nistarit + analytics.overall.finished,
                        })}
                      </Text>
                    )}
                  </Pressable>

                  {!analyticsExpanded && categoryFilter !== null && (
                    <View className="flex-row items-center mt-1.5">
                      <View className="flex-row items-center bg-muted rounded-full pl-2.5 pr-1.5 py-1 border border-border">
                        <Text className="text-xs text-foreground font-medium mr-1.5">
                          {t('prarthnaPatra.analytics.filtered', { type: PETITION_TYPE_LABELS[categoryFilter] })}
                        </Text>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            setCategoryFilter(null);
                          }}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={t('prarthnaPatra.analytics.clearFilter')}
                          className="w-4 h-4 rounded-full bg-muted-foreground/20 items-center justify-center active:opacity-60"
                        >
                          <X size={10} color="#6B7280" />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>

                {/* Expanded Analytics Block */}
                {analyticsExpanded && (
                  <Animated.View
                  >
                    {/* Overall card — compact 4-stat row */}
                    <View
                      className="bg-card border border-border rounded-2xl p-2.5 mb-2.5"
                      style={{ borderCurve: 'continuous' }}
                    >
                      <Text className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-2">
                        {t('prarthnaPatra.analytics.overall')}
                      </Text>
                      <View className="flex-row gap-2">
                        <View className="flex-1 items-center">
                          <Text className="text-base font-bold text-foreground">{analytics.overall.total}</Text>
                          <Text style={{ ...T.micro, color: '#9CA3AF', marginTop: 1 }}>{t('prarthnaPatra.analytics.statTotal')}</Text>
                        </View>
                        <View className="w-px bg-border" />
                        <View className="flex-1 items-center">
                          <Text className="text-base font-bold" style={{ color: '#92400E' }}>{analytics.overall.pending}</Text>
                          <Text style={{ ...T.micro, color: '#9CA3AF', marginTop: 1 }}>{t('fir.list.filterPending')}</Text>
                        </View>
                        <View className="w-px bg-border" />
                        <View className="flex-1 items-center">
                          <Text className="text-base font-bold" style={{ color: '#065F46' }}>{analytics.overall.nistarit + analytics.overall.finished}</Text>
                          <Text style={{ ...T.micro, color: '#9CA3AF', marginTop: 1 }}>{t('prarthnaPatra.status.nistarit')}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Category cards */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="mb-3"
                      contentContainerStyle={{ paddingRight: 8 }}
                    >
                      {PETITION_TYPES.map((type) => (
                        <AnalyticsCard
                          key={type}
                          label={PETITION_TYPE_LABELS[type]}
                          total={analytics.byType[type].total}
                          pending={analytics.byType[type].pending}
                          nistarit={analytics.byType[type].nistarit}
                          finished={analytics.byType[type].finished}
                          dueToday={analytics.byType[type].dueToday}
                          overdue={analytics.byType[type].overdue}
                          selected={categoryFilter === type}
                          onPress={() => handleCategoryCardPress(type)}
                        />
                      ))}
                    </ScrollView>
                  </Animated.View>
                )}
              </Animated.View>
            )}

            {/* ── Search + filter (design C, owner): ⚙︎ in the box, chosen filters as chips, sheet ── */}
            <SearchBar
              value={query}
              noResults={!loading && !!query.trim() && filtered.length === 0}
              onChangeText={setQuery}
              onSubmitEditing={handleSearchSubmit}
              placeholder={t('prarthnaPatra.list.searchPlaceholder')}
              variant="light"
              returnKeyType="search"
              containerStyle={{ marginBottom: T.space.sm }}
              accessibilityLabel={t('prarthnaPatra.list.searchAccessibility')}
              trailing={<FilterSearchButton count={activeFilterCount(filterValues)} onPress={() => setShowFilterSheet(true)} accent={PP_FILTER_ACCENT} />}
            />
            {activeFilterCount(filterValues) > 0 ? (
              <View style={{ marginBottom: T.space.sm }}>
                <ActiveFilterChips groups={filterGroups} values={filterValues} onRemove={removeFilter} accent={PP_FILTER_ACCENT} />
              </View>
            ) : null}

            {/* List count label */}
            <Text className="text-xs text-muted-foreground font-medium tracking-widest uppercase mt-1 mb-2">
              {t('prarthnaPatra.list.count', { count: filtered.length })}
            </Text>

            {loading && <ActivityIndicator className="my-8" />}
          </View>
        }
        renderItem={({ item }) => <PPCard pp={item} query={query} highlight={settings.highlightMatches} typoTolerant={settings.typoTolerance} onDelete={handleDelete} attachCount={attachCounts[item.id]} person={people[item.id]} />}
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-16 gap-3">
              <FileText size={40} color="#9CA3AF" />
              <Text className="text-base font-semibold text-muted-foreground">{t('prarthnaPatra.list.emptyTitle')}</Text>
              <Text className="text-sm text-muted-foreground text-center px-8">
                {query || statusFilter !== 'All' || timeFilter || categoryFilter
                  ? t('prarthnaPatra.list.emptySearchHint')
                  : t('prarthnaPatra.list.emptyAddHint')}
              </Text>
            </View>
          ) : null
        }
      />

    </View>
  );
}

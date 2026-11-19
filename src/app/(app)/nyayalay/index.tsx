import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import {
  BackHandler, View, Text, ScrollView, Pressable, FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { attachmentCounts } from '@/lib/db/attachmentRepo';
import { CardActionMenu, CardMenuButton, dmy, useCardMenu } from '@/components/common/CardActionMenu';
import { BatchDeleteDialog, SelectTick, SelectionHeader, runBatchExport, useCardSelection } from '@/components/common/CardSelection';
import { exportNyayalayBatch } from '@/lib/batchReportExport';
import { OFFICE_BLUE, OFFICE_DELETE_WARNING, OfficeCardTag, isFromOffice } from '@/office/OfficeOrigin';
import { useColorScheme } from 'nativewind';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import {
  Plus, Scale, ChevronDown, X,
} from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import { ActiveFilterChips, FilterSearchButton, FilterSheet, activeFilterCount, type FilterGroupDef, type FilterValues } from '@/components/common/FilterSheet';
import { HighlightText } from '@/components/HighlightText';
import { getAllNyayalayDocuments, deleteNyayalayDocument, searchNyayalayDocuments, computeAnalyticsFromDocs, nylDaysUntilDeadline, todayStr, DOC_TYPES, type NyayalayDocument, type NyayalayAnalytics, type DocType } from '@/lib/db/nyayalayRepo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useListBottomPadding } from '@/hooks/useListBottomPadding';
import { THEME } from '@/lib/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useGoHome } from '@/lib/goHome';

const NYL_COLOR = '#1D4ED8';

// Chip inactive tokens — readable on bg-background in both themes

// Status badge tokens — theme-aware
const STATUS_BG   = { light: { Finished: '#D1FAE5', Overdue: '#FEE2E2', Pending: '#FEF3C7' }, dark: { Finished: '#052E16', Overdue: '#450A0A', Pending: '#451A03' } } as const;
const STATUS_TEXT = { light: { Finished: '#065F46', Overdue: '#991B1B', Pending: '#92400E' }, dark: { Finished: '#6EE7B7', Overdue: '#FCA5A5', Pending: '#FCD34D' } } as const;
const DAY_COLOR   = { light: { finished: '#065F46', positive: '#1D4ED8', overdue: '#DC2626' }, dark: { finished: '#6EE7B7', positive: '#93C5FD', overdue: '#F87171' } } as const;

const STATUS_LABEL_KEY = {
  Finished: 'nyayalay.status.nistarit',
  Overdue: 'nyayalay.status.overdue',
  Pending: 'fir.list.filterPending',
} as const;

const DOC_TYPE_I18N_KEYS: Record<DocType, string> = {
  NBW: 'nyayalay.docType.NBW',
  Summons: 'nyayalay.docType.Summons',
  Bail_Lower_Court: 'nyayalay.docType.Bail_Lower_Court',
  High_Court_Documents: 'nyayalay.docType.High_Court_Documents',
  Anya: 'nyayalay.docType.Anya',
};

// ── Types ─────────────────────────────────────────────────────────────────

type StatusFilter = 'All' | 'Pending' | 'Finished';
type TimeFilter = 'Due Today' | 'Overdue' | null;

// ── Sub-components ────────────────────────────────────────────────────────

/** Compact analytics card — equal-width, minimal height, professional MD3 look */
function AnalyticsCard({
  label, total, pending, finished, overdue, selected, onPress, scheme,
}: {
  label: string; total: number; pending: number; finished: number;
  overdue: number; selected?: boolean; onPress?: () => void;
  scheme: 'light' | 'dark';
}) {
  const palette = THEME[scheme];
  return (
    <Pressable
      onPress={onPress}
      className="bg-card border rounded-2xl px-2.5 py-2 mr-2 active:opacity-70"
      style={{
        borderColor: selected ? NYL_COLOR : palette.border,
        borderWidth: selected ? 1.5 : 1,
        width: 116,
        borderCurve: 'continuous',
      }}
    >
      <Text className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-widest"
        numberOfLines={1}>{label}</Text>
      <Text className="text-lg font-bold text-foreground leading-tight">{total}</Text>
      <View className="flex-row gap-2 mt-1.5 pt-1.5 border-t border-border">
        <View className="flex-1 items-center">
          <Text className="text-xs font-semibold" style={{ color: STATUS_TEXT[scheme].Pending }}>{pending}</Text>
          <Text className="text-xs text-muted-foreground">P</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-xs font-semibold" style={{ color: STATUS_TEXT[scheme].Finished }}>{finished}</Text>
          <Text className="text-xs text-muted-foreground">F</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-xs font-semibold" style={{ color: STATUS_TEXT[scheme].Overdue }}>{overdue}</Text>
          <Text className="text-xs text-muted-foreground">O</Text>
        </View>
      </View>
    </Pressable>
  );
}

const DocCard = memo(function DocCard({
  doc, query, highlight, typoTolerant, onPress, onEdit, onDelete, scheme, attachCount, selecting, selected, onToggle,
}: {
  /** press-and-hold selection (owner): tick instead of ⋮, a tap chooses / un-chooses */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
  /** संलग्न कागज़ count (owner) → "📎 n" */
  attachCount?: number;
  doc: NyayalayDocument;
  query: string;
  highlight: boolean;
  typoTolerant?: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  scheme: 'light' | 'dark';
}) {
  const { t } = useTranslation();
  const palette = THEME[scheme];
  const today = todayStr();
  const days = nylDaysUntilDeadline(doc.deadline_date, doc.status);
  const isFinished = doc.status === 'Finished';
  const isOverdue = !isFinished && doc.deadline_date < today;

  const dayLabel = isFinished
    ? t('nyayalay.status.nistarit')
    : days > 0 ? t('nyayalay.daysLeft', { count: days })
    : days === 0 ? t('nyayalay.dueToday')
    : t('nyayalay.daysOverdue', { count: Math.abs(days) });

  const dayColorKey = isFinished ? 'finished' : days > 0 ? 'positive' : 'overdue';
  const dayColor = DAY_COLOR[scheme][dayColorKey];

  const statusKey: 'Finished' | 'Overdue' | 'Pending' = isFinished ? 'Finished' : isOverdue ? 'Overdue' : 'Pending';
  const statusBg    = STATUS_BG[scheme][statusKey];
  const statusColor = STATUS_TEXT[scheme][statusKey];
  const statusLabel = t(STATUS_LABEL_KEY[statusKey]);

  // Type badge — use accent token so it adapts to both themes
  const typeBadgeBg   = palette.accent;
  const typeBadgeText = palette.accentForeground;
  // owner (card design B, same as प्रार्थना पत्र): लंबित / समय निकला / निस्तारित, "n दिन ऊपर", ⋮ menu instead of ✏️ 🗑
  const statusWord = isFinished ? statusLabel : isOverdue ? 'समय निकला' : 'लंबित';
  const dayWord = !isFinished && days < 0 ? `${Math.abs(days)} दिन ऊपर` : dayLabel;
  const title = doc.court_name || doc.document_title || '';
  const subLine = [
    doc.vad_sankhya ? `वाद सं0 ${doc.vad_sankhya}` : '',
    doc.fir_number ? `मु0अ0सं0 ${doc.fir_number}` : '',
  ].filter(Boolean).join(' · ');
  const menu = useCardMenu();
  const titleStyle = { fontSize: 16, fontWeight: '700' as const, lineHeight: 24, color: palette.cardForeground, marginTop: 8 };

  return (
    <Pressable
      onPress={selecting ? () => onToggle?.(doc.id) : onPress}
      // owner: press-and-hold = choose the card (the menu stays on ⋮)
      onLongPress={() => onToggle?.(doc.id)}
      delayLongPress={350}
      className="bg-card border border-border rounded-2xl p-4 mb-3 active:opacity-70"
      style={{
        borderCurve: 'continuous',
        ...(isFromOffice(doc) ? { borderWidth: 2, borderColor: OFFICE_BLUE[scheme] } : {}),
        // chosen: module blue ring + faint blue tint (works on both themes)
        ...(selected ? { borderWidth: 2, borderColor: NYL_COLOR, backgroundColor: `${NYL_COLOR}14` } : {}),
      }}
      accessibilityState={selecting ? { selected: !!selected } : undefined}
    >
      {/* Top: type (+ sub type) · status · ⋮ */}
      <View className="flex-row items-center gap-2">
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: typeBadgeBg }}>
          <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: typeBadgeText }}>
            {t(DOC_TYPE_I18N_KEYS[doc.doc_type])}
          </Text>
        </View>
        {doc.sub_type ? (
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: palette.muted, flexShrink: 1 }}>
            <Text textBreakStrategy="simple" numberOfLines={1} className="text-xs" style={{ color: palette.mutedForeground }}>{doc.sub_type}</Text>
          </View>
        ) : null}
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: statusBg, marginLeft: 'auto' }}>
          <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: statusColor }}>{statusWord}</Text>
        </View>
        {selecting
          ? <SelectTick selected={!!selected} accent={NYL_COLOR} />
          : <CardMenuButton btnRef={menu.btnRef} onPress={menu.openAt} />}
      </View>

      {/* Big name = न्यायालय (else the कागज़ title) */}
      {title ? (
        highlight
          ? <HighlightText text={title} query={query} style={titleStyle} numberOfLines={1} typoTolerant={typoTolerant} />
          : <Text style={titleStyle} numberOfLines={1}>{title}</Text>
      ) : null}
      {subLine ? <Text className="text-xs text-muted-foreground" numberOfLines={1} style={{ marginTop: 1 }}>{subLine}</Text> : null}

      {/* Bottom strip: days · 📎 · अंतिम तिथि */}
      <View className="flex-row items-center gap-3 border-t border-border" style={{ marginTop: 10, paddingTop: 9 }}>
        <Text className="text-xs font-semibold" style={{ color: dayColor }}>{dayWord}</Text>
        {attachCount ? <Text className="text-xs text-muted-foreground">📎 {attachCount}</Text> : null}
        <Text className="text-xs text-muted-foreground ml-auto">अंतिम {dmy(doc.deadline_date)}</Text>
      </View>
      {/* कार्यालय से आया (चरण ग) */}
      <OfficeCardTag row={doc} />

      <CardActionMenu anchor={menu.anchor} onClose={menu.close} onView={onPress} onEdit={onEdit} onDelete={onDelete} />
    </Pressable>
  );
});

// ── Main Screen ───────────────────────────────────────────────────────────

export default function NyayalayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = THEME[scheme];
  const listPaddingBottom = useListBottomPadding();
  const { settings } = useSettingsStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [docs, setDocs] = useState<NyayalayDocument[]>([]);
  // Analytics derived from docs via useMemo — SSOT, always in sync, never NaN
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NyayalayDocument[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(null);
  const [typeFilter, setTypeFilter] = useState<DocType | null>(null);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  // Design C (owner): स्थिति, समय सीमा, प्रकार — the same three filters as the old chips, now in the filter sheet.
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const filterGroups = useMemo<FilterGroupDef[]>(() => [
    { key: 'status', label: t('filter.status', 'स्थिति'), options: [
      { value: 'Pending', label: t('fir.list.filterPending') }, { value: 'Finished', label: t('nyayalay.status.nistarit') },
    ] },
    { key: 'time', label: t('filter.date', 'तारीख'), options: [
      { value: 'Due Today', label: t('nyayalay.filterDueToday') }, { value: 'Overdue', label: t('nyayalay.status.overdue') },
    ] },
    { key: 'type', label: t('filter.type', 'प्रकार'), options: DOC_TYPES.map((d) => ({ value: d, label: t(DOC_TYPE_I18N_KEYS[d]) })) },
  ], [t]);
  const filterValues = useMemo<FilterValues>(
    () => ({ status: statusFilter === 'All' ? null : statusFilter, time: timeFilter, type: typeFilter }),
    [statusFilter, timeFilter, typeFilter],
  );
  const applyFilters = (v: FilterValues) => {
    setStatusFilter(((v.status as StatusFilter | null) ?? 'All'));
    setTimeFilter(((v.time ?? null) as TimeFilter));
    setTypeFilter(((v.type ?? null) as DocType | null));
  };
  const removeFilter = (key: string) => {
    if (key === 'status') setStatusFilter('All');
    else if (key === 'time') setTimeFilter(null);
    else setTypeFilter(null);
  };

  const progress = useSharedValue(analyticsExpanded ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(analyticsExpanded ? 1 : 0, { duration: 200 });
  }, [analyticsExpanded, progress]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const today = todayStr();

  const [attachCounts, setAttachCounts] = useState<Record<string, number>>({});
  const firstLoadRef = useRef(true);
  const load = useCallback(async () => {
    // Spinner only on the first load; later visits refresh in place so the
    // list isn't torn down (keeps scroll position, no flash).
    if (firstLoadRef.current) { firstLoadRef.current = false; setLoading(true); }
    try {
      const [all, counts] = await Promise.all([
        getAllNyayalayDocuments(), attachmentCounts('court').catch(() => ({})),
      ]);
      setAttachCounts(counts);
      setDocs(all);
    } catch (e) {
      logger.error('[NyayalayIndex] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Analytics computed from docs — same data source as the list (SSOT).
  // useMemo means values update the instant docs changes; no extra query needed.
  const analytics: NyayalayAnalytics = useMemo(
    () => computeAnalyticsFromDocs(docs),
    [docs]
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));
  // set below once the list is known — the back handler reads it (registered once on focus)
  const selectionBackRef = useRef<() => boolean>(() => false);

  const goHome = useGoHome();
  // Back → Dashboard: module root screens always return to home, never exit app.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectionBackRef.current()) return true; // back first ends the choosing
      goHome(); // back to the Home below (no new Home) — src/lib/goHome.ts
      return true;
    });
    return () => sub.remove();
  }, [goHome]));

  // BUG-R2 FIX: handleSearch fired an async DB query on every keystroke with no
  // debounce — same pattern as BUG-H3 (knowledge/index.tsx). Added 300 ms debounce
  // with searchTimer ref so only one DB query fires per keystroke burst.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); return; }
    if (!settings.instantSearch) return; // submit-only mode: wait for Enter key
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchNyayalayDocuments(
          q,
          settings.typoTolerance ? { typoTolerance: true } : undefined,
        );
        setSearchResults(results);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [settings.instantSearch, settings.typoTolerance]);

  const handleSubmitSearch = useCallback(async () => {
    if (!query.trim()) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearching(true);
    try {
      const results = await searchNyayalayDocuments(
        query,
        settings.typoTolerance ? { typoTolerance: true } : undefined,
      );
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, [query, settings.typoTolerance]);

  // Filtered list
  const filtered = useMemo(() => {
    const base = searchResults ?? docs;
    return base.filter((d) => {
      if (statusFilter !== 'All' && d.status !== statusFilter) return false;
      if (typeFilter && d.doc_type !== typeFilter) return false;
      if (timeFilter === 'Due Today' && d.deadline_date !== today) return false;
      if (timeFilter === 'Overdue' && !(d.status === 'Pending' && d.deadline_date < today)) return false;
      return true;
    });
  }, [docs, searchResults, statusFilter, typeFilter, timeFilter, today]);

  // Press-and-hold selection (owner): ☑ सभी चुनें · ⬇ one Word file · 🗑 delete the chosen ones.
  const shownIds = useMemo(() => filtered.map((d) => d.id), [filtered]);
  const sel = useCardSelection(shownIds);
  selectionBackRef.current = sel.handleBack;
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const chosenFromOffice = useMemo(() => filtered.some((d) => sel.selectedIds.has(d.id) && isFromOffice(d)), [filtered, sel.selectedIds]);
  const handleBatchExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    await runBatchExport(() => exportNyayalayBatch([...sel.selectedIds]), { noun: 'कागज़', report: 'रिपोर्ट' });
    setExporting(false);
    sel.clear();
  }, [exporting, sel]);
  const handleBatchDelete = useCallback(async () => {
    setBatchDeleteOpen(false);
    for (const id of sel.selectedIds) {
      try { await deleteNyayalayDocument(id); } catch { /* keep going */ }
    }
    sel.clear();
    if (query.trim()) {
      const results = await searchNyayalayDocuments(query, settings.typoTolerance ? { typoTolerance: true } : undefined).catch(() => null);
      if (results) setSearchResults(results);
    }
    load();
  }, [sel, load, query, settings.typoTolerance]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteNyayalayDocument(deleteTarget);
    setDeleteTarget(null);
    load();
  }, [deleteTarget, load]);

  // HOOKS RULE FIX: hoisted from renderItem={useCallback(...)} inside the
  // loading conditional. Calling a hook inside a conditional JSX branch violates
  // Rules of Hooks and causes "Rendered more hooks than during the previous render".
  const renderDocItem = useCallback(({ item }: { item: NyayalayDocument }) => (
    <View className="px-5">
      <DocCard
        doc={item}
        query={query}
        highlight={settings.highlightMatches}
        typoTolerant={settings.typoTolerance}
        scheme={scheme}
        onPress={() => router.push(`/(app)/nyayalay/${item.id}` as never)}
        onEdit={() => router.push(`/(app)/nyayalay/add?editId=${item.id}` as never)}
        onDelete={() => setDeleteTarget(item.id)}
        attachCount={attachCounts[item.id]}
        selecting={sel.selecting}
        selected={sel.selectedIds.has(item.id)}
        onToggle={sel.toggle}
      />
    </View>
  ), [query, settings.highlightMatches, settings.typoTolerance, scheme, attachCounts, sel.selecting, sel.selectedIds, sel.toggle]);

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {sel.selecting ? (
        <SelectionHeader
          count={sel.selectedIds.size}
          allChosen={sel.allChosen}
          onBack={sel.clear}
          onToggleAll={sel.toggleAll}
          onExport={handleBatchExport}
          onDelete={() => setBatchDeleteOpen(true)}
          exporting={exporting}
        />
      ) : (
      <AppHeader
        title={t('nyayalay.title')}
        subtitle={filtered.length === 1 ? t('nyayalay.docCount_one', { count: filtered.length }) : t('nyayalay.docCount_other', { count: filtered.length })}
        onMenuPress={() => setDrawerOpen(true)}
        actions={
          <HeaderIconBtn
            icon={Plus}
            onPress={() => router.push('/(app)/nyayalay/add' as never)}
            label={t('nyayalay.addCourtDocument')}
            color={NYL_COLOR}
          />
        }
      />
      )}

      {/* Toolbar */}
      <View className="px-4 pt-3 pb-2 gap-2 bg-background border-b border-border">
        <SearchBar
          value={query}
          noResults={!loading && !!query.trim() && filtered.length === 0}
          onChangeText={handleSearch}
          onSubmitEditing={handleSubmitSearch}
          placeholder={t('nyayalay.searchPlaceholder')}
          variant="light"
          returnKeyType="search"
          accessibilityLabel={t('nyayalay.searchAccessibility')}
          trailing={<FilterSearchButton count={activeFilterCount(filterValues)} onPress={() => setShowFilterSheet(true)} accent={NYL_COLOR} />}
        />
        <ActiveFilterChips groups={filterGroups} values={filterValues} onRemove={removeFilter} accent={NYL_COLOR} />
      </View>

      <FilterSheet
        visible={showFilterSheet}
        groups={filterGroups}
        values={filterValues}
        onApply={applyFilters}
        onClose={() => setShowFilterSheet(false)}
        accent={NYL_COLOR}
      />

      <FlatList keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          removeClippedSubviews
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: listPaddingBottom }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <View className="px-5 pt-5">
            {/* Collapsible Analytics Header + Summary */}
            <Animated.View className="mb-3">
              <Pressable
                onPress={() => setAnalyticsExpanded((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={t('nyayalay.accessibility.toggleAnalytics')}
                className="py-1"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('nyayalay.overview')}
                  </Text>
                  <Animated.View style={chevronStyle}>
                    <ChevronDown size={16} color={palette.mutedForeground} />
                  </Animated.View>
                </View>
                {!analyticsExpanded && (
                  <Text
                    numberOfLines={1}
                    className="text-xs text-muted-foreground mt-1"
                  >
                    {`${analytics.overall.total} ${t('nyayalay.analyticsTotal')} · ${analytics.overall.pending} ${t('fir.list.filterPending')} · ${analytics.overall.finished} ${t('nyayalay.status.nistarit')} · ${analytics.overall.overdue} ${t('nyayalay.status.overdue')}`}
                  </Text>
                )}
              </Pressable>

              {!analyticsExpanded && typeFilter !== null && (
                <View className="flex-row items-center mt-1.5">
                  <View className="flex-row items-center bg-muted rounded-full pl-2.5 pr-1.5 py-1 border border-border">
                    <Text className="text-xs text-foreground font-medium mr-1.5">
                      {t('nyayalay.filteredPrefix', { type: t(DOC_TYPE_I18N_KEYS[typeFilter]) })}
                    </Text>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setTypeFilter(null);
                      }}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={t('nyayalay.accessibility.clearFilter')}
                      className="w-4 h-4 rounded-full bg-muted-foreground/20 items-center justify-center active:opacity-60"
                    >
                      <X size={10} color={palette.foreground} />
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Expanded Analytics Block */}
              {analyticsExpanded && (
                <Animated.View
                >
                  {/* Analytics – compact overall row */}
                  <View
                    className="bg-card border border-border rounded-2xl px-4 py-2.5 mb-2.5"
                    style={{ borderCurve: 'continuous', borderLeftWidth: 3, borderLeftColor: NYL_COLOR }}
                  >
                    <Text className="text-xs font-bold uppercase tracking-widest mb-2 text-muted-foreground">
                      {t('nyayalay.overview')}
                    </Text>
                    <View className="flex-row gap-2">
                      {[
                        { label: t('nyayalay.analyticsTotal'),   val: analytics.overall.total,    colorKey: 'cardForeground' as const },
                        { label: t('fir.list.filterPending'), val: analytics.overall.pending,  colorKey: null, statusKey: 'Pending' as const },
                        { label: t('nyayalay.status.nistarit'),val: analytics.overall.finished, colorKey: null, statusKey: 'Finished' as const },
                        { label: t('nyayalay.status.overdue'), val: analytics.overall.overdue,  colorKey: null, statusKey: 'Overdue' as const },
                      ].map(({ label, val, colorKey, statusKey }) => (
                        <View key={label} className="flex-1 items-center">
                          <Text className="text-base font-bold leading-tight" style={{ color: colorKey ? palette[colorKey] : STATUS_TEXT[scheme][statusKey!] }}>{val}</Text>
                          <Text className="text-xs text-muted-foreground mt-0.5">{label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Per-type compact analytics cards */}
                  <ScrollView keyboardShouldPersistTaps="handled"
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-3"
                    contentContainerStyle={{ paddingRight: 20 }}
                  >
                    {DOC_TYPES.map((type) => (
                      <AnalyticsCard
                        key={type}
                        label={t(DOC_TYPE_I18N_KEYS[type])}
                        total={analytics.byType[type].total}
                        pending={analytics.byType[type].pending}
                        finished={analytics.byType[type].finished}
                        overdue={analytics.byType[type].overdue}
                        selected={typeFilter === type}
                        scheme={scheme}
                        onPress={() => setTypeFilter((p) => p === type ? null : type)}
                      />
                    ))}
                  </ScrollView>
                </Animated.View>
              )}
            </Animated.View>

            {/* List count */}
            <Text className="text-xs font-bold uppercase tracking-widest mb-3 text-muted-foreground">
              {t('nyayalay.documents')} ({filtered.length})
            </Text>

            {loading && (
              <View className="items-center py-10">
                <ActivityIndicator size="large" color={NYL_COLOR} />
              </View>
            )}
          </View>
        )}
        renderItem={renderDocItem}
        ListEmptyComponent={() =>
          !loading ? (
            <View className="px-5 items-center py-16">
              <Scale size={40} color={palette.border} />
              <Text className="text-base font-semibold text-foreground mt-4 mb-1">
                {query || statusFilter !== 'All' || timeFilter || typeFilter
                  ? t('nyayalay.noMatchingDocs')
                  : t('nyayalay.noDocs')}
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                {query || statusFilter !== 'All' || timeFilter || typeFilter
                  ? t('nyayalay.noMatchingDocsHint')
                  : t('nyayalay.noDocsHint')}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Delete dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('nyayalay.dialog.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('nyayalay.dialog.deleteDesc')}
              {docs.find((d) => d.id === deleteTarget && isFromOffice(d)) ? `\n\n${OFFICE_DELETE_WARNING}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={handleDeleteConfirm}
              className="bg-destructive"
            >
              <Text className="text-destructive-foreground font-semibold">{t('common.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BatchDeleteDialog
        open={batchDeleteOpen}
        title={`${sel.selectedIds.size} न्यायालय कागज़ हटाएँ?`}
        description={`इनकी रिपोर्ट, चेकलिस्ट और संलग्न कागज़ भी हट जाएँगे। यह वापस नहीं होगा।${chosenFromOffice ? `\n\n${OFFICE_DELETE_WARNING}` : ''}`}
        onCancel={() => setBatchDeleteOpen(false)}
        onConfirm={handleBatchDelete}
      />
    </View>
  );
}

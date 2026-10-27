import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { logger } from '@/lib/logger';
import {
  BackHandler, View, Text, FlatList, Pressable, ActivityIndicator, useWindowDimensions,
  Share,
} from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import {
  Plus, Filter, ChevronDown, Pencil, Trash2, FileText, Sparkles, NotebookPen,
} from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import { matchesQuery, fuzzyMatch } from '@/lib/searchUtils';
import { HighlightText } from '@/components/HighlightText';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getAllFIRs, deleteFIR, searchFirIdsByLinkedText, type FIR } from '@/lib/db/firRepo';
import { cdGapDays, CD_ALERT_AFTER_DAYS, CD_MAX_GAP_DAYS } from '@/lib/caseDiaryGap';
import { SORT_OPTIONS, type SortOption } from '@/lib/mukadmaConstants';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useListBottomPadding } from '@/hooks/useListBottomPadding';
import { THEME } from '@/lib/theme';
import { crimeTypeLabel } from '@/lib/db/checklistRepo';

const ACCENT = '#6366F1';
const STATUS_FILTER_KEYS = ['All', 'Pending', 'Finished'] as const;
type StatusFilter = (typeof STATUS_FILTER_KEYS)[number];

// Chip inactive tokens — readable on bg-background in both themes
// Light: #F1F5F9 bg + #475569 text (7.0:1 on #F1F5F9) ✓
// Dark:  #334155 bg + #CBD5E1 text (7.1:1 on #334155) ✓
const CHIP_INACTIVE_BG   = { light: '#F1F5F9', dark: '#334155' } as const;
const CHIP_INACTIVE_TEXT = { light: '#475569', dark: '#CBD5E1' } as const;
const CHIP_BORDER        = { light: '#CBD5E1', dark: '#475569' } as const;

// Status badge — semantic tokens (theme-aware Pending/Finished palette)
// Using accent + accentForeground from THEME so both light/dark render clearly.
// Pending  → amber-tinted; Finished → green-tinted.
// Light: Pending bg #FEF3C7 (amber-100), text #92400E; Finished bg #D1FAE5, text #065F46
// Dark:  Pending bg #451A03 (amber-950), text #FCD34D; Finished bg #052E16 (green-950), text #6EE7B7
const STATUS_BG   = { light: { Pending: '#FEF3C7', Finished: '#D1FAE5' }, dark: { Pending: '#451A03', Finished: '#052E16' } } as const;
const STATUS_TEXT = { light: { Pending: '#92400E', Finished: '#065F46' }, dark: { Pending: '#FCD34D', Finished: '#6EE7B7' } } as const;

function StatusBadge({ status, scheme }: { status: string; scheme: 'light' | 'dark' }) {
  const key = status === 'Finished' ? 'Finished' : 'Pending';
  return (
    <View
      className="rounded-full px-2.5 py-1"
      style={{ backgroundColor: STATUS_BG[scheme][key] }}
    >
      <Text textBreakStrategy="simple"
        className="text-xs font-semibold"
        style={{ color: STATUS_TEXT[scheme][key] }}
      >
        {key === 'Finished' ? 'समाप्त' : 'विचाराधीन'}
      </Text>
    </View>
  );
}

// "केस डायरी लंबित" badge: amber from day 7, red after the 15-day limit.
const CD_BADGE = {
  light: { warn: { bg: '#FEF3C7', fg: '#92400E' }, over: { bg: '#FEE2E2', fg: '#B91C1C' } },
  dark:  { warn: { bg: '#451A03', fg: '#FCD34D' }, over: { bg: '#450A0A', fg: '#FCA5A5' } },
} as const;

function CdGapBadge({ fir, scheme }: { fir: FIR; scheme: 'light' | 'dark' }) {
  if (fir.status === 'Finished') return null;
  const days = cdGapDays(fir);
  if (days == null || days < CD_ALERT_AFTER_DAYS) return null;
  const c = CD_BADGE[scheme][days > CD_MAX_GAP_DAYS ? 'over' : 'warn'];
  const label = fir.last_diary_date
    ? `केस डायरी लंबित · ${days} दिन`
    : `कोई केस डायरी नहीं · ${days} दिन`;
  return (
    <View className="self-start flex-row items-center rounded-full px-2.5 py-1 mt-2" style={{ backgroundColor: c.bg, gap: 4 }}>
      <NotebookPen size={12} color={c.fg} />
      <Text textBreakStrategy="simple" style={{ fontSize: 12, fontWeight: '700', color: c.fg }}>{label}</Text>
    </View>
  );
}

const FIRCard = memo(function FIRCard({
  fir, query, onDelete, highlight, scheme, typoTolerant,
}: {
  fir: FIR; query: string; onDelete: (id: string) => void; highlight: boolean;
  scheme: 'light' | 'dark'; typoTolerant?: boolean;
}) {
  const { t } = useTranslation();
  const palette = THEME[scheme];
  const crimeLabel = crimeTypeLabel(fir.crime_type);
  // created_at is stored in seconds (older rows may be in ms).
  const createdMs = fir.created_at < 10000000000 ? fir.created_at * 1000 : fir.created_at;
  const registrationDate = new Date(createdMs).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const handleAskAI = async (e?: any) => {
    e?.stopPropagation?.();
    const prompt = `Suggest an important investigation checklist for a "${crimeLabel || fir.crime_type}" case.`;
    try {
      await Share.share({ message: prompt });
    } catch {
      // user cancelled the share sheet - no action needed
    }
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(app)/mukadma/[firId]/(tabs)/details' as never, params: { firId: fir.id } })}
      className="bg-card border border-border rounded-2xl p-4 mb-3 active:opacity-70"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-start justify-between gap-3 mb-2">
        <View className="flex-1">
          <Text className="text-xs text-muted-foreground font-medium tracking-widest uppercase">
            {t('fir.list.firNoLabel')}
          </Text>
          {highlight ? (
            <HighlightText
              text={fir.fir_number}
              query={query}
              style={{ fontSize: 16, fontWeight: '700', marginTop: 2, color: palette.cardForeground }}
              typoTolerant={typoTolerant}
            />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 2, color: palette.cardForeground }}>{fir.fir_number}</Text>
          )}
        </View>
        <StatusBadge status={fir.status} scheme={scheme} />
      </View>

      {highlight ? (
        <HighlightText
          text={fir.complainant_name}
          query={query}
          style={{ fontSize: 14, fontWeight: '500', color: palette.cardForeground }}
          numberOfLines={1}
          typoTolerant={typoTolerant}
        />
      ) : (
        <Text style={{ fontSize: 14, fontWeight: '500', color: palette.cardForeground }} numberOfLines={1}>{fir.complainant_name}</Text>
      )}
      {highlight ? (
        <HighlightText
          text={crimeLabel}
          query={query}
          style={{ fontSize: 12, marginTop: 2, color: palette.mutedForeground }}
          numberOfLines={1}
          typoTolerant={typoTolerant}
        />
      ) : (
        <Text style={{ fontSize: 12, marginTop: 2, color: palette.mutedForeground }} numberOfLines={1}>{crimeLabel}</Text>
      )}
      {fir.section ? (
        <Text className="text-xs text-muted-foreground">
          {t('fir.list.sectionLabel', { section: fir.section })}
        </Text>
      ) : null}
      <Text className="text-xs text-muted-foreground mt-0.5">
        {t('fir.list.registeredLabel', { date: registrationDate })}
      </Text>
      <CdGapBadge fir={fir} scheme={scheme} />

      {/* Action row: 36×36dp + hitSlop 4 = 44dp minimum touch target */}
      <View className="flex-row gap-3 mt-3 pt-3 border-t border-border">
        <Pressable
          onPress={() => router.push({ pathname: '/(app)/mukadma/[firId]/(tabs)/details' as never, params: { firId: fir.id } })}
          className="flex-row items-center gap-1.5 active:opacity-60"
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center' }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel="FIR संपादित करें"
        >
          <Pencil size={14} color="#2D52B8" />
          <Text className="text-xs font-semibold" style={{ color: '#2D52B8' }}>{t('fir.list.edit')}</Text>
        </Pressable>
        <Pressable
          onPress={() => onDelete(fir.id)}
          className="flex-row items-center gap-1.5 active:opacity-60"
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center' }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel="FIR हटाएं"
        >
          <Trash2 size={14} color={palette.destructive} />
          <Text className="text-xs font-semibold text-destructive">{t('fir.list.delete')}</Text>
        </Pressable>
        <Pressable
          onPress={handleAskAI}
          className="flex-row items-center gap-1.5 active:opacity-60"
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="AI से पूछें"
        >
          <Sparkles size={14} color={palette.primary} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: palette.primary }}>AI से पूछें</Text>
        </Pressable>
      </View>
    </Pressable>
  );
});

export default function MukadmaHomeScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = THEME[scheme];
  const { width: screenWidth } = useWindowDimensions();
  const chipSize = screenWidth < 360
    ? { paddingHorizontal: 8,  paddingVertical: 4, fontSize: 10, gap: 4 }
    : screenWidth < 400
    ? { paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, gap: 6 }
    : { paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, gap: 8 };
  const chipInactiveBg   = CHIP_INACTIVE_BG[scheme];
  const chipInactiveText = CHIP_INACTIVE_TEXT[scheme];
  const chipBorder       = CHIP_BORDER[scheme];
  const listPaddingBottom = useListBottomPadding();
  const { settings } = useSettingsStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sort, setSort] = useState<SortOption>('newest');
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // hasLoadedRef: true once data has been fetched at least once.
  // needsRefreshRef: set to true by actions that mutate data (delete, add) so
  //   the next focus re-fetch is intentional — all other back-navigations skip
  //   the reload and preserve the FlatList scroll position.
  const hasLoadedRef = useRef(false);
  const needsRefreshRef = useRef(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const all = await getAllFIRs();
      setFirs(all);
    } catch (e) {
      logger.warn('[Mukadma] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (!hasLoadedRef.current || needsRefreshRef.current) {
      hasLoadedRef.current = true;
      needsRefreshRef.current = false;
      load();
    }
  }, [load]));

  // Back → Dashboard: module root screens always return to home, never exit app.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(app)/home' as never);
      return true;
    });
    return () => sub.remove();
  }, []));

  // Search inside accused names and case diary text too (debounced DB lookup).
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!query.trim()) { setLinkedIds(new Set()); return; }
    let alive = true;
    const id = setTimeout(() => {
      searchFirIdsByLinkedText(query).then((ids) => { if (alive) setLinkedIds(ids); }).catch(() => {});
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [query, firs]);

  const filtered = firs
    .filter((f) => {
      const matchStatus = statusFilter === 'All' || f.status === statusFilter;
      // typoTolerance: when on, fall back to fuzzyMatch if exact substring doesn't match
      const exactMatch = matchesQuery(query,
        f.fir_number, f.complainant_name, f.crime_type, crimeTypeLabel(f.crime_type), f.section,
        f.complainant_address, f.complainant_mobile, f.ghatnasthal,
        f.nakal_chick, f.nakal_rapat,
      );
      const matchSearch = exactMatch || (
        settings.typoTolerance &&
        fuzzyMatch(query, [
          f.fir_number, f.complainant_name, f.crime_type, crimeTypeLabel(f.crime_type), f.section ?? '',
          f.complainant_address ?? '', f.complainant_mobile ?? '',
          f.ghatnasthal ?? '', f.nakal_chick ?? '', f.nakal_rapat ?? '',
        ].join(' '))
      );
      // Also FIRs whose accused / case diary text matches (loaded below).
      return matchStatus && (matchSearch || linkedIds.has(f.id));
    })
    .sort((a, b) => {
      if (sort === 'oldest') return a.created_at - b.created_at;
      if (sort === 'fir_number') return a.fir_number.localeCompare(b.fir_number);
      if (sort === 'complainant') return a.complainant_name.localeCompare(b.complainant_name);
      return b.created_at - a.created_at; // newest
    });

  const handleDelete = useCallback(async (id: string) => {
    await deleteFIR(id);
    setDeleteTarget(null);
    // Remove the deleted item in-place so the list doesn't jump to top.
    // No full reload needed — scroll position is preserved.
    setFirs((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // HOOKS RULE FIX: useCallback must be called unconditionally at the top level of
  // the component — never inside JSX props (renderItem={useCallback(...)}) where it
  // sits inside a conditional branch (loading ? ... : <FlatList renderItem={...}>).
  // When `loading` is true that branch is skipped, causing "Rendered more hooks than
  // during the previous render". Hoisted to a stable const here.
  const renderFIRItem = useCallback(({ item }: { item: FIR }) => (
    <FIRCard
      fir={item}
      query={query}
      onDelete={setDeleteTarget}
      highlight={settings.highlightMatches}
      typoTolerant={settings.typoTolerance}
      scheme={scheme}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [query, settings.highlightMatches, settings.typoTolerance, scheme]);

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AppHeader
        title={t('fir.list.title')}
        subtitle={t(filtered.length === 1 ? 'fir.list.caseCount_one' : 'fir.list.caseCount_other', { count: filtered.length })}
        onMenuPress={() => setDrawerOpen(true)}
        actions={
          <HeaderIconBtn
            icon={Plus}
            onPress={() => router.push('/(app)/mukadma/add-fir' as never)}
            label={t('fir.list.addFIR')}
            color="#2563EB"
          />
        }
      />

      {/* Search + filter toolbar */}
      <Animated.View
        className="px-4 pt-3 pb-2 gap-2 bg-background border-b border-border"
        layout={LinearTransition.duration(220)}
      >
        <View className="flex-row flex-wrap items-center" style={{ gap: chipSize.gap }}>
          <SearchBar
            value={query}
            noResults={!loading && !!query.trim() && filtered.length === 0}
            onChangeText={setQuery}
            placeholder={t('fir.list.searchPlaceholder')}
            variant="light"
            accessibilityLabel={t('fir.list.searchAccessibility')}
            collapsible
            containerStyle={{ flexGrow: 1, flexShrink: 1, minWidth: 200 }}
          />
          <View className="flex-row flex-shrink-0" style={{ gap: chipSize.gap }}>
            {STATUS_FILTER_KEYS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setStatusFilter(s)}
                className="rounded-full border active:opacity-70"
                style={{
                  paddingHorizontal: chipSize.paddingHorizontal,
                  paddingVertical: chipSize.paddingVertical,
                  backgroundColor: statusFilter === s ? ACCENT : chipInactiveBg,
                  borderColor:     statusFilter === s ? ACCENT : chipBorder,
                }}
              >
                <Text
                  className="font-semibold"
                  style={{
                    fontSize: chipSize.fontSize,
                    color: statusFilter === s ? '#fff' : chipInactiveText,
                  }}
                >
                  {s === 'All' ? t('fir.list.filterAll') : s === 'Pending' ? t('fir.list.filterPending') : t('fir.list.filterFinished')}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setShowSort(!showSort)}
            className="flex-row items-center rounded-full border active:opacity-70"
            style={{
              gap: chipSize.gap > 4 ? 6 : 4,
              paddingHorizontal: chipSize.paddingHorizontal,
              paddingVertical: chipSize.paddingVertical,
              borderColor: chipBorder,
              backgroundColor: chipInactiveBg,
            }}
          >
            <Filter size={11} color={chipInactiveText} />
            <Text
              className="font-semibold"
              style={{
                fontSize: chipSize.fontSize,
                color: chipInactiveText,
              }}
            >
              {t('fir.list.sortBtn')}
            </Text>
            <ChevronDown size={10} color={chipInactiveText} />
          </Pressable>
        </View>
        {showSort && (
          <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => { setSort(opt.value); setShowSort(false); }}
                className="px-4 py-3 active:bg-secondary"
                style={{ borderBottomWidth: opt.value === SORT_OPTIONS[SORT_OPTIONS.length - 1].value ? 0 : 1, borderBottomColor: palette.border }}
              >
                <Text className="text-sm" style={{ color: sort === opt.value ? ACCENT : palette.cardForeground, fontWeight: sort === opt.value ? '700' : '400' }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Animated.View>

      {/* List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          removeClippedSubviews
          contentContainerStyle={{ paddingBottom: listPaddingBottom }}
          contentContainerClassName="px-6 pt-4"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={
            <View className="items-center justify-center py-16 gap-3">
              <View className="w-14 h-14 rounded-2xl bg-secondary items-center justify-center">
                <FileText size={24} color={palette.mutedForeground} />
              </View>
              <Text className="text-base font-semibold text-foreground">{t('fir.list.noFIRsFound')}</Text>
              <Text className="text-sm text-muted-foreground text-center">
                {query || statusFilter !== 'All' ? t('fir.list.emptySearch') : t('fir.list.emptyDefault')}
              </Text>
            </View>
          }
          renderItem={renderFIRItem}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fir.list.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('fir.list.deleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}>
              <Text>{t('fir.list.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={() => deleteTarget && handleDelete(deleteTarget)}>
              <Text>{t('fir.list.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

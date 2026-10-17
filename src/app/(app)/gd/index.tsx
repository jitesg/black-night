import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import { stripHtmlTags } from '@/lib/stringUtils';
import {
  ActivityIndicator, BackHandler, FlatList, Pressable, ScrollView,
  Share, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import { HighlightText } from '@/components/HighlightText';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import {
  BookMarked, Calendar, ChevronDown,
  Copy, Edit2, Filter, Plus, Share2, Star, Trash2, X,
} from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import {
  getAllGdEntries, searchGdEntries, toggleGdFavorite,
  duplicateGdEntry, deleteGdEntry, type GdEntry,
} from '@/lib/db/gdRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useListBottomPadding } from '@/hooks/useListBottomPadding';
import { THEME } from '@/lib/theme';

// ─── Design Tokens ────────────────────────────────────────────────────────
const ACCENT = '#6366F1';
const GD_COLOR = '#D97706';

const TYPE_COLORS: Record<string, string> = {
  'रवानगी': '#6366F1',
  'वापसी':  '#059669',
  'तस्करा': '#DC2626',
  'अन्य':   '#6B7280',
};

// ─── Chip theme tokens (inactive state — must be readable on bg-background) ──
// Light: #F1F5F9 bg (4.5:1 on #F4F7FE) + #475569 text (7.0:1 on #F1F5F9) ✓
// Dark:  #334155 bg (3.5:1 on #0F172A) + #CBD5E1 text (7.1:1 on #334155)  ✓
const CHIP_INACTIVE_BG   = { light: '#F1F5F9', dark: '#334155' } as const;
const CHIP_INACTIVE_TEXT = { light: '#475569', dark: '#CBD5E1' } as const;
const CHIP_BORDER        = { light: '#CBD5E1', dark: '#475569' } as const;

const GD_TYPE_KEYS: Record<string, string> = {
  'रवानगी': 'departure',
  'वापसी':  'return',
  'तस्करा': 'taskara',
  'अन्य':   'other',
};

const FILTER_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'All',            labelKey: 'common.all' },
  { value: 'रवानगी',        labelKey: 'gd.type.departure' },
  { value: 'वापसी',         labelKey: 'gd.type.return' },
  { value: 'तस्करा',        labelKey: 'gd.type.taskara' },
  { value: 'अन्य',          labelKey: 'gd.type.other' },
  { value: 'Today',          labelKey: 'filters.today' },
  { value: 'This Week',      labelKey: 'filters.thisWeek' },
  { value: 'This Month',     labelKey: 'filters.thisMonth' },
  { value: 'Favorites',      labelKey: 'filters.favorites' },
  { value: 'Recently Added', labelKey: 'filters.recentlyAdded' },
];

const getFilterLabel = (val: string, t: (key: string) => string): string => {
  const item = FILTER_OPTIONS.find((f) => f.value === val);
  return item ? t(item.labelKey) : val;
};

function fmtDate(str: string): string {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── GD Card ──────────────────────────────────────────────────────────────
const GdCard = memo(function GdCard({
  entry, query, highlight, typoTolerant, onPress, onFavorite, onEdit, onDuplicate, onShare, onDelete,
}: {
  entry: GdEntry;
  query: string;
  highlight: boolean;
  typoTolerant?: boolean;
  onPress: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const palette = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const typeColor = TYPE_COLORS[entry.gd_type] ?? '#6B7280';
  const rawPreview = stripHtmlTags(entry.vivran_content);
  const preview = rawPreview.replace(/\s+/g, ' ').trim().slice(0, 100);

  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-2xl p-4 gap-3 active:opacity-75"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Top row */}
      <View className="flex-row items-start gap-3">
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mt-0.5"
          style={{ backgroundColor: `${typeColor}15` }}
        >
          <BookMarked size={17} color={typeColor} />
        </View>
        <View className="flex-1 gap-1" style={{ minWidth: 0 }}>
          <View className="flex-row items-center gap-2">
            <View
              className="self-start rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: `${typeColor}15` }}
            >
              <Text className="text-xs font-semibold" style={{ color: typeColor }}>
                {GD_TYPE_KEYS[entry.gd_type] ? t('gd.type.' + GD_TYPE_KEYS[entry.gd_type]) : entry.gd_type}
              </Text>
            </View>
            {entry.ta_da_flag === 1 && (
              <View className="rounded-full px-2 py-0.5 bg-amber-50 border border-amber-200">
                <Text className="text-xs font-medium text-amber-700">TA/DA</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-1">
            <Calendar size={11} color={palette.mutedForeground} />
            <Text className="text-xs text-muted-foreground">{fmtDate(entry.preparation_date)}</Text>
          </View>
        </View>
        {/* Star: 36×36dp container + hitSlop 4 = 44dp minimum touch target */}
        <Pressable
          onPress={onFavorite}
          className="items-center justify-center active:opacity-60"
          style={{ width: 36, height: 36 }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={entry.is_favorite ? t('gd.card.removeFromFavorites') : t('gd.card.addToFavorites')}
        >
          <Star
            size={18}
            color={entry.is_favorite ? GD_COLOR : palette.mutedForeground}
            fill={entry.is_favorite ? GD_COLOR : 'none'}
          />
        </Pressable>
      </View>

      {/* Vivran preview */}
      {preview.length > 0 && (
        highlight ? (
          <HighlightText
            text={preview + (rawPreview.length > 100 ? '…' : '')}
            query={query}
            style={{ fontSize: 14, lineHeight: 20, color: palette.cardForeground }}
            numberOfLines={2}
            typoTolerant={typoTolerant}
          />
        ) : (
          <Text style={{ fontSize: 14, lineHeight: 20, color: palette.cardForeground }} numberOfLines={2}>
            {preview + (rawPreview.length > 100 ? '…' : '')}
          </Text>
        )
      )}

      {/* Footer */}
      <View className="flex-row items-center justify-between pt-1 border-t border-border/50">
        <Text className="text-xs text-muted-foreground">
          {t('gd.card.modified', { date: fmtTs(entry.updated_at) })}
        </Text>
        {/* Action buttons: 36×36dp + hitSlop 4 = 44dp minimum touch target each */}
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={onEdit}
            className="w-9 h-9 rounded-lg items-center justify-center active:opacity-60"
            style={{ backgroundColor: '#6366F110' }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={t('gd.card.editAccessibility')}
          >
            <Edit2 size={14} color="#6366F1" />
          </Pressable>
          <Pressable
            onPress={onDuplicate}
            className="w-9 h-9 rounded-lg items-center justify-center active:opacity-60"
            style={{ backgroundColor: '#05966910' }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={t('gd.card.duplicateAccessibility')}
          >
            <Copy size={14} color="#059669" />
          </Pressable>
          <Pressable
            onPress={onShare}
            className="w-9 h-9 rounded-lg items-center justify-center active:opacity-60"
            style={{ backgroundColor: '#0891B210' }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={t('gd.card.shareAccessibility')}
          >
            <Share2 size={14} color="#0891B2" />
          </Pressable>
          <Pressable
            onPress={onDelete}
            className="w-9 h-9 rounded-lg items-center justify-center active:opacity-60"
            style={{ backgroundColor: '#DC262610' }}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={t('gd.card.deleteAccessibility')}
          >
            <Trash2 size={14} color={palette.destructive} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function GdScreen() {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const palette = THEME[colorScheme === 'dark' ? 'dark' : 'light'];
  const chipInactiveBg   = CHIP_INACTIVE_BG[colorScheme === 'dark' ? 'dark' : 'light'];
  const chipInactiveText = CHIP_INACTIVE_TEXT[colorScheme === 'dark' ? 'dark' : 'light'];
  const chipBorder       = CHIP_BORDER[colorScheme === 'dark' ? 'dark' : 'light'];
  const listPaddingBottom = useListBottomPadding();
  const { settings } = useSettingsStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [entries, setEntries] = useState<GdEntry[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GdEntry | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async (q = query, filter = activeFilter) => {
    try {
      const results = q.trim() || filter !== 'All'
        ? await searchGdEntries(q, filter, settings.typoTolerance ? { typoTolerance: true } : undefined)
        : await getAllGdEntries();
      setEntries(results);
    } catch (e) {
      logger.warn('[GD] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [settings.typoTolerance]);

  // BUG-C2a FIX: useFocusEffect must NOT depend on query/activeFilter.
  // Previously [loadData, query, activeFilter] caused a new loadData ref on
  // every keystroke, re-registering useFocusEffect and firing a second DB
  // load alongside the debounced handleSearch — double-load per keystroke.
  // Now useFocusEffect depends only on the stable loadData (empty deps),
  // and always reads the current values via function arguments from state.
  const queryRef = useRef(query);
  const activeFilterRef = useRef(activeFilter);
  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => { activeFilterRef.current = activeFilter; }, [activeFilter]);

  const firstLoadRef = useRef(true);
  useFocusEffect(useCallback(() => {
    // Spinner only on the first load; later visits refresh in place so the
    // list isn't torn down (keeps scroll position, no flash).
    if (firstLoadRef.current) { firstLoadRef.current = false; setLoading(true); }
    loadData(queryRef.current, activeFilterRef.current);
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
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (settings.instantSearch) {
      searchTimeout.current = setTimeout(() => loadData(text, activeFilter), 300);
    }
  };

  // Submit-only mode (instantSearch OFF): fires immediately on Enter/Done,
  // bypassing the debounce — same pattern as nyayalay handleSubmitSearch.
  const handleSearchSubmit = useCallback(async () => {
    if (!query.trim()) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    try {
      const results = await searchGdEntries(
        query,
        activeFilter,
        settings.typoTolerance ? { typoTolerance: true } : undefined,
      );
      setEntries(results);
    } catch (e) {
      logger.warn('[GD] Submit search error:', e);
    }
  }, [query, activeFilter, settings.typoTolerance]);

  const handleFilter = (f: string) => {
    setActiveFilter(f);
    setShowFilters(false);
    loadData(query, f);
  };

  const handleFavorite = async (entry: GdEntry) => {
    await toggleGdFavorite(entry.id, entry.is_favorite);
    setEntries((prev) =>
      prev.map((e) => e.id === entry.id ? { ...e, is_favorite: entry.is_favorite ? 0 : 1 } : e)
    );
  };

  const handleDuplicate = async (entry: GdEntry) => {
    await duplicateGdEntry(entry.id);
    loadData(query, activeFilter);
  };

  const handleShare = async (entry: GdEntry) => {
    const text = `GD Type: ${entry.gd_type}\nDate: ${fmtDate(entry.preparation_date)}\n\n${stripHtmlTags(entry.vivran_content)}`;
    try {
      await Share.share({ message: text, title: `GD – ${entry.gd_type}` });
    } catch { /* cancelled */ }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteGdEntry(deleteTarget.id);
    setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  // renderGdItem: hoisted from renderItem prop (Rules of Hooks fix).
  // stripHtmlTags is now applied inside GdCard on vivran_content before slicing
  // for preview text (rawPreview), so the list card always shows clean plain text.
  const renderGdItem = useCallback(({ item }: { item: GdEntry }) => (
    <GdCard
      entry={item}
      query={query}
      highlight={settings.highlightMatches}
      typoTolerant={settings.typoTolerance}
      onPress={() => router.push(`/(app)/gd/${item.id}` as never)}
      onFavorite={() => handleFavorite(item)}
      onEdit={() => router.push(`/(app)/gd/add-gd?editId=${item.id}` as never)}
      onDuplicate={() => handleDuplicate(item)}
      onShare={() => handleShare(item)}
      onDelete={() => setDeleteTarget(item)}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [query, settings.highlightMatches, settings.typoTolerance, handleFavorite, handleDuplicate, handleShare]);

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AppHeader
        title={t('gd.list.title')}
        subtitle={loading ? t('common.loading') : t('gd.list.entryCount', { count: entries.length })}
        onMenuPress={() => setDrawerOpen(true)}
        actions={
          <HeaderIconBtn
            icon={Plus}
            onPress={() => router.push('/(app)/gd/add-gd' as never)}
            label={t('gd.list.addGd')}
            color={GD_COLOR}
          />
        }
      />

      {/* Toolbar */}
      <View className="px-4 pt-3 pb-2 gap-2 bg-background border-b border-border">
        <View className="flex-row gap-2">
          <SearchBar
            value={query}
            onChangeText={handleSearch}
            onSubmitEditing={handleSearchSubmit}
            placeholder={t('gd.list.searchPlaceholder')}
            variant="light"
            returnKeyType="search"
            containerStyle={{ flex: 1 }}
            accessibilityLabel={t('gd.list.searchAccessibility')}
            collapsible
          />
          {/* Filter button: h-12 (48dp) to match SearchBar; solid themed inactive bg */}
          <Pressable
            onPress={() => setShowFilters(!showFilters)}
            className="flex-row items-center gap-1.5 px-3 rounded-xl border active:opacity-70"
            style={{
              height: 48,
              backgroundColor: activeFilter !== 'All' ? `${GD_COLOR}18` : chipInactiveBg,
              borderColor: activeFilter !== 'All' ? GD_COLOR : chipBorder,
            }}
          >
            <Filter size={13} color={activeFilter !== 'All' ? GD_COLOR : chipInactiveText} />
            <Text className="text-xs font-semibold" style={{ color: activeFilter !== 'All' ? GD_COLOR : chipInactiveText }}>
              {activeFilter !== 'All' ? getFilterLabel(activeFilter, t) : t('common.filter')}
            </Text>
          </Pressable>
        </View>
        {showFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {FILTER_OPTIONS.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => handleFilter(f.value)}
                className="mr-2 rounded-full px-3 py-1.5 border active:opacity-70"
                style={{
                  backgroundColor: activeFilter === f.value ? GD_COLOR : chipInactiveBg,
                  borderColor: activeFilter === f.value ? GD_COLOR : chipBorder,
                }}
              >
                <Text className="text-xs font-semibold" style={{ color: activeFilter === f.value ? '#fff' : chipInactiveText }}>
                  {t(f.labelKey)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={GD_COLOR} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          removeClippedSubviews
          contentContainerStyle={{ paddingBottom: listPaddingBottom }}
          contentContainerClassName="px-6 py-4 gap-3"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(); }}
          renderItem={renderGdItem}
          ListEmptyComponent={
            <View className="items-center justify-center py-24 gap-4">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center"
                style={{ backgroundColor: `${GD_COLOR}15` }}
              >
                <BookMarked size={30} color={GD_COLOR} />
              </View>
              <Text className="text-base font-semibold text-foreground">
                {query.trim() || activeFilter !== 'All' ? t('gd.list.noEntriesFound') : t('gd.list.noEntriesYet')}
              </Text>
              <Text className="text-sm text-muted-foreground text-center px-10">
                {query.trim() || activeFilter !== 'All'
                  ? t('gd.list.noEntriesFoundHint')
                  : t('gd.list.noEntriesYetHint')}
              </Text>
            </View>
          }
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('gd.dialog.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('gd.dialog.deleteDesc', {
                type: GD_TYPE_KEYS[deleteTarget?.gd_type ?? ''] ? t('gd.type.' + GD_TYPE_KEYS[deleteTarget?.gd_type ?? '']) : (deleteTarget?.gd_type ?? ''),
                date: deleteTarget ? fmtDate(deleteTarget.preparation_date) : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}>
              <Text>{t('common.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">{t('common.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

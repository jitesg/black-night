import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import { stripHtmlTags } from '@/lib/stringUtils';
import {
  ActivityIndicator, BackHandler, FlatList, Pressable, ScrollView,
  Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import {
  FileWarning, Plus, Filter, ChevronDown,
  Edit2, Trash2, MapPin, Calendar, X,
} from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import { HighlightText } from '@/components/HighlightText';
import {
  getAllNirodhatmakKaryvahi, searchNirodhatmakKaryvahi, deleteNirodhatmakKaryvahi,
  NIRODHATMAK_TYPES,
  type NirodhatmakKaryvahi, type NirodhatmakType,
} from '@/lib/db/nirodhatmakRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useListBottomPadding } from '@/hooks/useListBottomPadding';
import { THEME } from '@/lib/theme';

const MODULE_COLOR = '#DC2626';

// Chip inactive tokens — readable on bg-background in both themes
const CHIP_INACTIVE_BG   = { light: '#F1F5F9', dark: '#334155' } as const;
const CHIP_INACTIVE_TEXT = { light: '#475569', dark: '#CBD5E1' } as const;
const CHIP_BORDER        = { light: '#CBD5E1', dark: '#475569' } as const;

// Status chip tokens — theme-aware (Active = green, Inactive = muted)
const STATUS_BG   = { light: { Active: '#D1FAE5', other: '#F1F5F9' }, dark: { Active: '#052E16', other: '#1E293B' } } as const;
const STATUS_TEXT = { light: { Active: '#15803D', other: '#6B7280' }, dark: { Active: '#6EE7B7', other: '#94A3B8' } } as const;

function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtProceedingDate(str: string | undefined): string {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  if (!y || !m || !d) return str;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

const TYPE_CHIP_COLORS: Record<string, string> = {
  'बीट सूचना':    '#2D52B8',
  'मुकदमा':       '#7C3AED',
  'प्रार्थनापत्र': '#059669',
  'जमीनी विवाद':  '#D97706',
  'अन्य':         '#6B7280',
};

const NIRODHATMAK_TYPE_KEYS: Record<string, string> = {
  'बीट सूचना':    'beatInfo',
  'मुकदमा':       'case',
  'प्रार्थनापत्र': 'petition',
  'जमीनी विवाद':  'landDispute',
  'अन्य':         'other',
};

const NIRODHATMAK_STATUS_KEYS: Record<string, string> = {
  'Active': 'active',
  'Closed': 'closed',
};

// ─── Action Menu ──────────────────────────────────────────────────────────
function ActionMenu({
  item, onEdit, onDelete, onClose, scheme,
}: {
  item: NirodhatmakKaryvahi;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  scheme: 'light' | 'dark';
}) {
  const { t } = useTranslation();
  const palette = THEME[scheme];
  const typeDisplay = item.proceeding_type
    ? (NIRODHATMAK_TYPE_KEYS[item.proceeding_type] ? t('nirodhatmak.type.' + NIRODHATMAK_TYPE_KEYS[item.proceeding_type]) : item.proceeding_type)
    : '';

  return (
    <View
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm shadow-black/5"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
        <View className="flex-1 gap-0.5" style={{ minWidth: 0 }}>
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {item.format_title || t('nirodhatmak.card.defaultTitle')}
          </Text>
          <Text className="text-xs text-muted-foreground">{typeDisplay}</Text>
        </View>
        {/* Close: 36×36dp + hitSlop 4 = 44dp touch target */}
        <Pressable
          onPress={onClose}
          className="w-9 h-9 items-center justify-center active:opacity-70"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={t('nirodhatmak.menu.closeAccessibility')}
        >
          <X size={16} color={palette.mutedForeground} />
        </Pressable>
      </View>
      <Pressable onPress={onEdit} className="flex-row items-center gap-3 px-4 py-3 active:opacity-70 border-b border-border">
        <Edit2 size={16} color={palette.foreground} />
        <Text className="text-sm text-foreground">{t('common.edit')}</Text>
      </Pressable>
      <Pressable onPress={onDelete} className="flex-row items-center gap-3 px-4 py-3 active:opacity-70">
        <Trash2 size={16} color={palette.destructive} />
        <Text className="text-sm text-destructive">{t('common.delete')}</Text>
      </Pressable>
    </View>
  );
}

// ─── Record Card ──────────────────────────────────────────────────────────
const KaryvahiCard = memo(function KaryvahiCard({
  item,
  query,
  scheme,
  onPress,
  onLongPress,
}: {
  item: NirodhatmakKaryvahi;
  query: string;
  scheme: 'light' | 'dark';
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { t } = useTranslation();
  const palette = THEME[scheme];
  const typeColor = TYPE_CHIP_COLORS[item.proceeding_type] ?? '#6B7280';
  const dateStr = item.proceeding_date
    ? fmtProceedingDate(item.proceeding_date)
    : fmtTs(item.created_at);
  const rawDesc = stripHtmlTags(item.editor_content || item.report_text || '');
  const shortDesc = rawDesc.replace(/\s+/g, ' ').trim().slice(0, 100);

  const statusKey = item.status === 'Active' ? 'Active' : 'other';
  const statusBg   = STATUS_BG[scheme][statusKey];
  const statusText = STATUS_TEXT[scheme][statusKey];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="bg-card border border-border rounded-2xl p-4 gap-3 active:opacity-80"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Top row: icon + info + type chip */}
      <View className="flex-row items-start gap-3">
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mt-0.5"
          style={{ backgroundColor: `${typeColor}12` }}
        >
          <FileWarning size={18} color={typeColor} />
        </View>

        <View className="flex-1 gap-0.5" style={{ minWidth: 0 }}>
          {/* Village */}
          {item.village_name ? (
            <View className="flex-row items-center gap-1">
              <MapPin size={11} color={palette.mutedForeground} />
              <HighlightText text={item.village_name} query={query} style={{ fontSize: 14, fontWeight: '600', lineHeight: 20, color: palette.cardForeground }} numberOfLines={1} />
            </View>
          ) : (
            <HighlightText text={item.format_title || t('nirodhatmak.card.defaultTitle')} query={query} style={{ fontSize: 14, fontWeight: '600', lineHeight: 20, color: palette.cardForeground }} numberOfLines={1} />
          )}
          {/* Date + Status */}
          <View className="flex-row items-center gap-2 flex-wrap">
            <View className="flex-row items-center gap-1">
              <Calendar size={10} color={palette.mutedForeground} />
              <Text className="text-xs text-muted-foreground">{dateStr}</Text>
            </View>
            {item.status ? (
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: statusBg }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: statusText }}
                >
                  {NIRODHATMAK_STATUS_KEYS[item.status] ? t('nirodhatmak.status.' + NIRODHATMAK_STATUS_KEYS[item.status]) : item.status}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Type chip */}
        <View
          className="rounded-full px-2.5 py-1 mt-0.5"
          style={{ backgroundColor: `${typeColor}12` }}
        >
          <Text className="text-xs font-semibold" style={{ color: typeColor }} numberOfLines={1}>
            {NIRODHATMAK_TYPE_KEYS[item.proceeding_type] ? t('nirodhatmak.type.' + NIRODHATMAK_TYPE_KEYS[item.proceeding_type]) : (item.proceeding_type || t('nirodhatmak.type.other'))}
          </Text>
        </View>
      </View>

      {/* Short description */}
      {shortDesc.length > 0 && (
        <Text className="text-sm text-muted-foreground leading-5" numberOfLines={2}>
          {shortDesc}{rawDesc.length > 100 ? '…' : ''}
        </Text>
      )}
    </Pressable>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function NirodhatmakHomeScreen() {
  const { colorScheme } = useColorScheme();
  const { t } = useTranslation();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const chipInactiveBg   = CHIP_INACTIVE_BG[scheme];
  const chipInactiveText = CHIP_INACTIVE_TEXT[scheme];
  const chipBorder       = CHIP_BORDER[scheme];
  const listPaddingBottom = useListBottomPadding();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [records, setRecords] = useState<NirodhatmakKaryvahi[]>([]);
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<NirodhatmakType | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NirodhatmakKaryvahi | null>(null);
  const [longPressTarget, setLongPressTarget] = useState<NirodhatmakKaryvahi | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async (q = query, type = activeType) => {
    try {
      const results = q.trim() || type
        ? await searchNirodhatmakKaryvahi(q, type)
        : await getAllNirodhatmakKaryvahi();
      setRecords(results);
    } catch (e) {
      logger.warn('[Nirodhatmak] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // BUG-C2b FIX: useFocusEffect must NOT depend on query/activeType.
  // Same pattern as gd/index.tsx — every keystroke changed query → new
  // loadData ref → useFocusEffect re-registered → double DB load per keystroke.
  const queryRef = useRef(query);
  const activeTypeRef = useRef(activeType);
  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => { activeTypeRef.current = activeType; }, [activeType]);

  const firstLoadRef = useRef(true);
  useFocusEffect(useCallback(() => {
    // Spinner only on the first load; later visits refresh in place so the
    // list isn't torn down (keeps scroll position, no flash).
    if (firstLoadRef.current) { firstLoadRef.current = false; setLoading(true); }
    loadData(queryRef.current, activeTypeRef.current);
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
    searchTimeout.current = setTimeout(() => loadData(text, activeType), 300);
  };

  const handleTypeFilter = (type: NirodhatmakType | null) => {
    setActiveType(type);
    setShowFilters(false);
    loadData(query, type);
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteNirodhatmakKaryvahi(deleteTarget.id);
    setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  }, [deleteTarget]);

  // HOOKS RULE FIX: hoisted from renderItem={useCallback(...)} inside the
  // loading ternary. Calling a hook inside a conditional JSX branch violates
  // Rules of Hooks and causes "Rendered more hooks than during the previous render".
  const renderKaryvahiItem = useCallback(({ item }: { item: NirodhatmakKaryvahi }) => (
    <View>
      <KaryvahiCard
        item={item}
        query={query}
        scheme={scheme}
        onPress={() => {
          setLongPressTarget(null);
          router.push(`/(app)/nirodhatmak/add-proceeding?editId=${item.id}` as never);
        }}
        onLongPress={() => setLongPressTarget(item)}
      />
      {longPressTarget?.id === item.id && (
        <View className="mt-2">
          <ActionMenu
            item={item}
            scheme={scheme}
            onEdit={() => {
              setLongPressTarget(null);
              router.push(`/(app)/nirodhatmak/add-proceeding?editId=${item.id}` as never);
            }}
            onDelete={() => { setLongPressTarget(null); setDeleteTarget(item); }}
            onClose={() => setLongPressTarget(null)}
          />
        </View>
      )}
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [query, longPressTarget, scheme]);

  return (
    <View className="flex-1 bg-background">
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AppHeader
        title={t('nirodhatmak.list.title')}
        subtitle={loading ? t('common.loading') : t('nirodhatmak.list.proceedingCount', { count: records.length })}
        onMenuPress={() => setDrawerOpen(true)}
        actions={
          <HeaderIconBtn
            icon={Plus}
            onPress={() => router.push('/(app)/nirodhatmak/add-proceeding' as never)}
            label={t('nirodhatmak.list.addProceeding')}
            color={MODULE_COLOR}
          />
        }
      />

      {/* Toolbar */}
      <View className="px-4 pt-3 pb-2 gap-2 bg-background border-b border-border">
        <View className="flex-row gap-2">
          <SearchBar
            value={query}
            onChangeText={handleSearch}
            placeholder={t('nirodhatmak.list.searchPlaceholder')}
            variant="light"
            containerStyle={{ flex: 1 }}
            accessibilityLabel={t('nirodhatmak.list.searchAccessibility')}
            collapsible
          />
          {/* Filter button: h-12 (48dp) to match SearchBar; solid themed inactive bg */}
          <Pressable
            onPress={() => setShowFilters(!showFilters)}
            className="flex-row items-center gap-1.5 px-3 rounded-xl border active:opacity-70"
            style={{
              height: 48,
              backgroundColor: activeType ? `${MODULE_COLOR}18` : chipInactiveBg,
              borderColor: activeType ? MODULE_COLOR : chipBorder,
            }}
          >
            <Filter size={13} color={activeType ? MODULE_COLOR : chipInactiveText} />
            <Text className="text-xs font-semibold" style={{ color: activeType ? MODULE_COLOR : chipInactiveText }}>
              {activeType ? (NIRODHATMAK_TYPE_KEYS[activeType] ? t('nirodhatmak.type.' + NIRODHATMAK_TYPE_KEYS[activeType]) : activeType) : t('common.filter')}
            </Text>
          </Pressable>
        </View>
        {showFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Pressable
              key="all"
              onPress={() => handleTypeFilter(null)}
              className="mr-2 rounded-full px-3 py-1.5 border active:opacity-70"
              style={{
                backgroundColor: activeType === null ? MODULE_COLOR : chipInactiveBg,
                borderColor:     activeType === null ? MODULE_COLOR : chipBorder,
              }}
            >
              <Text className="text-xs font-semibold" style={{ color: activeType === null ? '#fff' : chipInactiveText }}>{t('common.all')}</Text>
            </Pressable>
            {NIRODHATMAK_TYPES.map((tVal) => (
              <Pressable
                key={tVal}
                onPress={() => handleTypeFilter(tVal)}
                className="mr-2 rounded-full px-3 py-1.5 border active:opacity-70"
                style={{
                  backgroundColor: activeType === tVal ? MODULE_COLOR : chipInactiveBg,
                  borderColor:     activeType === tVal ? MODULE_COLOR : chipBorder,
                }}
              >
                <Text className="text-xs font-semibold" style={{ color: activeType === tVal ? '#fff' : chipInactiveText }}>
                  {NIRODHATMAK_TYPE_KEYS[tVal] ? t('nirodhatmak.type.' + NIRODHATMAK_TYPE_KEYS[tVal]) : tVal}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── List ───────────────────────────────────────────────── */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={MODULE_COLOR} />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: listPaddingBottom }}
          contentContainerClassName="px-6 py-4 gap-3"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(query, activeType); }}
          renderItem={renderKaryvahiItem}
          ListEmptyComponent={
            <View className="items-center justify-center py-24 gap-4">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center"
                style={{ backgroundColor: `${MODULE_COLOR}12` }}
              >
                <FileWarning size={30} color={MODULE_COLOR} />
              </View>
              <Text className="text-base font-semibold text-foreground">
                {query.trim() || activeType
                  ? t('nirodhatmak.list.noProceedingsFound')
                  : t('nirodhatmak.list.noProceedingsYet')}
              </Text>
              <Text className="text-sm text-muted-foreground text-center px-10">
                {query.trim() || activeType
                  ? t('nirodhatmak.list.noProceedingsFoundHint')
                  : t('nirodhatmak.list.noProceedingsYetHint')}
              </Text>
            </View>
          }
        />
      )}



      {/* ── Delete Confirmation ─────────────────────────────────── */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('nirodhatmak.dialog.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('nirodhatmak.dialog.deleteDesc')}
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

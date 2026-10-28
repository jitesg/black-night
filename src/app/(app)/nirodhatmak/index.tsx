import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, BackHandler, FlatList, Platform, Pressable, ScrollView,
  Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { AppDrawer } from '@/components/common/AppDrawer';
import {
  FileWarning, Plus, Filter, ChevronDown,
  Edit2, Trash2, MapPin, Calendar, X, FileDown, Check, Clock,
} from 'lucide-react-native';
import { exportKaryvahiDocx } from '@/lib/nirodhatmak/karyvahiDocx';
import { SearchBar } from '@/components/SearchBar';
import { HighlightText } from '@/components/HighlightText';
import {
  getAllNirodhatmakKaryvahi, searchNirodhatmakKaryvahi, deleteNirodhatmakKaryvahi,
  NIRODHATMAK_TYPES,
  type NirodhatmakKaryvahi, type NirodhatmakType,
  KARYVAHI_CHECKLIST, parseKaryvahiChecklist, setKaryvahiChecklist, type KaryvahiChecklist,
} from '@/lib/db/nirodhatmakRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useListBottomPadding } from '@/hooks/useListBottomPadding';
import { THEME } from '@/lib/theme';
import { extractKaryvahiFacts } from '@/lib/nirodhatmak/extractKaryvahi';

const MODULE_COLOR = '#DC2626';

// Chip inactive tokens — readable on bg-background in both themes
const CHIP_INACTIVE_BG   = { light: '#F1F5F9', dark: '#334155' } as const;
const CHIP_INACTIVE_TEXT = { light: '#475569', dark: '#CBD5E1' } as const;
const CHIP_BORDER        = { light: '#CBD5E1', dark: '#475569' } as const;




const NIRODHATMAK_TYPE_KEYS: Record<string, string> = {
  'बीट सूचना':    'beatInfo',
  'मुकदमा':       'case',
  'प्रार्थनापत्र': 'petition',
  'जमीनी विवाद':  'landDispute',
  'अन्य':         'other',
};

// ─── Action Menu ──────────────────────────────────────────────────────────
function ActionMenu({
  item, onEdit, onExport, onDelete, onClose, scheme,
}: {
  item: NirodhatmakKaryvahi;
  onEdit: () => void;
  onExport: () => void;
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
      <Pressable onPress={onExport} className="flex-row items-center gap-3 px-4 py-3 active:opacity-70 border-b border-border">
        <FileDown size={16} color={palette.foreground} />
        <Text className="text-sm text-foreground">Word (.docx) में export करें</Text>
      </Pressable>
      <Pressable onPress={onDelete} className="flex-row items-center gap-3 px-4 py-3 active:opacity-70">
        <Trash2 size={16} color={palette.destructive} />
        <Text className="text-sm text-destructive">{t('common.delete')}</Text>
      </Pressable>
    </View>
  );
}

// ─── Record Card ──────────────────────────────────────────────────────────
// Village headline (pin + "गाँव का नाम" label), dispute line in a serif Hindi face
// with an opening quote, then a footer: date (left) and the section badge (right).
// Village / dispute / sections are read from the editor text (fallbacks: saved fields).
const CARD_COLORS = {
  dark: {
    bg: '#111827', border: '#1E293B', pinBg: '#7F1D1D', pin: '#FCA5A5', muted: '#94A3B8',
    village: '#4ADE80', type: '#FBBF24', dispute: '#F87171', divider: 'rgba(31,41,55,0.5)', badgeBg: '#1E3A8A', badgeFg: '#DBEAFE',
  },
  light: {
    bg: '#FFFFFF', border: '#E5E7EB', pinBg: '#FEE2E2', pin: '#B91C1C', muted: '#64748B',
    village: '#15803D', type: '#B45309', dispute: '#DC2626', divider: '#E5E7EB', badgeBg: '#1E3A8A', badgeFg: '#FFFFFF',
  },
} as const;
// "Kokila" is not on phones; Android's serif face carries Noto Serif Devanagari.
const SERIF_HINDI = Platform.select({ android: 'serif', ios: 'Kohinoor Devanagari', default: 'Kokila, "Noto Serif Devanagari", serif' });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function cardDate(item: NirodhatmakKaryvahi): string {
  const raw = item.proceeding_date ?? '';
  let d: Date | null = null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (m) d = new Date(+m[1], +m[2] - 1, +m[3]);
  else if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(raw))) d = new Date(+m[3], +m[2] - 1, +m[1]);
  else if (item.created_at) d = new Date(item.created_at < 10000000000 ? item.created_at * 1000 : item.created_at);
  if (!d || isNaN(d.getTime())) return raw;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

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
  const c = CARD_COLORS[scheme];
  const isDark = scheme === 'dark';
  const dateStr = cardDate(item);
  const facts = useMemo(
    () => extractKaryvahiFacts(item.editor_content || item.report_text || ''),
    [item.editor_content, item.report_text],
  );
  const rawVillage = (facts.village || item.village_name || '').trim();
  // Shown as "ग्राम <नाम>" (the text extractor drops the word ग्राम).
  const village = rawVillage && !/^ग्राम/.test(rawVillage) ? `ग्राम ${rawVillage}` : rawVillage;
  // Dispute: the format's "विवाद का कारण" (Matter) value when it was saved; else read from the text.
  const dispute = useMemo(() => {
    try {
      const v = JSON.parse(item.values_json || '{}') as Record<string, unknown>;
      const key = Object.keys(v).find((k) => /^matter$|vivad|dispute|विवाद/i.test(k) && String(v[k] ?? '').trim());
      if (key) return String(v[key]).trim();
    } catch { /* old rows */ }
    return facts.dispute;
  }, [item.values_json, facts.dispute]);
  const typeLabel = NIRODHATMAK_TYPE_KEYS[item.proceeding_type]
    ? t('nirodhatmak.type.' + NIRODHATMAK_TYPE_KEYS[item.proceeding_type])
    : (item.proceeding_type || t('nirodhatmak.type.other'));
  const sections = facts.sections.length ? facts.sections : [typeLabel];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="active:opacity-80"
      style={{
        borderCurve: 'continuous', borderRadius: 16, padding: 20, backgroundColor: c.bg,
        borderWidth: 1, borderColor: c.border,
        shadowColor: '#000', shadowOpacity: isDark ? 0.35 : 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}
      accessibilityRole="button"
      accessibilityLabel={[village, typeLabel, dispute, dateStr, sections.join(', ')].filter(Boolean).join(', ')}
    >
      {/* 1. Village: pin circle aligned with the label's top edge */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, marginTop: 1, backgroundColor: c.pinBg, alignItems: 'center', justifyContent: 'center' }}>
          <MapPin size={11} color={c.pin} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ fontSize: 11, lineHeight: 14, color: c.muted, letterSpacing: 0.2 }}>गाँव का नाम</Text>
          {village ? (
            <HighlightText
              text={village}
              query={query}
              style={{ fontSize: 16, lineHeight: 24, fontWeight: '700', color: c.village }}
              numberOfLines={2}
            />
          ) : (
            <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '700', color: c.muted }} numberOfLines={1}>
              {t('nirodhatmak.card.defaultTitle')}
            </Text>
          )}
          {/* कार्यवाही का प्रकार (e.g. बीट सूचना) */}
          <Text textBreakStrategy="simple" numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 18, fontWeight: '600', color: c.type }}>
            {typeLabel}
          </Text>
        </View>
      </View>

      {/* 2. Dispute — serif Hindi, coral, opening quote */}
      {dispute ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, paddingLeft: 32 }}>
          <Text style={{ fontFamily: SERIF_HINDI, fontSize: 20, lineHeight: 22, color: c.dispute, fontWeight: '700' }}>“</Text>
          <Text textBreakStrategy="simple" style={{ flex: 1, fontFamily: SERIF_HINDI, fontSize: 14, lineHeight: 21, color: c.dispute }}>
            {dispute}
          </Text>
        </View>
      ) : null}

      {/* 3. Checklist: चलानी प्रेषित → नोटिस प्राप्त → तामील */}
      <KaryvahiChecklistRows itemId={item.id} json={item.checklist_json} scheme={scheme} />

      {/* 4. Footer: date + section badge */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.divider,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Calendar size={13} color={c.muted} />
          <Text style={{ fontSize: 12.5, color: c.muted }}>{dateStr}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <View style={{ backgroundColor: c.badgeBg, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 10, flexShrink: 1 }}>
            <Text textBreakStrategy="simple" numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: c.badgeFg }}>{sections[0]}</Text>
          </View>
          {sections.length > 1 ? (
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: c.muted }}>+{sections.length - 1}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

// ─── Checklist rows on the card ───────────────────────────────────────────
function KaryvahiChecklistRows({ itemId, json, scheme }: { itemId: string; json?: string; scheme: 'light' | 'dark' }) {
  const [ticks, setTicks] = useState<KaryvahiChecklist>(() => parseKaryvahiChecklist(json));
  useEffect(() => { setTicks(parseKaryvahiChecklist(json)); }, [json]);
  const c = CARD_COLORS[scheme];
  const green = scheme === 'dark' ? '#4ADE80' : '#15803D';

  const toggle = (key: keyof KaryvahiChecklist) => {
    const next = { ...ticks, [key]: !ticks[key] };
    setTicks(next);
    setKaryvahiChecklist(itemId, next).catch(() => setTicks(ticks));
  };

  const amber = scheme === 'dark' ? '#FBBF24' : '#B45309';
  return (
    <View style={{ marginTop: 14, gap: 2 }}>
      {!ticks.prashit ? (
        // Pending until "चलानी प्रेषित की जा चुकी है" is ticked (also in सूचनाएँ + daily 9 AM alert).
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4,
          paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: `${amber}1F`, borderWidth: 1, borderColor: `${amber}55` }}>
          <Clock size={12} color={amber} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: amber }}>चलानी प्रेषण लंबित</Text>
        </View>
      ) : null}
      {KARYVAHI_CHECKLIST.map((row) => {
        const on = !!ticks[row.key];
        return (
          <Pressable
            key={row.key}
            onPress={() => toggle(row.key)}
            hitSlop={4}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={row.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
          >
            <View style={{
              width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
              borderColor: on ? green : c.muted, backgroundColor: on ? green : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {on ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <Text style={{ flex: 1, fontSize: 13.5, color: on ? green : c.muted, fontWeight: on ? '600' : '400' }}>
              {row.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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
            onExport={() => { setLongPressTarget(null); exportKaryvahiDocx(item); }}
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
            noResults={!loading && !!query.trim() && records.length === 0}
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
              className="mr-2 rounded-full border active:opacity-70 px-3 py-1.5"
              style={{
                backgroundColor: activeType === null ? MODULE_COLOR : chipInactiveBg,
                borderColor:     activeType === null ? MODULE_COLOR : chipBorder,
              }}
            >
              <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: activeType === null ? '#fff' : chipInactiveText }}>{t('common.all')}</Text>
            </Pressable>
            {NIRODHATMAK_TYPES.map((tVal) => (
              <Pressable
                key={tVal}
                onPress={() => handleTypeFilter(tVal)}
                className="mr-2 rounded-full border active:opacity-70 px-3 py-1.5"
                style={{
                  backgroundColor: activeType === tVal ? MODULE_COLOR : chipInactiveBg,
                  borderColor:     activeType === tVal ? MODULE_COLOR : chipBorder,
                }}
              >
                <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: activeType === tVal ? '#fff' : chipInactiveText }}>
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

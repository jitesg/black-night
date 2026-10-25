import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, Text, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ClipboardList, Edit2, Plus, Shield, Trash2, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { SearchBar } from '@/components/SearchBar';
import { HighlightText } from '@/components/HighlightText';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import {
  getAllChecklistItems, deleteChecklistItemM2M,
  type ChecklistItemM2M,
} from '@/lib/db/checklistRepo';
import { SourceBadge } from '@/components/common/SourceBadge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { matchesQuery } from '@/lib/searchUtils';

const COLOR = '#0891B2';

const SOURCE_FILTERS = ['All', 'System', 'User'] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number];

// ─── Item card ─────────────────────────────────────────────────────────────────
function ItemCard({
  item, query, onEdit, onDelete,
}: {
  item: ChecklistItemM2M;
  query: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const isSystem = item.source === 'system';
  // Group pairs by crime_type for compact display
  const grouped = item.pairs.reduce<Record<string, string[]>>((acc, p) => {
    if (!acc[p.crimeType]) acc[p.crimeType] = [];
    if (p.subType) acc[p.crimeType].push(p.subType);
    return acc;
  }, {});
  const crimeTypes = Object.keys(grouped);

  return (
    <View
      className="bg-card border border-border rounded-2xl p-4 gap-3"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="w-9 h-9 rounded-xl items-center justify-center mt-0.5"
          style={{ backgroundColor: `${COLOR}15` }}
        >
          <ClipboardList size={16} color={COLOR} />
        </View>
        <View className="flex-1" style={{ minWidth: 0 }}>
          <HighlightText text={item.task_name} query={query} style={{ fontSize: 14, fontWeight: '600', lineHeight: 20 }} numberOfLines={2} />
          {item.brief_description ? (
            <Text className="text-xs text-muted-foreground leading-4 mt-0.5" numberOfLines={2}>
              {item.brief_description}
            </Text>
          ) : null}
        </View>
        {!isSystem && (
          <View className="flex-row gap-1">
            <Pressable
              onPress={onEdit}
              className="w-7 h-7 rounded-lg items-center justify-center active:opacity-60"
              style={{ backgroundColor: `${C.primary}15` }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Edit2 size={13} color={C.primary} />
            </Pressable>
            <Pressable
              onPress={onDelete}
              className="w-7 h-7 rounded-lg items-center justify-center active:opacity-60"
              style={{ backgroundColor: `${C.destructive}15` }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Trash2 size={13} color={C.destructive} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Linked sub-type chips grouped by crime type */}
      {crimeTypes.length > 0 && (
        <View className="gap-1.5">
          {crimeTypes.map((ct) => (
            <View key={ct} className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-xs font-semibold text-muted-foreground">{ct}:</Text>
              {grouped[ct].length > 0 ? (
                grouped[ct].map((sub) => (
                  <View
                    key={sub}
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: `${COLOR}15` }}
                  >
                    <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: COLOR }}>{sub}</Text>
                  </View>
                ))
              ) : (
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${COLOR}10` }}
                >
                  <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{t('knowledge.checklist.anySubType')}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <View className="flex-row items-center justify-between border-t border-border/50 pt-2">
        <SourceBadge source={item.source ?? 'user'} size="xs" />
        <Text className="text-xs text-muted-foreground">
          {new Date(item.updated_at * 1000).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function ChecklistsIndexScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const [allItems, setAllItems]         = useState<ChecklistItemM2M[]>([]);
  const [filtered, setFiltered]         = useState<ChecklistItemM2M[]>([]);
  const [loading, setLoading]           = useState(true);
  const [query, setQuery]               = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All');
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItemM2M | null>(null);

  const applyFilters = (data: ChecklistItemM2M[], q: string, sf: SourceFilter) => {
    let result = data;
    if (sf === 'System') result = result.filter((i) => i.source === 'system');
    else if (sf === 'User') result = result.filter((i) => i.source !== 'system');
    if (q.trim()) {
      result = result.filter((i) => matchesQuery(q, i.task_name, i.brief_description,
        i.pairs.map((p) => `${p.crimeType} ${p.subType}`).join(' ')));
    }
    return result;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getAllChecklistItems();
      setAllItems(items);
      setFiltered(applyFilters(items, query, sourceFilter));
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFiltered(applyFilters(allItems, text, sourceFilter));
    }, 300);
  };

  const handleSourceFilter = (sf: SourceFilter) => {
    setSourceFilter(sf);
    setFiltered(applyFilters(allItems, query, sf));
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteChecklistItemM2M(deleteTarget.id);
    const next = allItems.filter((i) => i.id !== deleteTarget.id);
    setAllItems(next);
    setFiltered(applyFilters(next, query, sourceFilter));
    setDeleteTarget(null);
  };

  const renderItem = useCallback(
    ({ item }: { item: ChecklistItemM2M }) => (
      <ItemCard
        item={item}
        query={query}
        onEdit={() => router.push(`/(app)/knowledge/checklists/add-checklist?editId=${item.id}` as never)}
        onDelete={() => setDeleteTarget(item)}
      />
    ),
    [query, router]
  );

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('knowledge.checklist.listTitle')}
        subtitle={t('knowledge.checklist.listSubtitle')}
        showBack
        actions={
          <HeaderIconBtn
            icon={Plus}
            onPress={() => router.push('/(app)/knowledge/checklists/add-checklist' as never)}
            label={t('knowledge.checklist.addItem')}
            color={C.primary}
          />
        }
      />

      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        <SearchBar
          value={query}
          onChangeText={handleSearch}
          placeholder={t('knowledge.checklist.searchPlaceholder')}
          variant="navy"
          accessibilityLabel={t('knowledge.checklist.searchAccessibility')}
          collapsible
        />
        <View className="flex-row gap-1.5">
          {SOURCE_FILTERS.map((sf) => (
            <Pressable
              key={sf}
              onPress={() => handleSourceFilter(sf)}
              className="flex-row items-center gap-1 rounded-full active:opacity-70 px-2.5 py-1"
              style={{
                backgroundColor: sourceFilter === sf ? COLOR : `${COLOR}15`,
                borderCurve: 'continuous',
              }}
            >
              {sf !== 'All' && (sf === 'System'
                ? <Shield size={11} color={sourceFilter === sf ? '#fff' : COLOR} />
                : <User size={11} color={sourceFilter === sf ? '#fff' : COLOR} />)}
              <Text textBreakStrategy="simple" className="text-xs font-semibold" style={{ color: sourceFilter === sf ? '#fff' : COLOR }}>
                {sf === 'System' ? t('knowledge.checklist.filterSystem') : sf === 'User' ? t('knowledge.checklist.filterUser') : t('knowledge.checklist.filterAll')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLOR} />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View
            className="w-16 h-16 rounded-2xl items-center justify-center"
            style={{ backgroundColor: `${COLOR}15` }}
          >
            <ClipboardList size={30} color={COLOR} />
          </View>
          <Text className="text-base font-semibold text-foreground text-center">
            {query.trim() ? t('knowledge.checklist.noItemsFound') : t('knowledge.checklist.noItemsYet')}
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            {query.trim()
              ? t('knowledge.checklist.tryKeywords')
              : t('knowledge.checklist.tapToCreate')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48, gap: 12 }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
        />
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('knowledge.checklist.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('knowledge.checklist.deleteDesc', { name: deleteTarget?.task_name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}>
              <Text>{t('knowledge.checklist.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">{t('knowledge.checklist.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

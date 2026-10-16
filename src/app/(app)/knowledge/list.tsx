import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { stripHtmlTags } from '@/lib/stringUtils';
import {
  ActivityIndicator, FlatList, Pressable,
  ScrollView, Share, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Edit2, Filter, Plus, Trash2, Copy,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { SearchBar } from '@/components/SearchBar';
import { HighlightText } from '@/components/HighlightText';
import {
  searchKnowledge, deleteKnowledgeEntry, duplicateKnowledgeAsUser, type KnowledgeEntry,
} from '@/lib/db/knowledgeRepo';
import { KNOWLEDGE_CATEGORY_MAP, getCategoryLabel } from '@/lib/knowledgeConstants';
import { SourceBadge } from '@/components/common/SourceBadge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

// Source filter options
const SOURCE_FILTERS = ['All', 'System', 'User'] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number];

function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Record Card ──────────────────────────────────────────────────────────
function RecordCard({
  item, color, query, highlight, typoTolerant, onPress, onEdit, onDelete, onDuplicateAsUser,
}: {
  item: KnowledgeEntry;
  color: string;
  query: string;
  highlight: boolean;
  typoTolerant?: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicateAsUser: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isSystem = item.source === 'system';
  const attachCount = (() => {
    try { return (JSON.parse(item.attachment_uris) as unknown[]).length; } catch { return 0; }
  })();
  const tagList = item.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-2xl p-4 gap-3 active:opacity-75"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Title row */}
      <View className="flex-row items-start gap-3">
        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text className="text-sm font-semibold text-foreground leading-5" numberOfLines={2}>
            {highlight
              ? <HighlightText text={item.title} query={query} style={{ fontSize: 14, fontWeight: '600', lineHeight: 20 }} numberOfLines={2} typoTolerant={typoTolerant} />
              : item.title
            }
          </Text>
          <View className="flex-row items-center gap-1.5 mt-1.5 flex-wrap">
            {item.subcategory ? (
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: `${color}15` }}
              >
                <Text className="text-xs font-medium" style={{ color }}>
                  {item.subcategory}
                </Text>
              </View>
            ) : null}
            <SourceBadge source={item.source} size="xs" />
          </View>
        </View>
        <View className="flex-row gap-1 mt-0.5">
          {isSystem ? (
            <Pressable
              onPress={onDuplicateAsUser}
              className="flex-row items-center gap-1 px-2 py-1 rounded-lg active:opacity-60"
              style={{ backgroundColor: `${C.primary}15` }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Copy size={11} color={C.primary} />
              <Text className="text-[10px] font-semibold" style={{ color: C.primary }}>{t('knowledge.list.duplicateEdit')}</Text>
            </Pressable>
          ) : (
            <>
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
            </>
          )}
        </View>
      </View>

      {/* Description */}
      {item.description ? (
        highlight
          ? <HighlightText text={stripHtmlTags(item.description)} query={query} style={{ fontSize: 12, lineHeight: 16, color: 'inherit' }} numberOfLines={2} typoTolerant={typoTolerant} />
          : <Text style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={2}>{stripHtmlTags(item.description)}</Text>
      ) : null}

      {/* Tags */}
      {tagList.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {tagList.map((tag, idx) => (
            <View key={`${idx}-${tag}`} className="bg-secondary rounded-full px-2.5 py-0.5">
              <Text className="text-xs text-muted-foreground">{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View className="flex-row items-center justify-between pt-1 border-t border-border/50">
        <Text className="text-xs text-muted-foreground">Updated {fmtTs(item.updated_at)}</Text>
        {attachCount > 0 && (
          <Text className="text-xs text-muted-foreground">{attachCount} file{attachCount !== 1 ? 's' : ''}</Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── List Screen ──────────────────────────────────────────────────────────
export default function KnowledgeListScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const { settings } = useSettingsStore();
  const { category } = useLocalSearchParams<{ category: string }>();
  const cat = KNOWLEDGE_CATEGORY_MAP[category ?? ''];
  const color = cat?.color ?? '#0F766E';
  const subcategories = cat?.subcategories ?? [];

  const [allEntries, setAllEntries] = useState<KnowledgeEntry[]>([]);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [query, setQuery] = useState('');
  const [activeSubcat, setActiveSubcat] = useState('All');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All');
  const [showFilter, setShowFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable refs so the stable loadData closure can always read the latest values
  // without closing over volatile state (which would change the ref on every
  // keystroke and re-fire useFocusEffect — the scroll-reset bug).
  const queryRef = useRef(query);
  const activeSubcatRef = useRef(activeSubcat);
  const sourceFilterRef = useRef(sourceFilter);
  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => { activeSubcatRef.current = activeSubcat; }, [activeSubcat]);
  useEffect(() => { sourceFilterRef.current = sourceFilter; }, [sourceFilter]);

  // hasLoadedRef: skip the useFocusEffect reload on back-navigation so the
  // FlatList keeps its scroll position. needsRefreshRef: set to true by
  // mutating actions (delete, duplicate) so the next focus does reload.
  const hasLoadedRef = useRef(false);
  const needsRefreshRef = useRef(false);

  const applySourceFilter = (data: KnowledgeEntry[], sf: SourceFilter) => {
    if (sf === 'System') return data.filter((e) => e.source === 'system');
    if (sf === 'User') return data.filter((e) => e.source !== 'system');
    return data;
  };

  // Stable loadData: reads current values from refs, no volatile deps.
  const loadData = useCallback(
    async (q?: string, sub?: string, sf?: SourceFilter, showSpinner = true) => {
      if (!category) return;
      const resolvedQ = q ?? queryRef.current;
      const resolvedSub = sub ?? activeSubcatRef.current;
      const resolvedSf = sf ?? sourceFilterRef.current;
      if (showSpinner) setLoading(true);
      try {
        const res = await searchKnowledge(
          category,
          resolvedQ,
          resolvedSub === 'All' ? undefined : resolvedSub,
          undefined,
          settings.typoTolerance ? { typoTolerance: true } : undefined,
        );
        setAllEntries(res);
        setEntries(applySourceFilter(res, resolvedSf));
      } catch (e) {
        logger.warn('[KnowledgeList] load error:', e);
      } finally {
        setLoading(false);
      }
    },
    [category, settings.typoTolerance]
  );

  // Only reload on the very first focus or after a mutation — never on plain
  // back-navigation. This preserves the FlatList scroll offset.
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current || needsRefreshRef.current) {
        hasLoadedRef.current = true;
        needsRefreshRef.current = false;
        loadData();
      }
    }, [loadData])
  );

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!settings.instantSearch) return; // submit-only: search fires on Enter
    searchTimeout.current = setTimeout(() => loadData(text), 300);
  };

  const handleSearchSubmit = useCallback(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    loadData(query);
  }, [query, loadData]);

  const handleSubcat = (sub: string) => {
    setActiveSubcat(sub);
    setShowFilter(false);
    loadData(undefined, sub);
  };

  const handleSourceFilter = (sf: SourceFilter) => {
    setSourceFilter(sf);
    setEntries(applySourceFilter(allEntries, sf));
  };

  const handleDuplicateAsUser = async (item: KnowledgeEntry) => {
    await duplicateKnowledgeAsUser(item.id);
    needsRefreshRef.current = true;
    loadData();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteKnowledgeEntry(deleteTarget.id);
    // Remove in-place — no full reload; scroll position is preserved.
    setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    setAllEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={cat ? getCategoryLabel(cat.id, t) : category ?? t('knowledge.title')}
        showBack
        actions={
          <HeaderIconBtn icon={Plus} onPress={() => router.push(`/(app)/knowledge/add-knowledge?category=${encodeURIComponent(category ?? '')}` as never)} label={t('knowledge.list.addArticle')} color={color} />
        }
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {/* Search + Filter */}
        <View className="flex-row gap-2">
          <SearchBar
            value={query}
            onChangeText={handleSearch}
            onSubmitEditing={handleSearchSubmit}
            placeholder={t('knowledge.list.searchPlaceholder')}
            variant="light"
            returnKeyType="search"
            containerStyle={{ flex: 1 }}
            accessibilityLabel={t('knowledge.list.searchAccessibility')}
            collapsible
          />
          <Pressable
            onPress={() => setShowFilter(!showFilter)}
            className="flex-row items-center gap-1.5 px-3 rounded-xl bg-secondary active:opacity-70"
            style={{ borderCurve: 'continuous' }}
          >
            <Filter size={14} color={activeSubcat !== 'All' ? color : C.mutedForeground} />
            <Text
              className="text-xs font-medium"
              style={{ color: activeSubcat !== 'All' ? color : C.mutedForeground }}
              numberOfLines={1}
            >
              {activeSubcat !== 'All' ? activeSubcat : t('knowledge.list.filterBtn')}
            </Text>
          </Pressable>
        </View>

        {/* Subcategory chips */}
        {showFilter && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
            {['All', ...subcategories].map((sub) => (
              <Pressable
                key={sub}
                onPress={() => handleSubcat(sub)}
                className="mx-1 rounded-full px-3 py-1.5 active:opacity-70"
                style={{ backgroundColor: activeSubcat === sub ? color : C.muted }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: activeSubcat === sub ? '#fff' : C.foreground }}
                >
                  {sub === 'All' ? t('knowledge.list.filterAll') : sub}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Source filter tabs: All / System / User */}
        <View className="flex-row gap-1.5">
          {SOURCE_FILTERS.map((sf) => (
            <Pressable
              key={sf}
              onPress={() => handleSourceFilter(sf)}
              className="rounded-full px-3 py-1 active:opacity-70"
              style={{
                backgroundColor: sourceFilter === sf ? color : `${color}15`,
                borderCurve: 'continuous',
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: sourceFilter === sf ? '#fff' : color }}
              >
                {sf === 'System' ? t('knowledge.list.filterSystem') : sf === 'User' ? t('knowledge.list.filterUser') : t('knowledge.list.filterAll')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>



      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={color} />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={true}
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-6 py-4 gap-3 pb-10"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={false}
          onRefresh={() => loadData()}
          renderItem={({ item }) => (
            <RecordCard
              item={item}
              color={color}
              query={query}
              highlight={settings.highlightMatches}
              typoTolerant={settings.typoTolerance}
              onPress={() => router.push(`/(app)/knowledge/${item.id}` as never)}
              onEdit={() =>
                router.push(
                  `/(app)/knowledge/add-knowledge?editId=${item.id}&category=${encodeURIComponent(category ?? '')}` as never
                )
              }
              onDelete={() => setDeleteTarget(item)}
              onDuplicateAsUser={() => handleDuplicateAsUser(item)}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-24 gap-4">
              {cat && (
                <View
                  className="w-16 h-16 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <cat.icon size={30} color={color} />
                </View>
              )}
              <Text className="text-base font-semibold text-foreground">
                {query.trim() || activeSubcat !== 'All' ? t('knowledge.list.noRecordsFound') : t('knowledge.list.noRecordsYet')}
              </Text>
              <Text className="text-sm text-muted-foreground text-center px-10">
                {query.trim() || activeSubcat !== 'All'
                  ? t('knowledge.list.tryAdjust')
                  : t('knowledge.list.tapAdd')}
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
            <AlertDialogTitle>{t('knowledge.list.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('knowledge.list.deleteDesc', { title: deleteTarget?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}>
              <Text>{t('knowledge.list.cancel')}</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleDeleteConfirm} className="bg-destructive">
              <Text className="text-destructive-foreground font-semibold">{t('knowledge.list.delete')}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

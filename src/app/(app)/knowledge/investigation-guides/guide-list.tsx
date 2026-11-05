import { useCallback, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, FlatList, Pressable,
  Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  BookOpen, Edit2, FileText,
  Plus, Search, Trash2, Users,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { SearchBar } from '@/components/SearchBar';
import { ActiveFilterChips, FilterSearchButton, FilterSheet, activeFilterCount, type FilterGroupDef, type FilterValues } from '@/components/common/FilterSheet';
import {
  searchKnowledge, deleteKnowledgeEntry, type KnowledgeEntry,
} from '@/lib/db/knowledgeRepo';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const COLOR = '#0891B2';
const CATEGORY = 'Investigation Guides';

// ─── Guide type config ────────────────────────────────────────────────────
type GuideType = 'sops' | 'evidence' | 'witness' | 'charge-sheet';

interface GuideConfig {
  label: string;
  subcategory: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  contentLabel: string;
  addRoute: (type: string) => string;
}

const GUIDE_CONFIG: Record<GuideType, GuideConfig> = {
  sops: {
    label: 'Crime-wise Investigation SOPs',
    subcategory: 'Crime-wise Investigation',
    icon: BookOpen,
    contentLabel: 'SOP Content',
    addRoute: (t) => `/(app)/knowledge/investigation-guides/add-guide?type=${t}`,
  },
  evidence: {
    label: 'Evidence Collection',
    subcategory: 'Evidence Collection',
    icon: Search,
    contentLabel: 'Evidence Collection Steps',
    addRoute: (t) => `/(app)/knowledge/investigation-guides/add-guide?type=${t}`,
  },
  witness: {
    label: 'Witness Handling',
    subcategory: 'Witness Handling',
    icon: Users,
    contentLabel: 'Witness Handling Guidelines',
    addRoute: (t) => `/(app)/knowledge/investigation-guides/add-guide?type=${t}`,
  },
  'charge-sheet': {
    label: 'Charge Sheet Guide',
    subcategory: 'Charge Sheet Guide',
    icon: FileText,
    contentLabel: 'Charge Sheet Guidance',
    addRoute: (t) => `/(app)/knowledge/investigation-guides/add-guide?type=${t}`,
  },
};

function isGuideType(v: string | undefined): v is GuideType {
  return v === 'sops' || v === 'evidence' || v === 'witness' || v === 'charge-sheet';
}

function fmtTs(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Guide Card ───────────────────────────────────────────────────────────
function GuideCard({
  item, onPress, onEdit, onDelete,
}: {
  item: KnowledgeEntry;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const tagList = item.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3);
  const attachCount = (() => {
    try { return (JSON.parse(item.attachment_uris) as unknown[]).length; } catch { return 0; }
  })();

  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-2xl p-4 gap-3 active:opacity-75"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text className="text-sm font-semibold text-foreground leading-5" numberOfLines={2}>
            {item.title}
          </Text>
          {item.crime_type ? (
            <View
              className="self-start rounded-full mt-1.5 px-2.5 py-1"
              style={{ backgroundColor: `${COLOR}15` }}
            >
              <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: COLOR }}>
                {t('knowledge.guide.crimeType.' + item.crime_type, { defaultValue: item.crime_type })}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row gap-1 mt-0.5">
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
      </View>

      {item.description ? (
        <Text className="text-xs text-muted-foreground leading-4" numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      {tagList.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {tagList.map((tag, idx) => (
            <View key={`${idx}-${tag}`} className="bg-secondary rounded-full px-2.5 py-1">
              <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row items-center justify-between pt-1 border-t border-border/50">
        <Text className="text-xs text-muted-foreground">
          {t('knowledge.guide.updated', { date: fmtTs(item.updated_at) })}
        </Text>
        {attachCount > 0 && (
          <Text className="text-xs text-muted-foreground">
            {t('knowledge.guide.fileCount', { count: attachCount })}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────
export default function GuideListScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const COLOR = colorScheme === 'dark' ? '#22D3EE' : '#0891B2';
  const { type } = useLocalSearchParams<{ type: string }>();
  const guideType = isGuideType(type) ? type : 'sops';
  const config = GUIDE_CONFIG[guideType];
  const Icon = config.icon;

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [query, setQuery] = useState('');
  const [activeCrimeType, setActiveCrimeType] = useState('All');
  const [crimeTypeOptions, setCrimeTypeOptions] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(
    async (q = query, ct = activeCrimeType) => {
      try {
        const res = await searchKnowledge(
          CATEGORY,
          q,
          config.subcategory,
          ct === 'All' ? undefined : ct,
        );
        setEntries(res);
        // derive crime type options from loaded data if filter not yet populated
        if (crimeTypeOptions.length === 0) {
          const all = await searchKnowledge(CATEGORY, '', config.subcategory);
          const types = [...new Set(all.map((e) => e.crime_type).filter(Boolean))].sort();
          setCrimeTypeOptions(types);
        }
      } catch (e) {
        logger.error('[GuideList] load error:', e);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.subcategory, query, activeCrimeType]
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData(query, activeCrimeType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guideType])
  );

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadData(text, activeCrimeType), 300);
  };

  const handleFilterSelect = (ct: string) => {
    setActiveCrimeType(ct);
    setShowFilter(false);
    loadData(query, ct);
  };

  // Design C filter sheet: अपराध प्रकार (same options as the old chips).
  const filterGroups: FilterGroupDef[] = [{
    key: 'ct', label: t('knowledge.guide.filter'),
    options: crimeTypeOptions.map((ct) => ({ value: ct, label: t('knowledge.guide.crimeType.' + ct, { defaultValue: ct }) })),
  }];
  const filterValues: FilterValues = { ct: activeCrimeType === 'All' ? null : activeCrimeType };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteKnowledgeEntry(deleteTarget.id);
    setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t(`knowledge.guide.${guideType}.label`)}
        showBack
        actions={
          <HeaderIconBtn icon={Plus} onPress={() => router.push(config.addRoute(guideType) as never)} label={t('knowledge.guide.addGuide')} color={COLOR} />
        }
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {/* Search + filter (design C, owner) */}
        <SearchBar
          value={query}
          onChangeText={handleSearch}
          placeholder={t('knowledge.guide.searchPlaceholder')}
          variant="light"
          accessibilityLabel={t('knowledge.guide.searchAccessibility')}
          trailing={<FilterSearchButton count={activeFilterCount(filterValues)} onPress={() => setShowFilter(true)} accent={COLOR} />}
        />
        <ActiveFilterChips groups={filterGroups} values={filterValues} onRemove={() => handleFilterSelect('All')} accent={COLOR} />
      </View>

      <FilterSheet
        visible={showFilter}
        groups={filterGroups}
        values={filterValues}
        onApply={(v) => handleFilterSelect((v.ct as string | null) ?? 'All')}
        onClose={() => setShowFilter(false)}
        accent={COLOR}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLOR} />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={true}
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-6 py-4 gap-3 pb-12"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={false}
          onRefresh={() => loadData()}
          renderItem={({ item }) => (
            <GuideCard
              item={item}
              onPress={() =>
                router.push(
                  `/(app)/knowledge/investigation-guides/${item.id}?type=${guideType}` as never
                )
              }
              onEdit={() =>
                router.push(
                  `/(app)/knowledge/investigation-guides/add-guide?type=${guideType}&editId=${item.id}` as never
                )
              }
              onDelete={() => setDeleteTarget(item)}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-24 gap-4">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center"
                style={{ backgroundColor: `${COLOR}15` }}
              >
                <Icon size={30} color={COLOR} />
              </View>
              <Text className="text-base font-semibold text-foreground">
                {query.trim() || activeCrimeType !== 'All'
                  ? t('knowledge.guide.noRecordsFound')
                  : t('knowledge.guide.noRecordsYet')}
              </Text>
              <Text className="text-sm text-muted-foreground text-center px-10">
                {query.trim() || activeCrimeType !== 'All'
                  ? t('knowledge.guide.tryAdjusting')
                  : t('knowledge.guide.tapAddFirst', { label: t(`knowledge.guide.${guideType}.label`).toLowerCase() })}
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
            <AlertDialogTitle>{t('knowledge.guide.deleteRecord')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('knowledge.guide.deleteRecordDesc', { title: deleteTarget?.title ?? '' })}
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

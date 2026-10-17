/**
 * GD Select Format Screen
 *
 * Invoked from add-gd.tsx → "Add From Format".
 * Only fetches and displays templates where format_type = 'GD' (DB-level filter).
 * Search, Favorites, Recently Used, and Created By Me filters all operate
 * exclusively on the GD-scoped dataset — no other format type is ever loaded.
 *
 * After selecting a template the user fills keys in formats/fill.tsx
 * (callingModule=GD), generates the report in formats/preview.tsx, and
 * "Insert into GD" populates add-gd.tsx via gdFormatBridge.
 */
import { logger } from '@/lib/logger';
import { useTranslation } from 'react-i18next';
import { stripHtmlTags } from '@/lib/stringUtils';
import { T } from '@/lib/typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  ScrollView, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  ChevronRight, Eye, FileWarning,
  LayoutTemplate, Star, Clock, User,
} from 'lucide-react-native';
import { BottomSheet } from '@/components/ui/ds/BottomSheet';
import { SearchBar } from '@/components/SearchBar';
import {
  type FormatWithMeta,
} from '@/lib/db/predefinedFormatRepo';
import { getPublishedFormatsByType, searchPublishedFormatsByTypes } from '@/lib/db/sysFormatRepo';
import { gdFormatBridge } from '@/lib/gdFormatBridge';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

// ─── Constants ────────────────────────────────────────────────────────────
const GD_COLOR = '#D97706';
const GD_TYPE = 'GD' as const;

type ChipFilter = 'All' | 'Favorites' | 'Recently Used' | 'Created By Me';

const CHIP_FILTERS: { labelKey: string; value: ChipFilter }[] = [
  { labelKey: 'common.all',            value: 'All' },
  { labelKey: 'filters.favorites',     value: 'Favorites' },
  { labelKey: 'filters.recentlyUsed',  value: 'Recently Used' },
  { labelKey: 'filters.createdByMe',   value: 'Created By Me' },
];

// ─── Apply chip filter to an already-GD-scoped list ───────────────────────
function applyChipFilter(list: FormatWithMeta[], chip: ChipFilter): FormatWithMeta[] {
  switch (chip) {
    case 'Favorites':
      return list.filter((f) => f.is_favorite === 1);
    case 'Recently Used':
      return list
        .filter((f) => f.last_used_at != null)
        .sort((a, b) => (b.last_used_at ?? 0) - (a.last_used_at ?? 0));
    case 'Created By Me':
      return list.filter((f) => f.created_by === 'me');
    default:
      return list;
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────
export default function GdSelectFormatScreen() {
  const { t } = useTranslation();
  const [allGdFormats, setAllGdFormats] = useState<FormatWithMeta[]>([]);
  const [displayed, setDisplayed] = useState<FormatWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<ChipFilter>('All');
  const [previewFormat, setPreviewFormat] = useState<FormatWithMeta | null>(null);

  // Refs that mirror query/chip so useFocusEffect can read current values
  // without adding them to its dependency array (prevents double-load on keystroke).
  const queryRef = useRef(query);
  const chipRef  = useRef(chip);
  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => { chipRef.current  = chip;  }, [chip]);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending debounced search on unmount to prevent setState after
  // the screen is destroyed (memory-leak + stale-state guard).
  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  // ── Bridge sentinel ──────────────────────────────────────────────────────
  // When "Insert into GD" is tapped in formats/preview, that screen calls
  // navigation.getParent()?.goBack() which pops the entire formats Stack from
  // the (app) Stack in one action — both fill and preview are removed atomically.
  // This returns focus to the gd Stack, whose top screen is select-format.
  // If the bridge already has data it means the user is done selecting —
  // immediately pop this screen so add-gd regains focus and consumes the bridge.
  useFocusEffect(useCallback(() => {
    if (gdFormatBridge.has()) {
      router.back();
    }
  }, []));

  // ── Load: DB-level filter ensures format_type = 'GD' always ─────────────
  const load = useCallback(async (q = '', activeChip: ChipFilter = 'All') => {
    setLoading(true);
    try {
      // ① Text search: SQL WHERE format_type = 'GD' AND (title/vivran/tag LIKE ?)
      // ② No query: SQL WHERE format_type = 'GD' ORDER BY title ASC
      // Never touches any other format type.
      const base = q.trim()
        ? await searchPublishedFormatsByTypes(q, [GD_TYPE])
        : await getPublishedFormatsByType(GD_TYPE);

      logger.debug(`[GdSelectFormat] loaded ${base.length} GD rows — query="${q}" chip="${activeChip}"`);
      setAllGdFormats(base);
      setDisplayed(applyChipFilter(base, activeChip));
    } catch (e) {
      logger.warn('[GdSelectFormat] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-load on every focus (catches formats added since last visit).
  // Guard: skip the load if the bridge already has data — the sentinel above
  // will immediately call router.back(), so loading here is wasted work and
  // risks a setState call on a screen that is actively navigating away.
  // Dep array is [load] only — query/chip are read via refs to avoid
  // re-registering this effect (and firing an extra DB load) on every keystroke.
  useFocusEffect(useCallback(() => {
    if (gdFormatBridge.has()) return;
    load(queryRef.current, chipRef.current);
  }, [load]));

  // ── Search ───────────────────────────────────────────────────────────────
  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(text, chip), 300);
  };

  const clearSearch = () => {
    setQuery('');
    load('', chip);
  };

  // ── Chip filter ──────────────────────────────────────────────────────────
  const handleChip = (selected: ChipFilter) => {
    setChip(selected);
    // Re-apply filter to the already-loaded GD base set — no extra DB query
    setDisplayed(applyChipFilter(allGdFormats, selected));
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('formatPicker.titleGd')} subtitle="GD" showBack />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {/* Search box */}
        <SearchBar
          value={query}
          onChangeText={handleSearch}
          placeholder={t('formatPicker.searchPlaceholderGd')}
          variant="light"
          returnKeyType="search"
          accessibilityLabel={t('formatPicker.searchPlaceholderGd')}
        />

        {/* Chip filters — operate on the GD-scoped dataset only */}
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
          {CHIP_FILTERS.map((f) => {
            const active = chip === f.value;
            const Icon =
              f.value === 'Favorites'     ? Star :
              f.value === 'Recently Used' ? Clock :
              f.value === 'Created By Me' ? User  : null;
            return (
              <Pressable
                key={f.value}
                onPress={() => handleChip(f.value)}
                className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70"
                style={{ backgroundColor: active ? GD_COLOR : '#F3F4F6' }}
              >
                {Icon && <Icon size={11} color={active ? '#fff' : '#6B7280'} fill={f.value === 'Favorites' && active ? '#fff' : 'none'} />}
                <Text className="text-xs font-medium" style={{ color: active ? '#fff' : '#374151' }}>
                  {t(f.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── List ─────────────────────────────────────────────────── */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={GD_COLOR} />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={true}
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: T.space.xl - 12,
            paddingVertical: T.space.md,
            paddingBottom: 48,
            gap: T.space.md - 4,
          }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(
                  `/(app)/formats/fill?formatId=${item.id}&callingModule=GD` as never
                )
              }
              className="bg-card border border-border rounded-2xl p-4 flex-row items-center gap-3 active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: `${GD_COLOR}15` }}
              >
                {item.is_favorite === 1
                  ? <Star size={18} color={GD_COLOR} fill={GD_COLOR} />
                  : <LayoutTemplate size={18} color={GD_COLOR} />
                }
              </View>

              <View className="flex-1 gap-1" style={{ minWidth: 0 }}>
                <Text className="text-base font-semibold text-foreground shrink">
                  {item.title}
                </Text>
                {item.tags.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {item.tags.map((t) => (
                      <View key={t} className="mr-1 bg-secondary rounded-full px-2 py-0.5">
                        <Text className="text-xs text-muted-foreground">{t}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
                {item.last_used_at ? (
                  <View className="flex-row items-center gap-1">
                    <Clock size={10} color="#9CA3AF" />
                    <Text className="text-xs text-muted-foreground">
                      {t('formatPicker.usedOn', {
                        date: new Date(item.last_used_at * 1000).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        }),
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Eye: preview template content without navigating */}
              <Pressable
                onPress={(e) => { e.stopPropagation(); setPreviewFormat(item); }}
                className="p-2 active:opacity-60 mr-1"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel={t('formatPicker.previewTitle')}
              >
                <Eye size={16} color="#9CA3AF" />
              </Pressable>

              <ChevronRight size={16} color="#9CA3AF" />
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-24 gap-4 px-6">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center"
                style={{ backgroundColor: `${GD_COLOR}15` }}
              >
                <FileWarning size={30} color={GD_COLOR} />
              </View>
              <Text className="text-base font-semibold text-foreground text-center">
                {chip !== 'All'
                  ? t('formatPicker.noFilteredTemplatesGd', {
                      filter: t(CHIP_FILTERS.find((f) => f.value === chip)?.labelKey ?? 'common.all'),
                    })
                  : t('formatPicker.noTemplatesGd')}
              </Text>
              <Text className="text-sm text-muted-foreground text-center leading-5">
                {query.trim()
                  ? t('formatPicker.emptySearchHint')
                  : chip !== 'All'
                  ? t('formatPicker.emptyFilterHintGd')
                  : t('formatPicker.createTemplateHintGd')}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Template preview bottom sheet ──────────────────────── */}
      <BottomSheet
        visible={!!previewFormat}
        onClose={() => setPreviewFormat(null)}
        title={previewFormat ? t('formatPicker.previewTitleWithFormat', { title: previewFormat.title }) : t('formatPicker.previewTitle')}
        snapHeight={480}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-sm text-foreground leading-6" selectable>
            {previewFormat?.vivran
              ? stripHtmlTags(previewFormat.vivran).replace(/\{\{.*?\}\}|<<.*?>>|\[\[.*?\]\]/g, '....')
              : ''}
          </Text>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

/**
 * Nyayalay Select Format Screen
 *
 * Used by NBW, Summons, Anya, Vadi Suchna, and DCRB Report workflows.
 *
 * Params:
 *   tag        – filter by tag (NBW / Summons workflows)
 *   docId      – passed through so fill-format can route back
 *   mode       – "anya" = multi-type filter; "formatType" = exact format_type match
 *   formatType – the exact format_type value to filter when mode="formatType"
 *
 * NBW / Summons "tag" mode now behaves like GD's select-format:
 *   • Base set = formats whose tags array contains the tag param ('NBW' or 'Summons'),
 *     queried via getPublishedFormatsByTag — NOT filtered by format_type
 *   • Chip filters: All | Favorites | Recently Used | Created By Me
 *   • Debounced search applied client-side on the tag-filtered result set
 *   • Eye icon → BottomSheet content preview
 */
import { logger } from '@/lib/logger';
import { stripHtmlTags } from '@/lib/stringUtils';
import { T } from '@/lib/typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, FlatList, Pressable,
  ScrollView, Text, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Clock, FileWarning,
  Star, User,
} from 'lucide-react-native';
import { BottomSheet } from '@/components/ui/ds/BottomSheet';
import { SearchBar } from '@/components/SearchBar';
import { FormatCard } from '@/components/formats/FormatCard';
import {
  type FormatType,
  type FormatWithMeta,
} from '@/lib/db/predefinedFormatRepo';
import {
  getPublishedFormatsByTag,
  mergeFormatsFirst,
  filterFormatsByQuery,
  getPublishedFormatsByType,
  getPublishedFormatsByTypes,
  searchPublishedFormatsByTypes,
} from '@/lib/db/sysFormatRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';

const MODULE_COLOR = '#1D4ED8';
const ANYA_TYPES: FormatType[] = ['Nyayalay', 'Prarthna Patra', 'Any'];

// ─── Chip filter (used in tag / NBW mode only) ─────────────────────────────
type ChipFilter = 'All' | 'Favorites' | 'Recently Used' | 'Created By Me';

const CHIP_FILTERS: { labelKey: string; value: ChipFilter }[] = [
  { labelKey: 'formatPicker.chipAll',          value: 'All' },
  { labelKey: 'formatPicker.chipFavorites',    value: 'Favorites' },
  { labelKey: 'formatPicker.chipRecentlyUsed', value: 'Recently Used' },
  { labelKey: 'formatPicker.chipCreatedByMe',  value: 'Created By Me' },
];

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

// ─── Screen ────────────────────────────────────────────────────────────────
export default function NyayalaySelectFormatScreen() {
  const { t } = useTranslation();
  const { tag, docId, mode, formatType } = useLocalSearchParams<{
    tag?: string;
    docId: string;
    mode?: string;
    formatType?: string;
  }>();

  const isAnya       = mode === 'anya';
  const isFormatType = mode === 'formatType' && !!formatType;
  // Tag mode = NBW / Summons — uses the GD-style rich UI
  const isTagMode    = !isAnya && !isFormatType && !!tag;

  // ── Tag-mode state (chip filters + preview) ───────────────────────────
  const [allTagFormats, setAllTagFormats]   = useState<FormatWithMeta[]>([]);
  const [displayed,     setDisplayed]       = useState<FormatWithMeta[]>([]);
  const [chip,          setChip]            = useState<ChipFilter>('All');
  const [previewFormat, setPreviewFormat]   = useState<FormatWithMeta | null>(null);

  // ── Shared state ──────────────────────────────────────────────────────
  const [formats,  setFormats]  = useState<FormatWithMeta[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState('');

  // Refs so useFocusEffect reads latest query/chip without re-registering
  const queryRef = useRef(query);
  const chipRef  = useRef(chip);
  useEffect(() => { queryRef.current = query; }, [query]);
  useEffect(() => { chipRef.current  = chip;  }, [chip]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);

  // ── Load ──────────────────────────────────────────────────────────────
  const load = useCallback(async (q = '', activeChip: ChipFilter = 'All') => {
    setLoading(true);
    try {
      if (isTagMode) {
        // Base set = formats tagged exactly with tag ('NBW' or 'Summons') so the
        // two types are properly isolated at the DB level — not all Nyayalay templates.
        // A search query is applied client-side on the already-enriched tag result set
        // (getPublishedFormatsByTag returns enriched rows, so client filter is cheap).
        // Formats tagged for this document type first, then every other
        // 'Nyayalay' type format, so nothing usable is hidden.
        const rawBase = mergeFormatsFirst(
          await getPublishedFormatsByTag(tag!),
          await getPublishedFormatsByType('Nyayalay' as FormatType),
        );
        const base = filterFormatsByQuery(rawBase, q);
        logger.debug(
          `[NyayalaySelectFormat] loaded ${base.length} rows for tag="${tag}" — query="${q}" chip="${activeChip}"`
        );
        setAllTagFormats(base);
        setDisplayed(applyChipFilter(base, activeChip));
      } else if (isFormatType) {
        // Exact type first (e.g. वादी सूचना), then all 'Nyayalay' formats
        const results = mergeFormatsFirst(
          await getPublishedFormatsByType(formatType as FormatType),
          await getPublishedFormatsByType('Nyayalay' as FormatType),
        );
        setFormats(filterFormatsByQuery(results, q));
      } else if (isAnya) {
        const results = q.trim()
          ? await searchPublishedFormatsByTypes(q, ANYA_TYPES)
          : await getPublishedFormatsByTypes(ANYA_TYPES);
        setFormats(results);
      } else {
        // Fallback: tag-based raw query (legacy path, no chip UI)
        const results = mergeFormatsFirst(
          tag ? await getPublishedFormatsByTag(tag) : [],
          await getPublishedFormatsByType('Nyayalay' as FormatType),
        );
        setFormats(filterFormatsByQuery(results, q));
      }
    } catch (e) {
      logger.warn('[NyayalaySelectFormat] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [isAnya, isFormatType, isTagMode, tag, formatType]);

  useFocusEffect(useCallback(() => {
    load(queryRef.current, chipRef.current);
  }, [load]));

  // ── Search ────────────────────────────────────────────────────────────
  const handleSearch = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(q, chip), 300);
  };

  const clearSearch = () => {
    setQuery('');
    load('', chip);
  };

  // ── Chip (tag mode only) ──────────────────────────────────────────────
  const handleChip = (selected: ChipFilter) => {
    setChip(selected);
    setDisplayed(applyChipFilter(allTagFormats, selected));
  };

  // ── Derived ───────────────────────────────────────────────────────────
  const title = isFormatType
    ? t('formatPicker.titleWithTemplates', { tag: formatType, type: formatType })
    : isAnya  ? t('formatPicker.titleWithTemplates', { tag: 'Anya', type: 'Anya' })
    : tag     ? t('formatPicker.titleWithTemplates', { tag, type: tag })
    : t('formatPicker.selectTemplate');

  // In tag mode the displayed list comes from chip-filtered state;
  // in other modes it comes from the shared formats state.
  const listData = isTagMode ? displayed : formats;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background">
      <AppHeader title={title} subtitle={t('nyayalay.title')} showBack />

      {/* ── Tag-mode toolbar: search + chip filters (mirrors GD) ── */}
      {isTagMode && (
        <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
          <SearchBar
            value={query}
            onChangeText={handleSearch}
            placeholder={t('formatPicker.searchTagPlaceholder', { tag })}
            variant="light"
            returnKeyType="search"
            accessibilityLabel={t('formatPicker.searchTagAccessibility', { tag })}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            {CHIP_FILTERS.map((f) => {
              const active = chip === f.value;
              const Icon =
                f.value === 'Favorites'     ? Star  :
                f.value === 'Recently Used' ? Clock :
                f.value === 'Created By Me' ? User  : null;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => handleChip(f.value)}
                  className="bg-secondary flex-row items-center gap-1.5 rounded-full active:opacity-70 px-3 py-1.5"
                  style={active ? { backgroundColor: MODULE_COLOR } : undefined}
                >
                  {Icon && (
                    <Icon
                      size={11}
                      color={active ? '#fff' : '#6B7280'}
                      fill={f.value === 'Favorites' && active ? '#fff' : 'none'}
                    />
                  )}
                  <Text textBreakStrategy="simple"
                    className="text-secondary-foreground text-xs font-medium"
                    style={active ? { color: '#fff' } : undefined}
                  >
                    {t(f.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Anya / FormatType search bar ──────────────────────────── */}
      {(isAnya || isFormatType) && (
        <View className="px-5 pt-4">
          <SearchBar
            value={query}
            onChangeText={handleSearch}
            placeholder={t('formatPicker.searchPlaceholder')}
            variant="light"
            returnKeyType="search"
            accessibilityLabel={t('formatPicker.searchNyayalayAccessibility')}
          />
          <Text className="text-xs text-muted-foreground mt-2 mb-1">
            {isFormatType
              ? t('formatPicker.showingType', { type: formatType })
              : t('formatPicker.showingAnya')}
          </Text>
        </View>
      )}

      {/* ── List ─────────────────────────────────────────────────── */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={MODULE_COLOR} />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews
          data={listData}
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
            <FormatCard
              format={item}
              query={query}
              onPress={() => router.push(`/(app)/nyayalay/fill-format?formatId=${item.id}&docId=${docId}` as never)}
              onPreview={isTagMode ? () => setPreviewFormat(item) : undefined}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-24 gap-4 px-6">
              <View
                className="w-16 h-16 rounded-2xl items-center justify-center"
                style={{ backgroundColor: `${MODULE_COLOR}12` }}
              >
                <FileWarning size={30} color={MODULE_COLOR} />
              </View>
              <Text className="text-base font-semibold text-foreground text-center">
                {isTagMode && chip !== 'All'
                  ? t('formatPicker.noTemplatesChipTagged', {
                      chip: t(CHIP_FILTERS.find((c) => c.value === chip)?.labelKey ?? chip),
                      tag: tag ?? 'Nyayalay',
                    })
                  : t('formatPicker.noTemplatesTagged', { tag: tag ?? formatType ?? 'Nyayalay' })}
              </Text>
              <Text className="text-sm text-muted-foreground text-center leading-5">
                {query.trim()
                  ? t('formatPicker.hintDifferentQuery')
                  : isTagMode && chip !== 'All'
                  ? t('formatPicker.hintTryAllFilterTagged', { tag: tag ?? 'Nyayalay' })
                  : isFormatType
                  ? t('formatPicker.hintCreateTypeFormat', { type: formatType, formatType })
                  : isAnya
                  ? t('formatPicker.hintCreateAnyaFormats')
                  : t('formatPicker.hintCreateNyayalayFormat')}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Template preview bottom sheet (tag mode only) ─────────── */}
      {isTagMode && (
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
                ? stripHtmlTags(previewFormat.vivran).replace(/\{\{.*?\}\}|<<.*?>>|\[\[.*?\]\]/g, '…')
                : ''}
            </Text>
          </ScrollView>
        </BottomSheet>
      )}
    </View>
  );
}

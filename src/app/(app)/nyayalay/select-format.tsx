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
 *   • ⚙︎ filter (owner, design C — was the chip row; every mode): प्रकार ("<tag> वाले" / बाकी, or the format types) /
 *     दिखाएँ / स्रोत — components/formats/FormatPickExtras
 *   • Debounced search applied client-side on the tag-filtered result set
 *   • 👁 → shared preview sheet with "प्रारूप भरें →" (every mode)
 */
import { logger } from '@/lib/logger';
import { T } from '@/lib/typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, FlatList, Text, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { FileWarning } from 'lucide-react-native';
import { FORMAT_LIST_PADDING, FormatPreviewSheet, useFormatPickFilter } from '@/components/formats/FormatPickExtras';
import { SearchBar } from '@/components/SearchBar';
import { FormatCard } from '@/components/formats/FormatCard';
import {
  type FormatType,
  type FormatWithMeta,
} from '@/lib/db/predefinedFormatRepo';
import {
  getPublishedFormatsByIds,
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

/**
 * The उच्च न्यायालय cards "प्रारूप से वादी सूचना / DCRB रिपोर्ट जोड़ें" (owner, option ख): no format has format_type
 * "वादी सूचना" / "DCRB रिपोर्ट", so the list showed only the 5 न्यायालय formats. Their own formats (by id — they live
 * under केस डायरी / प्रार्थना पत्र — or by tag, for ones made later) are listed first; the न्यायालय formats follow.
 */
const FORMAT_TYPE_FIRST: Record<string, { ids: string[]; tags: string[]; label: string }> = {
  'वादी सूचना': { ids: ['sys-fmt-notice-suchna-vadi'], tags: ['वादी सूचना'], label: 'वादी सूचना वाले' },
  'DCRB रिपोर्ट': { ids: ['sys-fmt-dcrb-criminal-history'], tags: ['DCRB'], label: 'DCRB वाले' },
};

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

  // ── State ─────────────────────────────────────────────────────────────
  const [formats,  setFormats]  = useState<FormatWithMeta[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState('');
  const [previewFormat, setPreviewFormat] = useState<FormatWithMeta | null>(null);
  // Tag mode: ids of the formats tagged for this paper (listed first) → filter "<tag> वाले" / "बाकी"
  const [tagIds, setTagIds] = useState<ReadonlySet<string>>(new Set());
  const first = useMemo(() => {
    if (isTagMode && tag) return { ids: tagIds, label: `${tag === 'Death_Report' ? 'मृत्यु आख्या' : tag} वाले` };
    if (isFormatType && formatType) return { ids: tagIds, label: FORMAT_TYPE_FIRST[formatType]?.label ?? `${formatType} वाले` };
    return undefined;
  }, [isTagMode, isFormatType, tag, formatType, tagIds]);
  // ⚙︎ filter (owner, design C — was the tag-mode chip row; now every mode)
  const pick = useFormatPickFilter(formats, MODULE_COLOR, first);
  const openFill = (f: FormatWithMeta) => router.push(`/(app)/nyayalay/fill-format?formatId=${f.id}&docId=${docId}` as never);

  // Ref so useFocusEffect reads the latest query without re-registering
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, []);

  // ── Load ──────────────────────────────────────────────────────────────
  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      if (isTagMode) {
        // Base set = formats tagged exactly with tag ('NBW' or 'Summons') so the
        // two types are properly isolated at the DB level — not all Nyayalay templates.
        // A search query is applied client-side on the already-enriched tag result set
        // (getPublishedFormatsByTag returns enriched rows, so client filter is cheap).
        // Formats tagged for this document type first, then every other
        // 'Nyayalay' type format, so nothing usable is hidden.
        const tagged = await getPublishedFormatsByTag(tag!);
        const rawBase = mergeFormatsFirst(
          tagged,
          await getPublishedFormatsByType('Nyayalay' as FormatType),
        );
        const base = filterFormatsByQuery(rawBase, q);
        logger.debug(`[NyayalaySelectFormat] loaded ${base.length} rows for tag="${tag}" — query="${q}"`);
        setTagIds(new Set(tagged.map((f) => f.id)));
        setFormats(base);
      } else if (isFormatType) {
        // This card's own formats first (exact type, known ids, tags — FORMAT_TYPE_FIRST), then all 'Nyayalay' formats
        const own = FORMAT_TYPE_FIRST[formatType!];
        const ownList = mergeFormatsFirst(
          await getPublishedFormatsByIds(own?.ids ?? []),
          ...(await Promise.all((own?.tags ?? []).map((tg) => getPublishedFormatsByTag(tg)))),
          await getPublishedFormatsByType(formatType as FormatType),
        );
        const results = mergeFormatsFirst(ownList, await getPublishedFormatsByType('Nyayalay' as FormatType));
        setTagIds(new Set(ownList.map((f) => f.id)));
        // keepOrder inside filterFormatsByQuery keeps "this card's formats first" on a tie
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
    load(queryRef.current);
  }, [load]));

  // ── Search ────────────────────────────────────────────────────────────
  const handleSearch = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(q), 300);
  };

  // ── Derived ───────────────────────────────────────────────────────────
  const title = isFormatType
    ? t('formatPicker.titleWithTemplates', { tag: formatType, type: formatType })
    : isAnya  ? t('formatPicker.titleWithTemplates', { tag: 'Anya', type: 'Anya' })
    : tag     ? t('formatPicker.titleWithTemplates', { tag, type: tag })
    : t('formatPicker.selectTemplate');

  const listData = pick.filtered;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background">
      <AppHeader title={title} subtitle={t('nyayalay.title')} showBack />

      {/* ── Tag-mode toolbar: search + ⚙︎ filter (mirrors GD) ── */}
      {isTagMode && (
        <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
          <SearchBar
            value={query}
            onChangeText={handleSearch}
            placeholder={t('formatPicker.searchTagPlaceholder', { tag })}
            variant="light"
            returnKeyType="search"
            accessibilityLabel={t('formatPicker.searchTagAccessibility', { tag })}
            trailing={pick.button}
          />
          {pick.chips}
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
            trailing={pick.button}
          />
          <View style={{ marginTop: 8 }}>{pick.chips}</View>
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
        <FlatList keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: FORMAT_LIST_PADDING,
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
              onPress={() => openFill(item)}
              onPreview={() => setPreviewFormat(item)}
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
                {pick.count
                  ? t('formatPicker.noFilteredTemplatesGd')
                  : t('formatPicker.noTemplatesTagged', { tag: tag ?? formatType ?? 'Nyayalay' })}
              </Text>
              <Text className="text-sm text-muted-foreground text-center leading-5">
                {query.trim()
                  ? t('formatPicker.hintDifferentQuery')
                  : pick.count
                  ? t('formatPicker.emptyFilterHintGd')
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

      {/* ── 👁 preview (shared, every mode) + ⚙︎ filter sheet ─────── */}
      <FormatPreviewSheet
        format={previewFormat}
        onClose={() => setPreviewFormat(null)}
        onFill={() => { const f = previewFormat; setPreviewFormat(null); if (f) openFill(f); }}
        accent={MODULE_COLOR}
      />
      {pick.sheet}
    </View>
  );
}

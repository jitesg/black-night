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
import { T } from '@/lib/typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { FileWarning } from 'lucide-react-native';
import { FORMAT_LIST_PADDING, FormatPreviewSheet, useFormatPickFilter } from '@/components/formats/FormatPickExtras';
import { SearchBar } from '@/components/SearchBar';
import { FormatCard } from '@/components/formats/FormatCard';
import {
  type FormatWithMeta,
} from '@/lib/db/predefinedFormatRepo';
import { getPublishedFormatsByType, searchPublishedFormatsByTypes } from '@/lib/db/sysFormatRepo';
import { gdFormatBridge } from '@/lib/gdFormatBridge';
import { AppHeader } from '@/components/ui/ds/AppHeader';

// ─── Constants ────────────────────────────────────────────────────────────
const GD_COLOR = '#D97706';
const GD_TYPE = 'GD' as const;

// ─── Screen ───────────────────────────────────────────────────────────────
export default function GdSelectFormatScreen() {
  const { t } = useTranslation();
  const [allGdFormats, setAllGdFormats] = useState<FormatWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [previewFormat, setPreviewFormat] = useState<FormatWithMeta | null>(null);
  // ⚙︎ filter (owner, design C — was the chip row): दिखाएँ / स्रोत on the GD list
  const pick = useFormatPickFilter(allGdFormats, GD_COLOR);
  const openFill = (f: FormatWithMeta) => router.push(`/(app)/formats/fill?formatId=${f.id}&callingModule=GD` as never);

  // Ref that mirrors query so useFocusEffect can read the current value
  // without adding it to its dependency array (prevents double-load on keystroke).
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);

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
  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      // ① Text search: SQL WHERE format_type = 'GD' AND (title/vivran/tag LIKE ?)
      // ② No query: SQL WHERE format_type = 'GD' ORDER BY title ASC
      // Never touches any other format type.
      const base = q.trim()
        ? await searchPublishedFormatsByTypes(q, [GD_TYPE])
        : await getPublishedFormatsByType(GD_TYPE);

      logger.debug(`[GdSelectFormat] loaded ${base.length} GD rows — query="${q}"`);
      setAllGdFormats(base);
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
    load(queryRef.current);
  }, [load]));

  // ── Search ───────────────────────────────────────────────────────────────
  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(text), 300);
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
          trailing={pick.button}
        />

        {pick.chips}
      </View>

      {/* ── List ─────────────────────────────────────────────────── */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={GD_COLOR} />
        </View>
      ) : (
        <FlatList keyboardShouldPersistTaps="handled"
          removeClippedSubviews={true}
          data={pick.filtered}
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
                style={{ backgroundColor: `${GD_COLOR}15` }}
              >
                <FileWarning size={30} color={GD_COLOR} />
              </View>
              <Text className="text-base font-semibold text-foreground text-center">
                {pick.count
                  ? t('formatPicker.noFilteredTemplatesGd')
                  : t('formatPicker.noTemplatesGd')}
              </Text>
              <Text className="text-sm text-muted-foreground text-center leading-5">
                {query.trim()
                  ? t('formatPicker.emptySearchHint')
                  : pick.count
                  ? t('formatPicker.emptyFilterHintGd')
                  : t('formatPicker.createTemplateHintGd')}
              </Text>
            </View>
          }
        />
      )}

      {/* ── 👁 preview (shared) + ⚙︎ filter sheet ──────────────── */}
      <FormatPreviewSheet
        format={previewFormat}
        onClose={() => setPreviewFormat(null)}
        onFill={() => { const f = previewFormat; setPreviewFormat(null); if (f) openFill(f); }}
        accent={GD_COLOR}
      />
      {pick.sheet}
    </View>
  );
}

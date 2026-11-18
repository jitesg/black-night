/**
 * Nirodhatmak Select Format Screen
 *
 * Invoked from add-proceeding.tsx → "Add From Format".
 * Only fetches formats where format_type = 'BNSS Karyavahi'.
 * After selecting a template the user fills keys in formats/fill.tsx
 * (callingModule=NK), generates the report in formats/preview.tsx, and
 * "Save Proceeding" populates add-proceeding.tsx via nirodhatmakFormatBridge.
 *
 * Bridge sentinel: if the bridge already has data when this screen regains
 * focus it means the user completed the preview flow — immediately pop this
 * screen so add-proceeding regains focus and consumes the bridge.
 * (Mirrors the GD module gd/select-format.tsx pattern exactly.)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, FlatList, Text, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { FileWarning } from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import { FormatCard } from '@/components/formats/FormatCard';
import {
  type FormatWithMeta,
} from '@/lib/db/predefinedFormatRepo';
import { getPublishedFormatsByType, mergeFormatsFirst, filterFormatsByQuery } from '@/lib/db/sysFormatRepo';
import { nirodhatmakFormatBridge } from '@/lib/nirodhatmakFormatBridge';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { FORMAT_LIST_PADDING, FormatPreviewSheet, useFormatPickFilter } from '@/components/formats/FormatPickExtras';

const MODULE_COLOR = '#DC2626';
const NK_FORMAT_TYPE = 'BNSS Karyavahi' as const;

// ─── Format Selection Screen ───────────────────────────────────────────────
export default function NkSelectFormatScreen() {
  const { t } = useTranslation();
  // Accept the proceeding type passed from add-proceeding to pre-populate search
  const { type: initialTypeQuery } = useLocalSearchParams<{ type?: string }>();

  const [formats, setFormats] = useState<FormatWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  // Start with an empty search so every BNSS Karyavahi format is listed; the
  // proceeding type only decides which formats are suggested first.
  const [query, setQuery] = useState('');
  const [previewFormat, setPreviewFormat] = useState<FormatWithMeta | null>(null);
  // ⚙︎ filter (owner, design C): दिखाएँ / स्रोत (one format type here, so no प्रकार group)
  const pick = useFormatPickFilter(formats, MODULE_COLOR);
  const openFill = (f: FormatWithMeta) => router.push(`/(app)/formats/fill?formatId=${f.id}&callingModule=NK` as never);

  // Keep a ref so useFocusEffect can read latest query without re-registering
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, []);

  // ── Bridge sentinel — mirrors gd/select-format.tsx ───────────────────────
  // If the NK bridge has a payload when this screen regains focus, the user
  // has completed the preview flow → pop immediately so add-proceeding consumes it.
  useFocusEffect(useCallback(() => {
    if (nirodhatmakFormatBridge.has()) {
      router.back();
    }
  }, []));

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const all = await getPublishedFormatsByType(NK_FORMAT_TYPE);
      const hint = (initialTypeQuery ?? '').trim().toLowerCase();
      const suggested = hint
        ? all.filter((f) =>
            f.title.toLowerCase().includes(hint) ||
            hint.includes(f.title.toLowerCase()) ||
            (f.tags ?? []).some((tg) => tg.toLowerCase().includes(hint) || hint.includes(tg.toLowerCase())))
        : [];
      setFormats(filterFormatsByQuery(mergeFormatsFirst(suggested, all), q));
    } catch (e) {
      logger.warn('[NkSelectFormat] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [initialTypeQuery]);

  // Re-load on every focus using the ref so this hook never re-registers on
  // every keystroke (fixes broken debounce / double API call bug).
  useFocusEffect(useCallback(() => {
    if (nirodhatmakFormatBridge.has()) return;
    load(queryRef.current);
  }, [load]));

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(text), 300);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('formatPicker.titleNirodhatmak')}
        subtitle={t('nirodhatmak.subtitle', 'निरोधात्मक')}
        showBack
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {/* Search */}
        <SearchBar
          value={query}
          onChangeText={handleSearch}
          placeholder={t('formatPicker.searchPlaceholderNirodhatmak')}
          variant="light"
          returnKeyType="search"
          accessibilityLabel={t('formatPicker.searchPlaceholderNirodhatmak')}
          trailing={pick.button}
        />
        {pick.chips}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={MODULE_COLOR} />
        </View>
      ) : (
        <FlatList keyboardShouldPersistTaps="handled"
          removeClippedSubviews={true}
          data={pick.filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: FORMAT_LIST_PADDING, paddingTop: 16, paddingBottom: 48, gap: 12 }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          renderItem={({ item }) => (
            <FormatCard format={item} query={query} onPress={() => openFill(item)} onPreview={() => setPreviewFormat(item)} />
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
                {query.trim()
                  ? t('formatPicker.noFormatsFound')
                  : t('formatPicker.noFormatsAvailableNirodhatmak')}
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                {query.trim()
                  ? t('formatPicker.emptySearchHint')
                  : t('formatPicker.createFormatHintNirodhatmak')}
              </Text>
            </View>
          }
        />
      )}

      {/* 👁 preview (shared) + ⚙︎ filter sheet */}
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

import { logger } from '@/lib/logger';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, FlatList, Text, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, type RelativePathString } from 'expo-router';
import { FileWarning } from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import { FormatCard } from '@/components/formats/FormatCard';
import { type FormatWithMeta } from '@/lib/db/predefinedFormatRepo';
import { getPublishedFormatsByTag, getPublishedFormatsByType, mergeFormatsFirst, filterFormatsByQuery } from '@/lib/db/sysFormatRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { FORMAT_LIST_PADDING, FormatPreviewSheet, useFormatPickFilter } from '@/components/formats/FormatPickExtras';

const MODULE_COLOR = '#7C3AED';

export default function PPSelectFormatScreen() {
  const { mode, ppId } = useLocalSearchParams<{ mode?: string; ppId?: string }>();
  const isReportMode = mode === 'report';

  const formatType = isReportMode ? 'Prarthna Patra' : 'Prarthna Patra / BNSS Karyavahi';

  const [formats, setFormats] = useState<FormatWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [previewFormat, setPreviewFormat] = useState<FormatWithMeta | null>(null);
  // ⚙︎ filter (owner, design C): प्रकार (प्रार्थना पत्र / BNSS कार्यवाही) / दिखाएँ / स्रोत
  const pick = useFormatPickFilter(formats, MODULE_COLOR);

  // Keep a ref so useFocusEffect can read latest query without re-registering
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, []);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      // All 'Prarthna Patra' formats (type or tag) first. For actions, BNSS
      // Karyavahi formats follow, since action notices use that type.
      const lists = [
        await getPublishedFormatsByType('Prarthna Patra'),
        await getPublishedFormatsByTag('Prarthna Patra'),
        ...(isReportMode ? [] : [await getPublishedFormatsByType('BNSS Karyavahi')]),
      ];
      setFormats(filterFormatsByQuery(mergeFormatsFirst(...lists), q));
    } catch (e) {
      logger.warn('[PPSelectFormat] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [isReportMode]);

  // Re-load on every focus using ref — avoids re-registering on every keystroke
  useFocusEffect(useCallback(() => {
    load(queryRef.current);
  }, [load]));

  const handleSearch = (text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(text), 300);
  };

  const handleSelect = (item: FormatWithMeta) => {
    const qs = new URLSearchParams({ formatId: item.id });
    if (mode) qs.set('mode', mode);
    if (ppId) qs.set('ppId', ppId);
    router.push(`/(app)/prarthna-patra/fill-format?${qs.toString()}` as RelativePathString);
  };

  const { t } = useTranslation();
  const subtitleText = isReportMode ? t('prarthnaPatra.selectFormat.subtitleReport') : t('prarthnaPatra.selectFormat.subtitleFormat');

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('prarthnaPatra.selectFormat.title')}
        subtitle={subtitleText}
        onBack={() => router.back()}
      />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        <SearchBar
          value={query}
          onChangeText={handleSearch}
          placeholder={t('prarthnaPatra.selectFormat.searchPlaceholder', { type: formatType })}
          variant="light"
          returnKeyType="search"
          accessibilityLabel={t('prarthnaPatra.selectFormat.searchAccessibility')}
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
            <FormatCard format={item} query={query} onPress={() => handleSelect(item)} onPreview={() => setPreviewFormat(item)} />
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
                {query.trim() ? t('prarthnaPatra.selectFormat.noFormatsFound') : t('prarthnaPatra.selectFormat.noFormatsAvailable', { type: formatType })}
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                {query.trim()
                  ? t('prarthnaPatra.selectFormat.hintDifferentQuery')
                  : t('prarthnaPatra.selectFormat.hintCreateFormat', { type: formatType })}
              </Text>
            </View>
          }
        />
      )}

      {/* 👁 preview (shared) + ⚙︎ filter sheet */}
      <FormatPreviewSheet
        format={previewFormat}
        onClose={() => setPreviewFormat(null)}
        onFill={() => { const f = previewFormat; setPreviewFormat(null); if (f) handleSelect(f); }}
        accent={MODULE_COLOR}
      />
      {pick.sheet}
    </View>
  );
}

import { logger } from '@/lib/logger';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, FlatList, Pressable, ScrollView, Text, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, type RelativePathString } from 'expo-router';
import { FileWarning, LayoutTemplate, ChevronRight } from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import { type FormatWithMeta } from '@/lib/db/predefinedFormatRepo';
import { getPublishedFormatsByTag, getPublishedFormatsByType, mergeFormatsFirst, filterFormatsByQuery } from '@/lib/db/sysFormatRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';

const MODULE_COLOR = '#7C3AED';

export default function PPSelectFormatScreen() {
  const { mode, ppId } = useLocalSearchParams<{ mode?: string; ppId?: string }>();
  const isReportMode = mode === 'report';

  const formatType = isReportMode ? 'Prarthna Patra' : 'Prarthna Patra / BNSS Karyavahi';

  const [formats, setFormats] = useState<FormatWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

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
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={MODULE_COLOR} />
        </View>
      ) : (
        <FlatList
          removeClippedSubviews={true}
          data={formats}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 py-4 gap-3 pb-12"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          renderItem={({ item }) => (
            <FormatRow format={item} onPress={() => handleSelect(item)} />
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
    </View>
  );
}

function FormatRow({ format, onPress }: { format: FormatWithMeta; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-2xl p-4 flex-row items-center gap-3 active:opacity-70"
      style={{ borderCurve: 'continuous' }}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${MODULE_COLOR}12` }}
      >
        <LayoutTemplate size={18} color={MODULE_COLOR} />
      </View>
      <View className="flex-1 gap-1" style={{ minWidth: 0 }}>
        <Text className="text-base font-semibold text-foreground shrink">
          {format.title}
        </Text>
        {format.tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-0.5">
            {format.tags.slice(0, 5).map((tag, idx) => (
              <View key={`${idx}-${tag}`} className="mx-0.5 bg-secondary rounded-full px-2.5 py-1">
                <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <ChevronRight size={18} color="#9CA3AF" />
    </Pressable>
  );
}

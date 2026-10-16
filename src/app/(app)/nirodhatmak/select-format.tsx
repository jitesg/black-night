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
import { logger } from '@/lib/logger';
import {
  ActivityIndicator, FlatList, Pressable, ScrollView,
  Text, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  FileWarning, LayoutTemplate, ChevronRight,
} from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import {
  type FormatWithMeta,
} from '@/lib/db/predefinedFormatRepo';
import { getPublishedFormatsByType, searchPublishedFormatsByTypes } from '@/lib/db/sysFormatRepo';
import { nirodhatmakFormatBridge } from '@/lib/nirodhatmakFormatBridge';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const MODULE_COLOR = '#DC2626';
const NK_FORMAT_TYPE = 'BNSS Karyavahi' as const;

// ─── Format Selection Screen ───────────────────────────────────────────────
export default function NkSelectFormatScreen() {
  // Accept the proceeding type passed from add-proceeding to pre-populate search
  const { type: initialTypeQuery } = useLocalSearchParams<{ type?: string }>();

  const [formats, setFormats] = useState<FormatWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(initialTypeQuery || '');

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
      const results = q.trim()
        ? await searchPublishedFormatsByTypes(q, [NK_FORMAT_TYPE])
        : await getPublishedFormatsByType(NK_FORMAT_TYPE);
      setFormats(results);
    } catch (e) {
      logger.warn('[NkSelectFormat] load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

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
      <AppHeader title="Select Format" subtitle="Nirodhatmak" showBack />
      <View className="px-4 pt-3 pb-2 gap-2 border-b border-border bg-background">
        {/* Search */}
        <SearchBar
          value={query}
          onChangeText={handleSearch}
          placeholder="Search BNSS Karyavahi formats…"
          variant="light"
          returnKeyType="search"
          accessibilityLabel="Search nirodhatmak formats"
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
          contentContainerClassName="px-6 py-4 gap-3 pb-12"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          renderItem={({ item }) => (
            <FormatRow
              format={item}
              onPress={() =>
                router.push(
                  `/(app)/formats/fill?formatId=${item.id}&callingModule=NK` as never
                )
              }
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
                {query.trim()
                  ? 'No formats found'
                  : 'No BNSS Karyavahi formats available'}
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                {query.trim()
                  ? 'Try a different search term.'
                  : 'Create a format with type "BNSS Karyavahi" in the Predefine Format module first.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Row component ────────────────────────────────────────────────────────
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
              <View key={`${idx}-${tag}`} className="mx-0.5 bg-secondary rounded-full px-2 py-0.5">
                <Text className="text-xs text-muted-foreground">{tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <ChevronRight size={18} color="#9CA3AF" />
    </Pressable>
  );
}

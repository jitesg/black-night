import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, FlatList, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { ChevronRight, ArrowRight } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { THEME } from '@/lib/theme';
import {
  ACTS, getSections, parseBareSectionNumber, parseSectionRef, type ActId, type SectionItem,
} from '@/lib/law/lawLibrary';
import { getSimple, hasSimple } from '@/lib/law/simpleExplain';
import { matchesQuery } from '@/lib/searchUtils';

export default function LawActSectionsScreen() {
  const params = useLocalSearchParams<{ act: string }>();
  const actParam = (params.act?.toUpperCase() || 'BNS') as ActId;
  const actId: ActId = (actParam in ACTS) ? actParam : 'BNS';
  const meta = ACTS[actId];

  const { t, i18n } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isHi = i18n.language === 'hi';

  const [filterText, setFilterText] = useState('');
  const [jumpNumber, setJumpNumber] = useState('');

  const allSections = useMemo(() => getSections(actId), [actId]);

  const filteredSections = useMemo(() => {
    const raw = filterText.trim();
    if (!raw) return allSections;

    // A section number, with or without "धारा" / "section" / this Act's name:
    // "103", "धारा 103", "BNS 103", "103(1)", "धारा १०३".
    const ref = parseSectionRef(raw);
    const num = ref && ref.act === actId ? ref.n : ref ? null : parseBareSectionNumber(raw);
    if (num != null) {
      const q = String(num);
      const exact = allSections.filter((s) => s.n === num);
      const rest = allSections.filter((s) => s.n !== num && String(s.n).startsWith(q));
      return [...exact, ...rest];
    }

    // Words: title (English) + सरल व्याख्या and keywords (Hindi), word-by-word.
    return allSections.filter((s) => {
      const simple = getSimple(actId, s.n);
      return matchesQuery(raw, s.title, simple?.s, (simple?.k ?? []).join(' '));
    });
  }, [allSections, filterText, actId]);

  const handleJump = useCallback(() => {
    const n = parseInt(jumpNumber.trim(), 10);
    if (!isNaN(n) && n >= 1 && n <= meta.total) {
      router.push(`/(app)/knowledge/law/${actId}/${n}` as never);
    }
  }, [jumpNumber, actId, meta.total]);

  const actColor = actId === 'BNS' ? '#1D4ED8' : actId === 'BNSS' ? '#0F766E' : '#B45309';

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={isHi ? meta.nameHi : meta.nameEn}
        subtitle={`${actId} · ${t('knowledge.law.sectionCount', { count: meta.total, defaultValue: `कुल ${meta.total} धाराएं` })}`}
        showBack
      />

      {/* Jump to number + Search filter */}
      <View className="px-4 pt-3 pb-2 border-b border-border bg-background gap-2.5">
        <SearchBar
          value={filterText}
          onChangeText={setFilterText}
          placeholder={t('knowledge.law.searchPlaceholder', 'धारा नंबर या शीर्षक खोजें…')}
          variant="light"
          accessibilityLabel={t('knowledge.law.searchPlaceholder', 'धारा नंबर या शीर्षक खोजें')}
        />

        {/* Jump-to-number input row */}
        <View className="flex-row items-center gap-2">
          <View
            className="flex-1 flex-row items-center bg-card border border-border rounded-xl px-3 h-11"
            style={{ borderCurve: 'continuous' }}
          >
            <Text className="text-xs text-muted-foreground mr-1.5 font-medium">
              {isHi ? 'धारा:' : 'Sec:'}
            </Text>
            <TextInput
              value={jumpNumber}
              onChangeText={setJumpNumber}
              placeholder={`1–${meta.total}`}
              placeholderTextColor={C.mutedForeground}
              keyboardType="number-pad"
              returnKeyType="go"
              onSubmitEditing={handleJump}
              className="flex-1 text-sm text-foreground p-0"
              style={{ height: '100%' }}
            />
          </View>
          <Pressable
            onPress={handleJump}
            disabled={!jumpNumber.trim()}
            className="flex-row items-center justify-center px-4 h-11 rounded-xl bg-primary active:opacity-80"
            style={{
              borderCurve: 'continuous',
              opacity: jumpNumber.trim() ? 1 : 0.5,
              minWidth: 44,
            }}
          >
            <Text className="text-xs font-semibold text-primary-foreground mr-1">
              {t('knowledge.law.jumpBtn', 'देखें')}
            </Text>
            <ArrowRight size={14} color={C.primaryForeground} />
          </Pressable>
        </View>
      </View>

      {/* Section list with virtualization */}
      <FlatList<SectionItem>
        data={filteredSections}
        keyExtractor={(item) => String(item.n)}
        initialNumToRender={20}
        windowSize={7}
        removeClippedSubviews={true}
        contentContainerClassName="px-4 py-3 gap-2 pb-28"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          filterText.trim() ? (
            <Text className="text-xs font-semibold text-muted-foreground mb-1">
              {t('knowledge.resultCount', { count: filteredSections.length, defaultValue: `${filteredSections.length} धाराएं मिलीं` })}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(app)/knowledge/law/${actId}/${item.n}` as never)}
            className="flex-row items-center justify-between p-3.5 bg-card border border-border rounded-2xl active:opacity-70 gap-3"
            style={{ borderCurve: 'continuous', minHeight: 44 }}
          >
            <View className="flex-row items-center gap-3 flex-1" style={{ minWidth: 0 }}>
              <View
                className="w-12 h-12 rounded-xl items-center justify-center pt-0.5"
                style={{ backgroundColor: `${actColor}15`, borderCurve: 'continuous' }}
              >
                <Text className="text-[10px] font-bold uppercase" style={{ color: actColor }}>
                  {actId}
                </Text>
                <Text className="text-sm font-extrabold" style={{ color: actColor }}>
                  {item.n}
                </Text>
              </View>
              <View className="flex-1 gap-1" style={{ minWidth: 0 }}>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[15px] font-semibold text-foreground flex-1 pt-0.5 leading-[21px]" numberOfLines={2}>
                    {item.title}
                  </Text>
                  {hasSimple(actId, item.n) && (
                    <View
                      className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25"
                      style={{ borderCurve: 'continuous' }}
                    >
                      <Text className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        सरल
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <ChevronRight size={18} color={C.mutedForeground} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center py-20 gap-2">
            <Text className="text-base font-semibold text-foreground">
              {t('knowledge.law.noSections', 'कोई धारा नहीं मिली')}
            </Text>
            <Text className="text-sm text-muted-foreground text-center px-8">
              {t('knowledge.noResultsHint', 'अलग कीवर्ड आज़माएं')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

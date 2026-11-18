import { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { ChevronRight } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { THEME } from '@/lib/theme';
import {
  ACTS, getAllOffenceClassification, getSections, parseBareSectionNumber, parseSectionRef, type ActId, type SectionItem,
} from '@/lib/law/lawLibrary';
import { getSimple, hasSimple } from '@/lib/law/simpleExplain';
import { hasDetailedExplain } from '@/lib/law/detailedAnalysis';
import { hasCasesForSection } from '@/lib/law/casesData';
import { getLawNote } from '@/lib/law/lawNotes';
import { classFlagsBySection, passesLawFilters, type SectionFacts } from '@/lib/law/lawFilter';
import {
  ActiveFilterChips, FilterSearchButton, FilterSheet, activeFilterCount, type FilterGroupDef, type FilterValues,
} from '@/components/common/FilterSheet';
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
  // Latest typed text — the keyboard 🔍 / Enter opens a section number directly (owner: one box instead of the old
  // "धारा: ___ देखें" jump row). Kept in a ref: with instant search off, onChangeText and the submit come together.
  const lastQuery = useRef('');

  const allSections = useMemo(() => getSections(actId), [actId]);

  // Filter (owner): सामग्री for every Act + संज्ञेय / जमानतीय for BNS (BNSS First Schedule) — src/lib/law/lawFilter.ts
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [showFilters, setShowFilters] = useState(false);
  const facts = useMemo(() => {
    const cls = actId === 'BNS' ? classFlagsBySection(getAllOffenceClassification()) : null;
    const m = new Map<number, SectionFacts>();
    for (const s of allSections) {
      m.set(s.n, {
        simple: hasSimple(actId, s.n),
        detailed: hasDetailedExplain(actId, s.n) || !!getLawNote(actId, s.n),
        cases: hasCasesForSection(actId, s.n),
        cls: cls?.get(s.n),
      });
    }
    return m;
  }, [actId, allSections]);
  const countOf = useCallback((v: FilterValues) => allSections.filter((s) => passesLawFilters(facts.get(s.n)!, v)).length, [allSections, facts]);
  const filterGroups = useMemo<FilterGroupDef[]>(() => {
    const opt = (key: string, value: string, label: string) => ({ value, label: `${label} (${countOf({ [key]: value })})` });
    const groups: FilterGroupDef[] = [{
      key: 'have', label: 'सामग्री', allCount: allSections.length,
      options: [opt('have', 'simple', 'सरल व्याख्या वाली'), opt('have', 'detailed', 'विस्तृत विश्लेषण वाली'), opt('have', 'cases', 'न्यायिक निर्णय वाली')],
    }];
    if (actId === 'BNS') {
      groups.push(
        { key: 'cog', label: 'संज्ञेय / असंज्ञेय', allCount: allSections.length, options: [opt('cog', 'cog', 'संज्ञेय'), opt('cog', 'noncog', 'असंज्ञेय')] },
        { key: 'bail', label: 'जमानतीय / अजमानतीय', allCount: allSections.length, options: [opt('bail', 'bail', 'जमानतीय'), opt('bail', 'nonbail', 'अजमानतीय')] },
      );
    }
    return groups;
  }, [actId, allSections.length, countOf]);
  const filtersOn = activeFilterCount(filterValues, filterGroups) > 0;

  const filteredSections = useMemo(() => {
    const raw = filterText.trim();
    const base = filtersOn ? allSections.filter((s) => passesLawFilters(facts.get(s.n)!, filterValues)) : allSections;
    if (!raw) return base;

    // A section number, with or without "धारा" / "section" / this Act's name:
    // "103", "धारा 103", "BNS 103", "103(1)", "धारा १०३".
    const ref = parseSectionRef(raw);
    const num = ref && ref.act === actId ? ref.n : ref ? null : parseBareSectionNumber(raw);
    if (num != null) {
      const q = String(num);
      const exact = base.filter((s) => s.n === num);
      const rest = base.filter((s) => s.n !== num && String(s.n).startsWith(q));
      return [...exact, ...rest];
    }

    // Words: title (English) + सरल व्याख्या and keywords (Hindi), word-by-word.
    return base.filter((s) => {
      const simple = getSimple(actId, s.n);
      return matchesQuery(raw, s.title, simple?.s, (simple?.k ?? []).join(' '));
    });
  }, [allSections, filterText, actId, filtersOn, facts, filterValues]);

  /** The typed text as a section number of this Act that exists, else null. */
  const sectionOf = useCallback((text: string): number | null => {
    const raw = text.trim();
    if (!raw) return null;
    const ref = parseSectionRef(raw);
    const n = ref ? (ref.act === actId ? ref.n : null) : parseBareSectionNumber(raw);
    return n != null && allSections.some((s) => s.n === n) ? n : null;
  }, [actId, allSections]);
  const openSection = useCallback((n: number) => router.push(`/(app)/knowledge/law/${actId}/${n}` as never), [actId]);
  const handleSubmit = useCallback(() => {
    const n = sectionOf(lastQuery.current);
    if (n != null) openSection(n);
  }, [sectionOf, openSection]);
  const typedSection = sectionOf(filterText);

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
          onChangeText={(q) => { lastQuery.current = q; setFilterText(q); }}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          placeholder={t('knowledge.law.actSearchPlaceholder', 'धारा नंबर या शब्द खोजें…')}
          variant="light"
          accessibilityLabel={t('knowledge.law.actSearchPlaceholder', 'धारा नंबर या शब्द खोजें')}
          trailing={<FilterSearchButton count={activeFilterCount(filterValues, filterGroups)} onPress={() => setShowFilters(true)} accent={actColor} />}
        />
        <ActiveFilterChips groups={filterGroups} values={filterValues} onRemove={(k) => setFilterValues((v) => ({ ...v, [k]: null }))} accent={actColor} />
        {/* A number typed → one tap opens that section (replaces the old "धारा: ___ देखें" row) */}
        {typedSection != null ? (
          <Pressable
            onPress={() => openSection(typedSection)}
            accessibilityRole="button"
            className="flex-row items-center justify-between rounded-xl px-3.5 h-11 active:opacity-80"
            style={{ backgroundColor: `${actColor}14`, borderWidth: 1, borderColor: `${actColor}55`, borderCurve: 'continuous' }}
          >
            <Text className="text-sm font-semibold" style={{ color: actColor }}>
              {isHi ? `${actId} धारा ${typedSection} सीधे खोलें` : `Open ${actId} section ${typedSection}`}
            </Text>
            <ChevronRight size={18} color={actColor} />
          </Pressable>
        ) : null}
      </View>

      {/* Section list with virtualization */}
      <FlatList<SectionItem> keyboardShouldPersistTaps="handled"
        data={filteredSections}
        keyExtractor={(item) => String(item.n)}
        initialNumToRender={20}
        windowSize={7}
        removeClippedSubviews={true}
        contentContainerClassName="px-4 py-3 gap-2 pb-28"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          filterText.trim() || filtersOn ? (
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
      <FilterSheet
        visible={showFilters}
        groups={filterGroups}
        values={filterValues}
        onApply={(v) => { setFilterValues(v); setShowFilters(false); }}
        onClose={() => setShowFilters(false)}
        accent={actColor}
        previewCount={countOf}
      />
    </View>
  );
}

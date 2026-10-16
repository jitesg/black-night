import { useState, useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator, Keyboard, Pressable, SectionList, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  BookOpen, Home, User, Church, Building2, ShoppingBag, Search, Clock, X,
} from 'lucide-react-native';
import { SearchBar } from '@/components/SearchBar';
import { HighlightText } from '@/components/HighlightText';
import { scoredFuzzyMatch } from '@/lib/searchUtils';
import {
  globalSearch, getAutocompleteSuggestions, getSmartSuggestions,
  type SearchResult,
} from '@/lib/db/searchRepo';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useSearchHistory } from '@/hooks/useSearchHistory';

const TYPE_CONFIG: Record<
  SearchResult['type'],
  { icon: React.ComponentType<{ size: number; color: string }>; color: string; label: string }
> = {
  gram_panchayat: { icon: BookOpen,    color: '#2D52B8', label: 'Gram Panchayat' },
  hamlet:         { icon: Home,        color: '#7C3AED', label: 'Hamlet'          },
  person:         { icon: User,        color: '#0891B2', label: 'Person'          },
  religious_place:{ icon: Church,      color: '#DC2626', label: 'Religious Place' },
  institution:    { icon: Building2,   color: '#16a34a', label: 'Institution'     },
  liquor_shop:    { icon: ShoppingBag, color: '#D97706', label: 'Liquor Shop'     },
};

function ResultItem({ item, query, highlight, typoTolerant }: { item: SearchResult; query: string; highlight: boolean; typoTolerant?: boolean }) {
  const cfg = TYPE_CONFIG[item.type];
  const Icon = cfg.icon;

  const handlePress = () => {
    if (item.type === 'gram_panchayat') {
      router.push(`/(app)/halka/${item.id}` as never);
    } else if (item.gp_id) {
      router.push(`/(app)/halka/${item.gp_id}` as never);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-4 py-4 border-b border-border active:opacity-70"
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${cfg.color}15` }}
      >
        <Icon size={18} color={cfg.color} />
      </View>
      <View className="flex-1">
        {highlight ? (
          <HighlightText
            text={item.title}
            query={query}
            style={{ fontSize: 14, fontWeight: '600' }}
            numberOfLines={1}
            typoTolerant={typoTolerant}
          />
        ) : (
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{item.title}</Text>
        )}
        {item.subtitle ? (
          <Text className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</Text>
        ) : null}
      </View>
      <View
        className="rounded-full px-2 py-0.5"
        style={{ backgroundColor: `${cfg.color}15` }}
      >
        <Text className="text-xs font-medium" style={{ color: cfg.color }}>
          {cfg.label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const { settings } = useSettingsStore();
  const { history, addToHistory, clearHistory } = useSearchHistory();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // Autocomplete suggestions (shown while typing, before submit)
  const [autoSuggestions, setAutoSuggestions] = useState<
    { id: string; title: string; type: SearchResult['type'] }[]
  >([]);

  // Smart suggestions (shown when query is empty)
  const [smartSuggestions, setSmartSuggestions] = useState<SearchResult[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load smart suggestions once on focus (recency heuristic, not ML)
  useFocusEffect(useCallback(() => {
    if (!settings.smartSuggestions) return;
    (async () => {
      const suggestions = await getSmartSuggestions(5);
      setSmartSuggestions(suggestions);
    })();
  }, [settings.smartSuggestions]));

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setAutoSuggestions([]); // hide autocomplete once search fires
    const res = await globalSearch(
      q,
      settings.typoTolerance ? { typoTolerance: true } : undefined,
    );
    setResults(res);
    setSearched(true);
    setLoading(false);
  }, [settings.typoTolerance]);

  const handleChange = (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      setSearched(false);
      setAutoSuggestions([]);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (autoRef.current) clearTimeout(autoRef.current);
      return;
    }

    // Autocomplete: show suggestions while typing (>= 2 chars, before submit)
    if (settings.autocomplete && text.trim().length >= 2) {
      if (autoRef.current) clearTimeout(autoRef.current);
      autoRef.current = setTimeout(async () => {
        const suggestions = await getAutocompleteSuggestions(text.trim());
        setAutoSuggestions(suggestions);
      }, 150);
    } else {
      setAutoSuggestions([]);
    }

    // instantSearch: debounce search on every keystroke
    if (settings.instantSearch) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runSearch(text), 250);
    }
  };

  const handleSubmit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (autoRef.current) clearTimeout(autoRef.current);
    setAutoSuggestions([]);
    runSearch(query);
    if (settings.searchHistory) addToHistory(query);
    Keyboard.dismiss();
  };

  const handleHistoryTap = (q: string) => {
    setQuery(q);
    runSearch(q);
    Keyboard.dismiss();
  };

  const handleAutocompleteTap = (title: string) => {
    setQuery(title);
    setAutoSuggestions([]);
    if (autoRef.current) clearTimeout(autoRef.current);
    runSearch(title);
    if (settings.searchHistory) addToHistory(title);
    Keyboard.dismiss();
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setAutoSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (autoRef.current) clearTimeout(autoRef.current);
  };

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = TYPE_CONFIG[r.type].label;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const sections: { title: string; data: SearchResult[] }[] = Object.entries(grouped).map(
    ([title, data]) => ({ title, data })
  );

  // predictiveSearch: show smart suggestions when query is 1–2 chars and no full results yet
  const predictiveCandidates = useMemo(() => {
    if (
      !settings.predictiveSearch ||
      query.trim().length < 1 ||
      query.trim().length > 2 ||
      searched
    ) {
      return [];
    }
    const trimmed = query.trim();
    return smartSuggestions
      .map((s) => ({ item: s, match: scoredFuzzyMatch(trimmed, `${s.title} ${s.subtitle ?? ''}`) }))
      .filter(({ match }) => match.matched)
      .sort((a, b) => b.match.score - a.match.score)
      .map(({ item }) => item);
  }, [settings.predictiveSearch, query, searched, smartSuggestions]);

  const showPredictive = predictiveCandidates.length > 0;

  // searchHistory: show recent queries when input is empty and focused
  const showHistory =
    settings.searchHistory &&
    inputFocused &&
    !query.trim() &&
    history.length > 0;

  // smartSuggestions chip row: when query is empty and not showing history
  const showSmartChips =
    settings.smartSuggestions &&
    !query.trim() &&
    !showHistory &&
    smartSuggestions.length > 0;

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Search" showBack />

      {/* Search bar */}
      <View className="px-6 py-4">
        <SearchBar
          value={query}
          onChangeText={handleChange}
          onSubmitEditing={handleSubmit}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Search GPs, hamlets, persons, places…"
          variant="light"
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Search halka records"
        />

        {/* Quick filter chips */}
        <View className="flex-row flex-wrap gap-2 mt-3">
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
            const Icon = cfg.icon;
            return (
              <Pressable
                key={type}
                onPress={() => { setQuery(cfg.label); runSearch(cfg.label); Keyboard.dismiss(); }}
                className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 border border-border bg-card active:opacity-70"
              >
                <Icon size={12} color={cfg.color} />
                <Text className="text-xs text-foreground">{cfg.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Autocomplete dropdown */}
      {autoSuggestions.length > 0 && (
        <View className="mx-6 mb-2 bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
          {autoSuggestions.map((s) => {
            const cfg = TYPE_CONFIG[s.type];
            return (
              <Pressable
                key={`${s.type}-${s.id}`}
                onPress={() => handleAutocompleteTap(s.title)}
                className="flex-row items-center gap-3 px-4 py-3 border-b border-border active:bg-secondary"
              >
                <Search size={13} color="#9CA3AF" />
                <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>{s.title}</Text>
                <Text className="text-xs text-muted-foreground">{cfg.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Recent search history */}
      {showHistory && (
        <View className="mx-6 mb-2 bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
          <View className="flex-row items-center justify-between px-4 py-2 border-b border-border">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recent</Text>
            <Pressable onPress={clearHistory} className="active:opacity-70">
              <Text className="text-xs text-muted-foreground">Clear</Text>
            </Pressable>
          </View>
          {history.map((q, i) => (
            <Pressable
              key={i}
              onPress={() => handleHistoryTap(q)}
              className="flex-row items-center gap-3 px-4 py-3 border-b border-border active:bg-secondary"
            >
              <Clock size={13} color="#9CA3AF" />
              <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>{q}</Text>
              <Pressable
                onPress={() => { /* individual removal not supported — clear all */ }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={12} color="#9CA3AF" />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}

      {/* Smart suggestions chip row (empty query) */}
      {showSmartChips && (
        <View className="px-6 mb-2">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Suggested
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {smartSuggestions.map((s) => {
              const cfg = TYPE_CONFIG[s.type];
              return (
                <Pressable
                  key={`smart-${s.id}`}
                  onPress={() => { setQuery(s.title); runSearch(s.title); }}
                  className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 border border-border bg-card active:opacity-70"
                >
                  <Text className="text-xs font-medium" style={{ color: cfg.color }}>{s.title}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Predictive suggestions (query length 1–2, before full search) */}
      {showPredictive && (
        <View className="px-6 mb-2">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Suggested for you
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {predictiveCandidates.map((s) => {
              const cfg = TYPE_CONFIG[s.type];
              return (
                <Pressable
                  key={`pred-${s.id}`}
                  onPress={() => { setQuery(s.title); runSearch(s.title); }}
                  className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 border border-border bg-card active:opacity-70"
                >
                  <Text className="text-xs font-medium" style={{ color: cfg.color }}>{s.title}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Results */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2D52B8" />
        </View>
      ) : searched && results.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <View className="w-14 h-14 rounded-2xl bg-secondary items-center justify-center">
            <Search size={24} color="#9CA3AF" />
          </View>
          <Text className="text-base font-semibold text-foreground">No results found</Text>
          <Text className="text-sm text-muted-foreground text-center leading-6">
            Try a different search term or browse by category above
          </Text>
        </View>
      ) : !searched ? (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <View className="w-14 h-14 rounded-2xl bg-secondary items-center justify-center">
            <Search size={24} color="#9CA3AF" />
          </View>
          <Text className="text-sm text-muted-foreground text-center leading-6">
            Search across all Gram Panchayats, hamlets, persons, religious places, institutions, and liquor shops
          </Text>
        </View>
      ) : (
        <SectionList
          removeClippedSubviews={true}
          sections={sections}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerClassName="px-6 pb-8"
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-widest py-3">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </Text>
          }
          renderSectionHeader={({ section: { title } }) => (
            <View className="pt-4 pb-1 bg-background">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ResultItem item={item} query={query} highlight={settings.highlightMatches} typoTolerant={settings.typoTolerance} />
          )}
        />
      )}
    </View>
  );
}

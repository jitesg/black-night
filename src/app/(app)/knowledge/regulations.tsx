/**
 * Regulations hub (Tasks L35 / L36). One screen per Act, opened from its
 * card in the Law library (?act=uppr | ?act=pocso).
 *  - UP Regulations: भाग (I–IV) → अध्याय → पैरा
 *  - POCSO: अध्याय (I–IX) → धारा, warning card, quick cards
 * Search by number / title / tags, "सिर्फ़ हिंदी तैयार" filter and
 * Hindi-ready progress from the sidecar.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, ChevronDown, ChevronRight, CheckCircle2, BookOpen, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { THEME } from '@/lib/theme';
import { getRegulationRows } from '@/lib/db/knowledgeRepo';
import { getRegChapters, getRegIndex, getRegOrder, getRegProgress } from '@/lib/regulations/regIndex';
import {
  ACT_META, canonNo, searchParas, type RegAct, type RegPara, type RegSearchItem,
} from '@/lib/regulations/regCore';

type Theme = (typeof THEME)['light'];

interface ParaItem extends RegSearchItem {
  para: RegPara;
  available: boolean;
}

type ListRow =
  | { kind: 'part'; key: string; part: string; count: number; done: number; open: boolean }
  | { kind: 'chapter'; key: string; ch: string; title: string; count: number; done: number; open: boolean }
  | { kind: 'para'; key: string; item: ParaItem };

const PART_ORDER = ['I', 'II', 'III', 'IV'];
const PART_LABEL: Record<string, string> = { I: 'भाग I', II: 'भाग II', III: 'भाग III', IV: 'भाग IV' };

const POCSO_WARNING =
  "⚠ यह पाठ 2012/2013 का मूल पाठ है। 2019 संशोधन (कठोर सजाएँ, मृत्युदंड) और POCSO Rules 2020 के लिए हर धारा में '⚠ अद्यतन' पंक्ति देखें। न्यायालय में उपयोग से पहले India Code का नवीनतम पाठ देखें।";
const POCSO_WARN_KEY = 'reg.pocsoWarningSeen';

const POCSO_QUICK: { key: string; label: string; nos: string[] }[] = [
  { key: 'fir', label: 'FIR/रिपोर्टिंग (धारा 19)', nos: ['19'] },
  { key: 'stmt', label: 'बयान (24–26)', nos: ['24', '25', '26'] },
  { key: 'med', label: 'मेडिकल (27)', nos: ['27'] },
  { key: 'court', label: 'विशेष न्यायालय (28–38)', nos: ['28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38'] },
  { key: 'pun', label: 'सज़ाएँ (4,6,8,10,12,14,15)', nos: ['4', '6', '8', '10', '12', '14', '15'] },
];

/** "UPPR पैरा 97 — title" / "POCSO धारा 6 — title" → "title" */
function shortTitle(rowTitle: string | undefined, fallback: string): string {
  if (!rowTitle) return fallback;
  return rowTitle.replace(/^(UPPR\s*पैरा|POCSO\s*धारा)\s*[\w-]+\s*[—-]\s*/i, '').trim() || fallback;
}

const ParaRow = memo(function ParaRow({ item, c, unit }: { item: ParaItem; c: Theme; unit: string }) {
  const done = item.para.done;
  return (
    <Pressable
      disabled={!item.available}
      onPress={() => router.push(`/(app)/knowledge/${item.id}` as never)}
      style={({ pressed }) => ({
        minHeight: 56, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 6,
        borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
        flexDirection: 'row', alignItems: 'center', gap: 10,
        opacity: !item.available ? 0.5 : pressed ? 0.7 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={`${unit} ${item.no} ${item.title}`}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} textBreakStrategy="simple" style={{ color: c.foreground, fontSize: 14.5, lineHeight: 20 }}>
          <Text style={{ fontWeight: '800' }}>{unit} {item.no}</Text>
          <Text style={{ color: c.mutedForeground }}> · </Text>
          {item.title}
        </Text>
      </View>
      {!item.available ? (
        <Text style={{ color: c.mutedForeground, fontSize: 11, fontWeight: '600' }}>जल्द उपलब्ध</Text>
      ) : done ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 24, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#16A34A1F' }}>
          <CheckCircle2 size={11} color="#16A34A" />
          <Text textBreakStrategy="simple" style={{ color: '#16A34A', fontSize: 11, fontWeight: '700' }}>हिंदी तैयार</Text>
        </View>
      ) : (
        <View style={{ height: 24, paddingHorizontal: 8, borderRadius: 999, backgroundColor: c.secondary, justifyContent: 'center' }}>
          <Text textBreakStrategy="simple" style={{ color: c.mutedForeground, fontSize: 11, fontWeight: '600' }}>केवल मूल पाठ</Text>
        </View>
      )}
    </Pressable>
  );
});

export default function RegulationsHubScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = THEME[colorScheme ?? 'light'];
  const params = useLocalSearchParams<{ act?: string }>();

  // Which Act this screen lists (opened from its own card in the Law library).
  const act: RegAct = params.act === 'pocso' ? 'pocso' : 'uppr';
  const [rows, setRows] = useState<Map<string, { title: string; tags: string }>>(new Map());
  const [query, setQuery] = useState('');
  const [onlyReady, setOnlyReady] = useState(false);
  const [openParts, setOpenParts] = useState<Set<string>>(new Set());
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [quick, setQuick] = useState<string | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getRegulationRows()
      .then((list) => {
        if (alive) setRows(new Map(list.map((r) => [r.id, { title: r.title, tags: r.tags }])));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // POCSO warning: open the first time it is shown, collapsed afterwards.
  useEffect(() => {
    if (act !== 'pocso') return;
    AsyncStorage.getItem(POCSO_WARN_KEY)
      .then((v) => {
        if (!v) {
          setWarnOpen(true);
          AsyncStorage.setItem(POCSO_WARN_KEY, '1').catch(() => {});
        }
      })
      .catch(() => setWarnOpen(true));
  }, [act]);

  const index = getRegIndex();
  const prog = getRegProgress(act);
  const meta = ACT_META[act];

  // All rows of the selected Act in reading order, joined with the knowledge rows we have.
  const allItems = useMemo<ParaItem[]>(() => {
    if (!index) return [];
    return getRegOrder(act).map((id) => {
      const p = index.paras[id];
      const row = rows.get(id);
      return {
        id, no: p.no, para: p, available: !!row,
        title: shortTitle(row?.title, p.t), en: p.en, tags: row?.tags ?? '',
      };
    });
  }, [index, rows, act]);

  const filtered = useMemo(() => (onlyReady ? allItems.filter((x) => x.para.done) : allItems), [allItems, onlyReady]);

  const listRows = useMemo<ListRow[]>(() => {
    const q = query.trim();
    if (q) {
      return searchParas(filtered, q, 80).map((item) => ({ kind: 'para' as const, key: item.id, item: item as ParaItem }));
    }
    if (act === 'pocso' && quick) {
      const wanted = new Set(POCSO_QUICK.find((x) => x.key === quick)?.nos.map(canonNo) ?? []);
      return filtered.filter((x) => wanted.has(canonNo(x.no))).map((item) => ({ kind: 'para' as const, key: item.id, item }));
    }
    const out: ListRow[] = [];
    const chapters = getRegChapters(act);
    const pushChapters = (items: ParaItem[], part: string) => {
      for (const ch of chapters.filter((x) => x.part === part)) {
        const inCh = items.filter((x) => x.para.ch === ch.ch);
        if (inCh.length === 0) continue;
        const chKey = `${part}-${ch.ch}`;
        const chOpen = openChapters.has(chKey);
        out.push({ kind: 'chapter', key: `c-${chKey}`, ch: ch.ch, title: ch.t, count: inCh.length, done: inCh.filter((x) => x.para.done).length, open: chOpen });
        if (chOpen) for (const item of inCh) out.push({ kind: 'para', key: item.id, item });
      }
    };
    if (act === 'pocso') {
      pushChapters(filtered, 'POCSO');
      return out;
    }
    for (const part of PART_ORDER) {
      const inPart = filtered.filter((x) => x.para.part === part);
      if (inPart.length === 0) continue;
      const partOpen = openParts.has(part);
      out.push({ kind: 'part', key: `p-${part}`, part, count: inPart.length, done: inPart.filter((x) => x.para.done).length, open: partOpen });
      if (partOpen) pushChapters(inPart, part);
    }
    return out;
  }, [filtered, query, openParts, openChapters, act, quick]);

  const toggle = useCallback((set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    set((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const renderItem = useCallback(({ item: row }: { item: ListRow }) => {
    if (row.kind === 'para') return <ParaRow item={row.item} c={c} unit={meta.unit} />;
    const isPart = row.kind === 'part';
    const Icon = row.open ? ChevronDown : ChevronRight;
    const indented = !isPart && act === 'uppr';
    return (
      <Pressable
        onPress={() => (isPart ? toggle(setOpenParts, row.part) : toggle(setOpenChapters, row.key.slice(2)))}
        style={({ pressed }) => ({
          minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingVertical: 10, paddingHorizontal: isPart ? 14 : 12, marginBottom: 8,
          marginLeft: indented ? 10 : 0, borderRadius: 14,
          backgroundColor: isPart ? (isDark ? '#1E293B' : '#EEF2FF') : c.secondary,
          opacity: pressed ? 0.75 : 1,
        })}
        accessibilityRole="button"
      >
        <Icon size={18} color={c.foreground} />
        <Text textBreakStrategy="simple" numberOfLines={2} style={{ flex: 1, color: c.foreground, fontSize: isPart ? 15.5 : 14, fontWeight: isPart ? '800' : '700' }}>
          {isPart ? PART_LABEL[row.part] : `अध्याय ${row.ch} — ${row.title}`}
        </Text>
        <Text style={{ color: c.mutedForeground, fontSize: 12, fontWeight: '600' }}>
          {row.done > 0 ? `✓${row.done} · ` : ''}{row.count}
        </Text>
      </Pressable>
    );
  }, [c, isDark, toggle, meta.unit, act]);



  const pocsoHeader = act === 'pocso' && !query.trim() ? (
    <View style={{ marginBottom: 12, gap: 10 }}>
      <Pressable
        onPress={() => setWarnOpen((v) => !v)}
        accessibilityRole="button"
        style={{
          padding: 14, borderRadius: 16, borderWidth: 1,
          backgroundColor: isDark ? '#78350F55' : '#FEF3C7', borderColor: isDark ? '#F59E0B66' : '#FCD34D',
          flexDirection: 'row', gap: 10,
        }}
      >
        <AlertTriangle size={18} color={isDark ? '#FCD34D' : '#B45309'} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: isDark ? '#FCD34D' : '#92400E', fontWeight: '800', fontSize: 13.5 }}>
            ज़रूरी सूचना — 2019 संशोधन {warnOpen ? '' : '(टैप करके पढ़ें)'}
          </Text>
          {warnOpen ? (
            <Text textBreakStrategy="simple" style={{ color: isDark ? '#FDE68A' : '#78350F', fontSize: 13.5, lineHeight: 21, marginTop: 4 }}>
              {POCSO_WARNING}
            </Text>
          ) : null}
        </View>
        {warnOpen ? <ChevronDown size={18} color={isDark ? '#FCD34D' : '#B45309'} /> : <ChevronRight size={18} color={isDark ? '#FCD34D' : '#B45309'} />}
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {POCSO_QUICK.map((q) => {
          const active = quick === q.key;
          return (
            <Pressable
              key={q.key}
              onPress={() => setQuick(active ? null : q.key)}
              style={{
                minHeight: 44, paddingHorizontal: 14, borderRadius: 14, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: active ? c.primary : c.card, borderWidth: 1, borderColor: active ? c.primary : c.border,
              }}
            >
              <Text textBreakStrategy="simple" style={{ color: active ? c.primaryForeground : c.foreground, fontWeight: '700', fontSize: 13 }}>{q.label}</Text>
              {active ? <X size={14} color={c.primaryForeground} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  ) : null;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={meta.name}
        subtitle={`${prog.total} ${act === 'pocso' ? 'धाराएँ' : 'पैरा'} · हिंदी तैयार: ${prog.done} / ${prog.total}`}
        showBack
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={act === 'pocso' ? 'धारा नंबर या शब्द (6, धारा 19, 42A, रिपोर्टिंग…)' : 'पैरा नंबर या शब्द (97, पैरा 154, मालखाना…)'}
          variant="light"
          returnKeyType="search"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => setOnlyReady((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: onlyReady }}
            style={{
              height: 36, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: onlyReady ? '#16A34A' : c.secondary,
            }}
          >
            <CheckCircle2 size={14} color={onlyReady ? '#fff' : c.secondaryForeground} />
            <Text textBreakStrategy="simple" style={{ color: onlyReady ? '#fff' : c.secondaryForeground, fontWeight: '700', fontSize: 13 }}>
              सिर्फ़ हिंदी तैयार
            </Text>
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'right', color: c.mutedForeground, fontSize: 12 }}>
            {allItems.filter((x) => x.available).length} {act === 'pocso' ? 'धाराएँ' : 'पैरा'} ऐप में उपलब्ध
          </Text>
        </View>
      </View>

      {!index ? (
        <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
          <BookOpen size={28} color={c.mutedForeground} />
          <Text style={{ color: c.mutedForeground }}>Regulations डेटा लोड नहीं हो सका।</Text>
        </View>
      ) : (
        <FlatList
          data={listRows}
          keyExtractor={(r) => r.key}
          renderItem={renderItem}
          ListHeaderComponent={pocsoHeader}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={11}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={{ color: c.mutedForeground, textAlign: 'center', marginTop: 32 }}>कुछ नहीं मिला</Text>
          }
        />
      )}
    </View>
  );
}

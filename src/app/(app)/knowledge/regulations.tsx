/**
 * UP Police Regulations hub (Task L35).
 * भाग (I–IV) → अध्याय → पैरा, search by number / title / tags,
 * "सिर्फ़ हिंदी तैयार" filter and Hindi-ready progress from the sidecar.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronDown, ChevronRight, CheckCircle2, BookOpen } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { THEME } from '@/lib/theme';
import { getRegulationRows } from '@/lib/db/knowledgeRepo';
import { getRegChapters, getRegIndex, getRegProgress } from '@/lib/regulations/regIndex';
import { searchParas, type RegPara, type RegSearchItem } from '@/lib/regulations/regCore';

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

/** "UPPR पैरा 97 — title" → "title" */
function shortTitle(rowTitle: string | undefined, fallback: string): string {
  if (!rowTitle) return fallback;
  return rowTitle.replace(/^UPPR\s*पैरा\s*[\w-]+\s*[—-]\s*/i, '').trim() || fallback;
}

const ParaRow = memo(function ParaRow({ item, c }: { item: ParaItem; c: Theme }) {
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
      accessibilityLabel={`पैरा ${item.no} ${item.title}`}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} textBreakStrategy="simple" style={{ color: c.foreground, fontSize: 14.5, lineHeight: 20 }}>
          <Text style={{ fontWeight: '800' }}>पैरा {item.no}</Text>
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
  const c = THEME[colorScheme ?? 'light'];

  const [rows, setRows] = useState<Map<string, { title: string; tags: string }>>(new Map());
  const [query, setQuery] = useState('');
  const [onlyReady, setOnlyReady] = useState(false);
  const [openParts, setOpenParts] = useState<Set<string>>(new Set());
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    getRegulationRows()
      .then((list) => {
        if (alive) setRows(new Map(list.map((r) => [r.id, { title: r.title, tags: r.tags }])));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const index = getRegIndex();
  const prog = getRegProgress();

  // All paragraphs in book order, joined with the knowledge rows we have.
  const allItems = useMemo<ParaItem[]>(() => {
    if (!index) return [];
    return Object.entries(index.paras).map(([id, p]) => {
      const row = rows.get(id);
      return {
        id, no: p.no, para: p, available: !!row,
        title: shortTitle(row?.title, p.t), en: p.en, tags: row?.tags ?? '',
      };
    });
  }, [index, rows]);

  const filtered = useMemo(() => (onlyReady ? allItems.filter((x) => x.para.done) : allItems), [allItems, onlyReady]);

  const listRows = useMemo<ListRow[]>(() => {
    const q = query.trim();
    if (q) {
      return searchParas(filtered, q, 80).map((item) => ({ kind: 'para' as const, key: item.id, item: item as ParaItem }));
    }
    const out: ListRow[] = [];
    const chapters = getRegChapters();
    for (const part of PART_ORDER) {
      const inPart = filtered.filter((x) => x.para.part === part);
      if (inPart.length === 0) continue;
      const partOpen = openParts.has(part);
      out.push({ kind: 'part', key: `p-${part}`, part, count: inPart.length, done: inPart.filter((x) => x.para.done).length, open: partOpen });
      if (!partOpen) continue;
      for (const ch of chapters.filter((x) => x.part === part)) {
        const inCh = inPart.filter((x) => x.para.ch === ch.ch);
        if (inCh.length === 0) continue;
        const chKey = `${part}-${ch.ch}`;
        const chOpen = openChapters.has(chKey);
        out.push({ kind: 'chapter', key: `c-${chKey}`, ch: ch.ch, title: ch.t, count: inCh.length, done: inCh.filter((x) => x.para.done).length, open: chOpen });
        if (chOpen) for (const item of inCh) out.push({ kind: 'para', key: item.id, item });
      }
    }
    return out;
  }, [filtered, query, openParts, openChapters]);

  const toggle = useCallback((set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    set((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const renderItem = useCallback(({ item: row }: { item: ListRow }) => {
    if (row.kind === 'para') return <ParaRow item={row.item} c={c} />;
    const isPart = row.kind === 'part';
    const Icon = row.open ? ChevronDown : ChevronRight;
    return (
      <Pressable
        onPress={() => (isPart ? toggle(setOpenParts, row.part) : toggle(setOpenChapters, row.key.slice(2)))}
        style={({ pressed }) => ({
          minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingVertical: 10, paddingHorizontal: isPart ? 14 : 12, marginBottom: 8,
          marginLeft: isPart ? 0 : 10, borderRadius: 14,
          backgroundColor: isPart ? (colorScheme === 'dark' ? '#1E293B' : '#EEF2FF') : c.secondary,
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
  }, [c, colorScheme, toggle]);

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="UP Police Regulations"
        subtitle={`${prog.total} पैरा · हिंदी तैयार: ${prog.done} / ${prog.total}`}
        showBack
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="पैरा नंबर या शब्द (97, पैरा 154, मालखाना…)"
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
            {rows.size} पैरा ऐप में उपलब्ध
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
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={11}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={{ color: c.mutedForeground, textAlign: 'center', marginTop: 32 }}>कोई पैरा नहीं मिला</Text>
          }
        />
      )}
    </View>
  );
}

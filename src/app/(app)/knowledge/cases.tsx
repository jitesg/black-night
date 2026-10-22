/**
 * न्यायिक निर्णय (पुलिस) — hub for police case notes (L39).
 * Rows: sys-case-* (content_type 'case_note', cases_seed_*.json);
 * sidecar: assets/reg/cases_index.json (merged into the Regulations index).
 * Cards open the shared 4-tab RegulationViewer.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { AlertTriangle, ChevronDown, ChevronRight, Gavel, ShieldCheck } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { THEME } from '@/lib/theme';
import { getCaseNoteRows } from '@/lib/db/knowledgeRepo';
import { onSeedComplete } from '@/lib/db/seedManager';
import { getRegIndex } from '@/lib/regulations/regIndex';
import {
  CASES_FOOTER_NOTE, CASES_SOURCE_NOTE, buildCaseItems, filterCases, topicOrder,
  type CaseItem, type CaseRowLite, type Court,
} from '@/lib/cases/caseCore';

type Theme = (typeof THEME)['light'];
const ACCENT = '#7C3AED';
const COURT_COLOR: Record<Court, string> = { SC: '#1D4ED8', HC: '#0F766E' };

type ListRow =
  | { kind: 'group'; key: string; topic: string; count: number; open: boolean }
  | { kind: 'case'; key: string; item: CaseItem };

function Chip({ label, active, onPress, c, color = ACCENT }: { label: string; active: boolean; onPress: () => void; c: Theme; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        height: 34, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center',
        backgroundColor: active ? color : c.card, borderWidth: 1, borderColor: active ? color : c.border,
      }}
    >
      <Text textBreakStrategy="simple" numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: active ? '#fff' : c.foreground }}>{label}</Text>
    </Pressable>
  );
}

function FooterNote({ isDark }: { isDark: boolean }) {
  return (
    <View style={{ marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: isDark ? '#78350F55' : '#FEF3C7', flexDirection: 'row', gap: 8 }}>
      <AlertTriangle size={14} color={isDark ? '#FCD34D' : '#B45309'} style={{ marginTop: 2 }} />
      <Text textBreakStrategy="simple" style={{ flex: 1, fontSize: 11.5, lineHeight: 17, color: isDark ? '#FDE68A' : '#92400E' }}>{CASES_FOOTER_NOTE}</Text>
    </View>
  );
}

const CaseCard = memo(function CaseCard({ item, c, isDark }: { item: CaseItem; c: Theme; isDark: boolean }) {
  const court = item.meta.court;
  const subtitle = [item.meta.caseName || item.para?.en, item.meta.citation].filter(Boolean).join(' — ');
  return (
    <Pressable
      disabled={!item.available}
      onPress={() => router.push(`/(app)/knowledge/${item.id}` as never)}
      style={({ pressed }) => ({
        padding: 14, marginBottom: 8, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
        gap: 6, opacity: !item.available ? 0.5 : pressed ? 0.75 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <Text textBreakStrategy="simple" style={{ fontSize: 15, fontWeight: '800', lineHeight: 21, color: c.foreground }}>{item.title}</Text>
      {subtitle ? <Text textBreakStrategy="simple" numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 18, color: c.mutedForeground }}>{subtitle}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {item.available ? (
          <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 999, justifyContent: 'center', backgroundColor: `${COURT_COLOR[court]}1A` }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: COURT_COLOR[court] }}>{court}</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 11, fontWeight: '600', color: c.mutedForeground }}>जल्द उपलब्ध</Text>
        )}
        {item.meta.hasUpdate ? (
          <View style={{ height: 22, paddingHorizontal: 8, borderRadius: 999, justifyContent: 'center', backgroundColor: isDark ? '#78350F66' : '#FEF3C7' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#FDE68A' : '#92400E' }}>⚠ अद्यतन</Text>
          </View>
        ) : null}
        {item.tags.filter((t) => t !== 'न्यायिक निर्णय' && !/Court$/.test(t) && t !== item.meta.caseName && t !== item.topic).slice(0, 3).map((t) => (
          <View key={t} style={{ height: 22, paddingHorizontal: 8, borderRadius: 999, justifyContent: 'center', backgroundColor: c.secondary }}>
            <Text textBreakStrategy="simple" numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: c.secondaryForeground }}>{t}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
});

export default function CasesHubScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = THEME[colorScheme ?? 'light'];
  const [rows, setRows] = useState<CaseRowLite[]>([]);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [court, setCourt] = useState<'all' | Court>('all');
  const [topic, setTopic] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const load = () => getCaseNoteRows().then((r) => { if (alive) setRows(r); }).catch(() => {});
    load();
    const off = onSeedComplete(load);
    return () => { alive = false; off(); };
  }, []);

  // Debounce 250 ms
  useEffect(() => {
    const id = setTimeout(() => setQuery(input), 250);
    return () => clearTimeout(id);
  }, [input]);

  const index = getRegIndex();
  const items = useMemo(() => buildCaseItems(index, rows), [index, rows]);
  const topics = useMemo(() => topicOrder(index, items), [index, items]);
  const filtered = useMemo(
    () => filterCases(items, { query, court, topic, verifiedOnly }),
    [items, query, court, topic, verifiedOnly],
  );
  const inApp = items.filter((x) => x.available).length;

  const listRows = useMemo<ListRow[]>(() => {
    // Searching or one topic chosen → flat list; otherwise collapsible groups.
    if (query.trim() || topic) return filtered.map((item) => ({ kind: 'case' as const, key: item.id, item }));
    const out: ListRow[] = [];
    for (const t of topics) {
      const inT = filtered.filter((x) => x.topic === t);
      if (!inT.length) continue;
      const isOpen = open.has(t);
      out.push({ kind: 'group', key: `g-${t}`, topic: t, count: inT.length, open: isOpen });
      if (isOpen) for (const item of inT) out.push({ kind: 'case', key: item.id, item });
    }
    return out;
  }, [filtered, topics, query, topic, open]);

  const toggle = useCallback((t: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const renderItem = useCallback(({ item: row }: { item: ListRow }) => {
    if (row.kind === 'case') return <CaseCard item={row.item} c={c} isDark={isDark} />;
    const Icon = row.open ? ChevronDown : ChevronRight;
    return (
      <Pressable
        onPress={() => toggle(row.topic)}
        style={({ pressed }) => ({
          minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14,
          marginBottom: 8, borderRadius: 14, backgroundColor: isDark ? '#2E1065' : '#F5F3FF', opacity: pressed ? 0.75 : 1,
        })}
        accessibilityRole="button"
      >
        <Icon size={18} color={c.foreground} />
        <Text textBreakStrategy="simple" numberOfLines={2} style={{ flex: 1, fontSize: 14.5, fontWeight: '800', color: c.foreground }}>{row.topic}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: c.mutedForeground }}>{row.count}</Text>
      </Pressable>
    );
  }, [c, isDark, toggle]);

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="न्यायिक निर्णय" subtitle={`${items.length} निर्णय · ${inApp} ऐप में`} showBack />
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text textBreakStrategy="simple" style={{ fontSize: 11.5, color: c.mutedForeground }}>{CASES_SOURCE_NOTE}</Text>
        <SearchBar
          value={input}
          onChangeText={setInput}
          placeholder="केस का नाम, सिटेशन या शब्द (Basu, गिरफ़्तारी, BNSS 35…)"
          variant="light"
          returnKeyType="search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
          <Chip label="सभी" active={court === 'all'} onPress={() => setCourt('all')} c={c} />
          <Chip label="सुप्रीम कोर्ट" active={court === 'SC'} onPress={() => setCourt('SC')} c={c} color={COURT_COLOR.SC} />
          <Chip label="हाईकोर्ट" active={court === 'HC'} onPress={() => setCourt('HC')} c={c} color={COURT_COLOR.HC} />
          <Pressable
            onPress={() => setVerifiedOnly((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: verifiedOnly }}
            style={{
              height: 34, paddingHorizontal: 12, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: verifiedOnly ? '#16A34A' : c.card, borderWidth: 1, borderColor: verifiedOnly ? '#16A34A' : c.border,
            }}
          >
            <ShieldCheck size={13} color={verifiedOnly ? '#fff' : c.foreground} />
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: verifiedOnly ? '#fff' : c.foreground }}>सत्यापित</Text>
          </Pressable>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
          <Chip label="सभी विषय" active={!topic} onPress={() => setTopic(null)} c={c} />
          {topics.map((t) => <Chip key={t} label={t} active={topic === t} onPress={() => setTopic(topic === t ? null : t)} c={c} />)}
        </ScrollView>
      </View>

      <FlatList
        data={listRows}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={16}
        windowSize={9}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <Gavel size={24} color={c.mutedForeground} />
            <Text style={{ color: c.mutedForeground }}>कोई निर्णय नहीं मिला</Text>
          </View>
        }
        ListFooterComponent={<FooterNote isDark={isDark} />}
      />
    </View>
  );
}

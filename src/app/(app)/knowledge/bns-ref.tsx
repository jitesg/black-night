/**
 * BNS संदर्भ — IPC ↔ BNS finder from the Delhi Police Academy BNS Handbook
 * (Ed. II, May 2024). Data: assets/ref/bns_compare.json (in memory) and the
 * bns_ref knowledge rows (opened in the 4-tab RegulationViewer).
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { BookOpen, Bot, ChevronDown, ChevronRight, FileText, Search, X } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { AICopilotModal } from '@/components/ai/AICopilotModal';
import { THEME } from '@/lib/theme';
import { searchBns, bnsTextFor, getBnsCompare } from '@/lib/bnsRef/bnsCompare';
import { BNS_REF_PINNED, BNSS_KEY_IDS, BNS_REF_SEED_FILE } from '@/lib/bnsRef/bnsRefSeed';
import {
  BNS_SOURCE_NOTE, DEPENDS_LABEL, FLAG_LABEL, annexLabel, clean, flagsDepend, isRemoved, parseFlags, rowTitle,
  baseSec, secTokens, type BnsMode, type BnsRow,
} from '@/lib/bnsRef/bnsCore';

type Theme = (typeof THEME)['light'];
const ACCENT = '#0E7490';
const AMBER_BG = { light: '#FEF3C7', dark: '#78350F55' };
const AMBER_FG = { light: '#92400E', dark: '#FDE68A' };

const MODES: { key: BnsMode; label: string }[] = [
  { key: 'ipc', label: 'IPC → BNS' },
  { key: 'bns', label: 'BNS → IPC' },
  { key: 'title', label: 'शीर्षक' },
];

const FLAG_COLOR: Record<string, string> = { C: '#B91C1C', N: '#15803D', B: '#15803D', NB: '#B91C1C' };

function SourceNote({ isDark }: { isDark: boolean }) {
  return (
    <View style={{ marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: isDark ? AMBER_BG.dark : AMBER_BG.light }}>
      <Text textBreakStrategy="simple" style={{ fontSize: 11.5, lineHeight: 17, color: isDark ? AMBER_FG.dark : AMBER_FG.light }}>
        {BNS_SOURCE_NOTE}
      </Text>
    </View>
  );
}

function FlagChips({ row, c }: { row: BnsRow; c: Theme }) {
  if (isRemoved(row)) return null;
  if (flagsDepend(row)) {
    return (
      <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, height: 24, borderRadius: 999, justifyContent: 'center', backgroundColor: c.secondary }}>
        <Text textBreakStrategy="simple" style={{ fontSize: 11.5, fontWeight: '700', color: c.secondaryForeground }}>{DEPENDS_LABEL}</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {parseFlags(row.fl).map((f) => (
        <View key={f} style={{ paddingHorizontal: 10, height: 24, borderRadius: 999, justifyContent: 'center', backgroundColor: `${FLAG_COLOR[f]}1A` }}>
          <Text textBreakStrategy="simple" style={{ fontSize: 11.5, fontWeight: '700', color: FLAG_COLOR[f] }}>{FLAG_LABEL[f]}</Text>
        </View>
      ))}
    </View>
  );
}

const ResultCard = memo(function ResultCard({ row, c, onPress }: { row: BnsRow; c: Theme; onPress: (r: BnsRow) => void }) {
  const removed = isRemoved(row);
  const h = clean(row.h);
  const p = clean(row.p);
  return (
    <Pressable
      onPress={() => onPress(row)}
      style={({ pressed }) => ({
        padding: 14, marginBottom: 10, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
        gap: 6, opacity: pressed ? 0.75 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={rowTitle(row)}
    >
      <Text textBreakStrategy="simple" style={{ fontSize: 15.5, fontWeight: '800', color: removed ? c.mutedForeground : ACCENT }}>
        {rowTitle(row)}
      </Text>
      {h ? <Text textBreakStrategy="simple" style={{ fontSize: 14, lineHeight: 20, color: c.foreground }}>{h}</Text> : null}
      <FlagChips row={row} c={c} />
      {flagsDepend(row) && !removed && clean(row.st) ? (
        <Text textBreakStrategy="simple" style={{ fontSize: 12, lineHeight: 17, color: c.mutedForeground }}>{clean(row.st)}</Text>
      ) : null}
      {p ? <Text textBreakStrategy="simple" style={{ fontSize: 13, lineHeight: 19, color: c.foreground }}>सज़ा: {p}</Text> : null}
      {row.pg != null ? <Text style={{ fontSize: 11, color: c.mutedForeground }}>हैंडबुक पृ. {row.pg}</Text> : null}
    </Pressable>
  );
});

function DetailSheet({ row, c, isDark, onClose, onAsk }: {
  row: BnsRow | null; c: Theme; isDark: boolean; onClose: () => void; onAsk: (q: string) => void;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => { setOpen(true); }, [row]);
  const texts = useMemo(() => (row ? bnsTextFor(row.bns) : []), [row]);
  if (!row) return null;
  const removed = isRemoved(row);
  const bnsNo = removed ? '' : baseSec(secTokens(row.bns)[0] ?? '');
  const ipcNo = secTokens(row.ipc)[0]?.toUpperCase() ?? '';
  const field = (label: string, value: string) => (value ? (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: c.mutedForeground }}>{label}</Text>
      <Text selectable textBreakStrategy="simple" style={{ fontSize: 14.5, lineHeight: 21, color: c.foreground }}>{value}</Text>
    </View>
  ) : null);
  const btn = { flex: 1, minHeight: 46, borderRadius: 14, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingHorizontal: 10 };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={onClose} />
      <View style={{ maxHeight: '86%', backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8, gap: 10 }}>
          <Text textBreakStrategy="simple" style={{ flex: 1, fontSize: 17, fontWeight: '800', color: removed ? c.mutedForeground : ACCENT }}>{rowTitle(row)}</Text>
          <Pressable onPress={onClose} style={{ padding: 8, borderRadius: 10, backgroundColor: c.muted }} accessibilityLabel="बंद करें">
            <X size={16} color={c.mutedForeground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }}>
          {field('शीर्षक', clean(row.h))}
          <FlagChips row={row} c={c} />
          {field('संज्ञेय/जमानती (हैंडबुक)', clean(row.st))}
          {field('सज़ा', clean(row.p))}
          {field('IPC', clean(row.ipc))}
          {field('BNS', removed ? 'BNS में नहीं (हटाई/समाहित)' : clean(row.bns))}
          {row.pg != null ? field('हैंडबुक पृष्ठ', String(row.pg)) : null}

          {texts.length > 0 ? (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, overflow: 'hidden' }}>
              <Pressable onPress={() => setOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 }} accessibilityRole="button">
                <BookOpen size={16} color={ACCENT} />
                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '800', color: c.foreground }}>BNS मूल पाठ</Text>
                {open ? <ChevronDown size={18} color={c.mutedForeground} /> : <ChevronRight size={18} color={c.mutedForeground} />}
              </Pressable>
              {open ? texts.map((t, i) => (
                <View key={i} style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, paddingTop: i ? 12 : 0 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: ACCENT }}>{annexLabel(t.annex)}</Text>
                  {clean(t.h) ? <Text textBreakStrategy="simple" style={{ fontSize: 13.5, fontWeight: '700', color: c.foreground }}>{clean(t.h).replace(/\s{2,}/g, ' ')}</Text> : null}
                  <Text selectable textBreakStrategy="simple" style={{ fontSize: 14, lineHeight: 22, color: c.foreground }}>{t.t ?? ''}</Text>
                </View>
              )) : null}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => { onClose(); router.push(`/(app)/knowledge?q=${encodeURIComponent(bnsNo ? `BNS ${bnsNo}` : `IPC ${ipcNo}`)}` as never); }}
              style={({ pressed }) => ({ ...btn, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.75 : 1 })}
              accessibilityRole="button"
            >
              <FileText size={16} color={c.foreground} />
              <Text textBreakStrategy="simple" style={{ fontSize: 13, fontWeight: '700', color: c.foreground }}>संबंधित SOP/परिपत्र</Text>
            </Pressable>
            <Pressable
              onPress={() => onAsk(bnsNo ? `BNS ${bnsNo} (IPC ${ipcNo || '—'}) क्या है?` : `IPC ${ipcNo} BNS में कहाँ है?`)}
              style={({ pressed }) => ({ ...btn, backgroundColor: ACCENT, opacity: pressed ? 0.85 : 1 })}
              accessibilityRole="button"
            >
              <Bot size={16} color="#fff" />
              <Text textBreakStrategy="simple" style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Copilot से पूछें</Text>
            </Pressable>
          </View>
          <SourceNote isDark={isDark} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function BnsRefScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = THEME[colorScheme ?? 'light'];
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<BnsMode>('ipc');
  const [selected, setSelected] = useState<BnsRow | null>(null);
  const [askQ, setAskQ] = useState<string | null>(null);

  // Debounce 250 ms
  useEffect(() => {
    const id = setTimeout(() => setQuery(input), 250);
    return () => clearTimeout(id);
  }, [input]);

  const results = useMemo(() => (query.trim() ? searchBns(query, mode, 50) : []), [query, mode]);
  const loaded = !!getBnsCompare();
  const bnssRows = useMemo(() => {
    const byId = new Map(BNS_REF_SEED_FILE.rows.map((r) => [r.id, r]));
    return BNSS_KEY_IDS.map((id) => ({ id, title: byId.get(id)?.title ?? id }));
  }, []);

  const openRow = useCallback((id: string) => router.push(`/(app)/knowledge/${id}` as never), []);
  const onPick = useCallback((r: BnsRow) => setSelected(r), []);
  const renderItem = useCallback(({ item }: { item: BnsRow }) => <ResultCard row={item} c={c} onPress={onPick} />, [c, onPick]);

  const empty = !query.trim();
  const listCard = (id: string, label: string, icon: React.ReactNode) => (
    <Pressable
      key={id}
      onPress={() => openRow(id)}
      style={({ pressed }) => ({
        minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 8,
        borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.75 : 1,
      })}
      accessibilityRole="button"
    >
      {icon}
      <Text textBreakStrategy="simple" numberOfLines={2} style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.foreground }}>{label}</Text>
      <ChevronRight size={18} color={c.mutedForeground} />
    </Pressable>
  );

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="BNS संदर्भ" subtitle="IPC ↔ BNS खोज · Delhi Police हैंडबुक" showBack />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <SearchBar
          value={input}
          onChangeText={setInput}
          placeholder={mode === 'title' ? 'शीर्षक का शब्द (murder, cheating, धमकी…)' : mode === 'ipc' ? 'IPC धारा (302, 420, 498A…)' : 'BNS धारा (103, 318, 69…)'}
          variant="light"
          returnKeyType="search"
        />
        <View style={{ flexDirection: 'row', gap: 6, padding: 4, borderRadius: 14, backgroundColor: c.secondary }}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{ flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.card : 'transparent' }}
              >
                <Text textBreakStrategy="simple" numberOfLines={1} style={{ fontSize: 13, fontWeight: active ? '800' : '600', color: active ? c.foreground : c.mutedForeground }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {empty ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 13, fontWeight: '800', color: c.mutedForeground, marginBottom: 8 }}>हैंडबुक के मुख्य अनुभाग</Text>
          {BNS_REF_PINNED.map((p) => listCard(p.id, p.label, <BookOpen size={18} color={ACCENT} />))}
          <Text style={{ fontSize: 13, fontWeight: '800', color: c.mutedForeground, marginTop: 10, marginBottom: 8 }}>BNSS महत्वपूर्ण धाराएँ</Text>
          {bnssRows.map((r) => listCard(r.id, r.title, <FileText size={18} color="#0F766E" />))}
          {!loaded ? <Text style={{ color: c.destructive, marginTop: 8 }}>BNS तालिका लोड नहीं हो सकी।</Text> : null}
          <SourceNote isDark={isDark} />
        </ScrollView>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r, i) => `${r.ipc}|${r.bns}|${i}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={9}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
              <Search size={24} color={c.mutedForeground} />
              <Text style={{ color: c.mutedForeground }}>कुछ नहीं मिला — दूसरा टैब (IPC / BNS / शीर्षक) आज़माएँ</Text>
            </View>
          }
          ListFooterComponent={<SourceNote isDark={isDark} />}
        />
      )}

      <DetailSheet row={selected} c={c} isDark={isDark} onClose={() => setSelected(null)} onAsk={(q) => { setSelected(null); setAskQ(q); }} />
      <AICopilotModal visible={!!askQ} onClose={() => setAskQ(null)} initialQuery={askQ ?? undefined} />
    </View>
  );
}

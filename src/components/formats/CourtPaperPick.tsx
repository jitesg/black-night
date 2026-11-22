/**
 * "📋 न्यायालय से लंबित काग़ज़ चुनें" (owner, sample approved) — shown under a format dropdown whose key has `courtPick` /
 * `courtFill` (src/lib/courtPick.ts), e.g. GD रवानगी `WType` (NBW / सम्मन / मृत्यु आख्या).
 * Dashed court-blue strip with the count → bottom sheet (search + cards: type badge, person, court, वाद सं0 · मु0अ0सं0 · अंतिम)
 * → tap = the courtFill keys are filled through the form's own onChange; strip "✓ न्यायालय काग़ज़ से भरा · हटाएँ" (undo = boxes as
 * before). Nothing is written to the न्यायालय paper (it stays लंबित). No pending paper → no strip. Any read error → no strip.
 * THEME colours (light + dark); the sheet pads by NAV_BAR_INSET (it is a separate window).
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { ChevronRight, ClipboardList } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import {
  fillValuesFrom, matchPaper, orderPapers, paperFir, paperPersonLine, typesFor, type CourtPickSpec, type PickPaper,
} from '@/lib/courtPick';

const TYPE_WORD: Record<string, string> = { NBW: 'NBW', Summons: 'सम्मन', Death_Report: 'मृत्यु आख्या' };
const TYPE_COLOR: Record<string, { light: [string, string]; dark: [string, string] }> = {
  NBW: { light: ['#DC2626', '#FEF2F2'], dark: ['#F87171', '#3A1F22'] },
  Summons: { light: ['#B45309', '#FFFBEB'], dark: ['#FCD34D', '#3A2A10'] },
  Death_Report: { light: ['#7C3AED', '#F5F3FF'], dark: ['#A78BFA', '#2E1065'] },
};
const COURT = { light: { fg: '#1D4ED8', bg: '#EFF6FF' }, dark: { fg: '#60A5FA', bg: '#172554' } };

/** YYYY-MM-DD → dd/mm/yyyy */
const dmy = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s ?? ''); };

export const CourtPaperPick = memo(function CourtPaperPick({ spec, choice, allValues, onChange }: {
  spec: CourtPickSpec;
  /** the dropdown's current value (NBW / सम्मन / मृत्यु आख्या) */
  choice: string;
  allValues?: Record<string, string>;
  onChange: (keyName: string, value: string) => void;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const C = dark ? THEME.dark : THEME.light;
  const K = dark ? COURT.dark : COURT.light;
  const types = useMemo(() => typesFor(spec, choice), [spec, choice]);
  const typesKey = types.join('|');
  const [papers, setPapers] = useState<PickPaper[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [filled, setFilled] = useState<{ before: Record<string, string> } | null>(null);

  useEffect(() => {
    let alive = true;
    if (!types.length) { setPapers([]); return () => { alive = false; }; }
    (async () => {
      try {
        const { getPendingCourtPapersForPick } = await import('@/lib/db/nyayalayRepo');
        const rows = await getPendingCourtPapersForPick(types);
        if (alive) setPapers(orderPapers(rows, types));
      } catch { if (alive) setPapers([]); }
    })();
    return () => { alive = false; };
  // types is derived from typesKey
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesKey]);

  const shown = useMemo(() => papers.filter((p) => matchPaper(p, q)), [papers, q]);

  const pick = useCallback((p: PickPaper) => {
    const next = fillValuesFrom(p, spec.fill);
    const before: Record<string, string> = {};
    for (const k of Object.keys(next)) before[k] = allValues?.[k] ?? '';
    for (const [k, v] of Object.entries(next)) if (v) onChange(k, v);
    setFilled({ before });
    setOpen(false);
    setQ('');
  }, [spec.fill, allValues, onChange]);

  const undo = useCallback(() => {
    if (!filled) return;
    for (const [k, v] of Object.entries(filled.before)) onChange(k, v);
    setFilled(null);
  }, [filled, onChange]);

  if (!types.length || !papers.length) return null;
  const sub = types.length > 1 && types[0] === 'Death_Report' ? 'मृत्यु आख्या पहले, फिर NBW / सम्मन' : `लंबित ${types.map((t) => TYPE_WORD[t] ?? t).join(' / ')}`;

  return (
    <View style={{ marginTop: 10, gap: 6 }}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="न्यायालय से लंबित काग़ज़ चुनें"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderStyle: filled ? 'solid' : 'dashed', borderColor: K.fg,
          backgroundColor: K.bg, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11 }}
      >
        <ClipboardList size={18} color={K.fg} strokeWidth={2.2} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: K.fg }}>{`न्यायालय से लंबित काग़ज़ चुनें (${papers.length})`}</Text>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: K.fg, opacity: 0.85 }}>{sub}</Text>
        </View>
        <ChevronRight size={18} color={K.fg} />
      </Pressable>
      {filled ? (
        <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.primary }}>
          {'✓ न्यायालय काग़ज़ से भरा · '}
          <Text onPress={undo} style={{ textDecorationLine: 'underline' }}>हटाएँ</Text>
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} android_ripple={null} accessibilityLabel="बंद करें" />
          <View style={{ maxHeight: '85%', backgroundColor: C.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: NAV_BAR_INSET + 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: C.border, alignSelf: 'center', marginBottom: 10 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 2 }}>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: C.foreground }}>न्यायालय के लंबित काग़ज़</Text>
              <Pressable onPress={() => setOpen(false)} style={{ padding: 6 }}>
                <Text style={{ fontSize: 15, color: C.mutedForeground }}>बंद करें</Text>
              </Pressable>
            </View>
            <Text style={{ paddingHorizontal: 16, marginBottom: 8, fontSize: 12.5, color: C.mutedForeground }}>{`${sub} · टैप करें = form भर जाएगा`}</Text>
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="नाम / वाद सं0 / मु0अ0सं0 से खोजें…"
                placeholderTextColor={C.mutedForeground}
                style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.foreground, backgroundColor: C.card }}
              />
            </View>
            <FlatList
              data={shown}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={{ textAlign: 'center', padding: 24, color: C.mutedForeground }}>कुछ नहीं मिला</Text>}
              renderItem={({ item }) => {
                const tc = (TYPE_COLOR[item.doc_type] ?? TYPE_COLOR.NBW)[dark ? 'dark' : 'light'];
                const person = paperPersonLine(item);
                const fir = paperFir(item);
                return (
                  <Pressable
                    onPress={() => pick(item)}
                    style={{ marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, gap: 3 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, backgroundColor: tc[1] }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: tc[0] }}>{TYPE_WORD[item.doc_type] ?? item.doc_type}</Text>
                      </View>
                      {item.deadline_date ? <Text style={{ fontSize: 11.5, color: C.mutedForeground }}>{`अंतिम ${dmy(item.deadline_date)}`}</Text> : null}
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: C.foreground }}>{person || item.court_name || '—'}</Text>
                    <Text numberOfLines={2} style={{ fontSize: 12.5, color: C.mutedForeground }}>
                      {[person ? item.court_name : '', item.vad_sankhya ? `वाद सं0 ${item.vad_sankhya}` : '', fir ? `मु0अ0सं0 ${fir}` : ''].filter(Boolean).join(' · ')}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
});

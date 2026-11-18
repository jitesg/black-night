/**
 * मु0अ0सं0 / धारा सुझाव (owner, step 2 of "पूरे app से सुझाव"): under a format's मु0अ0सं0 or धारा box (keys with the
 * @FIR.fir_number / @FIR.section default) — cases from मुकदमा + न्यायालय (db/peopleRegistryRepo.searchCases). A tap fills BOTH
 * boxes, nothing else. THEME colours; phone database only.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { searchCases, type CaseHit } from '@/lib/db/peopleRegistryRepo';

export const CaseSuggest = memo(function CaseSuggest({ query, active, onPick }: {
  query: string;
  active: boolean;
  onPick: (hit: CaseHit) => void;
}) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const [hits, setHits] = useState<CaseHit[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    if (!active || !query.trim()) { setHits([]); return; }
    const my = ++seq.current;
    const t = setTimeout(() => {
      searchCases(query).then((h) => {
        // a box already holding exactly this case (e.g. filled from the मुकदमा) needs no list
        const q = query.trim();
        if (my === seq.current) setHits(h.filter((x) => x.firNumber.trim() !== q && x.section.trim() !== q));
      }).catch(() => { if (my === seq.current) setHits([]); });
    }, 250);
    return () => clearTimeout(t);
  }, [query, active]);

  if (!active || !hits.length) return null;
  return (
    <View style={{ marginTop: 4, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card, overflow: 'hidden', elevation: 6 }}>
      <View style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.muted }}>
        <Text style={{ fontSize: 11, color: C.mutedForeground }}>📁 मुकदमे ({hits.length}) — दबाने पर मु0अ0सं0 + धारा दोनों भरेंगे</Text>
      </View>
      {hits.map((h, i) => (
        <Pressable
          key={h.key}
          onPress={() => { setHits([]); onPick(h); }}
          accessibilityRole="button"
          accessibilityLabel={`मु0अ0सं0 ${h.firNumber} चुनें`}
          style={{ paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}
        >
          <Text style={{ fontSize: 13, color: C.foreground }} numberOfLines={2}>
            {h.module === 'court' ? '⚖️ ' : ''}<Text style={{ fontWeight: '700', fontSize: 14 }}>{h.firNumber}</Text>{h.section ? `  ·  धारा ${h.section}` : ''}
          </Text>
          {h.detail ? <Text style={{ fontSize: 12, color: C.mutedForeground }} numberOfLines={1}>{h.detail}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
});

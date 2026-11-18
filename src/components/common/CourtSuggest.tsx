/**
 * न्यायालय के नाम / सेवा में — सुझाव (owner, samples approved; `kind`): the list under a court-name box (format keys {"court": true} and the
 * न्यायालय module's "न्यायालय का नाम"). Owner's 24 names + the officer's own (🕘 "आपका जोड़ा", on top); typed words highlighted.
 * A tap fills the box (still editable). THEME colours, light + dark; nothing leaves the phone.
 */
import { memo, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { matchCourtNames, type CourtHit } from '@/lib/courtNames';
import { matchSewaNames } from '@/lib/sewaNames';
import { getCustomNames, type NameKind } from '@/lib/courtNameStore';
import { buildHighlightSegments } from '@/lib/searchUtils';

export const CourtSuggest = memo(function CourtSuggest({ query, active, onPick, kind = 'court' }: {
  query: string;
  active: boolean;
  onPick: (name: string) => void;
  /** 'court' = न्यायालय list (default), 'sewa' = सेवा में list (owner) — the two lists never mix */
  kind?: NameKind;
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const C = dark ? THEME.dark : THEME.light;
  const [hits, setHits] = useState<CourtHit[]>([]);

  useEffect(() => {
    if (!active) { setHits([]); return; }
    // in-memory list of ~50 names — no debounce needed
    setHits(kind === 'sewa' ? matchSewaNames(query, getCustomNames('sewa')) : matchCourtNames(query, getCustomNames('court')));
  }, [query, active, kind]);

  if (!active || !hits.length) return null;
  const mark = { backgroundColor: dark ? '#854D0E' : '#FEF08A' };
  return (
    <View style={{ marginTop: 4, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card, overflow: 'hidden', elevation: 6 }}>
      <View style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.muted }}>
        <Text style={{ fontSize: 11, color: C.mutedForeground }}>{kind === 'sewa' ? '📮 सेवा में — सुझाव' : '⚖️ न्यायालय सुझाव'} ({hits.length})</Text>
      </View>
      {hits.map((h, i) => (
        <Pressable
          key={h.name}
          onPress={() => { setHits([]); onPick(h.name); }}
          accessibilityRole="button"
          accessibilityLabel={`${h.name} चुनें`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}
        >
          <Text style={{ fontSize: 13 }}>{h.custom ? '🕘' : kind === 'sewa' ? '📮' : '⚖️'}</Text>
          <Text style={{ flex: 1, fontSize: 14, color: C.foreground }}>
            {buildHighlightSegments(h.name, query).map((s, k) => (
              <Text key={k} style={s.highlighted ? mark : undefined}>{s.text}</Text>
            ))}
          </Text>
          {h.custom ? (
            <View style={{ backgroundColor: dark ? '#451A03' : '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: dark ? '#FCD34D' : '#92400E' }}>आपका जोड़ा</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
});

/**
 * "पूरे app से सुझाव" under a person card's name box (owner, sample approved): people from every module whose name matches what
 * is typed (db/peopleRegistryRepo.searchPeople). Tap = fill that card; "+n जगह" = a small sheet listing where the person was
 * seen, with "card में भरें". Plus the "✓ … से भरा · हटाएँ" strip shown above the card after a fill (`FilledFromStrip`).
 * THEME colours, light + dark. Searches only the phone's own database.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { searchPeople } from '@/lib/db/peopleRegistryRepo';
import { MODULE_ICON, MODULE_WORD, hitPlace, hitSubline, sourceChip, type PersonHit, type PeopleSource } from '@/lib/peopleRegistry';

const DEBOUNCE_MS = 250;

/** chip colours per module (light / dark) */
const CHIP = {
  light: { fir: ['#DBEAFE', '#1E40AF'], pp: ['#E0E7FF', '#3730A3'], court: ['#F3E8FF', '#6B21A8'], nk: ['#FEE2E2', '#991B1B'], halka: ['#CCFBF1', '#115E59'], recent: ['#FEF3C7', '#92400E'] },
  dark: { fir: ['#1E3A8A66', '#93C5FD'], pp: ['#3730A366', '#C7D2FE'], court: ['#6B21A866', '#E9D5FF'], nk: ['#7F1D1D66', '#FCA5A5'], halka: ['#115E5966', '#99F6E4'], recent: ['#78350F66', '#FCD34D'] },
} as const;

function SourceChip({ src, scheme }: { src: PeopleSource; scheme: 'light' | 'dark' }) {
  const [bg, fg] = CHIP[scheme][src.module];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
      <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: fg }}>{sourceChip(src)}</Text>
    </View>
  );
}

/** The list under the name box. `query` = the name typed; shown only while `active` (box focused). */
export const PeopleSuggest = memo(function PeopleSuggest({ query, active, onPick }: {
  query: string;
  active: boolean;
  onPick: (hit: PersonHit) => void;
}) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const C = THEME[scheme];
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [sheet, setSheet] = useState<PersonHit | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!active || query.trim().replace(/\s/g, '').length < 2) { setHits([]); return; }
    const my = ++seq.current;
    const t = setTimeout(() => {
      searchPeople(query).then((h) => { if (my === seq.current) setHits(h); }).catch(() => { if (my === seq.current) setHits([]); });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, active]);

  const pick = (h: PersonHit) => { setHits([]); setSheet(null); onPick(h); };

  return (
    <>
      {active && hits.length ? (
        <View style={{ marginTop: 4, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.card, overflow: 'hidden', elevation: 6 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.muted }}>
            <Text style={{ fontSize: 11, color: C.mutedForeground }}>🔎 पूरे app में मिले ({hits.length})</Text>
          </View>
          {hits.map((h, i) => {
            const sub = hitSubline(h);
            const place = hitPlace(h);
            const extra = h.sources.length - 2;
            return (
              <Pressable
                key={h.key}
                onPress={() => pick(h)}
                accessibilityRole="button"
                accessibilityLabel={`${h.name} चुनें`}
                style={{ paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.border, gap: 2 }}
              >
                <Text style={{ fontSize: 13, color: C.foreground }} numberOfLines={1}>
                  <Text style={{ fontWeight: '700', fontSize: 14 }}>{h.name}</Text>{sub ? `  ${sub}` : ''}
                </Text>
                {place || h.mobile ? (
                  <Text style={{ fontSize: 12, color: C.mutedForeground }} numberOfLines={1}>
                    {[place ? `📍 ${place}` : '', h.mobile ? `📞 ${h.mobile}` : ''].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginTop: 2 }}>
                  {h.sources.slice(0, 2).map((s, k) => <SourceChip key={k} src={s} scheme={scheme} />)}
                  {extra > 0 ? (
                    <Pressable onPress={() => setSheet(h)} hitSlop={8} accessibilityLabel="और जगह देखें">
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.primary }}>+{extra} जगह</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* "+n जगह" → where this person was seen (व्यक्ति रजिस्टर) */}
      <Modal transparent visible={!!sheet} animationType="fade" statusBarTranslucent onRequestClose={() => setSheet(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#00000066' }} onPress={() => setSheet(null)} accessibilityLabel="बंद करें" />
        {sheet ? (
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 16 + NAV_BAR_INSET, maxHeight: '75%' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.foreground }}>👤 {sheet.name}{sheet.father ? ` ${hitSubline(sheet).split(' · ')[0]}` : ''}</Text>
            <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 2 }}>
              {[hitPlace(sheet) ? `📍 ${hitPlace(sheet)}` : '', sheet.mobile ? `📞 ${sheet.mobile}` : '', sheet.age ? `${sheet.age.replace(/\s*वर्ष$/, '')} वर्ष` : ''].filter(Boolean).join(' · ')}
            </Text>
            <ScrollView style={{ marginTop: 8 }}>
              {sheet.sources.map((s, k) => (
                <View key={k} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginTop: 8 }}>
                  <Text style={{ fontSize: 13, color: C.foreground }}>
                    {MODULE_ICON[s.module]} {MODULE_WORD[s.module]} · <Text style={{ fontWeight: '700' }}>{s.title}</Text>{s.role ? ` · ${s.role}` : ''}
                  </Text>
                  {s.date ? <Text style={{ fontSize: 12, color: C.mutedForeground }}>{s.date}</Text> : null}
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Pressable onPress={() => setSheet(null)} style={{ flex: 1 }} accessibilityRole="button">
                <View style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.foreground }}>बंद करें</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => pick(sheet)} style={{ flex: 1 }} accessibilityRole="button">
                <View style={{ backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.primaryForeground }}>card में भरें</Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Modal>
    </>
  );
});

/** "✓ 📁 मुकदमा 120/2026 से भरा · हटाएँ" — shown above a card that was just filled from a suggestion. */
export function FilledFromStrip({ src, onUndo }: { src: PeopleSource; onUndo: () => void }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
      backgroundColor: dark ? '#163322' : '#ECFDF3', borderWidth: 1, borderColor: dark ? '#166534' : '#86EFAC',
    }}>
      <Text style={{ flex: 1, fontSize: 12, color: dark ? '#4ADE80' : '#15803D' }} numberOfLines={1}>✓ {MODULE_ICON[src.module]} {src.title} से भरा</Text>
      <Pressable onPress={onUndo} hitSlop={8} accessibilityRole="button" accessibilityLabel="भरा हुआ हटाएँ">
        <Text style={{ fontSize: 12, fontWeight: '700', color: dark ? '#4ADE80' : '#15803D', textDecorationLine: 'underline' }}>हटाएँ</Text>
      </Pressable>
    </View>
  );
}

/**
 * विधि पुस्तकालय — new layout part 2 (owner, sample approved):
 *  - `SectionJumpStrip`: "# धारा नंबर लिखें" — a typed number shows one button per Act that HAS that section (BNS / BNSS / BSA);
 *    "35(3)" / "धारा 103" / Devanagari digits work (parseBareSectionNumber). Keyboard "go" with exactly one match opens it.
 *  - `SpecialLawList`: UPPR, POCSO, महिला कानून, BNS संदर्भ, अन्य अधिनियम — one card, one row each (same routes as the old big cards).
 * Act tiles use GradientTile (KnowledgeHomeParts). THEME colours; Act colours = ACT_COLOR (same as the Act screen).
 */
import { memo, useMemo, useState, type ComponentType } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Hash } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { ACT_COLOR, getSection, parseBareSectionNumber, type ActId } from '@/lib/law/lawLibrary';

type Icon = ComponentType<{ size: number; color: string; strokeWidth?: number }>;
const ACT_IDS: ActId[] = ['BNS', 'BNSS', 'BSA'];

export const SectionJumpStrip = memo(function SectionJumpStrip({ placeholder, noneText }: { placeholder: string; noneText: (n: number) => string }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const C = dark ? THEME.dark : THEME.light;
  const accent = dark ? '#2DD4BF' : '#0F766E';
  const [text, setText] = useState('');
  const n = useMemo(() => parseBareSectionNumber(text), [text]);
  const hits = useMemo(() => (n ? ACT_IDS.filter((a) => !!getSection(a, n)).map((a) => ({ act: a, title: getSection(a, n)?.title ?? '' })) : []), [n]);
  const open = (act: ActId) => { if (n) router.push(`/(app)/knowledge/law/${act}/${n}` as never); };
  return (
    <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: accent, borderRadius: 16, backgroundColor: C.card, padding: 10, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Hash size={18} color={accent} strokeWidth={2.4} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={C.mutedForeground}
          keyboardType="default"
          returnKeyType="go"
          onSubmitEditing={() => { if (hits.length === 1) open(hits[0].act); }}
          style={{ flex: 1, fontSize: 15, color: C.foreground, paddingVertical: 6 }}
          accessibilityLabel={placeholder}
        />
        {text ? (
          <Pressable onPress={() => setText('')} hitSlop={10} accessibilityLabel="मिटाएँ">
            <Text style={{ fontSize: 16, color: C.mutedForeground }}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      {n ? (
        hits.length ? (
          <View style={{ gap: 6 }}>
            {hits.map((h) => (
              <Pressable
                key={h.act}
                onPress={() => open(h.act)}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
                  backgroundColor: `${ACT_COLOR[h.act]}14`, borderWidth: 1, borderColor: `${ACT_COLOR[h.act]}55` }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '900', color: ACT_COLOR[h.act], minWidth: 74 }}>{`${h.act} ${n}`}</Text>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: C.foreground }}>{h.title}</Text>
                <ChevronRight size={16} color={ACT_COLOR[h.act]} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ fontSize: 12.5, color: C.mutedForeground }}>{noneText(n)}</Text>
        )
      ) : null}
    </View>
  );
});

export interface SpecialLawRow { key: string; icon: Icon; color: string; title: string; sub: string; route: string }

export const SpecialLawList = memo(function SpecialLawList({ rows }: { rows: SpecialLawRow[] }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 12, borderCurve: 'continuous' } as object}>
      {rows.map((r, i) => {
        const I = r.icon;
        return (
          <Pressable
            key={r.key}
            onPress={() => router.push(r.route as never)}
            accessibilityRole="button"
            accessibilityLabel={r.title}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: `${r.color}18`, alignItems: 'center', justifyContent: 'center' }}>
              <I size={19} color={r.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: C.foreground }}>{r.title}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: C.mutedForeground, marginTop: 1 }}>{r.sub}</Text>
            </View>
            <ChevronRight size={18} color={C.mutedForeground} />
          </Pressable>
        );
      })}
    </View>
  );
});

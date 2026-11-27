/**
 * SOP सूची — new layout part 5 (owner, sample approved), used only when knowledge/list shows category SOP:
 *  - `SopListHeader`: visible topic chips (the SOP उप-श्रेणी with counts — same filter as the ⚙︎ sheet) + "जारी हैं" (SOPs whose
 *    checklist is started but not finished, with a progress bar; data sopChecklistRepo.getSopDoneCounts) + "सभी SOP" heading.
 *  - `SopQuickButtons`: पढ़ें / चेकलिस्ट / समझें on each SOP card → [knowledgeId]?tab=details|checklist|samjhe.
 * THEME colours; accent = the SOP module colour passed in.
 */
import { memo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export interface SopProgressRow { id: string; title: string; done: number; total: number }

export const SopListHeader = memo(function SopListHeader({ color, chips, active, onPick, inProgress }: {
  color: string;
  chips: { value: string; label: string }[];
  /** 'All' or a chip value */
  active: string;
  onPick: (value: string) => void;
  inProgress: SopProgressRow[];
}) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const C = dark ? THEME.dark : THEME.light;
  const amber = dark ? '#FBBF24' : '#D97706';
  const head = { fontSize: 12, fontWeight: '800' as const, letterSpacing: 0.4, color: C.mutedForeground, marginBottom: 8 };
  return (
    <View style={{ gap: 14, marginBottom: 4 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
        {[{ value: 'All', label: 'सभी' }, ...chips].map((c) => {
          const on = active === c.value;
          return (
            <Pressable
              key={c.value}
              onPress={() => onPick(c.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{ maxWidth: 260, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
                borderColor: on ? color : C.border, backgroundColor: on ? color : C.card }}
            >
              <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: on ? '#FFFFFF' : C.foreground }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {inProgress.length ? (
        <View>
          <Text style={head}>⏳ जारी हैं</Text>
          <View style={{ gap: 8 }}>
            {inProgress.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/(app)/knowledge/${p.id}?tab=checklist` as never)}
                accessibilityRole="button"
                accessibilityLabel={p.title}
                style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, gap: 6, borderCurve: 'continuous' } as object}
              >
                <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '700', color: C.foreground }}>{p.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.border, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round((p.done / p.total) * 100)}%`, height: '100%', backgroundColor: amber }} />
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: amber }}>{`चेकलिस्ट ${p.done} / ${p.total}`}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <Text style={{ ...head, marginBottom: 0 }}>📋 सभी SOP</Text>
    </View>
  );
});

export const SopQuickButtons = memo(function SopQuickButtons({ id, color, explain }: { id: string; color: string; explain: boolean }) {
  const buttons = [
    { tab: 'details', label: '📖 पढ़ें' },
    { tab: 'checklist', label: '✅ चेकलिस्ट' },
    ...(explain ? [{ tab: 'samjhe', label: '💡 समझें' }] : []),
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {buttons.map((b) => (
        <Pressable
          key={b.tab}
          onPress={() => router.push(`/(app)/knowledge/${id}?tab=${b.tab}` as never)}
          accessibilityRole="button"
          style={{ flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 7, backgroundColor: `${color}14`, borderWidth: 1, borderColor: `${color}40` }}
        >
          <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color }}>{b.label}</Text>
        </Pressable>
      ))}
    </View>
  );
});

/**
 * सूचनाएँ — notification centre opened from the home bell.
 * Cards are built live (src/lib/noticeCards.ts): केस डायरी लंबित, न्यायालय and
 * प्रार्थना पत्र deadlines (overdue / due in 3 days), reminders due today or missed.
 * Tapping a card opens that FIR / document / petition / Reminders.
 */
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Bell, BellOff, ChevronRight, NotebookPen, Scale, Scroll } from 'lucide-react-native';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { Pill } from '@/components/ui/ds/Pill';
import { THEME } from '@/lib/theme';
import { loadNoticeCards } from '@/lib/db/noticeRepo';
import { refreshAppBadge } from '@/lib/appBadge';
import type { NoticeCard, NoticeKind, NoticeLevel } from '@/lib/noticeCards';

const KIND_META: Record<NoticeKind, { label: string; icon: typeof Bell; light: string; dark: string }> = {
  cd:       { label: 'केस डायरी',   icon: NotebookPen, light: '#7C3AED', dark: '#C4B5FD' },
  court:    { label: 'न्यायालय',    icon: Scale,       light: '#1D4ED8', dark: '#93C5FD' },
  petition: { label: 'प्रार्थना पत्र', icon: Scroll,      light: '#0F766E', dark: '#5EEAD4' },
  reminder: { label: 'रिमाइंडर',    icon: Bell,        light: '#B45309', dark: '#FCD34D' },
};

const LEVEL_COLOR: Record<NoticeLevel, { light: string; dark: string }> = {
  over: { light: '#DC2626', dark: '#F87171' },
  warn: { light: '#D97706', dark: '#FBBF24' },
  info: { light: '#475569', dark: '#CBD5E1' },
};

type Filter = 'all' | NoticeKind;
const FILTERS: Filter[] = ['all', 'cd', 'court', 'petition', 'reminder'];

function NoticeItem({ card, isDark }: { card: NoticeCard; isDark: boolean }) {
  const palette = THEME[isDark ? 'dark' : 'light'];
  const meta = KIND_META[card.kind];
  const Icon = meta.icon;
  const kindColor = isDark ? meta.dark : meta.light;
  const levelColor = LEVEL_COLOR[card.level][isDark ? 'dark' : 'light'];
  return (
    <Pressable
      onPress={() => router.push(card.route as never)}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.body}`}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16,
        backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border,
        borderLeftWidth: 4, borderLeftColor: levelColor, opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${kindColor}${isDark ? '2E' : '1A'}` }}>
        <Icon size={18} color={kindColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text textBreakStrategy="simple" style={{ flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20, color: palette.foreground }} numberOfLines={2}>
            {card.title}
          </Text>
          <Pill size="xs" label={card.when} color={levelColor} />
        </View>
        <Text textBreakStrategy="simple" style={{ fontSize: 12.5, lineHeight: 18, color: palette.mutedForeground }}>{card.body}</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: kindColor }}>{meta.label}</Text>
      </View>
      <ChevronRight size={16} color={palette.mutedForeground} style={{ alignSelf: 'center' }} />
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = THEME[isDark ? 'dark' : 'light'];
  const [cards, setCards] = useState<NoticeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try { setCards(await loadNoticeCards()); } catch { /* keep the last list */ }
    refreshAppBadge().catch(() => {});
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: cards.length, cd: 0, court: 0, petition: 0, reminder: 0 };
    for (const x of cards) c[x.kind] += 1;
    return c;
  }, [cards]);
  const shown = filter === 'all' ? cards : cards.filter((c) => c.kind === filter);

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="सूचनाएँ" subtitle={loading ? undefined : `${cards.length} सूचना`} showBack />
      <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
          {FILTERS.map((f) => (
            <Pill
              key={f}
              size="md"
              label={f === 'all' ? 'सभी' : KIND_META[f].label}
              count={counts[f]}
              selected={filter === f}
              outline={filter !== f}
              tone="primary"
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={shown}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <NoticeItem card={item} isDark={isDark} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={loading ? null : (
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 10 }}>
            <BellOff size={28} color={palette.mutedForeground} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: palette.foreground }}>कोई सूचना नहीं</Text>
            <Text style={{ fontSize: 12.5, color: palette.mutedForeground, textAlign: 'center', paddingHorizontal: 24 }}>
              लंबित केस डायरी, न्यायालय / प्रार्थना पत्र की नज़दीकी अंतिम तिथि और आज के रिमाइंडर यहाँ दिखेंगे।
            </Text>
          </View>
        )}
        ListFooterComponent={
          <Pressable onPress={() => router.push('/(app)/reminders' as never)} style={{ marginTop: 14, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: palette.primary }}>सभी रिमाइंडर देखें →</Text>
          </Pressable>
        }
      />
    </View>
  );
}

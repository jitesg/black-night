/**
 * सूचनाएँ — notification centre opened from the home bell.
 * Cards are built live (src/lib/noticeCards.ts): केस डायरी लंबित, चलानी प्रेषण लंबित, न्यायालय and
 * प्रार्थना पत्र deadlines (overdue / due in 3 days), reminders due today or missed.
 * Tapping a card opens that FIR / document / petition / Reminders.
 */
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { BellOff } from 'lucide-react-native';
import { KIND_META, NoticeItem } from '@/components/notifications/NoticeItem';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { Pill } from '@/components/ui/ds/Pill';
import { THEME } from '@/lib/theme';
import { loadNoticeCards } from '@/lib/db/noticeRepo';
import { refreshAppBadge } from '@/lib/appBadge';
import type { NoticeCard, NoticeKind } from '@/lib/noticeCards';

type Filter = 'all' | NoticeKind;
const FILTERS: Filter[] = ['all', 'cd', 'nk', 'court', 'petition', 'reminder'];

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
    const c: Record<Filter, number> = { all: cards.length, cd: 0, court: 0, petition: 0, reminder: 0, nk: 0 };
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
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}
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

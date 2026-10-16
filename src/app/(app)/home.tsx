import { useState, useCallback, useRef, useMemo } from 'react';
import { T } from '@/lib/typography';
import {
  View, Text, ScrollView, Pressable,
  ActivityIndicator, SectionList,
  BackHandler, ToastAndroid, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import {
  BookOpen, FileText,
  BookMarked, ShieldAlert, Scroll, Scale,
  TrendingUp, Bell, Clock,
  CheckCircle, CalendarDays, Zap,
  Star, StarOff, ChevronRight, MoreHorizontal,
} from 'lucide-react-native';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  loadDashboardData, universalSearch,
  type DashboardData, type ReminderItem,
  type RecentActivity, type UniversalSearchItem,
} from '@/lib/db/dashboardRepo';
import { AppDrawer } from '@/components/common/AppDrawer';
import { DashboardHeader } from '@/components/common/DashboardHeader';
import { SearchBar } from '@/components/SearchBar';
import { HighlightText } from '@/components/HighlightText';
import { usePinnedItems, type PinnedItem } from '@/hooks/usePinnedItems';
import { SectionHeader, StatusChip, EmptyState, SkeletonList } from '@/components/ui/ds';

// ── Semantic colour aliases — Soft Indigo palette ────────────────────────────
const C_FIXED = {
  purple:    '#7C3AED',
  blue:      '#2563EB',
  amber:     '#D97706',
  red:       '#DC2626',
  teal:      '#0891B2',
  cyan:      '#0891B2',
  navy:      '#1D4ED8',
  action:    '#6366F1',   // indigo — primary action (fixed regardless of theme)
} as const;

const MC: Record<string, string> = {
  Mukadma:          '#7C3AED',
  Nyayalay:         '#1D4ED8',
  'Prarthna Patra': '#7C3AED',
  GD:               '#D97706',
  Nirodhatmak:      '#DC2626',
  Halka:            '#0891B2',
  Knowledge:        '#16A34A',
};

// Shadow is applied via Tailwind className="shadow-sm shadow-black/5" — no legacy shadow* props.

// ── StatCard — compact 2-col grid tile ──────────────────────────────────────
// Each sub-component that uses surface/text tokens calls useColorScheme()
// directly. This keeps them self-contained and avoids prop-drilling C.
function usePalette() {
  const { colorScheme } = useColorScheme();
  const p = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return {
    ...C_FIXED,
    text:      p.foreground,
    textMuted: p.mutedForeground,
    bg:        p.background,
    surface:   p.card,
    border:    p.border,
    divider:   p.muted,
  };
}

function StatCard({ label, value, color, onPress }: {
  label: string; value: number; color: string; onPress?: () => void;
}) {
  const C = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1, backgroundColor: C.surface, borderRadius: 16, padding: 16,
        borderCurve: 'continuous',
      } as object}
      className="shadow-sm shadow-black/5 active:opacity-70"
    >
      <Text style={{ fontSize: 28, fontWeight: '700', color, lineHeight: 34 }}>{value}</Text>
      <Text style={{ ...T.caption1, color: C.textMuted, marginTop: 2, lineHeight: 16 }}>{label}</Text>
    </Pressable>
  );
}

// ── QuickAction — icon + label tile ─────────────────────────────────────────
function QuickAction({ label, icon: Icon, color, onPress }: {
  label: string; icon: typeof FileText; color: string; onPress: () => void;
}) {
  const C = usePalette();
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center py-3 active:opacity-70"
      style={{
        backgroundColor: `${color}0F`,
        borderRadius: 16,
        borderCurve: 'continuous',
        gap: 6,
      } as object}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: `${color}20`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={color} />
      </View>
      <Text style={{ ...T.caption1, fontWeight: '600', color: C.text, textAlign: 'center', lineHeight: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── ReminderRow ──────────────────────────────────────────────────────────────
function ReminderRow({ item }: { item: ReminderItem }) {
  const C = usePalette();
  const isOverdue = item.daysLeft < 0;
  const isToday   = item.daysLeft === 0;
  const variant   = isOverdue ? 'error' : isToday ? 'warning' : 'neutral';
  const badge     = isOverdue ? `${Math.abs(item.daysLeft)}d late` : isToday ? 'Today' : `${item.daysLeft}d`;
  return (
    <Pressable
      onPress={() => router.push(item.route as never)}
      className="flex-row items-center gap-3 py-3 active:opacity-70"
      style={{ borderBottomWidth: 1, borderBottomColor: C.divider }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ ...T.footnote, fontWeight: '600', color: C.text }} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={{ ...T.caption1, color: C.textMuted, marginTop: 2 }}>{item.module}</Text>
      </View>
      <StatusChip label={badge} variant={variant} />
    </Pressable>
  );
}

// ── ContinueRow ──────────────────────────────────────────────────────────────
function ContinueRow({ item }: { item: RecentActivity }) {
  const C = usePalette();
  const timeAgo = useMemo(() => {
    const diff = Math.floor(Date.now() / 1000) - item.time;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }, [item.time]);
  return (
    <Pressable
      onPress={() => router.push(item.route as never)}
      className="flex-row items-center gap-3 py-3 active:opacity-70"
      style={{ borderBottomWidth: 1, borderBottomColor: C.divider }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: `${item.color}15`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: item.color }}>
          {item.label.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...T.footnote, fontWeight: '600', color: C.text }} numberOfLines={1}>
          {item.label}
        </Text>
        <Text style={{ ...T.caption1, color: C.textMuted, marginTop: 2 }} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ ...T.caption2, color: C.textMuted }}>{timeAgo}</Text>
        <ChevronRight size={12} color={C.border} />
      </View>
    </Pressable>
  );
}

// ── PinnedChip ────────────────────────────────────────────────────────────────
function PinnedChip({ item, onUnpin }: { item: PinnedItem; onUnpin: () => void }) {
  const C = usePalette();
  return (
    <Pressable
      onPress={() => router.push(item.route as never)}
      onLongPress={onUnpin}
      accessibilityHint="Long press to unpin"
      className="flex-row items-center gap-2 active:opacity-70 mr-2.5 shadow-sm shadow-black/5"
      style={{
        paddingHorizontal: 12, paddingVertical: 10,
        borderRadius: 12, borderCurve: 'continuous',
        minWidth: 110,
        backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border,
      } as object}
    >
      <Star size={11} color={C.action} fill={C.action} />
      <Text style={{ ...T.footnote, fontWeight: '600', color: C.text, maxWidth: 100 }} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

// ── SearchResultRow ───────────────────────────────────────────────────────────
function SearchResultRow({ item, query, onPress }: { item: UniversalSearchItem; query: string; onPress: () => void }) {
  const C = usePalette();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 py-3.5 active:opacity-70"
      style={{ borderBottomWidth: 1, borderBottomColor: C.divider }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: `${item.color}15`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: item.color }}>
          {item.module.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <HighlightText
          text={item.title}
          query={query}
          style={{ ...T.footnote, fontWeight: '600', color: C.text }}
          numberOfLines={1}
        />
        <HighlightText
          text={item.subtitle}
          query={query}
          style={{ ...T.caption1, color: C.textMuted, marginTop: 2 }}
          numberOfLines={1}
        />
      </View>
    </Pressable>
  );
}

// ── ProductivityBar ───────────────────────────────────────────────────────────
function ProductivityBar({ pct }: { pct: number }) {
  const C = usePalette();
  const color = pct >= 70 ? '#16A34A' : pct >= 40 ? '#D97706' : '#DC2626';
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ ...T.caption1, color: C.textMuted, fontWeight: '500' }}>Completion Rate</Text>
        <Text style={{ ...T.caption1, fontWeight: '700', color }}>{pct}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: C.divider, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  // Theme-reactive surface tokens — must live inside the component so they
  // re-evaluate when the user switches theme in Appearance settings.
  const { colorScheme: scheme } = useColorScheme();
  const palette = scheme === 'dark' ? THEME.dark : THEME.light;
  const C = {
    ...C_FIXED,
    text:      palette.foreground,
    textMuted: palette.mutedForeground,
    bg:        palette.background,
    surface:   palette.card,
    border:    palette.border,
    divider:   palette.muted,
  };
  const statusBarStyle = scheme === 'dark' ? 'light' : 'dark';
  const { workspace } = useWorkspace();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UniversalSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBackPressTime = useRef(0);

  const { items: pinnedItems, loaded: pinnedLoaded, unpinItem } = usePinnedItems();

  // Double-tap back to exit — Android only, active only on this screen
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      const now = Date.now();
      if (now - lastBackPressTime.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressTime.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []));

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await loadDashboardData();
        if (!cancelled) setData(d);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []));

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!text.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await universalSearch(text);
        setSearchResults(results);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const todayFmt = useMemo(() => new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }), []);

  // ── Group search results by module for SectionList ─────────────────────
  const searchSections = useMemo(() => {
    const map = new Map<string, UniversalSearchItem[]>();
    for (const item of searchResults) {
      const bucket = map.get(item.module) ?? [];
      bucket.push(item);
      map.set(item.module, bucket);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [searchResults]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <View className="flex-1 bg-background">
        <StatusBar style={statusBarStyle} backgroundColor={C.surface} />
        <DashboardHeader
          onMenuPress={() => setDrawerOpen(true)}
          onBellPress={() => {}}
          unreadCount={0}
        />
        <View style={{
          paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
          borderBottomWidth: 1, borderBottomColor: C.border,
          backgroundColor: C.surface,
        }}>
          <View style={{ height: 44, borderRadius: 12, backgroundColor: C.surface }} />
        </View>
        <SkeletonList rows={8} />
      </View>
    );
  }

  const { today, reminders, recentActivity, productivity } = data;
  const showSearch = searchQuery.length > 0;

  return (
    <View className="flex-1 bg-background">
      <StatusBar style={statusBarStyle} backgroundColor={C.surface} />

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ── Dashboard Header ────────────────────────────────────── */}
      <DashboardHeader
        onMenuPress={() => setDrawerOpen(true)}
        onBellPress={() => router.push('/(app)/mukadma' as never)}
        unreadCount={reminders.filter(r => r.daysLeft <= 0).length}
      />

      {/* ── Universal Search bar ────────────────────────────────── */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: C.surface,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Search FIR, GD, person, village, BNS…"
          variant="light"
        />
      </View>

      {/* ── Search overlay ─────────────────────────────────────── */}
      {showSearch ? (
        <View className="flex-1 bg-background">
          {searchLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color={C.action} />
            </View>
          ) : searchSections.length === 0 ? (
            <EmptyState
              title={`No results for "${searchQuery}"`}
              description="Try FIR number, person name, village, BNS section, or case type"
            />
          ) : (
            <SectionList
              removeClippedSubviews
              sections={searchSections}
              keyExtractor={(item) => `${item.module}-${item.id}`}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              renderSectionHeader={({ section }) => (
                <View style={{ paddingTop: 14, paddingBottom: 4, backgroundColor: C.bg }}>
                  <Text style={{ ...T.caption1, fontWeight: '700', color: C.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    {section.title}
                  </Text>
                </View>
              )}
              renderItem={({ item }) => (
                <SearchResultRow
                  item={item}
                  query={searchQuery}
                  onPress={() => { clearSearch(); router.push(item.route as never); }}
                />
              )}
            />
          )}
        </View>
      ) : (
        // ── Dashboard body ───────────────────────────────────────
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 60, gap: 24 }}
        >

          {/* ── Hero Banner ─────────────────────────────────────── */}
          <View
            className="shadow-md shadow-black/20"
            style={{
              backgroundColor: C.action,
              borderRadius: 20,
              padding: 14,
              borderCurve: 'continuous',
              gap: 10,
            } as object}
          >
            {/* Greeting row */}
            <View style={{ gap: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.75)' }}>
                {todayFmt}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3, lineHeight: 22 }}>
                {workspace.officer_name ? `Hello, ${workspace.officer_name} 👋` : 'Good morning, Officer 👋'}
              </Text>
              {workspace.police_station ? (
                <Text style={{ fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.70)', marginTop: 1 }}>
                  {workspace.police_station}{workspace.district ? `  ·  ${workspace.district}` : ''}
                </Text>
              ) : null}
            </View>

            {/* Active investigations stat + CTA row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: 12,
                padding: 10,
                gap: 2,
              }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', lineHeight: 26 }}>
                  {today.activeCase}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.80)' }}>
                  Active Investigations
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/(app)/mukadma' as never)}
                style={{
                  backgroundColor: C.surface,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                }}
                className="active:opacity-80"
              >
                <TrendingUp size={16} color={C.action} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: C.action }}>View All</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Today's Summary ── */}
          <View style={{ gap: 10 }}>
            <SectionHeader title="Today's Summary" icon={<CalendarDays size={13} color={C.textMuted} />} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatCard label="Pending FIR" value={today.activeCase} color={C.purple}
                onPress={() => router.push('/(app)/mukadma' as never)} />
              <StatCard label="Pending GD" value={today.todayGD} color={C.amber}
                onPress={() => router.push('/(app)/gd' as never)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatCard label="Court Work" value={today.activeCourtDocs} color={C.blue}
                onPress={() => router.push('/(app)/nyayalay' as never)} />
              <StatCard label="BNSS Actions" value={today.todayPending} color={C.red}
                onPress={() => router.push('/(app)/nirodhatmak' as never)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatCard label="Reminders" value={reminders.length}
                color={reminders.some(r => r.daysLeft < 0) ? C.red : C.amber}
                onPress={() => router.push('/(app)/mukadma' as never)} />
              <StatCard label="Petitions" value={today.pendingPrarthnaPatra} color={C.teal}
                onPress={() => router.push('/(app)/prarthna-patra' as never)} />
            </View>
          </View>

          {/* ── Quick Actions ── */}
          <View style={{ gap: 10 }}>
            <SectionHeader title="Quick Actions" icon={<Zap size={13} color={C.textMuted} />} />
            {/* Primary module row — horizontal scroll */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
              {[
                { label: 'New FIR',    icon: FileText,    color: MC.Mukadma,          route: '/(app)/mukadma/add-fir' },
                { label: 'New GD',     icon: BookMarked,  color: MC.GD,               route: '/(app)/gd/add-gd' },
                { label: 'Court Work', icon: Scale,       color: MC.Nyayalay,         route: '/(app)/nyayalay/add' },
                { label: 'Petition',   icon: Scroll,      color: MC['Prarthna Patra'],route: '/(app)/prarthna-patra/add' },
                { label: 'BNSS',       icon: ShieldAlert, color: MC.Nirodhatmak,      route: '/(app)/nirodhatmak' },
                { label: 'Beat Book',  icon: BookOpen,    color: MC.Halka,            route: '/(app)/halka' },
              ].map((item) => (
                <View key={item.label} style={{ width: 76 }}>
                  <QuickAction
                    label={item.label}
                    icon={item.icon}
                    color={item.color}
                    onPress={() => router.push(item.route as never)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── Pinned Items ── */}
          {pinnedLoaded && (
            <View style={{ gap: 10 }}>
              <SectionHeader
                title="Pinned"
                icon={<Star size={13} color={C.textMuted} />}
                actionLabel={pinnedItems.length > 0 ? 'Manage' : undefined}
                onAction={() => setDrawerOpen(true)}
              />
              {pinnedItems.length === 0 ? (
                <View
                  className="shadow-sm shadow-black/5"
                  style={{
                    backgroundColor: C.surface, borderRadius: 20, padding: 16,
                    alignItems: 'center', gap: 8, borderCurve: 'continuous',
                  } as object}
                >
                  <StarOff size={20} color={C.textMuted} />
                  <Text style={{ ...T.caption1, color: C.textMuted, textAlign: 'center' }}>
                    Long-press any screen link to pin it here.
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {pinnedItems.map((item) => (
                    <PinnedChip key={item.id} item={item} onUnpin={() => unpinItem(item.id)} />
                  ))}
                  <Pressable
                    onPress={() => setDrawerOpen(true)}
                    className="flex-row items-center gap-2 active:opacity-70 mr-2.5"
                    style={{
                      paddingHorizontal: 12, paddingVertical: 10,
                      borderRadius: 12, borderStyle: 'dashed',
                      borderCurve: 'continuous',
                      borderWidth: 1, borderColor: C.border,
                    } as object}
                  >
                    <MoreHorizontal size={14} color={C.textMuted} />
                    <Text style={{ ...T.footnote, color: C.textMuted }}>More</Text>
                  </Pressable>
                </ScrollView>
              )}
            </View>
          )}

          {/* ── Continue Working ── */}
          {recentActivity.length > 0 && (
            <View style={{ gap: 10 }}>
              <SectionHeader title="Continue Working" icon={<Clock size={13} color={C.textMuted} />} />
              <View
                className="shadow-sm shadow-black/5"
                style={{
                  backgroundColor: C.surface, borderRadius: 20,
                  paddingHorizontal: 16, borderCurve: 'continuous',
                } as object}
              >
                {recentActivity.slice(0, 6).map((a, idx) => (
                  <ContinueRow key={`${a.id}-${idx}`} item={a} />
                ))}
              </View>
            </View>
          )}

          {/* ── Upcoming Reminders ── */}
          {reminders.length > 0 && (
            <View style={{ gap: 10 }}>
              <SectionHeader title="Reminders" icon={<Bell size={13} color={C.textMuted} />} />
              <View
                className="shadow-sm shadow-black/5"
                style={{
                  backgroundColor: C.surface, borderRadius: 20,
                  paddingHorizontal: 16, borderCurve: 'continuous',
                } as object}
              >
                {reminders.slice(0, 6).map((r) => <ReminderRow key={r.id} item={r} />)}
                {reminders.length > 6 ? (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ ...T.caption1, fontWeight: '600', color: C.action }}>
                      +{reminders.length - 6} more reminders
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* ── Productivity ── */}
          <View style={{ gap: 10 }}>
            <SectionHeader title="Productivity" icon={<TrendingUp size={13} color={C.textMuted} />} />
            <View
              className="shadow-sm shadow-black/5"
              style={{
                backgroundColor: C.surface, borderRadius: 20, padding: 16,
                gap: 16, borderCurve: 'continuous',
              } as object}
            >
              <View style={{ flexDirection: 'row', gap: 0 }}>
                {[
                  { label: 'Today',      value: productivity.createdToday },
                  { label: 'This Week',  value: productivity.createdThisWeek },
                  { label: 'This Month', value: productivity.createdThisMonth },
                ].map((s, i) => (
                  <View key={s.label} style={{
                    flex: 1, alignItems: 'center',
                    borderRightWidth: i < 2 ? 1 : 0, borderRightColor: C.divider,
                  }}>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: C.text }}>{s.value}</Text>
                    <Text style={{ ...T.caption1, color: C.textMuted, marginTop: 2, textAlign: 'center' }}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <ProductivityBar pct={productivity.completionPct} />
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={12} color="#16A34A" />
                  <Text style={{ ...T.caption1, color: C.textMuted }}>{productivity.totalFinished} finished</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} color="#D97706" />
                  <Text style={{ ...T.caption1, color: C.textMuted }}>{productivity.totalPending} pending</Text>
                </View>
              </View>
            </View>
          </View>

        </ScrollView>
      )}
    </View>
  );
}


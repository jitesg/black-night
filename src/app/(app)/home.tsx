import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { clearAppLockSession } from '@/lib/appLockAuth';
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
import { useTranslation } from 'react-i18next';
import {
  BookOpen, FileText,
  BookMarked, ShieldAlert, Scroll, Scale,
  Bell, Clock,
  CalendarDays, Zap,
  ChevronRight,
} from 'lucide-react-native';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  loadDashboardData, universalSearch, SEARCH_MAX_PER_MODULE,
  type DashboardData, type ReminderItem,
  type RecentActivity, type UniversalSearchItem,
} from '@/lib/db/dashboardRepo';
import { AppDrawer } from '@/components/common/AppDrawer';
import { DashboardHeader } from '@/components/common/DashboardHeader';
import { loadNoticeCards } from '@/lib/db/noticeRepo';
import { noticeBadgeCount } from '@/lib/noticeCards';
import { reportRecordCounts } from '@/lib/db/reportRecordRepo';
import { warmKnowledgeSearch } from '@/lib/db/knowledgeRepo';
import { perfMarkOnce, perfSet } from '@/lib/perfLog';
import { SearchBar } from '@/components/SearchBar';
import { HighlightText } from '@/components/HighlightText';
import { SectionHeader, StatusChip, EmptyState, SkeletonList } from '@/components/ui/ds';
import { Pill } from '@/components/ui/ds/Pill';
import { SummaryBento } from '@/components/home/SummaryBento';
import { ProductivityCard } from '@/components/home/ProductivityCard';

// ── Semantic colour aliases — Trust Green palette ─────────────────────────────
const C_FIXED = {
  purple:    '#16A34A',
  blue:      '#15803D',
  amber:     '#D97706',
  red:       '#DC2626',
  teal:      '#0F766E',
  cyan:      '#0F766E',
  navy:      '#166534',
} as const;

const MC: Record<string, string> = {
  Mukadma:          '#16A34A',
  Nyayalay:         '#15803D',
  'Prarthna Patra': '#16A34A',
  GD:               '#D97706',
  Nirodhatmak:      '#DC2626',
  Halka:            '#0F766E',
  Knowledge:        '#16A34A',
};

// Shadow is applied via Tailwind className="shadow-sm shadow-black/5" — no legacy shadow* props.

// ── Palette ─────────────────────────────────────────────────────────────────
// Each sub-component that uses surface/text tokens calls useColorScheme()
// directly. This keeps them self-contained and avoids prop-drilling C.
function usePalette() {
  const { colorScheme } = useColorScheme();
  const p = colorScheme === 'dark' ? THEME.dark : THEME.light;
  return {
    ...C_FIXED,
    action:    p.primary,
    text:      p.foreground,
    textMuted: p.mutedForeground,
    bg:        p.background,
    surface:   p.card,
    border:    p.border,
    divider:   p.muted,
  };
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

// ── Hero date ────────────────────────────────────────────────────────────────
const HI_DAYS = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
const HI_MONTHS = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितम्बर', 'अक्टूबर', 'नवम्बर', 'दिसम्बर'];
/** "गुरुवार, 19 नवम्बर 2026" (built by hand — no Intl needed on the phone) / English "Thursday, 19 November 2026". */
function heroDate(d: Date, en: boolean): string {
  if (en) return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `${HI_DAYS[d.getDay()]}, ${d.getDate()} ${HI_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ── ReminderRow ──────────────────────────────────────────────────────────────

function ReminderRow({ item }: { item: ReminderItem }) {
  const { t } = useTranslation();
  const C = usePalette();
  const isOverdue = item.daysLeft < 0;
  const isToday   = item.daysLeft === 0;
  const variant   = isOverdue ? 'error' : isToday ? 'warning' : 'neutral';
  const badge     = isOverdue
    // the texts say "{{days}} दिन …" — pass `days` (was `count`, so "{{days}}" showed on screen — owner)
    ? t('home.daysLate', { days: Math.abs(item.daysLeft) })
    : isToday
    ? t('home.today')
    : t('home.daysRemaining', { days: item.daysLeft });
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
        <Text style={{ ...T.caption1, color: C.textMuted, marginTop: 2 }}>{/* module key stays English (colours / grouping); the word follows the app language (owner) */}
          {t(`home.reminderModule.${item.module}`, { defaultValue: item.module })}</Text>
      </View>
      <StatusChip label={badge} variant={variant} />
    </Pressable>
  );
}

// ── ContinueRow ──────────────────────────────────────────────────────────────
function ContinueRow({ item }: { item: RecentActivity }) {
  const { t } = useTranslation();
  const C = usePalette();
  const timeAgo = useMemo(() => {
    const diff = Math.floor(Date.now() / 1000) - item.time;
    if (diff < 60) return t('home.justNow');
    if (diff < 3600) return t('home.minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('home.hoursAgo', { count: Math.floor(diff / 3600) });
    return t('home.daysAgo', { count: Math.floor(diff / 86400) });
  }, [item.time, t]);
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
          {item.badge ?? item.label.slice(0, 2).toUpperCase()}
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
          {item.module === 'Law' ? '§' : item.module.slice(0, 2).toUpperCase()}
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

// ── Main Dashboard ────────────────────────────────────────────────────────────
// Home search: results shown per module before "सब देखें", and module names.
const SEARCH_PREVIEW = 5;
const SEARCH_MODULE_LABEL: Record<string, string> = {
  Law: 'धारा (BNS / BNSS / BSA)', FIR: 'मुकदमा', GD: 'GD', Nyayalay: 'न्यायालय', 'Prarthna Patra': 'प्रार्थना पत्र',
  Knowledge: 'कानूनी ज्ञान', Nirodhatmak: 'निरोधात्मक', Halka: 'मेरा हल्का',
};

export default function HomeScreen() {
  // Theme-reactive surface tokens — must live inside the component so they
  // re-evaluate when the user switches theme in Appearance settings.
  const { colorScheme: scheme } = useColorScheme();
  const palette = scheme === 'dark' ? THEME.dark : THEME.light;
  const C = {
    ...C_FIXED,
    action:    palette.primary,
    text:      palette.foreground,
    textMuted: palette.mutedForeground,
    bg:        palette.background,
    surface:   palette.card,
    border:    palette.border,
    divider:   palette.muted,
  };
  const statusBarStyle = scheme === 'dark' ? 'light' : 'dark';
  const { t, i18n } = useTranslation();
  const { workspace } = useWorkspace();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UniversalSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // Home search: module filter chip and modules opened with "सब देखें".
  const [searchModule, setSearchModule] = useState<string>('all');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Bell badge = सूचनाएँ that need action (overdue / due soon / केस डायरी लंबित).
  const [noticeCount, setNoticeCount] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    loadNoticeCards().then((c) => { if (alive) setNoticeCount(noticeBadgeCount(c)); }).catch(() => {});
    return () => { alive = false; };
  }, []));
  // "हाल के कार्य" tile (owner): reports made from predefined formats today / this week.
  const [recentCounts, setRecentCounts] = useState({ today: 0, week: 0 });
  useFocusEffect(useCallback(() => {
    let alive = true;
    reportRecordCounts().then((r) => { if (alive) setRecentCounts(r); }).catch(() => {});
    return () => { alive = false; };
  }, []));
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBackPressTime = useRef(0);


  // Double-tap back to exit — Android only, active only on this screen
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      const now = Date.now();
      if (now - lastBackPressTime.current < 2000) {
        // Exiting ends the App Lock session; the PIN is asked on next open.
        clearAppLockSession();
        BackHandler.exitApp();
        return true;
      }
      lastBackPressTime.current = now;
      ToastAndroid.show(t('home.pressBackToExit'), ToastAndroid.SHORT);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [t]));

  // Show the loading state only on the first visit; afterwards refresh in
  // the background so coming back to Home doesn't flash and re-lay out.
  const dashboardLoadedRef = useRef(false);
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      if (!dashboardLoadedRef.current) setLoading(true);
      try {
        const d = await loadDashboardData();
        if (!cancelled) { setData(d); dashboardLoadedRef.current = true; }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // the rows carry words in the app language (owner) — a language change reloads them while Home is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]));

  const searchSeqRef = useRef(0);
  useEffect(() => { perfMarkOnce('firstScreenMs'); }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setExpandedModules(new Set());
    const seq = ++searchSeqRef.current; // also cancels a search still running when the box is cleared
    if (!text.trim()) { setSearchResults([]); setSearchModule('all'); setSearchLoading(false); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const t0 = Date.now();
        const results = await universalSearch(text);
        perfSet('lastSearchMs', Date.now() - t0);
        // A slower, older search must not overwrite the newer one (list jumped while typing fast).
        if (seq === searchSeqRef.current) setSearchResults(results);
      } finally {
        if (seq === searchSeqRef.current) setSearchLoading(false);
      }
    }, 350);
  }, []);

  const clearSearch = useCallback(() => {
    searchSeqRef.current += 1;
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Hero card (owner, design C): date in the app language + a greeting by the time of day
  const lang = i18n.language;
  const todayFmt = useMemo(() => heroDate(new Date(), String(lang || '').startsWith('en')), [lang]);
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'home.greetingMorning' : hour < 17 ? 'home.helloWord' : 'home.greetingEvening');

  // ── Group search results by module for SectionList ─────────────────────
  const searchSections = useMemo(() => {
    const map = new Map<string, UniversalSearchItem[]>();
    for (const item of searchResults) {
      const bucket = map.get(item.module) ?? [];
      bucket.push(item);
      map.set(item.module, bucket);
    }
    const groups = Array.from(map.entries()).map(([module, items]) => ({ module, items }));
    const visible = searchModule === 'all' ? groups : groups.filter((g) => g.module === searchModule);
    return visible.map(({ module, items }) => {
      const open = searchModule !== 'all' || expandedModules.has(module) || items.length <= SEARCH_PREVIEW;
      return {
        title: `${SEARCH_MODULE_LABEL[module] ?? module} (${items.length}${items.length >= SEARCH_MAX_PER_MODULE ? '+' : ''})`,
        module, total: items.length, more: open ? 0 : items.length - SEARCH_PREVIEW,
        data: open ? items : items.slice(0, SEARCH_PREVIEW),
      };
    });
  }, [searchResults, searchModule, expandedModules]);
  const searchModuleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of searchResults) counts.set(item.module, (counts.get(item.module) ?? 0) + 1);
    return Array.from(counts.entries());
  }, [searchResults]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <View className="flex-1 bg-background">
        <StatusBar style={statusBarStyle} backgroundColor={C.surface} />
        <DashboardHeader
          onMenuPress={() => setDrawerOpen(true)}
          onBellPress={() => router.push('/(app)/notifications' as never)}
          unreadCount={noticeCount}
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

  const { today, reminders, recentActivity, nirodhatmak } = data;
  const goRoute = (route: string) => router.push(route as never);
  const showSearch = searchQuery.length > 0;

  return (
    <View className="flex-1 bg-background">
      <StatusBar style={statusBarStyle} backgroundColor={C.surface} />

      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ── Dashboard Header ────────────────────────────────────── */}
      <DashboardHeader
        onMenuPress={() => setDrawerOpen(true)}
        onBellPress={() => router.push('/(app)/notifications' as never)}
        unreadCount={noticeCount}
      />

      {/* ── Universal Search bar ────────────────────────────────── */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: C.surface,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <SearchBar
          value={searchQuery}
          noResults={!searchLoading && !!searchQuery.trim() && searchResults.length === 0}
          onChangeText={handleSearchChange}
          onFocus={() => { warmKnowledgeSearch().catch(() => {}); }}
          placeholder={t('home.searchPlaceholder')}
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
              title={t('home.noResultsFor', { query: searchQuery })}
              description={t('home.noResultsDesc')}
            />
          ) : (
            <SectionList
              removeClippedSubviews
              sections={searchSections}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingTop: 10 }}>
                  {[['all', searchResults.length] as [string, number], ...searchModuleCounts].map(([m, n]) => (
                    <Pill
                      key={m}
                      size="sm"
                      label={m === 'all' ? t('common.all', 'सभी') : (SEARCH_MODULE_LABEL[m] ?? m)}
                      count={n}
                      selected={searchModule === m}
                      outline={searchModule !== m}
                      tone="primary"
                      onPress={() => setSearchModule(m)}
                    />
                  ))}
                </ScrollView>
              }
              renderSectionFooter={({ section }) => section.more > 0 ? (
                <Pressable
                  onPress={() => setExpandedModules((prev) => new Set(prev).add(section.module))}
                  style={{ paddingVertical: 8, alignItems: 'flex-start' }}
                  accessibilityRole="button"
                >
                  <Text style={{ ...T.caption1, fontWeight: '700', color: C.action }}>
                    {t('home.searchSeeAll', 'सब देखें')} (+{section.more}) →
                  </Text>
                </Pressable>
              ) : null}
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
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderCurve: 'continuous',
              gap: 4,
            } as object}
          >
            {/* Greeting (owner, design C — the "सक्रिय जांच" box + "सभी देखें" are gone: the same count is the लंबित FIR tile below) */}
            <Text style={{ fontSize: 19, fontWeight: '700', color: palette.primaryForeground, letterSpacing: -0.3, lineHeight: 26 }}>
              {workspace.officer_name
                ? t('home.greetName', { greeting, name: workspace.officer_name })
                : t('home.greetOfficer', { greeting })}
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: palette.primaryForeground, opacity: 0.95, lineHeight: 19 }}>
              {`📅 ${todayFmt}`}
              {workspace.police_station
                ? `  ·  📍 ${workspace.police_station}${workspace.district ? `, ${workspace.district}` : ''}`
                : ''}
            </Text>
          </View>

          {/* ── मेरी उत्पादकता — right under the hero card (owner); design P1: मुकदमा / न्यायालय / प्रार्थना पत्र, मिले vs निस्तारित ── */}
          <ProductivityCard
            stats={data.prod}
            pending={{ fir: today.activeCase, firTotal: data.mukadma?.total ?? 0, court: today.activeCourtDocs, pp: today.pendingPrarthnaPatra }}
            go={goRoute}
          />

          {/* ── और काम (owner): निरोधात्मक / रिपोर्ट / आज की GD — मुकदमा, न्यायालय, प्रार्थना पत्र are in मेरा काम above ── */}
          <View style={{ gap: 10 }}>
            <SectionHeader title={t('home.summary.title')} icon={<CalendarDays size={13} color={C.textMuted} />} />
            <SummaryBento
              nkTotal={nirodhatmak?.total ?? 0}
              reportsWeek={recentCounts.week}
              reportsToday={recentCounts.today}
              gdToday={today.todayGD}
              go={goRoute}
            />
          </View>

          {/* ── Quick Actions ── */}
          <View style={{ gap: 10 }}>
            <SectionHeader title={t('home.quickActions')} icon={<Zap size={13} color={C.textMuted} />} />
            {/* Primary module row — horizontal scroll */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
              {[
                { label: t('home.newFir'),    icon: FileText,    color: MC.Mukadma,          route: '/(app)/mukadma/add-fir' },
                { label: t('home.newGd'),     icon: BookMarked,  color: MC.GD,               route: '/(app)/gd/add-gd' },
                { label: t('home.courtWork'), icon: Scale,       color: MC.Nyayalay,         route: '/(app)/nyayalay/add' },
                { label: t('home.petition'),  icon: Scroll,      color: MC['Prarthna Patra'],route: '/(app)/prarthna-patra/add' },
                { label: t('home.bnss'),      icon: ShieldAlert, color: MC.Nirodhatmak,      route: '/(app)/nirodhatmak' },
                { label: t('home.beatBook'),  icon: BookOpen,    color: MC.Halka,            route: '/(app)/halka' },
              ].map((item) => (
                <View key={item.route} style={{ width: 76 }}>
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

          {/* ── Continue Working ── */}
          {recentActivity.length > 0 && (
            <View style={{ gap: 10 }}>
              <SectionHeader title={t('home.continueWorking')} icon={<Clock size={13} color={C.textMuted} />} />
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
              <SectionHeader title={t('home.reminders')} icon={<Bell size={13} color={C.textMuted} />} />
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
                      {t('home.moreReminders', { count: reminders.length - 6 })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* ── Productivity ── */}

        </ScrollView>
      )}
    </View>
  );
}


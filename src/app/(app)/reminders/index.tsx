/**
 * Reminders — list screen.
 * Today summary card · tabs (आज / आगे / सभी / पूरे) · search · grouped
 * cards (छूटे, आज, कल, अगले 7 दिन, बाद में) · undo bar · add button.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter, type RelativePathString } from 'expo-router';
import { AlarmClock, BellOff, Plus, Search, ShieldCheck, Undo2, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { THEME } from '@/lib/theme';
import * as reminderRepo from '@/lib/db/reminderRepo';
import { hasNotificationPermission, requestReminderPermissions, openAppNotificationSettings } from '@/lib/reminderNotifications';
import {
  clearCompletedReminders, completeReminder, reminderTime, removeReminder, restoreRemovedReminder,
  restoreSnapshot, snoozeReminderUntil,
} from '@/lib/reminderService';
import { navigateToFIRTab } from '@/lib/firNavigation';
import { ReminderCard } from '@/components/reminders/ReminderCard';
import { OVERDUE_COLOR, dayLabel, fmtTime, sameDay } from '@/components/reminders/reminderUi';
import { matchesQuery } from '@/lib/searchUtils';

type Reminder = reminderRepo.Reminder;
type Tab = 'today' | 'upcoming' | 'all' | 'done';
type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'done';

interface Row { r: Reminder; at: number; group: GroupKey }

interface UndoState {
  message: string;
  undo: () => Promise<void>;
}

const GROUP_ORDER: GroupKey[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'done'];
const GROUP_LABEL: Record<GroupKey, string> = {
  overdue: 'reminders.groupOverdue',
  today: 'reminders.groupToday',
  tomorrow: 'reminders.groupTomorrow',
  week: 'reminders.groupWeek',
  later: 'reminders.groupLater',
  done: 'reminders.groupDone',
};

function groupOf(r: Reminder, at: number, now: number): GroupKey {
  if (r.is_completed) return 'done';
  if (at <= now) return 'overdue';
  const today = new Date(now);
  const d = new Date(at);
  if (sameDay(d, today)) return 'today';
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (sameDay(d, tomorrow)) return 'tomorrow';
  if (at - now < 7 * 86400000) return 'week';
  return 'later';
}

export default function RemindersScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = THEME[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [permOk, setPermOk] = useState(true);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setItems(await reminderRepo.getAllReminders());
      setPermOk(await hasNotificationPermission());
    } catch (e) {
      console.error('[Reminders] load failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      const id = setInterval(() => setTick((n) => n + 1), 30000);
      return () => clearInterval(id);
    }, [loadData])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const showUndo = (u: UndoState) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(u);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };

  const rows = useMemo<Row[]>(() => {
    void tick;
    const now = Date.now();
    return items.map((r) => {
      const at = reminderTime(r, now);
      return { r, at, group: groupOf(r, at, now) };
    });
  }, [items, tick]);

  const stats = useMemo(() => {
    const today = new Date();
    const todayRows = rows.filter((x) => x.group === 'today' || (x.group === 'done' && x.r.completed_at && sameDay(new Date(x.r.completed_at), today)));
    const overdue = rows.filter((x) => x.group === 'overdue').length;
    const doneToday = todayRows.filter((x) => x.group === 'done').length;
    const next = rows.filter((x) => x.group !== 'done' && x.group !== 'overdue').sort((a, b) => a.at - b.at)[0];
    return { total: todayRows.length, doneToday, overdue, next };
  }, [rows]);

  const counts = useMemo(() => ({
    today: rows.filter((x) => x.group === 'overdue' || x.group === 'today').length,
    upcoming: rows.filter((x) => ['tomorrow', 'week', 'later'].includes(x.group)).length,
    all: rows.filter((x) => x.group !== 'done').length,
    done: rows.filter((x) => x.group === 'done').length,
  }), [rows]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = rows.filter((x) => {
      if (q && !matchesQuery(q, x.r.title, x.r.note, x.r.fir_label)) return false;
      if (tab === 'today') return x.group === 'overdue' || x.group === 'today';
      if (tab === 'upcoming') return ['tomorrow', 'week', 'later'].includes(x.group);
      if (tab === 'done') return x.group === 'done';
      return q ? true : x.group !== 'done';
    });
    return GROUP_ORDER.map((g) => {
      const list = visible.filter((x) => x.group === g);
      if (g === 'overdue') list.sort((a, b) => b.at - a.at);
      else if (g === 'done') list.sort((a, b) => (b.r.completed_at ?? 0) - (a.r.completed_at ?? 0));
      else list.sort((a, b) => (a.r.priority === 'high' ? 0 : 1) - (b.r.priority === 'high' ? 0 : 1) || a.at - b.at);
      return { g, list };
    }).filter((s) => s.list.length > 0);
  }, [rows, tab, query]);

  // ── actions ──────────────────────────────────────────────────────────────
  const handleToggleDone = useCallback(async (r: Reminder) => {
    const snapshot = { ...r };
    try {
      if (r.is_completed) {
        await restoreSnapshot({ ...r, is_completed: 0, completed_at: null });
      } else {
        // optimistic: hide it from pending right away
        setItems((list) => list.map((x) => (x.id === r.id && x.repeat_mode === 'once' ? { ...x, is_completed: 1, completed_at: Date.now() } : x)));
        const res = await completeReminder(r);
        let message = t('reminders.completed');
        if (res === 'advanced') {
          const fresh = await reminderRepo.getReminderById(r.id);
          if (fresh) message = t('reminders.advanced', { when: `${dayLabel(reminderTime(fresh), t, i18n.language)} ${fmtTime(reminderTime(fresh))}` });
        }
        showUndo({ message, undo: () => restoreSnapshot(snapshot) });
      }
    } catch (e) {
      console.error('[Reminders] toggle failed:', e);
    }
    loadData();
  }, [i18n.language, loadData, t]);

  const handleDelete = useCallback(async (r: Reminder) => {
    setItems((list) => list.filter((x) => x.id !== r.id));
    try {
      await removeReminder(r);
      showUndo({ message: t('reminders.deleted'), undo: () => restoreRemovedReminder(r.id) });
    } catch (e) {
      console.error('[Reminders] delete failed:', e);
      // Tell the user instead of failing silently.
      Alert.alert(t('reminders.deleteFailed'), String((e as Error)?.message ?? e));
    }
    loadData();
  }, [loadData, t]);


  const handleSnooze = useCallback(async (r: Reminder, m: number | 'tomorrow') => {
    const snapshot = { ...r };
    let at: number;
    if (m === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      at = d.getTime();
    } else {
      at = Date.now() + m * 60000;
    }
    try {
      await snoozeReminderUntil(r.id, at);
      showUndo({ message: t('reminders.snoozedTo', { time: `${m === 'tomorrow' ? `${t('reminders.tomorrow')} ` : ''}${fmtTime(at)}` }), undo: () => restoreSnapshot(snapshot) });
    } catch (e) {
      console.error('[Reminders] snooze failed:', e);
    }
    loadData();
  }, [loadData, t]);

  const handleMenu = useCallback((r: Reminder) => {
    Alert.alert(r.title, undefined, [
      { text: r.is_completed ? t('reminders.undo') : t('reminders.tabDone'), onPress: () => handleToggleDone(r) },
      ...(r.is_completed ? [] : [{ text: t('reminders.snooze') + ' 1h', onPress: () => handleSnooze(r, 60) }]),
      { text: t('common.delete'), style: 'destructive' as const, onPress: () => handleDelete(r) },
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }, [handleDelete, handleSnooze, handleToggleDone, t]);

  const handleUndo = async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    try {
      await u.undo();
    } catch (e) {
      console.error('[Reminders] undo failed:', e);
    }
    loadData();
  };

  const handleClearDone = async () => {
    const ids = items.filter((x) => x.is_completed).map((x) => x.id);
    const n = await clearCompletedReminders();
    showUndo({
      message: t('reminders.cleared', { n }),
      undo: async () => {
        for (const id of ids) await reminderRepo.restoreReminder(id);
      },
    });
    loadData();
  };

  const openEdit = useCallback((r: Reminder) =>
    router.push({ pathname: '/(app)/reminders/add', params: { id: r.id } } as unknown as RelativePathString), [router]);
  const openCase = useCallback((r: Reminder) => {
    if (r.fir_id) navigateToFIRTab('details', r.fir_id, 'push');
  }, []);
  const openAdd = () => router.push('/(app)/reminders/add' as RelativePathString);

  const fixPermission = async () => {
    const ok = await requestReminderPermissions();
    if (!ok) await openAppNotificationSettings();
    setPermOk(ok);
  };

  // ── UI ───────────────────────────────────────────────────────────────────
  const progress = stats.total > 0 ? stats.doneToday / stats.total : 0;
  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: 'all', label: t('reminders.tabAll'), n: counts.all },
    { key: 'today', label: t('reminders.tabToday'), n: counts.today },
    { key: 'upcoming', label: t('reminders.tabUpcoming'), n: counts.upcoming },
    { key: 'done', label: t('reminders.tabDone'), n: counts.done },
  ];
  const emptyText = query ? t('reminders.noResults')
    : tab === 'today' ? t('reminders.emptyToday')
      : tab === 'upcoming' ? t('reminders.emptyUpcoming')
        : tab === 'done' ? t('reminders.emptyDone') : '';

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('reminders.title')}
        showBack
        actions={
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <HeaderIconBtn icon={Search} label={t('reminders.search')} onPress={() => { setSearchOpen((v) => !v); if (searchOpen) setQuery(''); }} />
            <HeaderIconBtn icon={ShieldCheck} label={t('reminders.health')} onPress={() => router.push('/(app)/reminders/health' as RelativePathString)} />
          </View>
        }
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={c.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {!permOk ? (
          <Pressable
            onPress={fixPermission}
            className="mb-3 rounded-2xl p-3.5 flex-row items-center gap-3 active:opacity-80"
            style={{ backgroundColor: isDark ? '#7F1D1D55' : '#FEE2E2', borderWidth: 1, borderColor: isDark ? '#F8717155' : '#FCA5A5' }}
          >
            <BellOff size={20} color={isDark ? '#FCA5A5' : '#B91C1C'} />
            <View className="flex-1">
              <Text style={{ color: isDark ? '#FCA5A5' : '#991B1B', fontWeight: '700', fontSize: 14 }}>{t('reminders.permTitle')}</Text>
              <Text style={{ color: isDark ? '#FECACA' : '#B91C1C', fontSize: 12, marginTop: 2 }}>{t('reminders.permDesc')}</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Today summary */}
        {items.length > 0 ? (
          <View
            style={{
              borderRadius: 20, padding: 16, marginBottom: 14,
              backgroundColor: isDark ? '#1E293B' : '#EEF2FF',
              borderWidth: 1, borderColor: isDark ? '#334155' : '#E0E7FF',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.mutedForeground, fontSize: 12.5, fontWeight: '600' }}>{t('reminders.heroToday')}</Text>
                <Text style={{ color: c.foreground, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
                  {stats.total > 0 ? t('reminders.heroDone', { done: stats.doneToday, total: stats.total }) : t('reminders.heroFree')}
                </Text>
              </View>
              {stats.overdue > 0 ? (
                <Pressable
                  onPress={() => setTab('today')}
                  style={{ paddingHorizontal: 10, height: 30, borderRadius: 999, backgroundColor: `${OVERDUE_COLOR}1F`, justifyContent: 'center' }}
                >
                  <Text style={{ color: OVERDUE_COLOR, fontWeight: '700', fontSize: 12.5 }}>⚠ {t('reminders.heroMissed', { n: stats.overdue })}</Text>
                </Pressable>
              ) : null}
            </View>
            {stats.total > 0 ? (
              <View style={{ height: 6, borderRadius: 3, backgroundColor: isDark ? '#334155' : '#C7D2FE', marginTop: 12, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(progress * 100)}%`, height: 6, borderRadius: 3, backgroundColor: '#4F46E5' }} />
              </View>
            ) : null}
            {stats.next ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <AlarmClock size={14} color={c.primary} />
                <Text numberOfLines={1} style={{ flex: 1, color: c.foreground, fontSize: 13 }}>
                  <Text style={{ fontWeight: '700' }}>{t('reminders.heroNext')}: </Text>
                  {dayLabel(stats.next.at, t, i18n.language)} {fmtTime(stats.next.at)} · {stats.next.r.title}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Search */}
        {searchOpen ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 14, paddingHorizontal: 12, backgroundColor: c.secondary, marginBottom: 12 }}>
            <Search size={16} color={c.mutedForeground} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={t('reminders.search')}
              placeholderTextColor={c.mutedForeground}
              style={{ flex: 1, color: c.foreground, fontSize: 15, paddingVertical: 0 }}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}><X size={16} color={c.mutedForeground} /></Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Tabs */}
        {items.length > 0 ? (
          <View style={{ flexDirection: 'row', backgroundColor: c.secondary, borderRadius: 14, padding: 4, marginBottom: 14 }}>
            {tabs.map((x) => {
              const active = tab === x.key;
              return (
                <Pressable
                  key={x.key}
                  onPress={() => setTab(x.key)}
                  style={{ flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, backgroundColor: active ? c.card : 'transparent' }}
                >
                  <Text textBreakStrategy="simple" numberOfLines={1} style={{ color: active ? c.foreground : c.mutedForeground, fontWeight: active ? '700' : '600', fontSize: 13 }}>
                    {x.label}
                  </Text>
                  {x.n > 0 ? (
                    <Text style={{ color: active ? c.primary : c.mutedForeground, fontWeight: '700', fontSize: 11.5 }}>{x.n}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Empty states */}
        {!loading && items.length === 0 ? (
          <View className="py-16 items-center justify-center">
            <View style={{ width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#1E293B' : '#EEF2FF', marginBottom: 16 }}>
              <AlarmClock size={34} color={c.primary} />
            </View>
            <Text className="text-lg font-bold text-foreground mb-1 text-center">{t('reminders.noneYet')}</Text>
            <Text className="text-sm text-muted-foreground text-center mb-6" style={{ maxWidth: 300 }}>{t('reminders.emptyDesc')}</Text>
            <Pressable onPress={openAdd} className="bg-primary px-5 h-11 rounded-xl flex-row items-center gap-2 active:opacity-80">
              <Plus size={18} color="#FFFFFF" />
              <Text className="text-sm font-semibold text-white">{t('reminders.createReminder')}</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && items.length > 0 && sections.length === 0 ? (
          <Text style={{ color: c.mutedForeground, textAlign: 'center', marginTop: 32, fontSize: 14 }}>{emptyText}</Text>
        ) : null}

        {/* Sections */}
        {sections.map(({ g, list }) => (
          <View key={g} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 2 }}>
              <Text style={{ color: g === 'overdue' ? OVERDUE_COLOR : c.foreground, fontSize: 14, fontWeight: '800' }}>{t(GROUP_LABEL[g])}</Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12.5, fontWeight: '700', flex: 1 }}>{list.length}</Text>
              {g === 'done' ? (
                <Pressable onPress={handleClearDone} hitSlop={8}>
                  <Text style={{ color: c.destructive, fontSize: 12.5, fontWeight: '600' }}>{t('reminders.clearDone')}</Text>
                </Pressable>
              ) : null}
            </View>
            {list.map(({ r, at }) => (
              <ReminderCard
                key={r.id}
                reminder={r}
                at={at}
                state={g === 'done' ? 'done' : g === 'overdue' ? 'overdue' : 'pending'}
                showDay={g !== 'today'}
                onPress={openEdit}
                onToggleDone={handleToggleDone}
                onDelete={handleDelete}
                onSnooze={handleSnooze}
                onOpenCase={openCase}
                onMenu={handleMenu}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Add button */}
      <Pressable
        onPress={openAdd}
        accessibilityRole="button"
        accessibilityLabel={t('reminders.addReminder')}
        className="active:opacity-85"
        style={{
          position: 'absolute', right: 20, bottom: Math.max(insets.bottom + 20, 32),
          height: 56, paddingHorizontal: 20, borderRadius: 28, backgroundColor: c.primary,
          flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6,
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
        }}
      >
        <Plus size={22} color={c.primaryForeground} strokeWidth={2.5} />
        <Text style={{ color: c.primaryForeground, fontWeight: '700', fontSize: 15 }}>{t('reminders.newReminder')}</Text>
      </Pressable>

      {/* Undo bar */}
      {undo ? (
        <View
          style={{
            position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom + 90, 100), borderRadius: 14,
            backgroundColor: isDark ? '#F1F5F9' : '#1F2937', flexDirection: 'row', alignItems: 'center',
            paddingLeft: 16, paddingRight: 6, minHeight: 50, elevation: 8,
          }}
        >
          <Text style={{ flex: 1, color: isDark ? '#0F172A' : '#F9FAFB', fontSize: 14, fontWeight: '500', paddingVertical: 8 }} numberOfLines={2}>
            {undo.message}
          </Text>
          <Pressable onPress={handleUndo} className="flex-row items-center gap-1.5 px-3 h-10 rounded-xl active:opacity-70">
            <Undo2 size={16} color={isDark ? '#2563EB' : '#93C5FD'} />
            <Text style={{ color: isDark ? '#2563EB' : '#93C5FD', fontWeight: '700', fontSize: 14 }}>{t('reminders.undo')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

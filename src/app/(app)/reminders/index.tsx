import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, AppState } from 'react-native';
import { useRouter, useFocusEffect, type RelativePathString } from 'expo-router';
import {
  Plus, Check, Trash2, BellOff, BellRing, RefreshCw, AlarmClock, ChevronDown, ChevronUp, AlertTriangle, Undo2,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { THEME } from '@/lib/theme';
import * as reminderRepo from '@/lib/db/reminderRepo';
import { hasNotificationPermission, openAppNotificationSettings, requestReminderPermissions } from '@/lib/reminderNotifications';
import {
  completeReminder, nextOccurrence, removeReminder, reopenReminder, restoreRemovedReminder,
} from '@/lib/reminderService';

type Reminder = reminderRepo.Reminder;
type TFn = (key: string, opts?: Record<string, unknown>) => string;

const REPEAT_LABEL_KEY = {
  once: 'reminders.repeat.once',
  daily: 'reminders.repeat.daily',
  weekly: 'reminders.repeat.weekly',
} as const;

const ACCENT = {
  overdue: '#DC2626',
  today: '#2563EB',
  later: '#7C3AED',
  done: '#16A34A',
} as const;

type Group = keyof typeof ACCENT;

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(ms: number, t: TFn, lang: string): string {
  const d = new Date(ms);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(d, now)) return t('reminders.today');
  if (sameDay(d, tomorrow)) return t('reminders.tomorrow');
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? '2-digit' : undefined,
  });
}

function timeParts(ms: number): { time: string; ampm: string } {
  const d = new Date(ms);
  const h = d.getHours();
  return { time: `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`, ampm: h >= 12 ? 'PM' : 'AM' };
}

function relative(ms: number, t: TFn): string {
  const diff = ms - Date.now();
  const mins = Math.round(Math.abs(diff) / 60000);
  if (mins < 1) return t('reminders.now');
  const future = diff > 0;
  if (mins < 60) return t(future ? 'reminders.inMin' : 'reminders.agoMin', { n: mins });
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return t(future ? 'reminders.inHr' : 'reminders.agoHr', { n: hrs });
  const days = Math.round(hrs / 24);
  return t(future ? 'reminders.inDay' : 'reminders.agoDay', { n: days });
}

interface UndoState {
  kind: 'deleted' | 'completed';
  reminder: Reminder;
}

export default function RemindersScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = THEME[colorScheme ?? 'light'];

  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [permOk, setPermOk] = useState(true);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setItems(await reminderRepo.getAllReminders());
      setPermOk(await hasNotificationPermission());
    } catch (e) {
      console.error('[Reminders] Failed to load reminders:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      // keep "in 5 min" labels and groups fresh while the screen is open
      const id = setInterval(() => setTick((n) => n + 1), 30000);
      return () => clearInterval(id);
    }, [loadData])
  );

  // Coming back from system settings → re-check permission.
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

  const groups = useMemo(() => {
    void tick; // re-group every 30 s
    const now = Date.now();
    const today = new Date();
    const g: Record<Group, { r: Reminder; at: number }[]> = { overdue: [], today: [], later: [], done: [] };
    for (const r of items) {
      const at = nextOccurrence(r, now);
      if (r.is_completed === 1) g.done.push({ r, at });
      else if (at <= now) g.overdue.push({ r, at });
      else if (sameDay(new Date(at), today)) g.today.push({ r, at });
      else g.later.push({ r, at });
    }
    g.overdue.sort((a, b) => b.at - a.at);
    g.today.sort((a, b) => a.at - b.at);
    g.later.sort((a, b) => a.at - b.at);
    g.done.sort((a, b) => b.r.updated_at - a.r.updated_at);
    return g;
  }, [items, tick]);

  const handleToggleDone = async (r: Reminder) => {
    // update the screen first so the tap feels instant
    setItems((list) => list.map((x) => (x.id === r.id ? { ...x, is_completed: r.is_completed ? 0 : 1, updated_at: Math.floor(Date.now() / 1000) } : x)));
    try {
      if (r.is_completed) {
        await reopenReminder(r);
      } else {
        await completeReminder(r);
        showUndo({ kind: 'completed', reminder: r });
      }
    } catch (e) {
      console.error('[Reminders] toggle done failed:', e);
    }
    loadData();
  };

  const handleDelete = async (r: Reminder) => {
    setItems((list) => list.filter((x) => x.id !== r.id));
    try {
      await removeReminder(r);
      showUndo({ kind: 'deleted', reminder: r });
    } catch (e) {
      console.error('[Reminders] Failed to delete reminder:', e);
    }
    loadData();
  };

  const handleUndo = async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    try {
      if (u.kind === 'deleted') await restoreRemovedReminder(u.reminder.id);
      else await reopenReminder(u.reminder);
    } catch (e) {
      console.error('[Reminders] undo failed:', e);
    }
    loadData();
  };

  const fixPermission = async () => {
    const ok = await requestReminderPermissions();
    if (!ok) openAppNotificationSettings();
    setPermOk(ok);
  };

  const openEdit = (r: Reminder) =>
    router.push({ pathname: '/(app)/reminders/add', params: { id: r.id } } as unknown as RelativePathString);

  const renderCard = ({ r, at }: { r: Reminder; at: number }, group: Group) => {
    const accent = ACCENT[group];
    const isDone = group === 'done';
    const { time, ampm } = timeParts(at);
    const SoundIcon = r.sound === 'silent' ? BellOff : r.sound === 'alarm' ? AlarmClock : BellRing;
    const tint = `${accent}${isDark ? '26' : '12'}`;

    return (
      <Pressable
        key={r.id}
        onPress={() => openEdit(r)}
        className="bg-card border border-border rounded-2xl mb-2.5 flex-row overflow-hidden active:opacity-80"
        style={{ borderCurve: 'continuous', opacity: isDone ? 0.75 : 1 }}
      >
        {/* Time block */}
        <View style={{ width: 76, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
          <Text style={{ color: accent, fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{time}</Text>
          <Text style={{ color: accent, fontSize: 11, fontWeight: '700', marginTop: -1 }}>{ampm}</Text>
          <Text textBreakStrategy="simple" numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 11, fontWeight: '600', marginTop: 4 }}>
            {dayLabel(at, t, i18n.language)}
          </Text>
        </View>

        {/* Content */}
        <View className="flex-1 min-w-0" style={{ paddingVertical: 12, paddingLeft: 12, paddingRight: 4 }}>
          <Text
            numberOfLines={2}
            textBreakStrategy="simple"
            className={`text-[15px] font-semibold ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
          >
            {r.title}
          </Text>
          {r.note ? (
            <Text numberOfLines={2} textBreakStrategy="simple" className="text-xs text-muted-foreground mt-0.5">
              {r.note}
            </Text>
          ) : null}

          <View className="flex-row flex-wrap items-center mt-2" style={{ gap: 6 }}>
            {!isDone ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: tint }}>
                {group === 'overdue' ? <AlertTriangle size={11} color={accent} /> : null}
                <Text textBreakStrategy="simple" numberOfLines={1} style={{ color: accent, fontSize: 11, fontWeight: '700' }}>
                  {relative(at, t)}
                </Text>
              </View>
            ) : null}
            {r.repeat_mode !== 'once' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: c.secondary }}>
                <RefreshCw size={10} color={c.secondaryForeground} />
                <Text textBreakStrategy="simple" numberOfLines={1} style={{ color: c.secondaryForeground, fontSize: 11, fontWeight: '600' }}>
                  {t(REPEAT_LABEL_KEY[r.repeat_mode] ?? 'reminders.repeat.once')}
                </Text>
              </View>
            ) : null}
            <SoundIcon size={13} color={c.mutedForeground} />
          </View>
        </View>

        {/* Actions */}
        <View style={{ justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingRight: 8 }}>
          <Pressable
            onPress={() => handleToggleDone(r)}
            hitSlop={6}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isDone }}
            style={{
              width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: isDone ? ACCENT.done : accent,
              backgroundColor: isDone ? ACCENT.done : 'transparent',
            }}
          >
            {isDone ? <Check size={17} color="#fff" strokeWidth={3} /> : null}
          </Pressable>
          <Pressable
            onPress={() => handleDelete(r)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
            style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            <Trash2 size={17} color={c.destructive} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const section = (group: Exclude<Group, 'done'>, labelKey: string) =>
    groups[group].length > 0 ? (
      <View className="mb-4">
        <View className="flex-row items-center gap-2 mb-2 px-1">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT[group] }} />
          <Text className="text-sm font-bold text-foreground">{t(labelKey)}</Text>
          <Text className="text-xs font-semibold text-muted-foreground">{groups[group].length}</Text>
        </View>
        {groups[group].map((x) => renderCard(x, group))}
      </View>
    ) : null;

  const isEmpty = items.length === 0;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={t('reminders.title')}
        showBack
        actions={
          <HeaderIconBtn
            icon={Plus}
            label={t('reminders.addReminder')}
            onPress={() => router.push('/(app)/reminders/add' as RelativePathString)}
          />
        }
      />

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={c.primary} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
      >
        {!permOk ? (
          <Pressable
            onPress={fixPermission}
            className="mb-4 rounded-2xl p-3.5 flex-row items-center gap-3 active:opacity-80"
            style={{ backgroundColor: isDark ? '#7F1D1D55' : '#FEE2E2', borderWidth: 1, borderColor: isDark ? '#F8717155' : '#FCA5A5' }}
          >
            <BellOff size={20} color={isDark ? '#FCA5A5' : '#B91C1C'} />
            <View className="flex-1">
              <Text style={{ color: isDark ? '#FCA5A5' : '#991B1B', fontWeight: '700', fontSize: 14 }}>{t('reminders.permTitle')}</Text>
              <Text style={{ color: isDark ? '#FECACA' : '#B91C1C', fontSize: 12, marginTop: 2 }}>{t('reminders.permDesc')}</Text>
            </View>
          </Pressable>
        ) : null}

        {isEmpty && !loading ? (
          <View className="py-20 items-center justify-center">
            <View className="w-16 h-16 rounded-2xl bg-muted/30 items-center justify-center mb-4">
              <AlarmClock size={28} color={c.mutedForeground} />
            </View>
            <Text className="text-base font-semibold text-foreground mb-1 text-center">{t('reminders.noneYet')}</Text>
            <Text className="text-sm text-muted-foreground text-center max-w-xs mb-6">{t('reminders.emptyDesc')}</Text>
            <Pressable
              onPress={() => router.push('/(app)/reminders/add' as RelativePathString)}
              className="bg-primary px-5 py-2.5 rounded-xl flex-row items-center gap-2 active:opacity-80"
            >
              <Plus size={16} color="#FFFFFF" />
              <Text className="text-sm font-semibold text-white">{t('reminders.createReminder')}</Text>
            </Pressable>
          </View>
        ) : null}

        {section('overdue', 'reminders.overdue')}
        {section('today', 'reminders.today')}
        {section('later', 'reminders.later')}

        {groups.done.length > 0 ? (
          <View className="mb-4">
            <Pressable onPress={() => setShowDone((v) => !v)} className="flex-row items-center gap-2 mb-2 px-1 py-1 active:opacity-70">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT.done }} />
              <Text className="text-sm font-bold text-foreground">{t('reminders.done')}</Text>
              <Text className="text-xs font-semibold text-muted-foreground flex-1">{groups.done.length}</Text>
              {showDone ? <ChevronUp size={18} color={c.mutedForeground} /> : <ChevronDown size={18} color={c.mutedForeground} />}
            </Pressable>
            {showDone ? groups.done.map((x) => renderCard(x, 'done')) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Undo bar */}
      {undo ? (
        <View
          style={{
            position: 'absolute', left: 16, right: 16, bottom: 24, borderRadius: 14,
            backgroundColor: isDark ? '#F1F5F9' : '#1F2937', flexDirection: 'row', alignItems: 'center',
            paddingLeft: 16, paddingRight: 6, height: 50, elevation: 6,
          }}
        >
          <Text style={{ flex: 1, color: isDark ? '#0F172A' : '#F9FAFB', fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
            {t(undo.kind === 'deleted' ? 'reminders.deleted' : 'reminders.completed')}
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

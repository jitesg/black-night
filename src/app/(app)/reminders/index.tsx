import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect, type RelativePathString } from 'expo-router';
import { Plus, Check, Clock, Trash2, CalendarCheck, BellOff, RefreshCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { THEME } from '@/lib/theme';
import * as reminderRepo from '@/lib/db/reminderRepo';
import { cancelReminderNotification } from '@/lib/reminderNotifications';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

const REPEAT_LABEL_KEY = {
  once: 'reminders.repeat.once',
  daily: 'reminders.repeat.daily',
  weekly: 'reminders.repeat.weekly',
} as const;

function formatDueAt(dueAt: number, t: (key: string, opts?: any) => string): string {
  const ms = dueAt < 10000000000 ? dueAt * 1000 : dueAt;
  const d = new Date(ms);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timeStr = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return t('reminders.todayAt', { time: timeStr });
  }

  const dateStr = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });

  return `${dateStr} • ${timeStr}`;
}

export default function RemindersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = THEME[colorScheme ?? 'light'];

  const [upcoming, setUpcoming] = useState<reminderRepo.Reminder[]>([]);
  const [past, setPast] = useState<reminderRepo.Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<reminderRepo.Reminder | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [up, pt] = await Promise.all([
        reminderRepo.getUpcomingReminders(),
        reminderRepo.getPastReminders(),
      ]);
      setUpcoming(up);
      setPast(pt);
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
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleComplete = async (reminder: reminderRepo.Reminder) => {
    try {
      await reminderRepo.markCompleted(reminder.id);
      if (reminder.notification_id) {
        await cancelReminderNotification(reminder.notification_id);
      }
      await loadData();
    } catch (e) {
      console.error('[Reminders] Failed to mark completed:', e);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await reminderRepo.deleteReminder(deleteTarget.id);
      if (deleteTarget.notification_id) {
        await cancelReminderNotification(deleteTarget.notification_id);
      }
      setDeleteTarget(null);
      await loadData();
    } catch (e) {
      console.error('[Reminders] Failed to delete reminder:', e);
    }
  };

  const renderReminderRow = (item: reminderRepo.Reminder, isUpcoming: boolean) => {
    const isDone = item.is_completed === 1;

    return (
      <View
        key={item.id}
        className="bg-card border border-border rounded-2xl p-4 mb-3 flex-row items-center gap-3.5"
        style={{ borderCurve: 'continuous' }}
      >
        {/* Complete Checkbox */}
        <Pressable
          onPress={() => !isDone && handleComplete(item)}
          disabled={isDone}
          hitSlop={8}
          className={`w-7 h-7 rounded-full items-center justify-center border ${
            isDone
              ? 'bg-emerald-600 border-emerald-600'
              : 'border-muted-foreground/40 bg-muted/20 active:opacity-60'
          }`}
        >
          {isDone ? (
            <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
          ) : (
            <Clock size={14} className="text-muted-foreground/60" />
          )}
        </Pressable>

        {/* Content */}
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center gap-2">
            <Text
              numberOfLines={1}
              className={`text-base font-semibold ${
                isDone ? 'line-through text-muted-foreground' : 'text-foreground'
              }`}
            >
              {item.title}
            </Text>
            {item.repeat_mode !== 'once' && (
              <View className="flex-row items-center gap-1 bg-primary/10 rounded-full px-2.5 py-1">
                <RefreshCw size={10} color={c.primary} />
                <Text textBreakStrategy="simple" className="text-[10px] font-medium text-primary">
                  {t(REPEAT_LABEL_KEY[item.repeat_mode] ?? 'reminders.repeat.once')}
                </Text>
              </View>
            )}
          </View>

          {item.note ? (
            <Text numberOfLines={1} className="text-xs text-muted-foreground mt-0.5">
              {item.note}
            </Text>
          ) : null}

          <View className="flex-row items-center gap-1.5 mt-1.5">
            <CalendarCheck size={12} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground font-medium">
              {formatDueAt(item.due_at, t)}
            </Text>
          </View>
        </View>

        {/* Delete button */}
        <Pressable
          onPress={() => setDeleteTarget(item)}
          hitSlop={8}
          className="w-9 h-9 rounded-full items-center justify-center active:opacity-60"
        >
          <Trash2 size={16} className="text-destructive/80" />
        </Pressable>
      </View>
    );
  };

  const isEmpty = upcoming.length === 0 && past.length === 0;

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

      <FlatList
        data={[{ key: 'content' }]}
        keyExtractor={(item) => item.key}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary} />
        }
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        renderItem={() => (
          <>
            {isEmpty && !loading ? (
              <View className="py-20 items-center justify-center">
                <View className="w-16 h-16 rounded-2xl bg-muted/30 items-center justify-center mb-4">
                  <BellOff size={28} className="text-muted-foreground" />
                </View>
                <Text className="text-base font-semibold text-foreground mb-1 text-center">
                  {t('reminders.noneYet')}
                </Text>
                <Text className="text-sm text-muted-foreground text-center max-w-xs mb-6">
                  {t('reminders.emptyDesc')}
                </Text>
                <Pressable
                  onPress={() => router.push('/(app)/reminders/add' as RelativePathString)}
                  className="bg-primary px-5 py-2.5 rounded-xl flex-row items-center gap-2 active:opacity-80"
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text className="text-sm font-semibold text-white">{t('reminders.createReminder')}</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Upcoming Section */}
            {upcoming.length > 0 && (
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3 px-1">
                  <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('reminders.upcoming')} ({upcoming.length})
                  </Text>
                </View>
                {upcoming.map((item) => renderReminderRow(item, true))}
              </View>
            )}

            {/* Past / Completed Section */}
            {past.length > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-3 px-1">
                  <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('reminders.pastCompleted')} ({past.length})
                  </Text>
                </View>
                {past.map((item) => renderReminderRow(item, false))}
              </View>
            )}
          </>
        )}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reminders.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reminders.deleteDesc', { title: deleteTarget?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setDeleteTarget(null)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onPress={handleDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

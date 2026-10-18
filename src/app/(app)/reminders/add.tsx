import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bell, AlertTriangle, CalendarDays, Clock, Volume2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { TimePickerModal, formatTime12 } from '@/components/common/TimePickerModal';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { THEME } from '@/lib/theme';
import * as reminderRepo from '@/lib/db/reminderRepo';
import { requestReminderPermissions, sendTestReminder, type ReminderSound } from '@/lib/reminderNotifications';
import { dueMs, saveReminder } from '@/lib/reminderService';
import { SOUND_OPTION_KEYS } from '@/app/(app)/settings/reminders';

type Repeat = 'once' | 'daily' | 'weekly';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Default for a new reminder: settings time today, or +1 hour if that has passed. */
function defaultDue(settingsTime: string): Date {
  const [h, m] = (settingsTime || '09:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h || 9, m || 0, 0, 0);
  if (d.getTime() <= Date.now() + 60000) {
    const n = new Date(Date.now() + 60 * 60000);
    n.setMinutes(Math.ceil(n.getMinutes() / 5) * 5, 0, 0);
    return n;
  }
  return d;
}

export default function AddReminderScreen() {
  const router = useRouter();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const { t, i18n } = useTranslation();
  const { settings } = useSettingsStore();
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  const [init] = useState(() => defaultDue(settings.reminderTime));
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dateStr, setDateStr] = useState(toDateStr(init));
  const [timeStr, setTimeStr] = useState(toTimeStr(init));
  const [repeatMode, setRepeatMode] = useState<Repeat>(settings.reminderRepeat || 'once');
  const [sound, setSound] = useState<ReminderSound>((settings.reminderSound as ReminderSound) || 'default');
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [loaded, setLoaded] = useState(!editId);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit mode: load the reminder.
  useEffect(() => {
    if (!editId) return;
    reminderRepo.getReminderById(String(editId)).then((r) => {
      if (r) {
        const d = new Date(dueMs(r));
        setTitle(r.title);
        setNote(r.note);
        setDateStr(toDateStr(d));
        setTimeStr(toTimeStr(d));
        setRepeatMode(r.repeat_mode);
        setSound((r.sound as ReminderSound) || 'default');
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [editId]);

  const repeatOptions: { value: Repeat; label: string }[] = [
    { value: 'once', label: t('reminders.repeat.once') },
    { value: 'daily', label: t('reminders.repeat.daily') },
    { value: 'weekly', label: t('reminders.repeat.weekly') },
  ];
  const soundOptions = SOUND_OPTION_KEYS.map((o) => ({ value: o.value as ReminderSound, label: t(o.labelKey) }));

  const target = (() => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, mi] = timeStr.split(':').map(Number);
    if ([y, mo, d, h, mi].some((n) => n == null || isNaN(n))) return null;
    return new Date(y, mo - 1, d, h, mi, 0, 0);
  })();

  const applyQuick = (d: Date) => {
    setDateStr(toDateStr(d));
    setTimeStr(toTimeStr(d));
    setValidationError(null);
  };
  const quick = [
    { key: 'q10m', make: () => new Date(Date.now() + 10 * 60000) },
    { key: 'q1h', make: () => new Date(Date.now() + 60 * 60000) },
    { key: 'qEvening', make: () => { const d = new Date(); d.setHours(18, 0, 0, 0); return d; }, hide: new Date().getHours() >= 18 },
    { key: 'qTomorrow', make: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  ].filter((q) => !q.hide);

  const canSave = title.trim().length > 0 && !!target && loaded;

  const handleSave = async () => {
    if (!canSave || saving || !target) return;
    setValidationError(null);
    setErrorBanner(null);

    // Repeating reminders may start at a past time (they roll to the next day/week).
    if (repeatMode === 'once' && target.getTime() <= Date.now()) {
      setValidationError(t('reminders.errorPastTime'));
      return;
    }

    setSaving(true);
    try {
      await requestReminderPermissions();
      await saveReminder(
        { title: title.trim(), note: note.trim(), dueAt: target.getTime(), repeatMode, sound },
        editId ? String(editId) : undefined,
      );
      router.back();
    } catch (e) {
      console.error('[AddReminder] Error scheduling reminder:', e);
      setErrorBanner(t('reminders.errorSchedule'));
    } finally {
      setSaving(false);
    }
  };

  const testSound = async () => {
    const ok = await sendTestReminder(sound, 5);
    setInfo(ok ? t('reminders.testSent') : t('reminders.permDesc'));
  };

  const chip = (active: boolean) => ({
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: 'center' as const,
    backgroundColor: active ? c.primary : c.secondary,
  });
  const chipText = (active: boolean) => ({
    color: active ? c.primaryForeground : c.secondaryForeground,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
    includeFontPadding: false,
  });

  const dateLabel = (() => {
    if (!target) return t('reminders.pickDate');
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (same(target, now)) return t('reminders.today');
    if (same(target, tomorrow)) return t('reminders.tomorrow');
    return target.toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  })();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={editId ? t('reminders.editReminder') : t('reminders.newReminder')} showBack />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {errorBanner && (
          <View className="mb-4 bg-destructive/15 border border-destructive/30 rounded-2xl p-4 flex-row items-center gap-3">
            <AlertTriangle size={18} color={c.destructive} />
            <Text className="text-sm text-destructive font-medium flex-1">{errorBanner}</Text>
          </View>
        )}

        <View className="gap-4">
          <Input
            label={t('reminders.fieldTitle')}
            required
            placeholder={t('reminders.fieldTitlePlaceholder')}
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              if (validationError) setValidationError(null);
            }}
          />

          <Input
            type="multiline"
            label={t('reminders.fieldNote')}
            placeholder={t('reminders.fieldNotePlaceholder')}
            value={note}
            onChangeText={setNote}
          />

          {/* When */}
          <View className="bg-card border border-border rounded-2xl p-3.5" style={{ borderCurve: 'continuous' }}>
            <Text className="text-xs font-bold text-muted-foreground mb-2.5">{t('reminders.when')}</Text>
            <View className="flex-row gap-2.5">
              <Pressable
                onPress={() => setShowDate(true)}
                className="flex-1 flex-row items-center gap-2 rounded-xl px-3 active:opacity-70"
                style={{ height: 48, backgroundColor: c.secondary }}
              >
                <CalendarDays size={18} color={c.primary} />
                <Text numberOfLines={1} textBreakStrategy="simple" style={{ color: c.foreground, fontSize: 15, fontWeight: '600', flex: 1 }}>
                  {dateLabel}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowTime(true)}
                className="flex-row items-center gap-2 rounded-xl px-3 active:opacity-70"
                style={{ height: 48, backgroundColor: c.secondary, minWidth: 128 }}
              >
                <Clock size={18} color={c.primary} />
                <Text style={{ color: c.foreground, fontSize: 15, fontWeight: '600' }}>{formatTime12(timeStr)}</Text>
              </Pressable>
            </View>

            <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
              {quick.map((q) => (
                <Pressable key={q.key} onPress={() => applyQuick(q.make())} style={chip(false)} className="active:opacity-70">
                  <Text textBreakStrategy="simple" numberOfLines={1} style={chipText(false)}>{t(`reminders.${q.key}`)}</Text>
                </Pressable>
              ))}
            </View>

            {validationError ? (
              <Text className="text-xs text-destructive font-medium mt-2.5">{validationError}</Text>
            ) : null}
          </View>

          {/* Repeat */}
          <View className="bg-card border border-border rounded-2xl p-3.5" style={{ borderCurve: 'continuous' }}>
            <Text className="text-xs font-bold text-muted-foreground mb-2.5">{t('reminders.repeatEvery')}</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {repeatOptions.map((o) => (
                <Pressable key={o.value} onPress={() => setRepeatMode(o.value)} style={chip(repeatMode === o.value)} className="active:opacity-70">
                  <Text textBreakStrategy="simple" numberOfLines={1} style={chipText(repeatMode === o.value)}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Sound */}
          <View className="bg-card border border-border rounded-2xl p-3.5" style={{ borderCurve: 'continuous' }}>
            <View className="flex-row items-center mb-2.5">
              <Text className="text-xs font-bold text-muted-foreground flex-1">{t('reminders.soundLabel')}</Text>
              <Pressable onPress={testSound} hitSlop={8} className="flex-row items-center gap-1.5 active:opacity-70">
                <Volume2 size={15} color={c.primary} />
                <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }}>{t('reminders.testSound')}</Text>
              </Pressable>
            </View>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {soundOptions.map((o) => (
                <Pressable key={o.value} onPress={() => setSound(o.value)} style={chip(sound === o.value)} className="active:opacity-70">
                  <Text textBreakStrategy="simple" numberOfLines={1} style={chipText(sound === o.value)}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
            {info ? <Text className="text-xs text-muted-foreground mt-2.5">{info}</Text> : null}
          </View>

          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            className={`mt-2 h-12 rounded-xl flex-row items-center justify-center gap-2 active:opacity-80 ${
              !canSave || saving ? 'bg-primary/50' : 'bg-primary'
            }`}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Bell size={18} color="#FFFFFF" />
                <Text className="text-base font-semibold text-white">
                  {editId ? t('reminders.saveChanges') : t('reminders.saveReminder')}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <DatePickerModal
        visible={showDate}
        value={dateStr}
        label={t('reminders.fieldDate')}
        onConfirm={(v) => {
          setDateStr(v);
          setShowDate(false);
          setValidationError(null);
        }}
        onClose={() => setShowDate(false)}
      />
      <TimePickerModal
        visible={showTime}
        value={timeStr}
        title={t('reminders.pickTime')}
        accentColor={c.primary}
        onConfirm={(v) => {
          setTimeStr(v);
          setShowTime(false);
          setValidationError(null);
        }}
        onClose={() => setShowTime(false)}
      />
    </View>
  );
}

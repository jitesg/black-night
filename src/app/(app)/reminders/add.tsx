/**
 * New / edit reminder.
 * Params: id (edit) · title, firId, firLabel, category (prefill from other screens)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle, Bell, CalendarDays, Check, Clock, FolderOpen, Trash2, Volume2, X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { TimePickerModal, formatTime12 } from '@/components/common/TimePickerModal';
import { FirPickerModal } from '@/components/reminders/FirPickerModal';
import { CATEGORY_META, CATEGORY_ORDER, PRIORITY_META, dayLabel, dayNames, tint } from '@/components/reminders/reminderUi';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { THEME } from '@/lib/theme';
import * as reminderRepo from '@/lib/db/reminderRepo';
import type { ReminderCategory, ReminderPriority, ReminderRepeatMode } from '@/lib/db/reminderRepo';
import { requestReminderPermissions, sendTestReminder, type ReminderSound } from '@/lib/reminderNotifications';
import { dueMs, removeReminder, saveReminder } from '@/lib/reminderService';
import { SOUND_OPTION_KEYS } from '@/app/(app)/settings/reminders';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const EARLY_OPTIONS = [0, 5, 15, 30, 60, 1440];
const NAG_OPTIONS = [0, 5, 10, 15, 30];

/** Default for a new reminder: settings time today, or the next round hour. */
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

function earlyLabel(n: number, t: (k: string) => string): string {
  return t(n === 0 ? 'reminders.earlyOff' : `reminders.early${n}`);
}

type Theme = (typeof THEME)['light'];

function Card({ c, title: label, children, right }: { c: Theme; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ flex: 1, color: c.mutedForeground, fontSize: 12.5, fontWeight: '700' }}>{label}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function Chip({ c, isDark, active, label, onPress, color, icon }: {
  c: Theme; isDark: boolean; active: boolean; label: string; onPress: () => void; color?: string; icon?: React.ReactNode;
}) {
  const accent = color ?? c.primary;
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-70"
      style={{
        height: 34, paddingHorizontal: 13, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: active ? (color ? tint(accent, isDark, true) : accent) : c.secondary,
        borderWidth: 1, borderColor: active ? accent : 'transparent',
      }}
    >
      {icon}
      <Text
        textBreakStrategy="simple"
        numberOfLines={1}
        style={{
          color: active ? (color ? accent : c.primaryForeground) : c.secondaryForeground,
          fontSize: 13, lineHeight: 18, fontWeight: '600', includeFontPadding: false,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ReminderEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; title?: string; firId?: string; firLabel?: string; category?: string }>();
  const editId = params.id ? String(params.id) : undefined;
  const { t, i18n } = useTranslation();
  const { settings } = useSettingsStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = THEME[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [init] = useState(() => defaultDue(settings.reminderTime));
  const [title, setTitle] = useState(params.title ? String(params.title) : '');
  const [note, setNote] = useState('');
  const [dateStr, setDateStr] = useState(toDateStr(init));
  const [timeStr, setTimeStr] = useState(toTimeStr(init));
  const [repeat, setRepeat] = useState<ReminderRepeatMode>(settings.reminderRepeat || 'once');
  const [days, setDays] = useState<number[]>([]);
  const [earlyMin, setEarlyMin] = useState<number>(settings.reminderEarly ?? 0);
  const [nagMin, setNagMin] = useState<number>(settings.reminderNag ?? 0);
  const [sound, setSound] = useState<ReminderSound>((settings.reminderSound as ReminderSound) || 'default');
  const [category, setCategory] = useState<ReminderCategory>(
    (CATEGORY_ORDER as string[]).includes(String(params.category)) ? (params.category as ReminderCategory) : 'general',
  );
  const [priority, setPriority] = useState<ReminderPriority>('normal');
  const [fir, setFir] = useState<{ id: string; label: string } | null>(
    params.firId ? { id: String(params.firId), label: String(params.firLabel ?? '') } : null,
  );

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showFir, setShowFir] = useState(false);
  const [loaded, setLoaded] = useState(!editId);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    reminderRepo.getReminderById(editId).then((r) => {
      if (r) {
        const d = new Date(dueMs(r));
        setTitle(r.title);
        setNote(r.note);
        setDateStr(toDateStr(d));
        setTimeStr(toTimeStr(d));
        setRepeat(r.repeat_mode);
        setDays(r.repeat_days);
        setEarlyMin(r.early_min);
        setNagMin(r.nag_min);
        setSound((r.sound as ReminderSound) || 'default');
        setCategory(r.category);
        setPriority(r.priority);
        setFir(r.fir_id ? { id: r.fir_id, label: r.fir_label } : null);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [editId]);

  const target = useMemo(() => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, mi] = timeStr.split(':').map(Number);
    if ([y, mo, d, h, mi].some((n) => n == null || isNaN(n))) return null;
    return new Date(y, mo - 1, d, h, mi, 0, 0);
  }, [dateStr, timeStr]);

  const names = dayNames(t);
  const soundOptions = SOUND_OPTION_KEYS.map((o) => ({ value: o.value as ReminderSound, label: t(o.labelKey) }));
  const canSave = title.trim().length > 0 && !!target && loaded && !saving;

  const quick = [
    { key: 'q10m', make: () => new Date(Date.now() + 10 * 60000) },
    { key: 'q1h', make: () => new Date(Date.now() + 60 * 60000) },
    { key: 'qEvening', make: () => { const d = new Date(); d.setHours(18, 0, 0, 0); return d; }, hide: new Date().getHours() >= 18 },
    { key: 'qTomorrow', make: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  ].filter((q) => !q.hide);

  const applyDate = (d: Date) => {
    setDateStr(toDateStr(d));
    setTimeStr(toTimeStr(d));
    setError(null);
  };

  const handleSave = async () => {
    if (!title.trim()) { setError(t('reminders.titleRequired')); return; }
    if (!canSave || !target) return;
    if (repeat === 'once' && target.getTime() <= Date.now()) {
      setError(t('reminders.errorPastTime'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await requestReminderPermissions();
      await saveReminder({
        title: title.trim(),
        note: note.trim(),
        due_at: target.getTime(),
        repeat_mode: repeat,
        repeat_days: repeat === 'weekly' ? (days.length ? days : [target.getDay()]) : [],
        sound,
        category,
        priority,
        fir_id: fir?.id ?? '',
        fir_label: fir?.label ?? '',
        early_min: earlyMin,
        nag_min: nagMin,
      }, editId);
      router.back();
    } catch (e) {
      console.error('[ReminderEditor] save failed:', e);
      setError(t('reminders.errorSchedule'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    const r = await reminderRepo.getReminderById(editId);
    if (r) await removeReminder(r);
    router.back();
  };

  const row = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={editId ? t('reminders.editReminder') : t('reminders.newReminder')}
        showBack
        actions={<HeaderIconBtn icon={Check} label={t('reminders.saveReminder')} onPress={handleSave} />}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, marginBottom: 12, backgroundColor: tint(c.destructive, isDark) }}>
            <AlertTriangle size={18} color={c.destructive} />
            <Text style={{ flex: 1, color: c.destructive, fontWeight: '600', fontSize: 13.5 }}>{error}</Text>
          </View>
        ) : null}

        {/* What */}
        <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 }}>
          <TextInput
            value={title}
            onChangeText={(v) => { setTitle(v); if (error) setError(null); }}
            placeholder={t('reminders.fieldTitlePlaceholder')}
            placeholderTextColor={c.mutedForeground}
            autoFocus={!editId && !params.title}
            style={{ color: c.foreground, fontSize: 18, fontWeight: '700', paddingVertical: 8 }}
          />
          <View style={{ height: 1, backgroundColor: c.border }} />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('reminders.fieldNotePlaceholder')}
            placeholderTextColor={c.mutedForeground}
            multiline
            style={{ color: c.foreground, fontSize: 14.5, minHeight: 56, paddingVertical: 10, textAlignVertical: 'top' }}
          />
        </View>

        {/* When */}
        <Card c={c} title={t('reminders.when')}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => setShowDate(true)}
              className="active:opacity-70"
              style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: c.secondary, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}
            >
              <CalendarDays size={18} color={c.primary} />
              <Text numberOfLines={1} textBreakStrategy="simple" style={{ flex: 1, color: c.foreground, fontSize: 15, fontWeight: '700' }}>
                {target ? dayLabel(target.getTime(), t, i18n.language, true) : t('reminders.pickDate')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTime(true)}
              className="active:opacity-70"
              style={{ minWidth: 126, height: 50, borderRadius: 14, backgroundColor: c.secondary, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}
            >
              <Clock size={18} color={c.primary} />
              <Text style={{ color: c.foreground, fontSize: 15, fontWeight: '700' }}>{formatTime12(timeStr)}</Text>
            </Pressable>
          </View>
          <View style={[row, { marginTop: 10 }]}>
            {quick.map((q) => (
              <Chip c={c} isDark={isDark} key={q.key} active={false} label={t(`reminders.${q.key}`)} onPress={() => applyDate(q.make())} />
            ))}
          </View>
        </Card>

        {/* Repeat */}
        <Card c={c} title={t('reminders.repeatEvery')}>
          <View style={row}>
            {(['once', 'daily', 'weekly', 'monthly'] as const).map((m) => (
              <Chip c={c} isDark={isDark} key={m} active={repeat === m} label={t(`reminders.repeat.${m}`)} onPress={() => setRepeat(m)} />
            ))}
          </View>
          {repeat === 'weekly' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              {names.map((n, d) => {
                const on = days.length ? days.includes(d) : target?.getDay() === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      const base = days.length ? days : target ? [target.getDay()] : [];
                      setDays(base.includes(d) ? base.filter((x) => x !== d) : [...base, d].sort());
                    }}
                    style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.primary : c.secondary }}
                  >
                    <Text style={{ color: on ? c.primaryForeground : c.secondaryForeground, fontWeight: '700', fontSize: 13 }}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Card>

        {/* Alerts */}
        <Card c={c} title={t('reminders.early')}>
          <View style={row}>
            {EARLY_OPTIONS.map((n) => (
              <Chip c={c} isDark={isDark} key={n} active={earlyMin === n} label={earlyLabel(n, t)} onPress={() => setEarlyMin(n)} />
            ))}
          </View>
        </Card>

        <Card c={c} title={t('reminders.nag')}>
          <View style={row}>
            {NAG_OPTIONS.map((n) => (
              <Chip c={c} isDark={isDark} key={n} active={nagMin === n} label={n === 0 ? t('reminders.nagOff') : t('reminders.nagEvery', { n })} onPress={() => setNagMin(n)} />
            ))}
          </View>
          <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 8 }}>{t('reminders.nagHint')}</Text>
        </Card>

        {/* Type + priority */}
        <Card c={c} title={t('reminders.category')}>
          <View style={row}>
            {CATEGORY_ORDER.map((k) => {
              const meta = CATEGORY_META[k];
              const Icon = meta.icon;
              return (
                <Chip c={c} isDark={isDark} key={k} active={category === k} color={meta.color} label={t(meta.labelKey)} icon={<Icon size={14} color={category === k ? meta.color : c.secondaryForeground} />} onPress={() => setCategory(k)} />
              );
            })}
          </View>
          <Text style={{ color: c.mutedForeground, fontSize: 12.5, fontWeight: '700', marginTop: 14, marginBottom: 8 }}>{t('reminders.priority')}</Text>
          <View style={row}>
            {(['high', 'normal', 'low'] as const).map((p) => (
              <Chip c={c} isDark={isDark} key={p} active={priority === p} color={PRIORITY_META[p].color} label={t(PRIORITY_META[p].labelKey)} onPress={() => setPriority(p)} />
            ))}
          </View>
        </Card>

        {/* Case link */}
        <Card c={c} title={t('reminders.linkCase')}>
          {fir ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: tint('#7C3AED', isDark) }}>
                <FolderOpen size={18} color="#7C3AED" />
              </View>
              <Pressable onPress={() => setShowFir(true)} style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: c.foreground, fontWeight: '700', fontSize: 14.5 }}>{fir.label}</Text>
              </Pressable>
              <Pressable onPress={() => setFir(null)} hitSlop={8}><X size={18} color={c.mutedForeground} /></Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowFir(true)}
              className="active:opacity-70"
              style={{ height: 44, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
            >
              <FolderOpen size={16} color={c.primary} />
              <Text style={{ color: c.primary, fontWeight: '600' }}>{t('reminders.pickCase')}</Text>
            </Pressable>
          )}
        </Card>

        {/* Sound */}
        <Card
          c={c}
          title={t('reminders.soundLabel')}
          right={
            <Pressable
              onPress={async () => setInfo((await sendTestReminder(sound, 5)) ? t('reminders.testSent') : t('reminders.permDesc'))}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Volume2 size={15} color={c.primary} />
              <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }}>{t('reminders.testSound')}</Text>
            </Pressable>
          }
        >
          <View style={row}>
            {soundOptions.map((o) => (
              <Chip c={c} isDark={isDark} key={o.value} active={sound === o.value} label={o.label} onPress={() => setSound(o.value)} />
            ))}
          </View>
          {info ? <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 8 }}>{info}</Text> : null}
        </Card>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className="active:opacity-80"
          style={{ height: 52, borderRadius: 16, backgroundColor: c.primary, opacity: canSave ? 1 : 0.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}
        >
          {saving ? <ActivityIndicator color={c.primaryForeground} /> : (
            <>
              <Bell size={18} color={c.primaryForeground} />
              <Text style={{ color: c.primaryForeground, fontSize: 16, fontWeight: '700' }}>
                {editId ? t('reminders.saveChanges') : t('reminders.saveReminder')}
              </Text>
            </>
          )}
        </Pressable>

        {editId ? (
          <Pressable
            onPress={handleDelete}
            className="active:opacity-70"
            style={{ height: 48, borderRadius: 16, borderWidth: 1, borderColor: `${c.destructive}66`, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}
          >
            <Trash2 size={17} color={c.destructive} />
            <Text style={{ color: c.destructive, fontSize: 15, fontWeight: '600' }}>{t('reminders.deleteReminder')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <DatePickerModal
        visible={showDate}
        value={dateStr}
        label={t('reminders.fieldDate')}
        onConfirm={(v) => { setDateStr(v); setShowDate(false); setError(null); }}
        onClose={() => setShowDate(false)}
      />
      <TimePickerModal
        visible={showTime}
        value={timeStr}
        title={t('reminders.pickTime')}
        accentColor={c.primary}
        onConfirm={(v) => { setTimeStr(v); setShowTime(false); setError(null); }}
        onClose={() => setShowTime(false)}
      />
      <FirPickerModal
        visible={showFir}
        onClose={() => setShowFir(false)}
        onPick={(f) => { setFir(f); setShowFir(false); if (category === 'general') setCategory('case'); }}
      />
    </View>
  );
}

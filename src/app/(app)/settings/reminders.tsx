/**
 * Reminders Settings Screen
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Switch } from 'react-native';
import { useRouter, type RelativePathString } from 'expo-router';
import { Clock, Music, RefreshCw, ChevronDown, ChevronRight, Check, Bell, Volume2, BatteryCharging, ShieldCheck, EyeOff, Timer, Repeat } from 'lucide-react-native';
import { resyncReminderNotifications } from '@/lib/reminderService';
import { sendTestReminder, openBatterySettings } from '@/lib/reminderNotifications';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type SettingsState } from '@/hooks/useSettingsStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';

// Generic inline dropdown picker
export function OptionPicker<T extends string | number>({
  label, value, options, onSelect, desc,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
  desc?: string;
}) {
  const [open, setOpen] = useState(false);
  const display = options.find((o) => o.value === value)?.label ?? String(value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center px-4 py-4 active:opacity-70"
      >
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">{label}</Text>
          {desc ? <Text className="text-xs text-muted-foreground mt-0.5">{desc}</Text> : null}
        </View>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-sm font-semibold" style={{ color: '#2563EB' }}>{display}</Text>
          <ChevronDown size={14} color='#2563EB' />
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <View className="bg-card rounded-t-3xl px-4 pt-4 pb-10">
            <Text className="text-base font-bold text-foreground mb-4 text-center">{label}</Text>
            {options.map((opt) => (
              <Pressable
                key={String(opt.value)}
                onPress={() => { onSelect(opt.value); setOpen(false); }}
                className="flex-row items-center py-3.5 border-b border-border active:opacity-70"
              >
                <Text className="flex-1 text-sm text-foreground">{opt.label}</Text>
                {opt.value === value && <Check size={16} color='#2563EB' />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

type SnoozeVal = SettingsState['reminderSnooze'];
type SoundVal = SettingsState['reminderSound'];
type RepeatVal = SettingsState['reminderRepeat'];

export const SOUND_OPTIONS: { value: SoundVal; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'bell', label: 'Bell' },
  { value: 'chime', label: 'Chime' },
  { value: 'silent', label: 'Silent' },
];
export const SNOOZE_OPTIONS: { value: SnoozeVal; label: string }[] = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
];
export const REPEAT_OPTIONS: { value: RepeatVal; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export const SOUND_OPTION_KEYS: { value: SoundVal; labelKey: string }[] = [
  { value: 'default', labelKey: 'settings.reminders.soundDefault' },
  { value: 'bell', labelKey: 'settings.reminders.soundBell' },
  { value: 'chime', labelKey: 'settings.reminders.soundChime' },
  { value: 'alarm', labelKey: 'settings.reminders.soundAlarm' },
  { value: 'silent', labelKey: 'settings.reminders.soundSilent' },
];
export const SNOOZE_OPTION_KEYS: { value: SnoozeVal; labelKey: string }[] = [
  { value: 5, labelKey: 'settings.reminders.snooze5Min' },
  { value: 10, labelKey: 'settings.reminders.snooze10Min' },
  { value: 15, labelKey: 'settings.reminders.snooze15Min' },
  { value: 30, labelKey: 'settings.reminders.snooze30Min' },
];
export const REPEAT_OPTION_KEYS: { value: RepeatVal; labelKey: string }[] = [
  { value: 'once', labelKey: 'settings.reminders.repeatOnce' },
  { value: 'daily', labelKey: 'settings.reminders.repeatDaily' },
  { value: 'weekly', labelKey: 'settings.reminders.repeatWeekly' },
  { value: 'monthly', labelKey: 'settings.reminders.repeatMonthly' },
];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  const val = `${h}:${m}`;
  const h12 = parseInt(h, 10) % 12 || 12;
  const ampm = parseInt(h, 10) < 12 ? 'AM' : 'PM';
  return { value: val, label: `${h12}:${m} ${ampm}` };
});

export default function RemindersScreen() {
  const { settings, update } = useSettingsStore();
  const router = useRouter();
  const { t } = useTranslation();
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const soundOptions = SOUND_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  const snoozeOptions = SNOOZE_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  const repeatOptions = REPEAT_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('settings.reminders.title')} showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        {/* Navigation to My Reminders */}
        <View className="mb-6">
          <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
            <Pressable
              onPress={() => router.push('/(app)/reminders' as RelativePathString)}
              className="px-4 py-4 flex-row items-center gap-3 active:opacity-70"
            >
              <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#2563EB15' }}>
                <Bell size={18} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{t('settings.reminders.myReminders')}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.reminders.myRemindersDesc')}</Text>
              </View>
              <ChevronRight size={18} color="#6B7280" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(app)/reminders/health' as RelativePathString)}
              className="px-4 py-4 flex-row items-center gap-3 border-t border-border active:opacity-70"
            >
              <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#16A34A15' }}>
                <ShieldCheck size={18} color="#16A34A" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{t('reminders.health')}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">{t('reminders.healthDesc')}</Text>
              </View>
              <ChevronRight size={18} color="#6B7280" />
            </Pressable>
          </View>
        </View>

        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.reminders.preferences')}</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border" style={{ borderCurve: 'continuous' }}>

          {/* Default time */}
          <View className="px-4 py-4 flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${'#F59E0B'}15` }}>
              <Clock size={16} color='#2563EB' />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t('settings.reminders.defaultTime')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.reminders.defaultTimeDesc')}</Text>
            </View>
          </View>
          <OptionPicker
            label={t('settings.reminders.timeLabel')}
            value={settings.reminderTime}
            options={TIME_OPTIONS}
            onSelect={(v) => update('reminderTime', v)}
          />

          {/* Sound */}
          <View className="px-4 py-4 flex-row items-center gap-3 border-t border-border">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#1D4ED815' }}>
              <Music size={16} color="#1D4ED8" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t('settings.reminders.sound')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.reminders.soundDesc')}</Text>
            </View>
          </View>
          <OptionPicker
            label={t('settings.reminders.sound')}
            value={settings.reminderSound}
            options={soundOptions}
            onSelect={(v) => update('reminderSound', v as SoundVal)}
          />
          <Pressable
            onPress={async () => {
              const ok = await sendTestReminder(settings.reminderSound, 5);
              setTestMsg(ok ? t('reminders.testSent') : t('reminders.permDesc'));
            }}
            className="px-4 py-3.5 flex-row items-center gap-3 active:opacity-70"
          >
            <Volume2 size={16} color="#2563EB" />
            <View className="flex-1">
              <Text className="text-sm font-semibold" style={{ color: '#2563EB' }}>{t('settings.reminders.testSound')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{testMsg ?? t('settings.reminders.testSoundDesc')}</Text>
            </View>
          </Pressable>

          {/* Snooze */}
          <View className="px-4 py-4 flex-row items-center gap-3 border-t border-border">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#10B98115' }}>
              <Clock size={16} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t('settings.reminders.snooze')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.reminders.snoozeDesc')}</Text>
            </View>
          </View>
          <OptionPicker
            label={t('settings.reminders.snooze')}
            value={settings.reminderSnooze}
            options={snoozeOptions}
            onSelect={(v) => update('reminderSnooze', v as SnoozeVal)}
          />

          {/* Repeat */}
          <View className="px-4 py-4 flex-row items-center gap-3 border-t border-border">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#7C3AED15' }}>
              <RefreshCw size={16} color="#7C3AED" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t('settings.reminders.repeat')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.reminders.repeatDesc')}</Text>
            </View>
          </View>
          <OptionPicker
            label={t('settings.reminders.repeat')}
            value={settings.reminderRepeat}
            options={repeatOptions}
            onSelect={(v) => update('reminderRepeat', v as RepeatVal)}
          />

          {/* Early alert */}
          <View className="px-4 py-4 flex-row items-center gap-3 border-t border-border">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#0891B215' }}>
              <Timer size={16} color="#0891B2" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t('reminders.defaultEarly')}</Text>
            </View>
          </View>
          <OptionPicker
            label={t('reminders.early')}
            value={settings.reminderEarly ?? 0}
            options={[0, 5, 15, 30, 60, 1440].map((n) => ({ value: n, label: t(n === 0 ? 'reminders.earlyOff' : `reminders.early${n}`) }))}
            onSelect={(v) => update('reminderEarly', v)}
          />

          {/* Repeat until done */}
          <View className="px-4 py-4 flex-row items-center gap-3 border-t border-border">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#DC262615' }}>
              <Repeat size={16} color="#DC2626" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t('reminders.defaultNag')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('reminders.nagHint')}</Text>
            </View>
          </View>
          <OptionPicker
            label={t('reminders.nag')}
            value={settings.reminderNag ?? 0}
            options={[0, 5, 10, 15, 30].map((n) => ({ value: n, label: n === 0 ? t('reminders.nagOff') : t('reminders.nagEvery', { n }) }))}
            onSelect={(v) => update('reminderNag', v)}
          />

          {/* Lock-screen privacy */}
          <View className="px-4 py-4 flex-row items-center gap-3 border-t border-border">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#47556915' }}>
              <EyeOff size={16} color="#475569" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t('reminders.privacy')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('reminders.privacyDesc')}</Text>
            </View>
            <Switch
              value={!!settings.reminderPrivate}
              onValueChange={(v) => {
                update('reminderPrivate', v);
                resyncReminderNotifications({ hide: v }).catch(() => {});
              }}
            />
          </View>
        </View>

        {/* Battery tip — some phones delay alarms of apps in battery saver */}
        <Pressable
          onPress={openBatterySettings}
          className="mt-6 mb-4 bg-card border border-border rounded-2xl p-4 flex-row gap-3 active:opacity-70"
          style={{ borderCurve: 'continuous' }}
        >
          <BatteryCharging size={18} color="#F59E0B" />
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground leading-5">{t('reminders.batteryTip')}</Text>
            <Text className="text-xs font-semibold mt-1.5" style={{ color: '#2563EB' }}>{t('reminders.openSettings')}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

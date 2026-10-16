/**
 * Reminders Settings Screen
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { Clock, Music, RefreshCw, ChevronDown, Check } from 'lucide-react-native';
import { useSettingsStore, type SettingsState } from '@/hooks/useSettingsStore';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

// Generic inline dropdown picker
function OptionPicker<T extends string | number>({
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

const SOUND_OPTIONS: { value: SoundVal; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'bell', label: 'Bell' },
  { value: 'chime', label: 'Chime' },
  { value: 'silent', label: 'Silent' },
];
const SNOOZE_OPTIONS: { value: SnoozeVal; label: string }[] = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
];
const REPEAT_OPTIONS: { value: RepeatVal; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
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
  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Reminders" showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Reminder Preferences</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border" style={{ borderCurve: 'continuous' }}>

          {/* Default time */}
          <View className="px-4 py-4 flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${'#F59E0B'}15` }}>
              <Clock size={16} color='#2563EB' />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Default Reminder Time</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Applied to new reminders without a specific time</Text>
            </View>
          </View>
          <OptionPicker
            label="Time"
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
              <Text className="text-sm font-semibold text-foreground">Reminder Sound</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Alert sound for reminder notifications</Text>
            </View>
          </View>
          <OptionPicker
            label="Sound"
            value={settings.reminderSound}
            options={SOUND_OPTIONS}
            onSelect={(v) => update('reminderSound', v as SoundVal)}
          />

          {/* Snooze */}
          <View className="px-4 py-4 flex-row items-center gap-3 border-t border-border">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#10B98115' }}>
              <Clock size={16} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Snooze Duration</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Time to delay when snoozing a reminder</Text>
            </View>
          </View>
          <OptionPicker
            label="Snooze Duration"
            value={settings.reminderSnooze}
            options={SNOOZE_OPTIONS}
            onSelect={(v) => update('reminderSnooze', v as SnoozeVal)}
          />

          {/* Repeat */}
          <View className="px-4 py-4 flex-row items-center gap-3 border-t border-border">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#7C3AED15' }}>
              <RefreshCw size={16} color="#7C3AED" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Repeat Settings</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Default repeat frequency for new reminders</Text>
            </View>
          </View>
          <OptionPicker
            label="Repeat"
            value={settings.reminderRepeat}
            options={REPEAT_OPTIONS}
            onSelect={(v) => update('reminderRepeat', v as RepeatVal)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

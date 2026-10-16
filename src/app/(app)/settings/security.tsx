/**
 * Security & Privacy Screen
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch, Modal } from 'react-native';
import { Lock, KeyRound, Fingerprint, Timer, EyeOff, Shield, ChevronDown, Check } from 'lucide-react-native';
import { useSettingsStore, type SettingsState } from '@/hooks/useSettingsStore';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

type TimeoutVal = SettingsState['autoLockTimeout'];
const TIMEOUT_OPTIONS: { value: TimeoutVal; label: string }[] = [
  { value: 0, label: 'Immediately' },
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
];

export default function SecurityScreen() {
  const { settings, update } = useSettingsStore();
  const [timeoutOpen, setTimeoutOpen] = useState(false);
  const timeoutLabel = TIMEOUT_OPTIONS.find((o) => o.value === settings.autoLockTimeout)?.label ?? '5 minutes';

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Security & Privacy" subtitle="App lock, biometric, and privacy controls" showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>

        {/* App Lock section */}
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">App Lock</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden mb-5" style={{ borderCurve: 'continuous' }}>
          {/* App Lock master */}
          <View className="flex-row items-center gap-3 px-4 py-4 border-b border-border">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${'#1E3A5F'}15` }}>
              <Lock size={16} color='#1E3A5F' />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">App Lock</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Require authentication to open InvestSuite</Text>
            </View>
            <Switch
              value={settings.appLock}
              onValueChange={(v) => update('appLock', v)}
              trackColor={{ false: '#E5E7EB', true: `${'#F59E0B'}60` }}
              thumbColor={settings.appLock ? '#F59E0B' : '#9CA3AF'}
            />
          </View>

          {/* PIN Lock */}
          <View className={`flex-row items-center gap-3 px-4 py-4 border-b border-border ${!settings.appLock ? 'opacity-40' : ''}`}>
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#1D4ED815' }}>
              <KeyRound size={16} color="#1D4ED8" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">PIN Lock</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">4–6 digit PIN to unlock the app</Text>
            </View>
            <Switch
              value={settings.pinLock}
              disabled={!settings.appLock}
              onValueChange={(v) => update('pinLock', v)}
              trackColor={{ false: '#E5E7EB', true: `${'#F59E0B'}60` }}
              thumbColor={settings.pinLock ? '#F59E0B' : '#9CA3AF'}
            />
          </View>

          {/* Biometric */}
          <View className={`flex-row items-center gap-3 px-4 py-4 border-b border-border ${!settings.appLock ? 'opacity-40' : ''}`}>
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#10B98115' }}>
              <Fingerprint size={16} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Biometric Authentication</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Fingerprint or face recognition unlock</Text>
            </View>
            <Switch
              value={settings.biometric}
              disabled={!settings.appLock}
              onValueChange={(v) => update('biometric', v)}
              trackColor={{ false: '#E5E7EB', true: `${'#F59E0B'}60` }}
              thumbColor={settings.biometric ? '#F59E0B' : '#9CA3AF'}
            />
          </View>

          {/* Auto Lock Timeout */}
          <Pressable
            onPress={() => settings.appLock && setTimeoutOpen(true)}
            className={`flex-row items-center gap-3 px-4 py-4 active:opacity-70 ${!settings.appLock ? 'opacity-40' : ''}`}
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#F59E0B15' }}>
              <Timer size={16} color="#F59E0B" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Auto Lock Timeout</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Lock app after period of inactivity</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-sm font-semibold" style={{ color: '#2563EB' }}>{timeoutLabel}</Text>
              <ChevronDown size={14} color='#2563EB' />
            </View>
          </Pressable>
        </View>

        {/* Privacy section */}
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Privacy</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden mb-5" style={{ borderCurve: 'continuous' }}>
          <View className="flex-row items-center gap-3 px-4 py-4">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#DC262615' }}>
              <EyeOff size={16} color="#DC2626" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Hide Sensitive Information</Text>
              <Text className="text-xs text-muted-foreground mt-0.5 leading-4">Mask phone numbers, addresses, and personal data</Text>
            </View>
            <Switch
              value={settings.hideSensitive}
              onValueChange={(v) => update('hideSensitive', v)}
              trackColor={{ false: '#E5E7EB', true: `${'#F59E0B'}60` }}
              thumbColor={settings.hideSensitive ? '#F59E0B' : '#9CA3AF'}
            />
          </View>
        </View>

        <View className="bg-muted/50 rounded-2xl p-4" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs text-muted-foreground leading-5">
            App Lock requires device-level biometric or PIN enrollment. Enable App Lock first to configure PIN and biometric options.
          </Text>
        </View>
      </ScrollView>

      {/* Timeout picker modal */}
      <Modal visible={timeoutOpen} transparent animationType="fade" onRequestClose={() => setTimeoutOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setTimeoutOpen(false)}>
          <View className="bg-card rounded-t-3xl px-4 pt-4 pb-10">
            <Text className="text-base font-bold text-foreground mb-4 text-center">Auto Lock Timeout</Text>
            {TIMEOUT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => { update('autoLockTimeout', opt.value as TimeoutVal); setTimeoutOpen(false); }}
                className="flex-row items-center py-3.5 border-b border-border active:opacity-70"
              >
                <Text className="flex-1 text-sm text-foreground">{opt.label}</Text>
                {opt.value === settings.autoLockTimeout && <Check size={16} color='#2563EB' />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

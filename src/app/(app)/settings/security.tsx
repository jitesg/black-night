/**
 * Security & Privacy Screen
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch, Modal } from 'react-native';
import { Lock, KeyRound, Fingerprint, Timer, EyeOff, ChevronDown, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type SettingsState } from '@/hooks/useSettingsStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { hasAppLockPinSet, touchAppLockSession } from '@/lib/appLockAuth';
import { router } from 'expo-router';

export type TimeoutVal = SettingsState['autoLockTimeout'];
export const TIMEOUT_OPTIONS: { value: TimeoutVal; labelKey: string }[] = [
  { value: 0, labelKey: 'settings.security.immediately' },
  { value: 1, labelKey: 'settings.security.minutes1' },
  { value: 5, labelKey: 'settings.security.minutes5' },
  { value: 15, labelKey: 'settings.security.minutes15' },
  { value: 30, labelKey: 'settings.security.minutes30' },
];

export default function SecurityScreen() {
  const { settings, update } = useSettingsStore();
  const [timeoutOpen, setTimeoutOpen] = useState(false);
  const { t } = useTranslation();
  const activeOpt = TIMEOUT_OPTIONS.find((o) => o.value === settings.autoLockTimeout);
  const timeoutLabel = activeOpt ? t(activeOpt.labelKey) : t('settings.security.minutes5');

  // Turning a lock on must not lock the officer out of the screen they are
  // on, so start an unlocked session first. With no PIN yet, go to the
  // first-time PIN setup, which turns the PIN lock on when it's saved.
  const handleAppLockToggle = async (val: boolean) => {
    if (!val) { update('appLock', false); return; }
    touchAppLockSession();
    update('appLock', true);
    if (!(await hasAppLockPinSet())) {
      router.push('/(app)/app-lock/pin-setup' as never);
    } else if (!settings.pinLock) {
      update('pinLock', true);
    }
  };

  const handlePinLockToggle = async (val: boolean) => {
    if (val) {
      const hasPin = await hasAppLockPinSet();
      if (!hasPin) {
        router.push('/(app)/app-lock/pin-setup' as never);
        return;
      }
      touchAppLockSession();
      update('pinLock', true);
    } else {
      update('pinLock', false);
    }
  };

  // Fingerprint needs a PIN as the fallback if it fails.
  const handleBiometricToggle = async (val: boolean) => {
    if (val && !(await hasAppLockPinSet())) {
      update('biometric', true);
      router.push('/(app)/app-lock/pin-setup' as never);
      return;
    }
    update('biometric', val);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('settings.security.title')} subtitle={t('settings.security.subtitle')} showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>

        {/* App Lock section */}
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.security.appLock')}</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden mb-5" style={{ borderCurve: 'continuous' }}>
          {/* App Lock master */}
          <View className="flex-row items-center gap-3 px-4 py-4 border-b border-border">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${'#1E3A5F'}15` }}>
              <Lock size={16} color='#1E3A5F' />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t('settings.security.appLock')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.security.appLockDesc')}</Text>
            </View>
            <Switch
              value={settings.appLock}
              onValueChange={handleAppLockToggle}
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
              <Text className="text-sm font-semibold text-foreground">{t('settings.security.pinLock')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.security.pinLockDesc')}</Text>
            </View>
            <Switch
              value={settings.pinLock}
              disabled={!settings.appLock}
              onValueChange={handlePinLockToggle}
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
              <Text className="text-sm font-semibold text-foreground">{t('settings.security.biometric')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.security.biometricDesc')}</Text>
            </View>
            <Switch
              value={settings.biometric}
              disabled={!settings.appLock}
              onValueChange={handleBiometricToggle}
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
              <Text className="text-sm font-semibold text-foreground">{t('settings.security.timeout')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.security.timeoutDesc')}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-sm font-semibold" style={{ color: '#2563EB' }}>{timeoutLabel}</Text>
              <ChevronDown size={14} color='#2563EB' />
            </View>
          </Pressable>
        </View>

        {/* Privacy section */}
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.security.privacy')}</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden mb-5" style={{ borderCurve: 'continuous' }}>
          <View className="flex-row items-center gap-3 px-4 py-4">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#DC262615' }}>
              <EyeOff size={16} color="#DC2626" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t('settings.security.hideSensitive')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5 leading-4">{t('settings.security.hideSensitiveDesc')}</Text>
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
            {t('settings.security.disclaimer')}
          </Text>
        </View>
      </ScrollView>

      {/* Timeout picker modal */}
      <Modal visible={timeoutOpen} transparent animationType="fade" onRequestClose={() => setTimeoutOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setTimeoutOpen(false)}>
          <View className="bg-card rounded-t-3xl px-4 pt-4 pb-10">
            <Text className="text-base font-bold text-foreground mb-4 text-center">{t('settings.security.timeout')}</Text>
            {TIMEOUT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => { update('autoLockTimeout', opt.value as TimeoutVal); setTimeoutOpen(false); }}
                className="flex-row items-center py-3.5 border-b border-border active:opacity-70"
              >
                <Text className="flex-1 text-sm text-foreground">{t(opt.labelKey)}</Text>
                {opt.value === settings.autoLockTimeout && <Check size={16} color='#2563EB' />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

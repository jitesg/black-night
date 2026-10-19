/**
 * Reminder check — the "troubleshoot reminders" page found in apps like
 * TickTick / Galarm. Shows what could stop reminders from ringing and opens
 * the right phone setting for each.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  AlarmClock, BatteryCharging, Bell, BellRing, CheckCircle2, PlayCircle, Power, RefreshCw, XCircle, AlertCircle,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { THEME } from '@/lib/theme';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import {
  hasNotificationPermission, openAppInfo, openAppNotificationSettings, openBatterySettings, openExactAlarmSettings,
  requestReminderPermissions, sendTestReminder,
} from '@/lib/reminderNotifications';
import { checkReminderHealth, resyncReminderNotifications, type ReminderHealth } from '@/lib/reminderService';

type Status = 'ok' | 'bad' | 'info';

export default function ReminderHealthScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const { settings } = useSettingsStore();

  const [perm, setPerm] = useState<boolean | null>(null);
  const [health, setHealth] = useState<ReminderHealth | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setPerm(await hasNotificationPermission());
    setHealth(await checkReminderHealth());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') load(); });
    return () => sub.remove();
  }, [load]);

  const repair = async () => {
    setBusy(true);
    try {
      await requestReminderPermissions();
      await resyncReminderNotifications();
      await load();
      setMsg(t('reminders.hRepaired'));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    const ok = await sendTestReminder(settings.reminderSound, 30);
    setMsg(ok ? t('reminders.hTestSent') : t('reminders.hNotifOff'));
  };

  const StatusIcon = ({ s }: { s: Status }) =>
    s === 'ok' ? <CheckCircle2 size={20} color="#16A34A" />
      : s === 'bad' ? <XCircle size={20} color="#DC2626" />
        : <AlertCircle size={20} color="#D97706" />;

  const Item = ({ icon, title, desc, status, action, onAction }: {
    icon: React.ReactNode; title: string; desc: string; status: Status; action?: string; onAction?: () => void;
  }) => (
    <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: status === 'bad' ? '#DC262655' : c.border, borderRadius: 18, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.secondary }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, color: c.foreground, fontWeight: '700', fontSize: 14.5 }}>{title}</Text>
          <StatusIcon s={status} />
        </View>
        <Text style={{ color: c.mutedForeground, fontSize: 12.5, lineHeight: 18, marginTop: 3 }}>{desc}</Text>
        {action && onAction ? (
          <Pressable
            onPress={onAction}
            className="active:opacity-70"
            style={{ alignSelf: 'flex-start', marginTop: 10, height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: status === 'bad' ? '#DC2626' : c.primary, justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const schedStatus: Status = !health || health.pending === 0 ? 'info' : health.missing.length === 0 ? 'ok' : 'bad';

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('reminders.health')} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text style={{ color: c.mutedForeground, fontSize: 13, marginBottom: 14 }}>{t('reminders.healthDesc')}</Text>

        {msg ? (
          <View style={{ padding: 12, borderRadius: 14, backgroundColor: '#16A34A1F', marginBottom: 12 }}>
            <Text style={{ color: '#16A34A', fontWeight: '600' }}>{msg}</Text>
          </View>
        ) : null}

        <Item
          icon={<Bell size={18} color={c.primary} />}
          title={t('reminders.hNotif')}
          desc={perm === false ? t('reminders.hNotifOff') : t('reminders.hChannelDesc')}
          status={perm == null ? 'info' : perm ? 'ok' : 'bad'}
          action={perm === false ? t('reminders.allow') : t('reminders.open')}
          onAction={async () => {
            if (perm === false && (await requestReminderPermissions())) return load();
            openAppNotificationSettings();
          }}
        />

        <Item
          icon={<RefreshCw size={18} color={c.primary} />}
          title={health && health.pending > 0 ? t('reminders.hScheduled', { ok: health.scheduled, n: health.pending }) : t('reminders.hNone')}
          desc={t('reminders.hRepair')}
          status={schedStatus}
          action={busy ? '…' : t('reminders.hRepair')}
          onAction={busy ? undefined : repair}
        />

        <Item
          icon={<AlarmClock size={18} color={c.primary} />}
          title={t('reminders.hExact')}
          desc={t('reminders.hExactDesc')}
          status="info"
          action={t('reminders.open')}
          onAction={openExactAlarmSettings}
        />

        <Item
          icon={<BatteryCharging size={18} color="#D97706" />}
          title={t('reminders.hBattery')}
          desc={t('reminders.hBatteryDesc')}
          status="info"
          action={t('reminders.open')}
          onAction={openBatterySettings}
        />

        <Item
          icon={<Power size={18} color="#D97706" />}
          title={t('reminders.hAutostart')}
          desc={t('reminders.hAutostartDesc')}
          status="info"
          action={t('reminders.open')}
          onAction={openAppInfo}
        />

        <Item
          icon={<BellRing size={18} color={c.primary} />}
          title={t('reminders.hChannel')}
          desc={t('reminders.hChannelDesc')}
          status="info"
          action={t('reminders.open')}
          onAction={openAppNotificationSettings}
        />

        <Item
          icon={<PlayCircle size={18} color="#16A34A" />}
          title={t('reminders.hTest')}
          desc={t('reminders.hTestDesc')}
          status="info"
          action={t('reminders.hTest')}
          onAction={test}
        />
      </ScrollView>
    </View>
  );
}

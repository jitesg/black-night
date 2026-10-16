/**
 * Notifications Settings Screen
 */
import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { Bell, Scale, Clock, BarChart2, Search } from 'lucide-react-native';
import { useSettingsStore, type SettingsState } from '@/hooks/useSettingsStore';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

type NotifKey = keyof Pick<SettingsState,
  'notifReminders' | 'notifCourtAlerts' | 'notifDeadlines' | 'notifDailySummary' | 'notifInvestigations'
>;

const NOTIF_ITEMS: { key: NotifKey; label: string; desc: string; icon: typeof Bell; color: string }[] = [
  { key: 'notifReminders', label: 'Reminder Notifications', desc: 'Alerts for scheduled reminders and due dates', icon: Clock, color: '#2563EB' },
  { key: 'notifCourtAlerts', label: 'Court Alerts', desc: 'Hearing dates, court appearances, and filings', icon: Scale, color: '#1D4ED8' },
  { key: 'notifDeadlines', label: 'Deadline Alerts', desc: 'Investigation and case deadline notifications', icon: Bell, color: '#DC2626' },
  { key: 'notifDailySummary', label: 'Daily Summary', desc: 'Morning digest of pending items and activity', icon: BarChart2, color: '#10B981' },
  { key: 'notifInvestigations', label: 'Investigation Alerts', desc: 'Updates on active investigation cases', icon: Search, color: '#7C3AED' },
];

export default function NotificationsScreen() {
  const { settings, update } = useSettingsStore();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Notifications" showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Notification Types</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
          {NOTIF_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const value = settings[item.key];
            return (
              <View key={item.key} className={`flex-row items-center gap-3 px-4 py-4 ${idx < NOTIF_ITEMS.length - 1 ? 'border-b border-border' : ''}`}>
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                  <Icon size={16} color={item.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{item.label}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5 leading-4">{item.desc}</Text>
                </View>
                <Switch
                  value={value}
                  onValueChange={(v) => update(item.key, v)}
                  trackColor={{ false: '#E5E7EB', true: `${'#F59E0B'}60` }}
                  thumbColor={value ? '#F59E0B' : '#9CA3AF'}
                />
              </View>
            );
          })}
        </View>

        <View className="bg-muted/50 rounded-2xl p-4 mt-4" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs text-muted-foreground leading-5">
            Notifications require device permission. If notifications are not appearing, enable them in your device Settings → InvestSuite → Notifications.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

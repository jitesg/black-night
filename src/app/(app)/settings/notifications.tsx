/**
 * Notifications Settings Screen
 */
import { View, Text, ScrollView, Switch } from 'react-native';
import { Bell, Scale, Clock, BarChart2, Search, NotebookPen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type SettingsState } from '@/hooks/useSettingsStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';

type NotifKey = keyof Pick<SettingsState,
  'notifReminders' | 'notifCourtAlerts' | 'notifDeadlines' | 'notifDailySummary' | 'notifInvestigations' | 'notifCaseDiaryGap'
>;

const NOTIF_ITEMS: { key: NotifKey; labelKey: string; descKey: string; icon: typeof Bell; color: string }[] = [
  { key: 'notifReminders', labelKey: 'settings.notifications.reminders', descKey: 'settings.notifications.remindersDesc', icon: Clock, color: '#2563EB' },
  { key: 'notifCourtAlerts', labelKey: 'settings.notifications.courtAlerts', descKey: 'settings.notifications.courtAlertsDesc', icon: Scale, color: '#1D4ED8' },
  { key: 'notifDeadlines', labelKey: 'settings.notifications.deadlines', descKey: 'settings.notifications.deadlinesDesc', icon: Bell, color: '#DC2626' },
  { key: 'notifDailySummary', labelKey: 'settings.notifications.dailySummary', descKey: 'settings.notifications.dailySummaryDesc', icon: BarChart2, color: '#10B981' },
  { key: 'notifInvestigations', labelKey: 'settings.notifications.investigations', descKey: 'settings.notifications.investigationsDesc', icon: Search, color: '#7C3AED' },
  { key: 'notifCaseDiaryGap', labelKey: 'settings.notifications.caseDiaryGap', descKey: 'settings.notifications.caseDiaryGapDesc', icon: NotebookPen, color: '#B45309' },
];

export default function NotificationsScreen() {
  const { settings, update } = useSettingsStore();
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('settings.notifications.title')} showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.notifications.types')}</Text>
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
                  <Text className="text-sm font-semibold text-foreground">{t(item.labelKey)}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5 leading-4">{t(item.descKey)}</Text>
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
            {t('settings.notifications.disclaimer')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

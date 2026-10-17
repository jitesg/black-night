/**
 * Help & Support Screen
 */
import { View, Text, Pressable, ScrollView } from 'react-native';
import { BookOpen, HelpCircle, Bug, MessageSquare, Phone, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/ui/ds/AppHeader';

const HELP_ITEMS = [
  {
    icon: BookOpen,      color: '#1D4ED8', labelKey: 'settings.help.userGuide',
    descKey: 'settings.help.userGuideDesc',
  },
  {
    icon: HelpCircle,    color: '#10B981', labelKey: 'settings.help.faq',
    descKey: 'settings.help.faqDesc',
  },
  {
    icon: Bug,           color: '#DC2626', labelKey: 'settings.help.reportBug',
    descKey: 'settings.help.reportBugDesc',
  },
  {
    icon: MessageSquare, color: '#2563EB', labelKey: 'settings.help.feedback',
    descKey: 'settings.help.feedbackDesc',
  },
  {
    icon: Phone,         color: '#7C3AED', labelKey: 'settings.help.contact',
    descKey: 'settings.help.contactDesc',
  },
];

export default function HelpScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('settings.help.title')} showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View
          className="rounded-2xl p-4 mb-5 flex-row items-center gap-3"
          style={{ backgroundColor: `${'#1E3A5F'}08`, borderWidth: 1, borderColor: `${'#1E3A5F'}20`, borderCurve: 'continuous' }}
        >
          <HelpCircle size={20} color='#1E3A5F' />
          <View className="flex-1">
            <Text className="text-sm font-bold text-foreground">{t('settings.help.bannerTitle')}</Text>
            <Text className="text-xs text-muted-foreground mt-0.5 leading-4">
              {t('settings.help.bannerDesc')}
            </Text>
          </View>
        </View>

        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.help.resources')}</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden mb-5" style={{ borderCurve: 'continuous' }}>
          {HELP_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.labelKey}
                onPress={() => {}}
                className={`flex-row items-center gap-3 px-4 py-4 active:opacity-70 ${idx < HELP_ITEMS.length - 1 ? 'border-b border-border' : ''}`}
              >
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                  <Icon size={16} color={item.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{t(item.labelKey)}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">{t(item.descKey)}</Text>
                </View>
                <ChevronRight size={15} color="#D1D5DB" />
              </Pressable>
            );
          })}
        </View>

        {/* Contact info */}
        <View className="bg-card border border-border rounded-2xl p-4" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.help.contactInfo')}</Text>
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-muted-foreground w-16">{t('settings.help.email')}</Text>
              <Text className="text-xs font-semibold text-foreground">support@investsuite.in</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-muted-foreground w-16">{t('settings.help.phone')}</Text>
              <Text className="text-xs font-semibold text-foreground">{t('settings.help.tollFree')}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-muted-foreground w-16">{t('settings.help.hours')}</Text>
              <Text className="text-xs font-semibold text-foreground">{t('settings.help.hoursValue')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Help & Support Screen
 */
import { View, Text, Pressable, ScrollView } from 'react-native';
import { BookOpen, HelpCircle, Bug, MessageSquare, Phone, ChevronRight } from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const HELP_ITEMS = [
  {
    icon: BookOpen,     color: '#1D4ED8', label: 'User Guide',
    desc: 'Step-by-step guide to all InvestSuite features',
  },
  {
    icon: HelpCircle,   color: '#10B981', label: 'FAQ',
    desc: 'Frequently asked questions and answers',
  },
  {
    icon: Bug,          color: '#DC2626', label: 'Report a Bug',
    desc: 'Help us improve by reporting issues',
  },
  {
    icon: MessageSquare, color: '#2563EB',  label: 'Send Feedback',
    desc: 'Share suggestions and feature requests',
  },
  {
    icon: Phone,        color: '#7C3AED', label: 'Contact Support',
    desc: 'Reach our support team for assistance',
  },
];

export default function HelpScreen() {
  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Help & Support" showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View
          className="rounded-2xl p-4 mb-5 flex-row items-center gap-3"
          style={{ backgroundColor: `${'#1E3A5F'}08`, borderWidth: 1, borderColor: `${'#1E3A5F'}20`, borderCurve: 'continuous' }}
        >
          <HelpCircle size={20} color='#1E3A5F' />
          <View className="flex-1">
            <Text className="text-sm font-bold text-foreground">How can we help?</Text>
            <Text className="text-xs text-muted-foreground mt-0.5 leading-4">
              Browse the user guide, check FAQ, or contact our support team directly.
            </Text>
          </View>
        </View>

        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Support Resources</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden mb-5" style={{ borderCurve: 'continuous' }}>
          {HELP_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                onPress={() => {}}
                className={`flex-row items-center gap-3 px-4 py-4 active:opacity-70 ${idx < HELP_ITEMS.length - 1 ? 'border-b border-border' : ''}`}
              >
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                  <Icon size={16} color={item.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{item.label}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">{item.desc}</Text>
                </View>
                <ChevronRight size={15} color="#D1D5DB" />
              </Pressable>
            );
          })}
        </View>

        {/* Contact info */}
        <View className="bg-card border border-border rounded-2xl p-4" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Contact Information</Text>
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-muted-foreground w-16">Email</Text>
              <Text className="text-xs font-semibold text-foreground">support@investsuite.in</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-muted-foreground w-16">Phone</Text>
              <Text className="text-xs font-semibold text-foreground">1800-XXX-XXXX (Toll Free)</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-muted-foreground w-16">Hours</Text>
              <Text className="text-xs font-semibold text-foreground">Mon – Sat, 9:00 AM – 6:00 PM</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * AI Assistant Settings Screen — Future Ready (all disabled)
 */
import { View, Text, ScrollView } from 'react-native';
import { Sparkles, FileEdit, Library, FileBarChart, Lock } from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

const AI_ITEMS = [
  { icon: Sparkles,    color: '#7C3AED', label: 'AI Suggestions',       desc: 'Context-aware suggestions while working on cases' },
  { icon: FileEdit,    color: '#1D4ED8', label: 'AI Draft Assistance',  desc: 'Automatically draft FIR and case summaries' },
  { icon: Library,     color: '#0F766E', label: 'AI Knowledge Search',  desc: 'AI-powered semantic search across knowledge base' },
  { icon: FileBarChart,color: '#D97706', label: 'AI Report Generation', desc: 'Generate investigation reports with AI assistance' },
  { icon: Lock,        color: '#6B7280', label: 'AI Privacy Settings',  desc: 'Control what data AI features can access' },
];

export default function AiAssistantScreen() {
  return (
    <View className="flex-1 bg-background">
      <AppHeader title="AI Assistant" subtitle="Configure AI-powered features" showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        {/* Coming Soon Banner */}
        <View
          className="rounded-2xl p-4 mb-5 flex-row items-center gap-3"
          style={{ backgroundColor: '#7C3AED12', borderWidth: 1, borderColor: '#7C3AED30', borderCurve: 'continuous' }}
        >
          <Sparkles size={20} color="#7C3AED" />
          <View className="flex-1">
            <Text className="text-sm font-bold" style={{ color: '#7C3AED' }}>AI Features — Coming Soon</Text>
            <Text className="text-xs text-muted-foreground mt-0.5 leading-4">
              InvestSuite AI is being built for intelligent investigation assistance. These settings will be activated in a future update.
            </Text>
          </View>
        </View>

        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">AI Features</Text>
        <View className="bg-muted/30 border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
          {AI_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <View
                key={item.label}
                className={`flex-row items-center gap-3 px-4 py-4 ${idx < AI_ITEMS.length - 1 ? 'border-b border-border' : ''}`}
              >
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}10` }}>
                  <Icon size={16} color={`${item.color}60`} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-muted-foreground">{item.label}</Text>
                  <Text className="text-xs text-muted-foreground/70 mt-0.5 leading-4">{item.desc}</Text>
                </View>
                <View className="px-2 py-1 rounded-full bg-muted">
                  <Text className="text-xs font-semibold text-muted-foreground">Soon</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

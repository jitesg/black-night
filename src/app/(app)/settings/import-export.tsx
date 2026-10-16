/**
 * Import / Export Screen
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Download, Upload, FileText, FileBarChart, Braces } from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';

type ActionKey = 'exportDb' | 'importDb' | 'exportReports' | 'exportPdf' | 'exportJson';

const EXPORT_ITEMS: { key: ActionKey; icon: typeof Download; color: string; label: string; desc: string }[] = [
  { key: 'exportDb',      icon: Download,    color: '#2563EB',   label: 'Export Database',  desc: 'Export full SQLite database as .db file' },
  { key: 'importDb',      icon: Upload,      color: '#1D4ED8', label: 'Import Database',  desc: 'Replace local database from a .db file' },
  { key: 'exportReports', icon: FileBarChart, color: '#10B981', label: 'Export Reports',   desc: 'Export case reports as PDF or Excel' },
  { key: 'exportPdf',     icon: FileText,    color: '#DC2626', label: 'Export PDF',        desc: 'Export selected documents as PDF files' },
  { key: 'exportJson',    icon: Braces,      color: '#7C3AED', label: 'Export JSON',       desc: 'Export data records as structured JSON' },
];

export default function ImportExportScreen() {
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [msg, setMsg] = useState('');

  const handleAction = async (key: ActionKey) => {
    setLoading(key);
    setMsg('');
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(null);
    if (key === 'importDb') {
      setMsg('Database import will be available in the full release with file picker support.');
    } else {
      setMsg(`${EXPORT_ITEMS.find((i) => i.key === key)?.label ?? 'Export'} will save to your Documents folder in the full release.`);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Import / Export" showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        {msg ? (
          <View className="bg-card border border-border rounded-2xl p-4 mb-4 flex-row items-start gap-2" style={{ borderCurve: 'continuous', borderLeftWidth: 3, borderLeftColor: '#10B981' }}>
            <Text className="text-sm text-foreground flex-1 leading-5">{msg}</Text>
          </View>
        ) : null}

        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Operations</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
          {EXPORT_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const isLoading = loading === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => handleAction(item.key)}
                disabled={loading !== null}
                className={`flex-row items-center gap-3 px-4 py-4 active:opacity-70 ${idx < EXPORT_ITEMS.length - 1 ? 'border-b border-border' : ''}`}
              >
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                  {isLoading
                    ? <ActivityIndicator size="small" color={item.color} />
                    : <Icon size={16} color={item.color} />
                  }
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{item.label}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">{item.desc}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="bg-muted/50 rounded-2xl p-4 mt-4" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs text-muted-foreground leading-5">
            All exports are saved to your device's Documents folder. Import operations will replace existing data — always create a backup before importing.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

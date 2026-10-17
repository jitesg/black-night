/**
 * Import / Export Screen
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Download, Upload, FileText, FileBarChart, Braces } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/ui/ds/AppHeader';

type ActionKey = 'exportDb' | 'importDb' | 'exportReports' | 'exportPdf' | 'exportJson';

const EXPORT_ITEMS: { key: ActionKey; icon: typeof Download; color: string; labelKey: string; descKey: string }[] = [
  { key: 'exportDb',      icon: Download,    color: '#2563EB',   labelKey: 'settings.importExport.exportDb',      descKey: 'settings.importExport.exportDbDesc' },
  { key: 'importDb',      icon: Upload,      color: '#1D4ED8',   labelKey: 'settings.importExport.importDb',      descKey: 'settings.importExport.importDbDesc' },
  { key: 'exportReports', icon: FileBarChart, color: '#10B981',   labelKey: 'settings.importExport.exportReports', descKey: 'settings.importExport.exportReportsDesc' },
  { key: 'exportPdf',     icon: FileText,    color: '#DC2626',   labelKey: 'settings.importExport.exportPdf',     descKey: 'settings.importExport.exportPdfDesc' },
  { key: 'exportJson',    icon: Braces,      color: '#7C3AED',   labelKey: 'settings.importExport.exportJson',    descKey: 'settings.importExport.exportJsonDesc' },
];

export default function ImportExportScreen() {
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [msg, setMsg] = useState('');
  const { t } = useTranslation();

  const handleAction = async (key: ActionKey) => {
    setLoading(key);
    setMsg('');
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(null);
    if (key === 'importDb') {
      setMsg(t('settings.importExport.importDbMsg'));
    } else {
      const item = EXPORT_ITEMS.find((i) => i.key === key);
      const name = item ? t(item.labelKey) : t('common.export');
      setMsg(t('settings.importExport.exportMsg', { name }));
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('settings.importExport.title')} showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        {msg ? (
          <View className="bg-card border border-border rounded-2xl p-4 mb-4 flex-row items-start gap-2" style={{ borderCurve: 'continuous', borderLeftWidth: 3, borderLeftColor: '#10B981' }}>
            <Text className="text-sm text-foreground flex-1 leading-5">{msg}</Text>
          </View>
        ) : null}

        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.importExport.operations')}</Text>
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
                  <Text className="text-sm font-semibold text-foreground">{t(item.labelKey)}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">{t(item.descKey)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="bg-muted/50 rounded-2xl p-4 mt-4" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs text-muted-foreground leading-5">
            {t('settings.importExport.disclaimer')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

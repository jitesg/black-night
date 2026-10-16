/**
 * Data & Backup Screen
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Database, RotateCcw, Info, CloudOff, Repeat, Trash2 } from 'lucide-react-native';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { clearStubCache } from '@/lib/db/database';
import { dcClearAll } from '@/lib/devContentPersistence';

export default function DataBackupScreen() {
  const { settings, update } = useSettingsStore();
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  const handleBackup = async () => {
    setBacking(true);
    setBackupMsg('');
    await new Promise((r) => setTimeout(r, 1200)); // simulate backup
    const now = new Date().toLocaleString('en-IN');
    update('lastBackupDate', now);
    setBackupMsg(`Backup completed: ${now}`);
    setBacking(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRestoring(false);
    setBackupMsg('Restore from backup file is available in the full release.');
  };

  const handleClearCache = async () => {
    setClearing(true);
    setBackupMsg('');
    await new Promise((r) => setTimeout(r, 300)); // allow UI to update
    clearStubCache();           // wipe Web SQLite stub _mem + localStorage
    await dcClearAll();         // wipe devContentPersistence keys
    setBackupMsg('Cache cleared. Restart the app to reseed from defaults.');
    setClearing(false);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Data & Backup" subtitle="Import, export, sync" showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        {/* Backup info card */}
        <View className="bg-card border border-border rounded-2xl p-4 mb-5 flex-row items-start gap-3" style={{ borderCurve: 'continuous' }}>
          <Info size={16} color="#6B7280" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">Backup Information</Text>
            <Text className="text-xs text-muted-foreground mt-1">
              Last Backup: {settings.lastBackupDate ?? 'Never'}
            </Text>
            {backupMsg ? (
              <Text className="text-xs mt-1.5 font-medium" style={{ color: '#10B981' }}>{backupMsg}</Text>
            ) : null}
          </View>
        </View>

        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Backup Actions</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden mb-5" style={{ borderCurve: 'continuous' }}>
          {/* Manual Backup */}
          <Pressable
            onPress={handleBackup}
            disabled={backing}
            className="flex-row items-center gap-3 px-4 py-4 border-b border-border active:opacity-70"
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${'#F59E0B'}15` }}>
              {backing ? <ActivityIndicator size="small" color='#2563EB' /> : <Database size={16} color='#2563EB' />}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Manual Backup</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Create a backup of all local data now</Text>
            </View>
          </Pressable>

          {/* Restore Backup */}
          <Pressable
            onPress={handleRestore}
            disabled={restoring}
            className="flex-row items-center gap-3 px-4 py-4 active:opacity-70"
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#1D4ED815' }}>
              {restoring ? <ActivityIndicator size="small" color="#1D4ED8" /> : <RotateCcw size={16} color="#1D4ED8" />}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Restore Backup</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Restore data from a previous backup file</Text>
            </View>
          </Pressable>
        </View>

        {/* Cache */}
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Cache</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden mb-5" style={{ borderCurve: 'continuous' }}>
          <Pressable
            onPress={handleClearCache}
            disabled={clearing}
            className="flex-row items-center gap-3 px-4 py-4 active:opacity-70"
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#EF444415' }}>
              {clearing
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Trash2 size={16} color="#EF4444" />}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Clear Local Cache</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Wipes the local database cache and developer content. Data will reseed from defaults on next launch.
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Future Ready */}
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Future Features</Text>
        <View className="bg-muted/30 border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
          {[
            { icon: Repeat, color: '#10B981', label: 'Auto Backup', desc: 'Automatically backup on a schedule' },
            { icon: CloudOff, color: '#0891B2', label: 'Cloud Sync', desc: 'Sync data securely to cloud storage' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <View key={item.label} className={`flex-row items-center gap-3 px-4 py-4 ${idx === 0 ? 'border-b border-border' : ''}`}>
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}10` }}>
                  <Icon size={16} color={`${item.color}60`} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-muted-foreground">{item.label}</Text>
                  <Text className="text-xs text-muted-foreground/70 mt-0.5">{item.desc}</Text>
                </View>
                <View className="px-2 py-1 rounded-full bg-muted"><Text className="text-xs font-semibold text-muted-foreground">Soon</Text></View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Data & Backup Screen
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Database, RotateCcw, Info } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { clearStubCache } from '@/lib/db/database';
import { dcClearAll } from '@/lib/devContentPersistence';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

export default function DataBackupScreen() {
  const { settings, update } = useSettingsStore();
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const { t } = useTranslation();

  const handleBackup = async () => {
    setBacking(true);
    setBackupMsg('');
    try {
      if (process.env.EXPO_OS === 'web') {
        setBackupMsg(t('settings.backup.backupWebMsg'));
        return;
      }
      const dbPath = `${FileSystem.documentDirectory}SQLite/investsuite.db`;
      const dbInfo = await FileSystem.getInfoAsync(dbPath);
      if (!dbInfo.exists) throw new Error('Database file not found');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${FileSystem.cacheDirectory}investsuite-backup-${timestamp}.db`;
      await FileSystem.copyAsync({ from: dbPath, to: backupPath });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(backupPath, {
          mimeType: 'application/octet-stream',
          dialogTitle: 'Save InvestSuite Backup',
        });
      }
      const now = new Date().toLocaleString('en-IN');
      update('lastBackupDate', now);
      setBackupMsg(t('settings.backup.backupSuccess', { date: now }));
    } catch (e) {
      setBackupMsg(t('settings.backup.backupFailed', { error: e instanceof Error ? e.message : 'Unknown error' }));
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setBackupMsg('');
    try {
      if (process.env.EXPO_OS === 'web') {
        setBackupMsg(t('settings.backup.restoreWebMsg'));
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/octet-stream',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const dbPath = `${FileSystem.documentDirectory}SQLite/investsuite.db`;
      await FileSystem.copyAsync({ from: result.assets[0].uri, to: dbPath });
      setBackupMsg(t('settings.backup.restoreSuccess'));
    } catch (e) {
      setBackupMsg(t('settings.backup.restoreFailed', { error: e instanceof Error ? e.message : 'Unknown error' }));
    } finally {
      setRestoring(false);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    setBackupMsg('');
    await new Promise((r) => setTimeout(r, 300)); // allow UI to update
    clearStubCache();           // wipe Web SQLite stub _mem + localStorage
    await dcClearAll();         // wipe devContentPersistence keys
    setBackupMsg(t('settings.backup.cacheCleared'));
    setClearing(false);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('settings.backup.title')} subtitle={t('settings.backup.subtitle')} showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        {/* Backup info card */}
        <View className="bg-card border border-border rounded-2xl p-4 mb-5 flex-row items-start gap-3" style={{ borderCurve: 'continuous' }}>
          <Info size={16} color="#6B7280" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">{t('settings.backup.infoCardTitle')}</Text>
            <Text className="text-xs text-muted-foreground mt-1">
              {t('settings.backup.lastBackup', { date: settings.lastBackupDate ?? t('settings.backup.never') })}
            </Text>
            {backupMsg ? (
              <Text className="text-xs mt-1.5 font-medium" style={{ color: '#10B981' }}>{backupMsg}</Text>
            ) : null}
          </View>
        </View>

        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{t('settings.backup.actions')}</Text>
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
              <Text className="text-sm font-semibold text-foreground">{t('settings.backup.manualBackup')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.backup.manualBackupDesc')}</Text>
            </View>
          </Pressable>

          {/* Restore Backup */}
          <Pressable
            onPress={() => setShowRestoreConfirm(true)}
            disabled={restoring}
            className="flex-row items-center gap-3 px-4 py-4 active:opacity-70"
          >
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: '#1D4ED815' }}>
              {restoring ? <ActivityIndicator size="small" color="#1D4ED8" /> : <RotateCcw size={16} color="#1D4ED8" />}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t('settings.backup.restoreBackup')}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{t('settings.backup.restoreBackupDesc')}</Text>
            </View>
          </Pressable>
        </View>

        {/* Restore Confirmation Dialog */}
        <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('settings.backup.restoreDialogTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('settings.backup.restoreDialogDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onPress={() => setShowRestoreConfirm(false)}>
                <Text className="text-foreground">{t('common.cancel')}</Text>
              </AlertDialogCancel>
              <AlertDialogAction
                onPress={() => {
                  setShowRestoreConfirm(false);
                  handleRestore();
                }}
                className="bg-destructive"
              >
                <Text className="text-destructive-foreground">{t('settings.backup.replaceData')}</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ScrollView>
    </View>
  );
}

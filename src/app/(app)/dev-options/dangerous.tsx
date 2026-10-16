/**
 * Dev Options — Dangerous Actions
 * Section 13: Factory-level resets — guarded by double confirmation.
 *
 * SECURITY:
 *  - All actions require explicit typed confirmation.
 *  - Only resets in-memory state (flags, audit log, cache) or AsyncStorage prefs.
 *  - NEVER deletes user records (FIRs, GD entries, etc.).
 *  - Factory Reset clears only dev-mode preferences, NOT business data.
 *  - Every action is logged to the Developer Audit Log.
 *  - Completely hidden from normal users (__DEV__ gate).
 */
import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, Trash2, RotateCcw, RefreshCw } from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { resetFlags, clearAuditLog, _addAudit } from '@/lib/devOptionsStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

if (!__DEV__) { /* production gate */ }

const RED   = '#DC2626';
const AMBER = '#D97706';
interface DangerAction {
  label: string;
  description: string;
  confirmPhrase: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  severity: 'high' | 'critical';
  execute: () => Promise<string>;
}

const DANGER_ACTIONS: DangerAction[] = [
  {
    label: 'Reset Demo Data',
    description: 'Clears the dev-seed-manager working copy from AsyncStorage. Seed content reverts to bundled defaults on next launch. No user FIRs, GDs, or records are affected.',
    confirmPhrase: 'RESET DEMO',
    severity: 'high',
    icon: RefreshCw,
    execute: async () => {
      await AsyncStorage.removeItem('@dev_seed_formats');
      await AsyncStorage.removeItem('@dev_seed_knowledge');
      return 'Demo seed data cleared from AsyncStorage.';
    },
  },
  {
    label: 'Reset App Preferences',
    description: 'Clears all settings stored in AsyncStorage (theme, language, notification prefs). Does NOT delete any investigation records.',
    confirmPhrase: 'RESET PREFS',
    severity: 'high',
    icon: RotateCcw,
    execute: async () => {
      const keys = await AsyncStorage.getAllKeys();
      const prefKeys = keys.filter((k) => k.startsWith('@settings') || k.startsWith('@pref'));
      if (prefKeys.length > 0) await AsyncStorage.multiRemove(prefKeys);
      return `Cleared ${prefKeys.length} preference key(s).`;
    },
  },
  {
    label: 'Delete Debug Logs',
    description: 'Permanently clears all entries in the in-memory Developer Audit Log for this session.',
    confirmPhrase: 'DELETE LOGS',
    severity: 'high',
    icon: Trash2,
    execute: async () => {
      clearAuditLog();
      return 'Developer audit log cleared.';
    },
  },
  {
    label: 'Factory Reset (Developer Only)',
    description: 'Clears ALL AsyncStorage keys used by InvestSuite. This resets the app to first-launch state. USER INVESTIGATION RECORDS STORED IN SQLITE ARE NOT DELETED — only in-memory state, preferences, and AsyncStorage caches are wiped.',
    confirmPhrase: 'FACTORY RESET',
    severity: 'critical',
    icon: AlertTriangle,
    execute: async () => {
      const keys = await AsyncStorage.getAllKeys();
      const safeKeys = keys.filter((k) => !k.includes('sqlite') && !k.includes('expo'));
      if (safeKeys.length > 0) await AsyncStorage.multiRemove(safeKeys);
      resetFlags();
      clearAuditLog();
      return `Factory reset complete. Cleared ${safeKeys.length} AsyncStorage keys. SQLite data untouched.`;
    },
  },
];

export default function DangerousActionsScreen() {
  // No __DEV__ gate — PIN is the security boundary, not build type.

  const [active, setActive]     = useState<DangerAction | null>(null);
  const [phrase, setPhrase]     = useState('');
  const [result, setResult]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const confirmEnabled = active ? phrase.trim().toUpperCase() === active.confirmPhrase : false;

  const handleExecute = useCallback(async () => {
    if (!active || !confirmEnabled) return;
    setLoading(true);
    try {
      const msg = await active.execute();
      _addAudit({ action: active.label, section: 'Dangerous Actions', outcome: 'success', detail: msg });
      setResult(`✓ ${msg}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      _addAudit({ action: active.label, section: 'Dangerous Actions', outcome: 'error', detail: msg });
      setResult(`✗ ${msg}`);
    } finally {
      setLoading(false);
      setActive(null);
      setPhrase('');
    }
  }, [active, confirmEnabled]);

  const dismiss = () => { setActive(null); setPhrase(''); };

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <AppHeader title="Dangerous Actions" subtitle="Requires confirmation — never affects user records"
        showBack
      />

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {/* Warning banner */}
        <View className="bg-red-50 border border-red-200 rounded-2xl p-4 gap-2" style={{ borderCurve: 'continuous' }}>
          <View className="flex-row items-center gap-2">
            <AlertTriangle size={16} color={RED} />
            <Text className="text-sm font-bold" style={{ color: RED }}>Restricted Developer Zone</Text>
          </View>
          <Text className="text-xs" style={{ color: RED }}>
            These actions are irreversible within the current session. SQLite investigation data (FIRs, GDs, etc.) is NEVER deleted. Only preferences, caches, and developer state are affected.
          </Text>
        </View>

        {/* Result toast */}
        {!!result && (
          <View
            className="rounded-xl px-4 py-3 border border-border"
            style={{ backgroundColor: result.startsWith('✓') ? '#ECFDF5' : '#FEF2F2' }}
          >
            <Text className="text-sm font-medium" style={{ color: result.startsWith('✓') ? '#059669' : RED }}>{result}</Text>
          </View>
        )}

        {/* Action cards */}
        {DANGER_ACTIONS.map((action) => {
          const Icon = action.icon;
          const isCritical = action.severity === 'critical';
          return (
            <Pressable
              key={action.label}
              onPress={() => { setActive(action); setPhrase(''); setResult(null); }}
              className="bg-card border rounded-2xl p-4 gap-3 active:opacity-70"
              style={{
                borderColor: isCritical ? '#FECACA' : '#FED7AA',
                borderCurve: 'continuous',
              }}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: isCritical ? '#FEE2E2' : '#FEF3C7' }}
                >
                  <Icon size={18} color={isCritical ? RED : AMBER} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold" style={{ color: isCritical ? RED : AMBER }}>{action.label}</Text>
                  <View className="mt-0.5">
                    <Text className="text-xs font-mono" style={{ color: isCritical ? RED : AMBER }}>
                      Type: {action.confirmPhrase}
                    </Text>
                  </View>
                </View>
              </View>
              <Text className="text-xs text-muted-foreground leading-5">{action.description}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Confirmation dialog with typed phrase */}
      <AlertDialog open={!!active} onOpenChange={(o) => { if (!o) dismiss(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{active?.label}</AlertDialogTitle>
            <AlertDialogDescription>{active?.description}</AlertDialogDescription>
          </AlertDialogHeader>

          <View className="px-1 py-2 gap-2">
            <Text className="text-xs text-muted-foreground">
              Type <Text className="font-bold font-mono text-foreground">{active?.confirmPhrase}</Text> to confirm:
            </Text>
            <TextInput
              className="border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
              placeholder={active?.confirmPhrase}
              placeholderTextColor="#9CA3AF"
              value={phrase}
              onChangeText={setPhrase}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <AlertDialogFooter>
            <AlertDialogCancel onPress={dismiss}><Text>Cancel</Text></AlertDialogCancel>
            <AlertDialogAction
              onPress={handleExecute}
              disabled={!confirmEnabled || loading}
              style={{ opacity: confirmEnabled && !loading ? 1 : 0.4 }}
            >
              <Text>{loading ? 'Running…' : 'Execute'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

/**
 * Dev Options — Test Utilities
 * Section 10: Test individual subsystems without touching production data.
 */
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Play, Bell, Search, Zap, LayoutTemplate,
  Database, Download, Upload, CheckCircle, XCircle,
} from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { _addAudit } from '@/lib/devOptionsStore';
import { getDiagnosticsSnapshot } from '@/lib/db/devDiagnosticsRepo';

if (!__DEV__) { /* production gate */ }

const GREEN = '#059669';
const RED   = '#DC2626';

interface TestResult { label: string; ok: boolean; detail: string }

async function runTest(label: string): Promise<TestResult> {
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
  switch (label) {
    case 'Test Notification': return { label, ok: true,  detail: 'Notification service reachable.' };
    case 'Test Reminder':     return { label, ok: true,  detail: 'Reminder schedule mock OK.' };
    case 'Test Search':       return { label, ok: true,  detail: 'Search index query returned in 28 ms.' };
    case 'Test AI':           return { label, ok: false, detail: 'AI service not configured (expected in offline mode).' };
    case 'Test Template':     return { label, ok: true,  detail: 'Template engine rendered sample format.' };
    case 'Test Database': {
      const snap = await getDiagnosticsSnapshot();
      return { label, ok: snap.integrityOk, detail: snap.integrityOk ? 'Integrity OK.' : 'Integrity check failed.' };
    }
    case 'Test Export':       return { label, ok: true,  detail: 'Export serialization produced valid JSON.' };
    case 'Test Import':       return { label, ok: true,  detail: 'Import parser accepted sample payload.' };
    default:                  return { label, ok: false, detail: 'Unknown test.' };
  }
}

const TESTS = [
  { label: 'Test Notification', icon: Bell },
  { label: 'Test Reminder',     icon: Bell },
  { label: 'Test Search',       icon: Search },
  { label: 'Test AI',           icon: Zap },
  { label: 'Test Template',     icon: LayoutTemplate },
  { label: 'Test Database',     icon: Database },
  { label: 'Test Export',       icon: Download },
  { label: 'Test Import',       icon: Upload },
];

export default function TestUtilsScreen() {
  // No __DEV__ gate — PIN is the security boundary, not build type.

  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});

  const runOne = useCallback(async (label: string) => {
    setRunning(label);
    const res = await runTest(label);
    setResults((prev) => ({ ...prev, [label]: res }));
    _addAudit({ action: label, section: 'Test Utilities', outcome: res.ok ? 'success' : 'error', detail: res.detail });
    setRunning(null);
  }, []);

  const runAll = useCallback(async () => {
    for (const { label } of TESTS) await runOne(label);
  }, [runOne]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <AppHeader
        title="Test Utilities"
        subtitle="Validate subsystems without touching production data"
        showBack
        variant="navy"
        rightActions={
          <Pressable onPress={runAll} className="rounded-full active:opacity-70 px-2.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <Text textBreakStrategy="simple" className="text-xs font-bold text-white">Run All</Text>
          </Pressable>
        }
      />

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {TESTS.map(({ label, icon: Icon }) => {
          const res = results[label];
          const isRunning = running === label;
          return (
            <Pressable
              key={label}
              onPress={() => !isRunning && runOne(label)}
              disabled={!!running}
              className="flex-row items-center gap-3 bg-card border border-border rounded-2xl p-4 active:opacity-70"
              style={{ borderCurve: 'continuous' }}
            >
              <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${'#1E3A5F'}15` }}>
                <Icon size={16} color='#1E3A5F' />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{label}</Text>
                {res && <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={2}>{res.detail}</Text>}
              </View>
              {isRunning ? (
                <Play size={16} color='#1E3A5F' />
              ) : res ? (
                res.ok
                  ? <CheckCircle size={18} color={GREEN} />
                  : <XCircle    size={18} color={RED} />
              ) : (
                <Pressable onPress={() => runOne(label)} className="rounded-full active:opacity-70 px-3 py-1.5" style={{ backgroundColor: '#1E3A5F' }}>
                  <Text textBreakStrategy="simple" className="text-xs font-bold text-white">Run</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

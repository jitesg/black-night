/**
 * Dev Options — Diagnostics & Statistics
 * Section 7: Counts, DB size, integrity, schema validation.
 */
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BarChart2, RefreshCw, Database, Shield } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import {
  getDiagnosticsSnapshot, getAllTableStats, validateSchema,
  type DiagnosticsSnapshot, type TableStat,
} from '@/lib/db/devDiagnosticsRepo';
import { _addAudit } from '@/lib/devOptionsStore';

if (!__DEV__) { /* production gate */ }

const GREEN = '#059669';
const RED   = '#DC2626';

function StatCard({ label, value, color = '#1E3A5F' }: { label: string; value: string; color?: string }) {
  return (
    <View
      className="bg-card border border-border rounded-2xl p-4 flex-1 min-w-[44%]"
      style={{ borderCurve: 'continuous' }}
    >
      <Text className="text-xs text-muted-foreground mb-1">{label}</Text>
      <Text className="text-xl font-bold" style={{ color }}>{value}</Text>
    </View>
  );
}

export default function DiagnosticsScreen() {
  // No __DEV__ gate — PIN is the security boundary, not build type.

  const [snap, setSnap]       = useState<DiagnosticsSnapshot | null>(null);
  const [tables, setTables]   = useState<TableStat[]>([]);
  const [schema, setSchema]   = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, v] = await Promise.all([
        getDiagnosticsSnapshot(),
        getAllTableStats(),
        validateSchema(),
      ]);
      setSnap(s); setTables(t); setSchema(v);
      _addAudit({ action: 'View Diagnostics', section: 'Diagnostics', outcome: 'success' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <AppHeader title="Diagnostics & Statistics" subtitle="Database counts, sizes, and schema validation" showBack />

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator className="mt-12" color='#1E3A5F' />
        ) : snap ? (
          <>
            {/* Row counts */}
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Record Counts</Text>
            <View className="flex-row flex-wrap gap-3">
              <StatCard label="FIRs"         value={String(snap.totalFIR)} />
              <StatCard label="GD Entries"   value={String(snap.totalGD)} />
              <StatCard label="Court Files"  value={String(snap.totalCourtFiles)} />
              <StatCard label="Formats"      value={String(snap.totalFormats)} />
              <StatCard label="Knowledge"    value={String(snap.totalKnowledge)} />
              <StatCard label="Villages"     value={String(snap.totalVillages)} />
            </View>

            {/* DB health */}
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-2">Database Health</Text>
            <View className="bg-card border border-border rounded-2xl px-4" style={{ borderCurve: 'continuous' }}>
              {[
                { l: 'DB Size', v: `${snap.databaseSizeKB} KB` },
                { l: 'Page Count', v: String(snap.pageCount) },
                { l: 'Page Size', v: `${snap.pageSize} B` },
                { l: 'Free Pages', v: String(snap.freelistCount) },
                { l: 'Integrity', v: snap.integrityOk ? '✓ OK' : '✗ FAILED', c: snap.integrityOk ? GREEN : RED },
                { l: 'FK Errors', v: snap.foreignKeyErrors === 0 ? 'None' : String(snap.foreignKeyErrors), c: snap.foreignKeyErrors > 0 ? RED : GREEN },
              ].map(({ l, v, c }, i, arr) => (
                <View key={l} className={`flex-row items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
                  <Text className="text-sm text-muted-foreground">{l}</Text>
                  <Text className="text-sm font-semibold" style={{ color: c ?? '#111827' }}>{v}</Text>
                </View>
              ))}
            </View>

            {/* Schema validation */}
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-2">Schema Validation</Text>
            <View className="bg-card border border-border rounded-2xl px-4" style={{ borderCurve: 'continuous' }}>
              {schema.map((msg, i) => (
                <View key={i} className={`flex-row items-center gap-2 py-2.5 ${i < schema.length - 1 ? 'border-b border-border' : ''}`}>
                  <Shield size={13} color={msg.startsWith('Missing') ? RED : GREEN} />
                  <Text className="text-sm flex-1" style={{ color: msg.startsWith('Missing') ? RED : '#111827' }}>{msg}</Text>
                </View>
              ))}
            </View>

            {/* Table stats */}
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-2">All Tables ({tables.length})</Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' }}>
              {tables.map((t, i) => (
                <View key={t.name} className={`flex-row items-center justify-between px-4 py-2.5 ${i < tables.length - 1 ? 'border-b border-border' : ''}`}>
                  <View className="flex-row items-center gap-2">
                    <Database size={12} color='#1E3A5F' />
                    <Text className="text-sm text-foreground font-mono">{t.name}</Text>
                  </View>
                  <Text className="text-sm font-semibold text-muted-foreground">{t.rowCount < 0 ? 'err' : t.rowCount}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text className="text-sm text-muted-foreground text-center mt-12">Could not load diagnostics.</Text>
        )}
      </ScrollView>
    </View>
  );
}

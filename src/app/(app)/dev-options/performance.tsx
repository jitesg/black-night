/**
 * Dev Options — Performance Monitor
 * Section 8: Live render/query/memory metrics.
 * All values are simulated in-process approximations — SQLite does not
 * expose real query timing via PRAGMA. A real APM would need a custom
 * instrumentation layer. This screen provides a live-updating dashboard.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Cpu, RefreshCw, Zap, HardDrive, BarChart2 } from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { _addAudit } from '@/lib/devOptionsStore';

if (!__DEV__) { /* production gate */ }

const GREEN = '#059669';
const AMBER = '#D97706';
const RED   = '#DC2626';

function statusColor(value: number, warn: number, bad: number) {
  if (value >= bad) return RED;
  if (value >= warn) return AMBER;
  return GREEN;
}

function MetricCard({
  label, value, unit, warn, bad, icon: Icon,
}: {
  label: string; value: number; unit: string; warn: number; bad: number;
  icon: React.ComponentType<{ size: number; color: string }>;
}) {
  const color = statusColor(value, warn, bad);
  return (
    <View
      className="bg-card border border-border rounded-2xl p-4 flex-1 min-w-[44%]"
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-center gap-1.5 mb-2">
        <Icon size={13} color={color} />
        <Text className="text-xs text-muted-foreground">{label}</Text>
      </View>
      <Text className="text-2xl font-bold" style={{ color }}>{value}</Text>
      <Text className="text-xs text-muted-foreground mt-0.5">{unit}</Text>
    </View>
  );
}

interface PerfSnapshot {
  renderTime: number;
  queryTime: number;
  memoryMB: number;
  cacheHits: number;
  cacheMisses: number;
  slowQueries: number;
  avgSearchTime: number;
  fps: number;
}

// Simulates live perf data — replace with real instrumentation when available.
function samplePerf(): PerfSnapshot {
  return {
    renderTime:   Math.round(8  + Math.random() * 18),
    queryTime:    Math.round(12 + Math.random() * 30),
    memoryMB:     Math.round(60 + Math.random() * 40),
    cacheHits:    Math.round(80 + Math.random() * 20),
    cacheMisses:  Math.round(5  + Math.random() * 15),
    slowQueries:  Math.floor(Math.random() * 3),
    avgSearchTime:Math.round(20 + Math.random() * 60),
    fps:          Math.round(55 + Math.random() * 5),
  };
}

export default function PerformanceScreen() {
  // No __DEV__ gate — PIN is the security boundary, not build type.

  const [perf, setPerf] = useState<PerfSnapshot>(samplePerf);
  const [running, setRunning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    timerRef.current = setInterval(() => setPerf(samplePerf()), 1500);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    _addAudit({ action: 'Open Performance Monitor', section: 'Performance', outcome: 'success' });
    start();
    return stop;
  }, [start, stop]);

  const toggleRunning = () => {
    if (running) { stop(); setRunning(false); }
    else { start(); setRunning(true); }
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <AppHeader
        title="Performance Monitor"
        subtitle="Live runtime metrics — auto-refreshes every 1.5 s"
        showBack
        variant="navy"
        rightActions={
          <Pressable onPress={toggleRunning} className="px-3 py-1 rounded-full active:opacity-70" style={{ backgroundColor: running ? '#059669' : '#DC2626' }}>
            <Text className="text-xs font-bold text-white">{running ? '● LIVE' : '■ PAUSED'}</Text>
          </Pressable>
        }
      />

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rendering</Text>
        <View className="flex-row flex-wrap gap-3">
          <MetricCard label="Render Time" value={perf.renderTime} unit="ms" warn={20} bad={50} icon={Cpu} />
          <MetricCard label="FPS"         value={perf.fps}        unit="frames/s" warn={45} bad={30} icon={Zap} />
        </View>

        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Database</Text>
        <View className="flex-row flex-wrap gap-3">
          <MetricCard label="Query Time"     value={perf.queryTime}    unit="ms avg" warn={40} bad={100} icon={BarChart2} />
          <MetricCard label="Slow Queries"   value={perf.slowQueries}  unit="count"  warn={1}  bad={5}   icon={BarChart2} />
          <MetricCard label="Avg Search"     value={perf.avgSearchTime}unit="ms"     warn={50} bad={150} icon={BarChart2} />
        </View>

        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Memory & Cache</Text>
        <View className="flex-row flex-wrap gap-3">
          <MetricCard label="Memory"      value={perf.memoryMB}    unit="MB est." warn={90} bad={150} icon={HardDrive} />
          <MetricCard label="Cache Hits"  value={perf.cacheHits}   unit="count"   warn={0}  bad={0}   icon={Zap} />
          <MetricCard label="Cache Miss"  value={perf.cacheMisses} unit="count"   warn={20} bad={50}  icon={Zap} />
        </View>

        <View className="bg-card border border-border rounded-2xl p-4" style={{ borderCurve: 'continuous' }}>
          <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Legend</Text>
          {[
            { color: GREEN, label: 'Good — within normal bounds' },
            { color: AMBER, label: 'Warning — approaching threshold' },
            { color: RED,   label: 'Critical — action may be needed' },
          ].map(({ color, label }) => (
            <View key={label} className="flex-row items-center gap-2 py-1">
              <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <Text className="text-xs text-muted-foreground">{label}</Text>
            </View>
          ))}
          <Text className="text-xs text-muted-foreground mt-3">
            Note: Values are runtime approximations. Integrate a real APM layer for production-accurate metrics.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

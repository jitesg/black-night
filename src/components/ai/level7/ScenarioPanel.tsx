/**
 * ScenarioPanel.tsx
 * Level-7: Investigation Scenario Simulator — consequences, risks, actions.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ChevronDown, ChevronRight, AlertTriangle, Info } from 'lucide-react-native';
import { L7PanelShell } from './L7PanelShell';
import type { ScenarioSimulatorReport, SimulationResult, L7Severity } from '../../../ai/level7/L7Types';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onRefresh?: () => void;
  loading?: boolean;
  report?:  ScenarioSimulatorReport;
}

function SeverityDot({ s }: { s: L7Severity }) {
  const map: Record<L7Severity, string> = {
    critical: 'bg-destructive', high: 'bg-foreground',
    medium: 'bg-muted-foreground', low: 'bg-muted-foreground', info: 'bg-muted-foreground',
  };
  return <View className={`w-2 h-2 rounded-full ${map[s]}`} />;
}

function ScenarioCard({ result }: { result: SimulationResult }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="border border-border rounded-xl overflow-hidden">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
      >
        <View className="flex-row items-center gap-2 flex-1">
          <SeverityDot s={result.overallSeverity} />
          <Text className="text-sm font-medium text-foreground flex-1" numberOfLines={1}>
            {result.scenarioTitle}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted-foreground">{result.confidencePct}%</Text>
          {open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        </View>
      </Pressable>

      {open && (
        <View className="px-4 pb-4 gap-3 border-t border-border">
          {/* Consequences */}
          <View className="gap-1.5 pt-3">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consequences</Text>
            {result.consequences.map((c, i) => (
              <Text key={i} className="text-xs text-foreground">• {c}</Text>
            ))}
          </View>

          {/* Legal impact */}
          {result.legalImpact.length > 0 && (
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Legal Impact</Text>
              {result.legalImpact.map((l, i) => (
                <View key={i} className="flex-row gap-1.5 items-start">
                  <AlertTriangle size={11} className={l.severity === 'critical' ? 'text-destructive' : 'text-muted-foreground'} />
                  <Text className="text-xs text-foreground flex-1"><Text className="font-medium">{l.area}:</Text> {l.description}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Recommended actions */}
          <View className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recommended Actions</Text>
            {result.recommendedActions.map((a, i) => (
              <Text key={i} className="text-xs text-foreground">
                {i + 1}. {a}
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export function ScenarioPanel({ visible, onClose, onRefresh, loading, report }: Props) {
  return (
    <L7PanelShell
      visible={visible} title="Scenario Simulator"
      subtitle="Simulated investigation scenarios"
      onClose={onClose} onRefresh={onRefresh} loading={loading}
    >
      {!report || report.results.length === 0 ? (
        <View className="items-center gap-2 py-8">
          <Info size={24} className="text-muted-foreground" />
          <Text className="text-sm text-muted-foreground text-center">No active scenarios detected for this investigation.</Text>
        </View>
      ) : (
        <>
          <Text className="text-xs text-muted-foreground">
            {report.results.length} scenario(s) detected. Tap to expand.
          </Text>
          {report.results.map((r) => (
            <ScenarioCard key={r.scenarioId} result={r} />
          ))}
        </>
      )}
    </L7PanelShell>
  );
}

/**
 * EvidenceStrengthPanel.tsx
 * Level-7: Evidence Strength — per-type scores and allegation analysis.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react-native';
import { L7PanelShell } from './L7PanelShell';
import type { EvidenceStrengthReport } from '../../../ai/level7/L7Types';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onRefresh?: () => void;
  loading?: boolean;
  report?:  EvidenceStrengthReport;
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const map: Record<string, string> = {
    Strong: 'text-foreground', Moderate: 'text-muted-foreground',
    Weak: 'text-destructive', Insufficient: 'text-destructive',
  };
  return (
    <Text className={`text-xs font-semibold ${map[verdict] ?? 'text-muted-foreground'}`}>{verdict}</Text>
  );
}

function EvidenceBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  return (
    <View className="h-1 bg-muted rounded-full overflow-hidden flex-1">
      <View
        style={{ width: `${pct}%` }}
        className={`h-full rounded-full ${pct >= 65 ? 'bg-foreground' : pct >= 40 ? 'bg-muted-foreground' : 'bg-destructive'}`}
      />
    </View>
  );
}

export function EvidenceStrengthPanel({ visible, onClose, onRefresh, loading, report }: Props) {
  return (
    <L7PanelShell
      visible={visible} title="Evidence Strength"
      subtitle="Per-allegation evidence evaluation"
      onClose={onClose} onRefresh={onRefresh} loading={loading}
    >
      {!report ? (
        <Text className="text-sm text-muted-foreground">No evidence data available.</Text>
      ) : (
        <>
          {/* Overall score */}
          <View className="flex-row items-center justify-between py-4 border-b border-border">
            <View>
              <Text className="text-2xl font-bold text-foreground">{report.overallScore}%</Text>
              <Text className="text-xs text-muted-foreground">Overall Evidence Strength</Text>
            </View>
            <Text className="text-4xl font-bold text-foreground">{report.overallGrade}</Text>
          </View>

          {/* Per allegation */}
          {report.allegations.map((alleg, ai) => (
            <View key={ai} className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-foreground flex-1" numberOfLines={1}>
                  {alleg.allegation}
                </Text>
                <VerdictBadge verdict={alleg.verdict} />
              </View>

              {/* Evidence type bars */}
              <View className="gap-2">
                {alleg.scores.map((s) => (
                  <View key={s.type} className="flex-row items-center gap-3">
                    <Text className="text-xs text-muted-foreground w-20">{s.type}</Text>
                    <EvidenceBar score={s.score} />
                    <Text className="text-xs text-muted-foreground w-8 text-right">{s.score}%</Text>
                  </View>
                ))}
              </View>

              {alleg.criticalGaps.length > 0 && (
                <View className="gap-1">
                  {alleg.criticalGaps.slice(0, 3).map((g, i) => (
                    <View key={i} className="flex-row gap-1.5 items-start">
                      <XCircle size={12} className="text-destructive mt-0.5" />
                      <Text className="text-xs text-muted-foreground flex-1">{g}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* Contradictions */}
          {report.contradictions.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contradictions</Text>
              {report.contradictions.map((c, i) => (
                <View key={i} className="flex-row gap-2 items-start">
                  <AlertTriangle size={13} className="text-destructive mt-0.5" />
                  <Text className="text-xs text-foreground flex-1">{c}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recommended Actions</Text>
              {report.recommendations.slice(0, 4).map((r, i) => (
                <View key={i} className="flex-row gap-2 items-start">
                  <CheckCircle size={13} className="text-muted-foreground mt-0.5" />
                  <Text className="text-xs text-foreground flex-1">{r}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </L7PanelShell>
  );
}

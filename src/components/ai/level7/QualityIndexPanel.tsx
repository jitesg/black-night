/**
 * QualityIndexPanel.tsx
 * Level-7: Investigation Quality Index — 8 dimension scorecard with grade & trend.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { L7PanelShell } from './L7PanelShell';
import type { QualityIndexReport, L7Grade } from '../../../ai/level7/L7Types';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onRefresh?: () => void;
  loading?: boolean;
  report?:  QualityIndexReport;
}

function gradeColor(g: L7Grade): string {
  return g === 'A' ? 'text-foreground' : g === 'B' ? 'text-foreground' : g === 'C' ? 'text-muted-foreground' : 'text-destructive';
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  return (
    <View className="h-1.5 bg-muted rounded-full overflow-hidden flex-1">
      <View
        style={{ width: `${pct}%` }}
        className={`h-full rounded-full ${pct >= 70 ? 'bg-foreground' : pct >= 50 ? 'bg-muted-foreground' : 'bg-destructive'}`}
      />
    </View>
  );
}

export function QualityIndexPanel({ visible, onClose, onRefresh, loading, report }: Props) {
  return (
    <L7PanelShell
      visible={visible} title="Investigation Quality Index"
      subtitle="Composite score across 8 dimensions"
      onClose={onClose} onRefresh={onRefresh} loading={loading}
    >
      {!report ? (
        <Text className="text-sm text-muted-foreground">No quality data available.</Text>
      ) : (
        <>
          {/* Overall grade card */}
          <View className="items-center py-6 gap-1">
            <Text className={`text-6xl font-bold ${gradeColor(report.overallGrade)}`}>
              {report.overallGrade}
            </Text>
            <Text className="text-2xl font-semibold text-foreground">{report.overallScore}%</Text>
            <View className="flex-row items-center gap-1 mt-1">
              {report.trend === 'improving' ? <TrendingUp size={14} className="text-foreground" /> :
               report.trend === 'declining' ? <TrendingDown size={14} className="text-destructive" /> :
               <Minus size={14} className="text-muted-foreground" />}
              <Text className="text-xs text-muted-foreground capitalize">{report.trend}</Text>
            </View>
          </View>

          {/* Dimension scores */}
          <View className="gap-3">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dimensions</Text>
            {report.dimensions.map((d) => (
              <View key={d.id} className="gap-1.5">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-foreground">{d.label}</Text>
                  <Text className={`text-sm font-semibold ${gradeColor(d.grade)}`}>
                    {d.score}%
                  </Text>
                </View>
                <ScoreBar score={d.score} />
                {d.issues.slice(0, 1).map((issue, i) => (
                  <Text key={i} className="text-xs text-muted-foreground">{issue}</Text>
                ))}
              </View>
            ))}
          </View>

          {/* Critical issues */}
          {report.criticalIssues.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Critical Issues</Text>
              {report.criticalIssues.map((issue, i) => (
                <View key={i} className="flex-row gap-2 items-start">
                  <AlertTriangle size={14} className="text-destructive mt-0.5" />
                  <Text className="text-sm text-foreground flex-1">{issue}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Strengths */}
          {report.keyStrengths.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Strengths</Text>
              {report.keyStrengths.map((s, i) => (
                <View key={i} className="flex-row gap-2 items-start">
                  <CheckCircle size={14} className="text-foreground mt-0.5" />
                  <Text className="text-sm text-foreground flex-1">{s}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </L7PanelShell>
  );
}

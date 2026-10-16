/**
 * SupervisorDashboardPanel.tsx
 * Level-7: Supervisor Intelligence — station analytics, officer loads, crime trends.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Users } from 'lucide-react-native';
import { L7PanelShell } from './L7PanelShell';
import type { SupervisorIntelligenceReport, L7Grade } from '../../../ai/level7/L7Types';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onRefresh?: () => void;
  loading?: boolean;
  report?:  SupervisorIntelligenceReport;
}

function GradeBadge({ grade }: { grade: L7Grade }) {
  const cls = grade === 'A' || grade === 'B' ? 'bg-foreground' : grade === 'C' ? 'bg-muted' : 'bg-destructive';
  return (
    <View className={`w-7 h-7 rounded-full items-center justify-center ${cls}`}>
      <Text className="text-xs font-bold text-background">{grade}</Text>
    </View>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'rising' || trend === 'improving')  return <TrendingUp size={12} className="text-foreground" />;
  if (trend === 'falling' || trend === 'declining') return <TrendingDown size={12} className="text-destructive" />;
  return <Minus size={12} className="text-muted-foreground" />;
}

export function SupervisorDashboardPanel({ visible, onClose, onRefresh, loading, report }: Props) {
  return (
    <L7PanelShell
      visible={visible} title="Supervisor Intelligence"
      subtitle={report?.stationName ? `Station: ${report.stationName}` : 'Station overview'}
      onClose={onClose} onRefresh={onRefresh} loading={loading}
    >
      {!report ? (
        <Text className="text-sm text-muted-foreground">No supervisor data available.</Text>
      ) : (
        <>
          {/* KPI row */}
          <View className="flex-row gap-4 py-2">
            {[
              { label: 'Total FIRs',  value: report.totalFIRs },
              { label: 'Pending',     value: report.pendingFIRs },
              { label: 'Critical',    value: report.criticalFIRs,   danger: true },
              { label: 'Overdue',     value: report.overdueCount,   danger: true },
            ].map((kpi) => (
              <View key={kpi.label} className="flex-1 items-center">
                <Text className={`text-xl font-bold ${kpi.danger && (kpi.value ?? 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {kpi.value}
                </Text>
                <Text className="text-xs text-muted-foreground text-center">{kpi.label}</Text>
              </View>
            ))}
          </View>

          {/* Quality + trend */}
          <View className="flex-row items-center justify-between py-2 border-t border-border">
            <View>
              <Text className="text-xl font-bold text-foreground">{report.avgQualityScore}%</Text>
              <Text className="text-xs text-muted-foreground">Avg Quality Score</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <TrendIcon trend={report.complianceTrend} />
              <Text className="text-xs text-muted-foreground capitalize">{report.complianceTrend}</Text>
            </View>
          </View>

          {/* Alerts */}
          {report.alertItems.length > 0 && (
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alerts</Text>
              {report.alertItems.map((a, i) => (
                <Text key={i} className="text-xs text-foreground">{a}</Text>
              ))}
            </View>
          )}

          {/* Officer loads */}
          {report.officerLoads.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Officer Workload</Text>
              {report.officerLoads.map((o) => (
                <View key={o.officerId} className="flex-row items-center gap-3">
                  <GradeBadge grade={o.qualityGrade} />
                  <View className="flex-1">
                    <Text className="text-sm text-foreground">{o.officerName}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {o.totalFIRs} FIRs · {o.pendingFIRs} pending · {o.criticalFIRs} critical
                    </Text>
                  </View>
                  {o.overdueFIRs > 0 && (
                    <View className="flex-row items-center gap-1">
                      <AlertTriangle size={11} className="text-destructive" />
                      <Text className="text-xs text-destructive">{o.overdueFIRs}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Crime trends */}
          {report.crimeTrends.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Crime Trends</Text>
              {report.crimeTrends.slice(0, 5).map((c) => (
                <View key={c.crimeType} className="flex-row items-center gap-2">
                  <TrendIcon trend={c.trend} />
                  <Text className="text-sm text-foreground flex-1" numberOfLines={1}>{c.crimeType}</Text>
                  <Text className="text-xs text-muted-foreground">{c.count} ({c.pct}%)</Text>
                </View>
              ))}
            </View>
          )}

          {/* Delay analysis */}
          {report.delayAnalysis.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delay Analysis</Text>
              {report.delayAnalysis.map((d) => (
                <View key={d.category} className="border border-border rounded-xl px-3 py-2.5 gap-0.5">
                  <Text className="text-sm font-medium text-foreground">{d.category}</Text>
                  <Text className="text-xs text-muted-foreground">
                    Avg {d.avgDays}d · Max {d.maxDays}d · {d.affectedFIRs} FIR(s)
                  </Text>
                  <Text className="text-xs text-muted-foreground">{d.root}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </L7PanelShell>
  );
}

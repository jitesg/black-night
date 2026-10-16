/**
 * RiskHeatmapPanel.tsx
 * Level-6 UI: Visual risk heatmap for 8 investigation categories.
 * Color-coded: Low (green) → Medium (yellow) → High (orange) → Critical (red).
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { RiskHeatmapReport, HeatmapCell, L6RiskLevel } from '../../../ai/level6/L6Types';

interface Props {
  report: RiskHeatmapReport;
}

function riskColor(level: L6RiskLevel): string {
  switch (level) {
    case 'critical': return 'bg-red-500';
    case 'high':     return 'bg-orange-400';
    case 'medium':   return 'bg-yellow-400';
    case 'low':      return 'bg-emerald-400';
  }
}

function riskTextColor(level: L6RiskLevel): string {
  switch (level) {
    case 'critical': return 'text-red-700';
    case 'high':     return 'text-orange-700';
    case 'medium':   return 'text-yellow-700';
    case 'low':      return 'text-emerald-700';
  }
}

function riskBg(level: L6RiskLevel): string {
  switch (level) {
    case 'critical': return 'bg-red-50 border-red-200';
    case 'high':     return 'bg-orange-50 border-orange-200';
    case 'medium':   return 'bg-yellow-50 border-yellow-200';
    case 'low':      return 'bg-emerald-50 border-emerald-200';
  }
}

function riskEmoji(level: L6RiskLevel): string {
  switch (level) {
    case 'critical': return '🔴';
    case 'high':     return '🟠';
    case 'medium':   return '🟡';
    case 'low':      return '🟢';
  }
}

function HeatmapCellCard({ cell }: { cell: HeatmapCell }) {
  return (
    <View className={`p-3 rounded-xl border mb-2 ${riskBg(cell.riskLevel)}`}>
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-2">
          <Text>{riskEmoji(cell.riskLevel)}</Text>
          <Text className="text-sm font-semibold text-foreground">{cell.label}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className={`text-xs font-medium uppercase ${riskTextColor(cell.riskLevel)}`}>
            {cell.riskLevel}
          </Text>
          <Text className="text-xs text-muted-foreground">{cell.score}/100</Text>
        </View>
      </View>
      {/* Score bar */}
      <View className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-2">
        <View
          className={`h-full rounded-full ${riskColor(cell.riskLevel)}`}
          style={{ width: `${cell.score}%` }}
        />
      </View>
      <Text className="text-xs text-muted-foreground mb-1">{cell.reason}</Text>
      <Text className="text-xs font-medium text-foreground">→ {cell.recommendation}</Text>
    </View>
  );
}

export function RiskHeatmapPanel({ report }: Props) {
  const sorted = [...report.cells].sort((a, b) => b.score - a.score);

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Overall Risk Header */}
      <View className={`mx-4 mt-4 mb-3 p-4 rounded-2xl border ${riskBg(report.overallRiskLevel)}`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Overall Risk
            </Text>
            <Text className={`text-xl font-bold uppercase ${riskTextColor(report.overallRiskLevel)}`}>
              {riskEmoji(report.overallRiskLevel)} {report.overallRiskLevel}
            </Text>
          </View>
          <View className="items-end">
            <Text className={`text-3xl font-bold ${riskTextColor(report.overallRiskLevel)}`}>
              {report.overallRiskScore}
            </Text>
            <Text className="text-xs text-muted-foreground">/100</Text>
          </View>
        </View>
        <View className="h-2 bg-white/50 rounded-full overflow-hidden mt-3">
          <View
            className={`h-full rounded-full ${riskColor(report.overallRiskLevel)}`}
            style={{ width: `${report.overallRiskScore}%` }}
          />
        </View>
      </View>

      {/* Category stats */}
      <View className="mx-4 mb-3 flex-row gap-2">
        <View className="flex-1 p-2 bg-red-50 rounded-xl border border-red-200 items-center">
          <Text className="text-lg font-bold text-red-600">{report.criticalCategoryCount}</Text>
          <Text className="text-xs text-red-500">Critical</Text>
        </View>
        <View className="flex-1 p-2 bg-orange-50 rounded-xl border border-orange-200 items-center">
          <Text className="text-lg font-bold text-orange-600">{report.highCategoryCount}</Text>
          <Text className="text-xs text-orange-500">High</Text>
        </View>
        <View className="flex-1 p-2 bg-muted rounded-xl border border-border items-center">
          <Text className="text-lg font-bold text-foreground">
            {report.cells.filter((c) => c.riskLevel === 'medium').length}
          </Text>
          <Text className="text-xs text-muted-foreground">Medium</Text>
        </View>
        <View className="flex-1 p-2 bg-emerald-50 rounded-xl border border-emerald-200 items-center">
          <Text className="text-lg font-bold text-emerald-600">
            {report.cells.filter((c) => c.riskLevel === 'low').length}
          </Text>
          <Text className="text-xs text-emerald-500">Low</Text>
        </View>
      </View>

      {/* Risk cells */}
      <View className="mx-4 mb-4">
        {sorted.map((cell, i) => (
          <HeatmapCellCard key={i} cell={cell} />
        ))}
      </View>

      {/* Legend */}
      <View className="mx-4 mb-6 p-3 bg-muted/30 rounded-xl">
        <Text className="text-xs font-semibold text-foreground mb-2">Risk Legend</Text>
        <View className="flex-row justify-around">
          {(['low', 'medium', 'high', 'critical'] as L6RiskLevel[]).map((level) => (
            <View key={level} className="items-center gap-1">
              <Text>{riskEmoji(level)}</Text>
              <Text className="text-xs text-muted-foreground capitalize">{level}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * SupervisorViewPanel.tsx
 * Level-6 UI: Station-level supervisor intelligence dashboard.
 * Read-only. Shows pending/critical FIRs, officer workload, crime trends.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import type { SupervisorViewReport, OfficerIntelligenceSummary, CrimeTrendAnalysis, L6Grade } from '../../../ai/level6/L6Types';

interface Props {
  report: SupervisorViewReport;
}

function gradeColor(grade: L6Grade): string {
  switch (grade) {
    case 'A': return 'text-emerald-600 bg-emerald-50';
    case 'B': return 'text-green-600 bg-green-50';
    case 'C': return 'text-yellow-700 bg-yellow-50';
    case 'D': return 'text-orange-700 bg-orange-50';
    case 'F': return 'text-red-700 bg-red-50';
  }
}

function trendIcon(trend: CrimeTrendAnalysis['trend']): string {
  switch (trend) {
    case 'increasing': return '↑';
    case 'decreasing': return '↓';
    default:           return '→';
  }
}

function trendColor(trend: CrimeTrendAnalysis['trend']): string {
  switch (trend) {
    case 'increasing': return 'text-red-600';
    case 'decreasing': return 'text-emerald-600';
    default:           return 'text-muted-foreground';
  }
}

function GradeDistBar({ dist }: { dist: Record<L6Grade, number> }) {
  const total  = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const grades = (['A', 'B', 'C', 'D', 'F'] as L6Grade[]);
  const colors: Record<L6Grade, string> = { A: 'bg-emerald-500', B: 'bg-green-400', C: 'bg-yellow-400', D: 'bg-orange-400', F: 'bg-red-500' };
  return (
    <View>
      <View className="h-3 flex-row rounded-full overflow-hidden mb-1">
        {grades.map((g) => {
          const pct = Math.round((dist[g] / total) * 100);
          if (pct === 0) return null;
          return <View key={g} className={`${colors[g]}`} style={{ flex: dist[g] }} />;
        })}
      </View>
      <View className="flex-row gap-3 flex-wrap">
        {grades.filter((g) => dist[g] > 0).map((g) => (
          <Text key={g} className={`text-xs px-1.5 py-0.5 rounded ${gradeColor(g)}`}>
            {g}: {dist[g]}
          </Text>
        ))}
      </View>
    </View>
  );
}

function OfficerRow({ officer }: { officer: OfficerIntelligenceSummary }) {
  return (
    <View className="py-3 border-b border-border">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-medium text-foreground flex-1" numberOfLines={1}>
          {officer.officerName}
        </Text>
        <View className="flex-row gap-3 ml-2">
          <Text className="text-xs text-muted-foreground">{officer.totalFIRs} FIRs</Text>
          {officer.criticalFIRs > 0 && (
            <Text className="text-xs text-red-600 font-medium">{officer.criticalFIRs} critical</Text>
          )}
        </View>
      </View>
      <View className="flex-row gap-4">
        <Text className="text-xs text-muted-foreground">Score: {officer.avgInvestigationScore}/100</Text>
        <Text className="text-xs text-muted-foreground">Overdue: {officer.overdueTaskCount}</Text>
        {officer.courtDeadlinesThisWeek > 0 && (
          <Text className="text-xs text-orange-600">Court: {officer.courtDeadlinesThisWeek}</Text>
        )}
      </View>
    </View>
  );
}

type Tab = 'overview' | 'officers' | 'crimes';

export function SupervisorViewPanel({ report }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'officers', label: 'Officers' },
    { id: 'crimes',   label: 'Crimes' },
  ];

  return (
    <View className="flex-1">
      {/* Tab bar */}
      <View className="flex-row border-b border-border bg-card">
        {tabs.map((t) => (
          <Pressable
            key={t.id}
            className={`flex-1 py-3 items-center ${tab === t.id ? 'border-b-2 border-primary' : ''}`}
            onPress={() => setTab(t.id)}
          >
            <Text className={`text-xs font-medium ${tab === t.id ? 'text-primary' : 'text-muted-foreground'}`}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {tab === 'overview' && (
          <View>
            {/* Station header */}
            <View className="mx-4 mt-4 mb-3 p-4 bg-card rounded-2xl border border-border">
              <Text className="text-xs text-muted-foreground mb-1">Station</Text>
              <Text className="text-base font-semibold text-foreground mb-3">{report.stationName}</Text>
              <View className="flex-row justify-between mb-3">
                {[
                  { label: 'Total', value: report.totalFIRs, color: 'text-foreground' },
                  { label: 'Pending', value: report.pendingFIRs, color: 'text-yellow-600' },
                  { label: 'Critical', value: report.criticalFIRs, color: 'text-red-600' },
                  { label: 'Overdue', value: report.overdueInvestigations, color: 'text-orange-600' },
                ].map((s) => (
                  <View key={s.label} className="items-center">
                    <Text className={`text-2xl font-bold ${s.color}`}>{s.value}</Text>
                    <Text className="text-xs text-muted-foreground">{s.label}</Text>
                  </View>
                ))}
              </View>
              <Text className="text-xs text-muted-foreground mb-2">
                Avg Score: {report.avgInvestigationScore}/100
              </Text>
              <GradeDistBar dist={report.gradeDistribution} />
            </View>

            {/* Critical alerts */}
            {report.criticalAlerts.length > 0 && (
              <View className="mx-4 mb-3 p-3 bg-red-50 rounded-xl border border-red-200">
                <Text className="text-xs font-semibold text-red-700 mb-2">Critical Alerts</Text>
                {report.criticalAlerts.map((a, i) => (
                  <Text key={i} className="text-xs text-red-600 mb-0.5">⚠ {a}</Text>
                ))}
              </View>
            )}

            {/* Station recommendations */}
            {report.stationRecommendations.length > 0 && (
              <View className="mx-4 mb-4 p-3 bg-primary/5 rounded-xl border border-primary/20">
                <Text className="text-xs font-semibold text-foreground mb-2">Recommendations</Text>
                {report.stationRecommendations.map((r, i) => (
                  <Text key={i} className="text-xs text-muted-foreground mb-1">→ {r}</Text>
                ))}
              </View>
            )}

            <View className="mx-4 mb-6 p-3 bg-muted/30 rounded-xl">
              <Text className="text-xs text-muted-foreground text-center italic">
                Read-only supervisor view. No investigation records are modified.
              </Text>
            </View>
          </View>
        )}

        {tab === 'officers' && (
          <View className="mx-4 mt-4 mb-6 bg-card rounded-2xl border border-border px-4">
            {report.officerSummaries.length === 0 ? (
              <View className="p-4 items-center">
                <Text className="text-sm text-muted-foreground">No officer data available.</Text>
              </View>
            ) : (
              report.officerSummaries.map((o, i) => (
                <OfficerRow key={i} officer={o} />
              ))
            )}
          </View>
        )}

        {tab === 'crimes' && (
          <View className="mx-4 mt-4 mb-6">
            {report.crimeTrends.length === 0 ? (
              <View className="p-4 items-center">
                <Text className="text-sm text-muted-foreground">No crime trend data available.</Text>
              </View>
            ) : (
              report.crimeTrends.map((ct, i) => (
                <View key={i} className="mb-2 p-3 bg-card rounded-xl border border-border">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm font-medium text-foreground flex-1" numberOfLines={1}>
                      {ct.crimeType}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Text className={`text-base font-bold ${trendColor(ct.trend)}`}>
                        {trendIcon(ct.trend)}
                      </Text>
                      <Text className="text-sm font-semibold text-foreground">{ct.count}</Text>
                      <Text className="text-xs text-muted-foreground">({ct.percentage}%)</Text>
                    </View>
                  </View>
                  <View className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <View
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${ct.percentage}%` }}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

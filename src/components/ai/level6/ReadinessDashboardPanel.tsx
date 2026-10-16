/**
 * ReadinessDashboardPanel.tsx
 * Level-6 UI: Investigation Readiness Dashboard with 8 dimension scores
 * and overall A–F grade.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { InvestigationReadinessReport, ReadinessDimension, L6Grade } from '../../../ai/level6/L6Types';

interface Props {
  report: InvestigationReadinessReport;
}

function gradeColor(grade: L6Grade): string {
  switch (grade) {
    case 'A': return 'text-emerald-600';
    case 'B': return 'text-green-600';
    case 'C': return 'text-yellow-600';
    case 'D': return 'text-orange-600';
    case 'F': return 'text-red-600';
  }
}

function gradeBg(grade: L6Grade): string {
  switch (grade) {
    case 'A': return 'bg-emerald-50 border-emerald-200';
    case 'B': return 'bg-green-50 border-green-200';
    case 'C': return 'bg-yellow-50 border-yellow-200';
    case 'D': return 'bg-orange-50 border-orange-200';
    case 'F': return 'bg-red-50 border-red-200';
  }
}

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-yellow-500';
  if (score >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function DimensionRow({ dim }: { dim: ReadinessDimension }) {
  return (
    <View className="py-3 border-b border-border">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-medium text-foreground">{dim.label}</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted-foreground">{dim.score}/100</Text>
          <Text className={`text-sm font-bold ${gradeColor(dim.grade)}`}>{dim.grade}</Text>
        </View>
      </View>
      {/* Score bar */}
      <View className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
        <View
          className={`h-full rounded-full ${scoreBarColor(dim.score)}`}
          style={{ width: `${dim.score}%` }}
        />
      </View>
      <Text className="text-xs text-muted-foreground">{dim.description}</Text>
      {dim.criticalIssues.length > 0 && (
        <View className="mt-1 gap-0.5">
          {dim.criticalIssues.slice(0, 2).map((issue, i) => (
            <Text key={i} className="text-xs text-red-600">⚠ {issue}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

export function ReadinessDashboardPanel({ report }: Props) {
  const dims: ReadinessDimension[] = [
    report.investigationScore,
    report.compliance,
    report.evidenceStrength,
    report.documentation,
    report.courtReadiness,
    report.chargeSheetReadiness,
    report.timelineHealth,
    report.riskScore,
  ];

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Overall Grade Card */}
      <View className={`mx-4 mt-4 mb-3 p-4 rounded-2xl border ${gradeBg(report.overallGrade)}`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Overall Grade
            </Text>
            <Text className="text-base font-medium text-foreground">{report.gradeLabel}</Text>
          </View>
          <View className="items-center ml-4">
            <Text className={`text-5xl font-bold ${gradeColor(report.overallGrade)}`}>
              {report.overallGrade}
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">{report.overallScore}/100</Text>
          </View>
        </View>
        {/* Overall bar */}
        <View className="h-2 bg-white/60 rounded-full overflow-hidden mt-3">
          <View
            className={`h-full rounded-full ${scoreBarColor(report.overallScore)}`}
            style={{ width: `${report.overallScore}%` }}
          />
        </View>
      </View>

      {/* Critical Issues */}
      {report.criticalIssues.length > 0 && (
        <View className="mx-4 mb-3 p-3 bg-red-50 rounded-xl border border-red-200">
          <Text className="text-xs font-semibold text-red-700 mb-2">Critical Issues</Text>
          {report.criticalIssues.slice(0, 5).map((issue, i) => (
            <Text key={i} className="text-xs text-red-600 mb-0.5">• {issue}</Text>
          ))}
        </View>
      )}

      {/* Dimension Rows */}
      <View className="mx-4 bg-card rounded-2xl border border-border px-4 mb-4">
        {dims.map((dim, i) => (
          <DimensionRow key={i} dim={dim} />
        ))}
      </View>

      {/* Top Recommendations */}
      {report.topRecommendations.length > 0 && (
        <View className="mx-4 mb-6 p-3 bg-muted/50 rounded-xl">
          <Text className="text-xs font-semibold text-foreground mb-2">Recommendations</Text>
          {report.topRecommendations.map((rec, i) => (
            <Text key={i} className="text-xs text-muted-foreground mb-1">→ {rec}</Text>
          ))}
        </View>
      )}

      {/* Advisory */}
      <View className="mx-4 mb-6 p-3 bg-muted/30 rounded-xl">
        <Text className="text-xs text-muted-foreground text-center italic">
          Read-only advisory. Officer confirmation required for all actions.
        </Text>
      </View>
    </ScrollView>
  );
}

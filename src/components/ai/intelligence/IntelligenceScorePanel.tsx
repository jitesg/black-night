/**
 * IntelligenceScorePanel.tsx
 * Displays the 6-dimension investigation score with grades and weighted bar.
 * Minimal design — airiness, whitespace, typography hierarchy.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import type { InvestigationScoreReport, ScoreDimension, IntelGrade } from '@/ai/intelligence/IntelligenceTypes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function gradeColor(g: IntelGrade, isDark: boolean): string {
  switch (g) {
    case 'A': return isDark ? '#4ade80' : '#16a34a';
    case 'B': return isDark ? '#60a5fa' : '#2563eb';
    case 'C': return isDark ? '#fbbf24' : '#d97706';
    case 'D': return isDark ? '#fb923c' : '#ea580c';
    default:  return isDark ? '#f87171' : '#dc2626';
  }
}

function scoreBarColor(score: number, isDark: boolean): string {
  if (score >= 75) return isDark ? '#4ade80' : '#16a34a';
  if (score >= 50) return isDark ? '#fbbf24' : '#d97706';
  return isDark ? '#f87171' : '#dc2626';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DimensionRow({ dim, isDark }: { dim: ScoreDimension; isDark: boolean }) {
  const barPct = `${dim.score}%`;
  const gColor = gradeColor(dim.grade, isDark);
  return (
    <View className="mb-4">
      <View className="flex-row justify-between items-baseline mb-1">
        <Text className="text-sm font-medium text-foreground">{dim.name}</Text>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-xs text-muted-foreground">{dim.score}/100</Text>
          <View
            className="w-5 h-5 rounded items-center justify-center"
            style={{ backgroundColor: gColor + '22' }}
          >
            <Text className="text-xs font-bold" style={{ color: gColor }}>
              {dim.grade}
            </Text>
          </View>
        </View>
      </View>
      {/* Score bar */}
      <View className="h-1.5 rounded-full bg-muted overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: `${dim.score}%` as `${number}%`, backgroundColor: scoreBarColor(dim.score, isDark) }}
        />
      </View>
      {/* Key items (first 2) */}
      {dim.items.slice(0, 2).map((item, i) => (
        <Text key={i} className="text-xs text-muted-foreground mt-0.5 leading-4">{item}</Text>
      ))}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  report: InvestigationScoreReport;
}

export function IntelligenceScorePanel({ report }: Props) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';
  const overallColor = gradeColor(report.grade, isDark);
  const dimensions: ScoreDimension[] = [
    report.investigationQuality,
    report.evidenceStrength,
    report.documentation,
    report.legalCompliance,
    report.courtReadiness,
    report.timelineDiscipline,
  ];

  return (
    <View className="bg-card rounded-2xl p-5 mb-4" style={{ borderCurve: 'continuous' } as object}>
      {/* Overall score header */}
      <View className="flex-row items-center justify-between mb-5">
        <View>
          <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Investigation Score
          </Text>
          <Text className="text-2xl font-bold text-foreground">
            {report.overallScore}
            <Text className="text-base font-normal text-muted-foreground">/100</Text>
          </Text>
          <Text className="text-sm text-muted-foreground mt-0.5">{report.label}</Text>
        </View>
        <View
          className="w-14 h-14 rounded-2xl items-center justify-center"
          style={{ backgroundColor: overallColor + '18', borderCurve: 'continuous' } as object}
        >
          <Text className="text-3xl font-bold" style={{ color: overallColor }}>
            {report.grade}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View className="h-px bg-border mb-4" />

      {/* Dimension rows */}
      {dimensions.map((dim) => (
        <DimensionRow key={dim.name} dim={dim} isDark={isDark} />
      ))}

      {/* Footer advisory */}
      <View className="mt-2 pt-3 border-t border-border">
        <Text className="text-xs text-muted-foreground leading-4">
          ⚖️ Score is advisory only. All actions require officer confirmation.
        </Text>
      </View>
    </View>
  );
}

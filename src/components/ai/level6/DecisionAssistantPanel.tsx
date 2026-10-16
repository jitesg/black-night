/**
 * DecisionAssistantPanel.tsx
 * Level-6 UI: Officer Decision Assistant.
 * Shows Why / Evidence used / Rules applied / Confidence / Alternatives / Risk.
 * Officer always makes the final decision.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import type { OfficerDecisionAssistantReport, DecisionAssistance, DecisionAlternative } from '../../../ai/level6/L6Types';
import type { IntelSeverity } from '../../../ai/intelligence/IntelligenceTypes';

interface Props {
  report: OfficerDecisionAssistantReport;
}

function severityBg(s: IntelSeverity): string {
  switch (s) {
    case 'critical': return 'border-red-300 bg-red-50';
    case 'high':     return 'border-orange-300 bg-orange-50';
    case 'medium':   return 'border-yellow-200 bg-yellow-50';
    default:         return 'border-border bg-card';
  }
}

function severityTag(s: IntelSeverity): string {
  switch (s) {
    case 'critical': return 'bg-red-100 text-red-700';
    case 'high':     return 'bg-orange-100 text-orange-700';
    case 'medium':   return 'bg-yellow-100 text-yellow-700';
    default:         return 'bg-muted text-muted-foreground';
  }
}

function confidenceColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-yellow-500';
  return 'bg-orange-500';
}

function AlternativeCard({ alt, idx }: { alt: DecisionAlternative; idx: number }) {
  return (
    <View className="mb-2 p-2 bg-muted/50 rounded-lg border border-border">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs font-semibold text-foreground">Option {idx + 1}: {alt.title}</Text>
        <Text className="text-xs text-muted-foreground">{alt.confidencePct}% confidence</Text>
      </View>
      <Text className="text-xs text-muted-foreground mb-1">{alt.description}</Text>
      <View className="flex-row gap-3">
        <View className="flex-1">
          {alt.pros.map((p, i) => (
            <Text key={i} className="text-xs text-emerald-700">✓ {p}</Text>
          ))}
        </View>
        <View className="flex-1">
          {alt.cons.map((c, i) => (
            <Text key={i} className="text-xs text-red-600">✗ {c}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function DecisionCard({ dec }: { dec: DecisionAssistance }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className={`mx-4 mb-3 rounded-2xl border ${severityBg(dec.severity)}`}>
      <Pressable className="p-4" onPress={() => setExpanded((v) => !v)}>
        <View className="flex-row items-start justify-between gap-2 mb-2">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground mb-1">{dec.recommendationTitle}</Text>
            <View className="flex-row gap-2">
              <View className={`px-2 py-0.5 rounded-full ${severityTag(dec.severity)}`}>
                <Text className={`text-xs font-medium ${severityTag(dec.severity).split(' ')[1]}`}>
                  {dec.severity.toUpperCase()}
                </Text>
              </View>
              <View className={`px-2 py-0.5 rounded-full ${severityTag(dec.priority === 'urgent' ? 'critical' : dec.priority === 'high' ? 'high' : 'medium')}`}>
                <Text className="text-xs">{dec.priority}</Text>
              </View>
            </View>
          </View>
          {/* Confidence circle */}
          <View className="items-center">
            <Text className="text-lg font-bold text-foreground">{dec.confidencePct}%</Text>
            <Text className="text-xs text-muted-foreground">confidence</Text>
          </View>
        </View>

        {/* Confidence bar */}
        <View className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-3">
          <View
            className={`h-full rounded-full ${confidenceColor(dec.confidencePct)}`}
            style={{ width: `${dec.confidencePct}%` }}
          />
        </View>

        <Text className="text-xs text-muted-foreground mb-1">{dec.why}</Text>
        <Text className="text-xs text-primary mt-1">{expanded ? '▲ Less' : '▼ Full details'}</Text>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 gap-3">
          {/* Evidence used */}
          <View>
            <Text className="text-xs font-semibold text-foreground mb-1">Evidence Used:</Text>
            {dec.evidenceUsed.map((e, i) => (
              <Text key={i} className="text-xs text-muted-foreground">• {e}</Text>
            ))}
          </View>

          {/* Rules applied */}
          <View>
            <Text className="text-xs font-semibold text-foreground mb-1">Rules Applied:</Text>
            {dec.rulesApplied.map((r, i) => (
              <Text key={i} className="text-xs text-muted-foreground">📜 {r}</Text>
            ))}
          </View>

          {/* Risk if ignored */}
          <View className="p-2 bg-red-50 rounded-lg border border-red-200">
            <Text className="text-xs font-semibold text-red-700 mb-0.5">Risk if Ignored:</Text>
            <Text className="text-xs text-red-600">{dec.riskIfIgnored}</Text>
          </View>

          {/* Expected outcome */}
          <View className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
            <Text className="text-xs font-semibold text-emerald-700 mb-0.5">Expected Outcome:</Text>
            <Text className="text-xs text-emerald-700">{dec.expectedOutcome}</Text>
          </View>

          {/* Legal basis */}
          <Text className="text-xs text-muted-foreground">Legal Basis: {dec.legalBasis}</Text>

          {/* Alternatives */}
          {dec.alternatives.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-foreground mb-2">Possible Alternatives:</Text>
              {dec.alternatives.map((alt, i) => (
                <AlternativeCard key={i} alt={alt} idx={i} />
              ))}
            </View>
          )}

          {/* Officer decision notice */}
          <View className="p-2 bg-primary/5 rounded-lg border border-primary/20">
            <Text className="text-xs text-primary font-medium text-center">
              Officer makes the final decision. AI provides advisory only.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export function DecisionAssistantPanel({ report }: Props) {
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mx-4 mt-4 mb-3 p-3 bg-card rounded-2xl border border-border">
        <View className="flex-row justify-between">
          <View className="items-center">
            <Text className="text-xl font-bold text-foreground">{report.decisions.length}</Text>
            <Text className="text-xs text-muted-foreground">Decisions</Text>
          </View>
          <View className="items-center">
            <Text className={`text-xl font-bold ${report.criticalCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {report.criticalCount}
            </Text>
            <Text className="text-xs text-muted-foreground">Critical</Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-foreground">
              {report.decisions.reduce((s, d) => s + d.alternatives.length, 0)}
            </Text>
            <Text className="text-xs text-muted-foreground">Alternatives</Text>
          </View>
        </View>
      </View>

      {report.decisions.length === 0 ? (
        <View className="mx-4 p-6 items-center">
          <Text className="text-2xl mb-2">✅</Text>
          <Text className="text-sm text-muted-foreground">{report.summary}</Text>
        </View>
      ) : (
        report.decisions.map((dec) => (
          <DecisionCard key={dec.id} dec={dec} />
        ))
      )}

      <View className="mx-4 mb-6 p-3 bg-muted/30 rounded-xl mt-2">
        <Text className="text-xs text-muted-foreground text-center italic">
          All recommendations are advisory. Officer authority is absolute.
        </Text>
      </View>
    </ScrollView>
  );
}

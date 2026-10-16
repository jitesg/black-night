/**
 * TimelineReplayPanel.tsx
 * Level-6 UI: Chronological investigation timeline replay.
 * Shows events, gaps, missing periods, delays, and next expected event.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import type { TimelineReplayReport, TimelineReplayEntry, TimelineGap } from '../../../ai/level6/L6Types';

interface Props {
  report: TimelineReplayReport;
}

function entryColor(entry: TimelineReplayEntry): string {
  if (entry.isMissing)    return 'bg-red-100 border-red-300';
  if (entry.isCritical)   return 'bg-orange-50 border-orange-300';
  if (entry.isGap)        return 'bg-yellow-50 border-yellow-200';
  if (entry.isCompleted)  return 'bg-muted border-border';
  return 'bg-muted/50 border-border';
}

function dotColor(entry: TimelineReplayEntry): string {
  if (entry.isMissing)    return 'bg-red-500';
  if (entry.isCritical)   return 'bg-orange-500';
  if (entry.isGap)        return 'bg-yellow-500';
  if (entry.isCompleted)  return 'bg-emerald-500';
  return 'bg-muted-foreground';
}

function moduleIcon(module: string): string {
  switch (module) {
    case 'FIR':        return '📋';
    case 'Karyvahi':   return '✅';
    case 'CaseDiary':  return '📓';
    case 'Court':      return '⚖️';
    case 'GD':         return '📝';
    default:           return '•';
  }
}

function GapCard({ gap }: { gap: TimelineGap }) {
  const color = gap.severity === 'critical' ? 'border-red-300 bg-red-50'
    : gap.severity === 'high' ? 'border-orange-300 bg-orange-50'
    : 'border-yellow-200 bg-yellow-50';
  return (
    <View className={`mx-4 my-1 p-3 rounded-xl border ${color}`}>
      <Text className="text-xs font-semibold text-orange-700 mb-1">
        ⚠ Gap: {gap.gapDays} days ({gap.fromDate} → {gap.toDate})
      </Text>
      <Text className="text-xs text-muted-foreground">{gap.description}</Text>
      <Text className="text-xs text-foreground mt-1">→ {gap.recommendation}</Text>
    </View>
  );
}

function EntryCard({ entry }: { entry: TimelineReplayEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable
      className={`mx-4 mb-2 p-3 rounded-xl border ${entryColor(entry)}`}
      onPress={() => setExpanded((v) => !v)}
    >
      <View className="flex-row items-start gap-3">
        {/* Timeline dot */}
        <View className="items-center mt-1">
          <View className={`w-2.5 h-2.5 rounded-full ${dotColor(entry)}`} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5 flex-1">
              <Text className="text-base">{moduleIcon(entry.module)}</Text>
              <Text className="text-sm font-medium text-foreground flex-1" numberOfLines={expanded ? undefined : 1}>
                {entry.title}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground ml-2">{entry.date}</Text>
          </View>
          {entry.isGap && entry.gapDays !== undefined && (
            <Text className="text-xs text-yellow-700 mt-0.5">
              ⚠ {entry.gapDays}-day gap before this entry
            </Text>
          )}
          {expanded && entry.description ? (
            <Text className="text-xs text-muted-foreground mt-1">{entry.description}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function TimelineReplayPanel({ report }: Props) {
  const [showGapsOnly, setShowGapsOnly] = useState(false);

  const displayed = showGapsOnly
    ? report.entries.filter((e) => e.isGap || e.isCritical || e.isMissing)
    : report.entries;

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Header stats */}
      <View className="mx-4 mt-4 mb-3 p-3 bg-card rounded-2xl border border-border">
        <View className="flex-row justify-between mb-2">
          <View className="items-center">
            <Text className="text-xl font-bold text-foreground">{report.totalEntries}</Text>
            <Text className="text-xs text-muted-foreground">Events</Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-foreground">{report.investigationDurationDays}d</Text>
            <Text className="text-xs text-muted-foreground">Duration</Text>
          </View>
          <View className="items-center">
            <Text className={`text-xl font-bold ${report.totalGaps > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
              {report.totalGaps}
            </Text>
            <Text className="text-xs text-muted-foreground">Gaps</Text>
          </View>
          <View className="items-center">
            <Text className={`text-xl font-bold ${report.criticalGaps > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {report.criticalGaps}
            </Text>
            <Text className="text-xs text-muted-foreground">Critical</Text>
          </View>
        </View>
        {report.delayedInvestigation && (
          <View className="bg-red-50 rounded-lg p-2 mt-1">
            <Text className="text-xs text-red-700 font-medium">⚠ Delayed Investigation Detected</Text>
          </View>
        )}
      </View>

      {/* Next expected event */}
      <View className="mx-4 mb-3 p-3 bg-primary/5 rounded-xl border border-primary/20">
        <Text className="text-xs font-semibold text-primary mb-1">Next Expected Event</Text>
        <Text className="text-sm text-foreground">{report.nextExpectedEvent}</Text>
      </View>

      {/* Filter toggle */}
      <View className="mx-4 mb-3 flex-row gap-2">
        <Pressable
          className={`px-3 py-1.5 rounded-full border ${!showGapsOnly ? 'bg-primary border-primary' : 'bg-card border-border'}`}
          onPress={() => setShowGapsOnly(false)}
        >
          <Text className={`text-xs font-medium ${!showGapsOnly ? 'text-primary-foreground' : 'text-foreground'}`}>
            All Events
          </Text>
        </Pressable>
        <Pressable
          className={`px-3 py-1.5 rounded-full border ${showGapsOnly ? 'bg-primary border-primary' : 'bg-card border-border'}`}
          onPress={() => setShowGapsOnly(true)}
        >
          <Text className={`text-xs font-medium ${showGapsOnly ? 'text-primary-foreground' : 'text-foreground'}`}>
            Gaps & Critical
          </Text>
        </Pressable>
      </View>

      {/* Summary gaps */}
      {report.gaps.length > 0 && !showGapsOnly && (
        <View className="mb-2">
          {report.gaps.slice(0, 3).map((gap, i) => (
            <GapCard key={i} gap={gap} />
          ))}
        </View>
      )}

      {/* Timeline entries */}
      <View className="mb-4">
        {displayed.length === 0 ? (
          <View className="mx-4 p-4 items-center">
            <Text className="text-sm text-muted-foreground">No timeline events found.</Text>
          </View>
        ) : (
          displayed.map((entry, i) => <EntryCard key={i} entry={entry} />)
        )}
      </View>

      {/* Advisory */}
      <View className="mx-4 mb-6 p-3 bg-muted/30 rounded-xl">
        <Text className="text-xs text-muted-foreground text-center italic">
          Read-only. All entries derived from investigation records.
        </Text>
      </View>
    </ScrollView>
  );
}

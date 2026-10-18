/**
 * MultiFIRLinkerPanel.tsx
 * Level-6 UI: Cross-FIR intelligence — repeat accused, witness, location,
 * vehicle, mobile, modus operandi clusters.
 * Shows suggestions only. Officer confirms all actions.
 */

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { MultiFIRLinkerReport, LinkedFIRCluster } from '../../../ai/level6/L6Types';

interface Props {
  report: MultiFIRLinkerReport;
}

function linkIcon(type: LinkedFIRCluster['linkType']): string {
  switch (type) {
    case 'repeat-accused':           return '👤';
    case 'repeat-witness':           return '👁';
    case 'repeat-location':          return '📍';
    case 'repeat-vehicle':           return '🚗';
    case 'repeat-mobile':            return '📱';
    case 'repeat-modus-operandi':    return '🔄';
    case 'combined':                 return '🔗';
  }
}

function linkLabel(type: LinkedFIRCluster['linkType']): string {
  switch (type) {
    case 'repeat-accused':           return 'Repeat Accused';
    case 'repeat-witness':           return 'Repeat Witness';
    case 'repeat-location':          return 'Repeat Location';
    case 'repeat-vehicle':           return 'Repeat Vehicle';
    case 'repeat-mobile':            return 'Repeat Mobile';
    case 'repeat-modus-operandi':    return 'Repeat MO';
    case 'combined':                 return 'Combined Link';
  }
}

function confidenceColor(c: number): string {
  if (c >= 80) return 'text-emerald-700 bg-emerald-50';
  if (c >= 60) return 'text-yellow-700 bg-yellow-50';
  return 'text-orange-700 bg-orange-50';
}

function ClusterCard({ cluster }: { cluster: LinkedFIRCluster }) {
  return (
    <View className="mb-2 p-3 bg-card rounded-xl border border-border">
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base">{linkIcon(cluster.linkType)}</Text>
          <Text className="text-sm font-semibold text-foreground">{linkLabel(cluster.linkType)}</Text>
        </View>
        <View className={`px-2 py-0.5 rounded-full ${confidenceColor(cluster.confidence)}`}>
          <Text className={`text-xs font-medium ${confidenceColor(cluster.confidence).split(' ')[0]}`}>
            {cluster.confidence}% match
          </Text>
        </View>
      </View>

      <Text className="text-xs text-muted-foreground mb-2">{cluster.description}</Text>

      {/* FIR numbers */}
      <View className="flex-row flex-wrap gap-1 mb-2">
        {cluster.firNumbers.map((fn, i) => (
          <View key={i} className="bg-muted rounded-full px-2.5 py-1">
            <Text textBreakStrategy="simple" className="text-xs text-foreground">{fn}</Text>
          </View>
        ))}
      </View>

      {/* Matched value */}
      <View className="p-2 bg-muted/50 rounded-lg mb-1">
        <Text className="text-xs font-medium text-muted-foreground">Matched: </Text>
        <Text className="text-xs text-foreground">{cluster.matchedValue}</Text>
      </View>

      <Text className="text-xs text-primary">→ {cluster.recommendation}</Text>
    </View>
  );
}

const LINK_TYPES: LinkedFIRCluster['linkType'][] = [
  'repeat-accused', 'repeat-witness', 'repeat-location',
  'repeat-vehicle', 'repeat-mobile', 'repeat-modus-operandi',
];

export function MultiFIRLinkerPanel({ report }: Props) {
  const statMap: Partial<Record<LinkedFIRCluster['linkType'], number>> = {
    'repeat-accused':        report.repeatAccusedCount,
    'repeat-witness':        report.repeatWitnessCount,
    'repeat-location':       report.repeatLocationCount,
    'repeat-vehicle':        report.repeatVehicleCount,
    'repeat-mobile':         report.repeatMobileCount,
    'repeat-modus-operandi': 0,
  };

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mx-4 mt-4 mb-3 p-4 bg-card rounded-2xl border border-border">
        <View className="flex-row justify-between mb-3">
          <View className="items-center">
            <Text className="text-xl font-bold text-foreground">{report.totalFIRsAnalyzed}</Text>
            <Text className="text-xs text-muted-foreground">FIRs Analysed</Text>
          </View>
          <View className="items-center">
            <Text className={`text-xl font-bold ${report.clusters.length > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
              {report.clusters.length}
            </Text>
            <Text className="text-xs text-muted-foreground">Clusters</Text>
          </View>
          <View className="items-center">
            <Text className={`text-xl font-bold ${report.suspectedSerialCrimeCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {report.suspectedSerialCrimeCount}
            </Text>
            <Text className="text-xs text-muted-foreground">Serial Patterns</Text>
          </View>
        </View>

        {/* Category stats */}
        <View className="flex-row flex-wrap gap-2">
          {LINK_TYPES.filter((t) => (statMap[t] ?? 0) > 0).map((t) => (
            <View key={t} className="flex-row items-center gap-1 bg-muted rounded-full px-2.5 py-1">
              <Text textBreakStrategy="simple" className="text-xs">{linkIcon(t)}</Text>
              <Text textBreakStrategy="simple" className="text-xs text-foreground">{statMap[t]}</Text>
            </View>
          ))}
        </View>
      </View>

      {report.clusters.length === 0 ? (
        <View className="mx-4 p-6 items-center">
          <Text className="text-2xl mb-2">🔍</Text>
          <Text className="text-sm font-medium text-foreground">No Cross-FIR Links Detected</Text>
          <Text className="text-xs text-muted-foreground mt-1">{report.summary}</Text>
        </View>
      ) : (
        <View className="mx-4 mb-4">
          {LINK_TYPES.map((type) => {
            const typeClusters = report.clusters.filter((c) => c.linkType === type);
            if (typeClusters.length === 0) return null;
            return (
              <View key={type} className="mb-2">
                <Text className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {linkIcon(type)} {linkLabel(type)} ({typeClusters.length})
                </Text>
                {typeClusters.map((cluster) => (
                  <ClusterCard key={cluster.clusterId} cluster={cluster} />
                ))}
              </View>
            );
          })}
        </View>
      )}

      <View className="mx-4 mb-6 p-3 bg-muted/30 rounded-xl">
        <Text className="text-xs text-muted-foreground text-center italic">
          Suggestions only. Links are probabilistic — officer verifies all connections.
        </Text>
      </View>
    </ScrollView>
  );
}

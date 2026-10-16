/**
 * DependencyGraphPanel.tsx
 * Level-6 UI: Investigation dependency tree.
 * Shows what blocks what and highlights missing critical dependencies.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import type { DependencyGraphReport, DepNode } from '../../../ai/level6/L6Types';

interface Props {
  report: DependencyGraphReport;
}

function nodeColor(node: DepNode): string {
  if (node.isBlocking)  return 'border-red-400 bg-red-50';
  if (node.isMissing)   return 'border-orange-300 bg-orange-50';
  if (node.isPresent)   return 'border-emerald-300 bg-emerald-50';
  return 'border-border bg-muted';
}

function nodeIcon(node: DepNode): string {
  if (node.isBlocking) return '🔴';
  if (node.isMissing)  return '🟠';
  if (node.isPresent)  return '🟢';
  return '⚪';
}

function NodeCard({ node, depth }: { node: DepNode; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const indent = depth * 16;
  return (
    <Pressable
      style={{ marginLeft: indent }}
      className={`mb-2 p-3 rounded-xl border mr-4 ${nodeColor(node)}`}
      onPress={() => setExpanded((v) => !v)}
    >
      <View className="flex-row items-center gap-2">
        <Text>{nodeIcon(node)}</Text>
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground">{node.label}</Text>
          {node.isBlocking && (
            <Text className="text-xs text-red-600 mt-0.5">⚠ Blocking charge sheet</Text>
          )}
        </View>
        {node.legalReference && (
          <Text className="text-xs text-muted-foreground">{node.legalReference}</Text>
        )}
      </View>
      {expanded && (
        <Text className="text-xs text-muted-foreground mt-2">{node.details}</Text>
      )}
    </Pressable>
  );
}

export function DependencyGraphPanel({ report }: Props) {
  // Group nodes by depth for tree display
  const byDepth = new Map<number, DepNode[]>();
  report.nodes.forEach((n) => {
    const arr = byDepth.get(n.depth) ?? [];
    arr.push(n);
    byDepth.set(n.depth, arr);
  });

  const maxDepth = Math.max(...report.nodes.map((n) => n.depth));

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
            <Text className="text-xl font-bold text-foreground">{report.completionPct}%</Text>
            <Text className="text-xs text-muted-foreground">Complete</Text>
          </View>
          <View className="items-center">
            <Text className={`text-xl font-bold ${report.missingCritical.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {report.missingCritical.length}
            </Text>
            <Text className="text-xs text-muted-foreground">Blocking</Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-foreground">{report.nodes.filter((n) => n.isPresent).length}</Text>
            <Text className="text-xs text-muted-foreground">Present</Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-foreground">{report.nodes.length}</Text>
            <Text className="text-xs text-muted-foreground">Total</Text>
          </View>
        </View>
        {/* Completion bar */}
        <View className="h-2 bg-muted rounded-full overflow-hidden mt-3">
          <View
            className={`h-full rounded-full ${report.completionPct >= 80 ? 'bg-emerald-500' : report.completionPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${report.completionPct}%` }}
          />
        </View>
      </View>

      {/* Blocking chain */}
      {report.blockingChain.length > 0 && (
        <View className="mx-4 mb-3 p-3 bg-red-50 rounded-xl border border-red-200">
          <Text className="text-xs font-semibold text-red-700 mb-2">Blocking Chain (resolve in order):</Text>
          <View className="flex-row flex-wrap gap-1">
            {report.blockingChain.map((step, i) => (
              <View key={i} className="flex-row items-center">
                <Text className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{step}</Text>
                {i < report.blockingChain.length - 1 && (
                  <Text className="text-xs text-red-400 mx-1">→</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Dependency tree by depth */}
      <View className="ml-4 mb-2">
        {Array.from({ length: maxDepth + 1 }, (_, d) => d).map((depth) => {
          const nodes = byDepth.get(depth) ?? [];
          if (nodes.length === 0) return null;
          return (
            <View key={depth} className="mb-1">
              {nodes.map((node) => (
                <NodeCard key={node.id} node={node} depth={depth} />
              ))}
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View className="mx-4 mb-6 p-3 bg-muted/30 rounded-xl">
        <Text className="text-xs font-semibold text-foreground mb-2">Legend</Text>
        <View className="flex-row gap-4">
          <Text className="text-xs text-muted-foreground">🟢 Present</Text>
          <Text className="text-xs text-muted-foreground">🟠 Missing</Text>
          <Text className="text-xs text-muted-foreground">🔴 Blocking</Text>
        </View>
        <Text className="text-xs text-muted-foreground mt-2 italic">
          Tap any node to see details. Officer confirmation required for all actions.
        </Text>
      </View>
    </ScrollView>
  );
}

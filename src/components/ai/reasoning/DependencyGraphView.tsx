/**
 * DependencyGraphView.tsx
 * Visual representation of the investigation dependency graph.
 * Shows node status: completed / pending / blocked / missing.
 * Minimal style — no decorative graphics, pure text + status indicators.
 */

import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle, Clock, Lock } from 'lucide-react-native';
import type { DependencyGraph, DependencyNode } from '@/ai/reasoning/ReasoningTypes';

interface Props {
  graph: DependencyGraph;
}

// ── Status icon + colors ──────────────────────────────────────────────────────

function NodeStatusIcon({ status }: { status: DependencyNode['status'] }) {
  switch (status) {
    case 'completed': return <CheckCircle size={13} className="text-emerald-600" />;
    case 'pending':   return <Clock size={13} className="text-amber-500" />;
    case 'blocked':   return <Lock size={13} className="text-orange-500" />;
    case 'missing':   return <AlertTriangle size={13} className="text-destructive" />;
  }
}

function nodeBg(status: DependencyNode['status']): string {
  switch (status) {
    case 'completed': return 'bg-emerald-50 border-emerald-200';
    case 'pending':   return 'bg-amber-50 border-amber-200';
    case 'blocked':   return 'bg-orange-50 border-orange-200';
    case 'missing':   return 'bg-red-50 border-red-200';
  }
}

function nodeText(status: DependencyNode['status']): string {
  switch (status) {
    case 'completed': return 'text-emerald-700';
    case 'pending':   return 'text-amber-700';
    case 'blocked':   return 'text-orange-700';
    case 'missing':   return 'text-red-700';
  }
}

// ── Node row ──────────────────────────────────────────────────────────────────

function NodeRow({ node }: { node: DependencyNode }) {
  return (
    <View className={`flex-row items-start gap-2 px-3 py-2 rounded-xl border mb-1.5 ${nodeBg(node.status)}`} style={{ borderCurve: 'continuous' } as object}>
      <View className="mt-0.5"><NodeStatusIcon status={node.status} /></View>
      <View className="flex-1">
        <Text className={`text-xs font-semibold ${nodeText(node.status)}`}>{node.label}</Text>
        {node.blockReason && (
          <Text className="text-xs text-muted-foreground mt-0.5">{node.blockReason}</Text>
        )}
      </View>
      <View className={`px-2 py-0.5 rounded-full border ${nodeBg(node.status)}`}>
        <Text className={`text-xs ${nodeText(node.status)}`}>
          {node.status.charAt(0).toUpperCase() + node.status.slice(1)}
        </Text>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DependencyGraphView({ graph }: Props) {
  const blockedNodes = graph.nodes.filter((n) => n.status === 'blocked' || n.status === 'missing');
  const completedNodes = graph.nodes.filter((n) => n.status === 'completed');
  const pendingNodes = graph.nodes.filter((n) => n.status === 'pending');

  return (
    <View>
      {/* Summary */}
      <View className="flex-row gap-2 mb-3 flex-wrap">
        <View className="flex-row items-center gap-1 px-2.5 py-1 bg-emerald-50 rounded-full">
          <CheckCircle size={10} className="text-emerald-600" />
          <Text className="text-xs text-emerald-700">{completedNodes.length} completed</Text>
        </View>
        <View className="flex-row items-center gap-1 px-2.5 py-1 bg-amber-50 rounded-full">
          <Clock size={10} className="text-amber-600" />
          <Text className="text-xs text-amber-700">{pendingNodes.length} pending</Text>
        </View>
        {blockedNodes.length > 0 && (
          <View className="flex-row items-center gap-1 px-2.5 py-1 bg-red-50 rounded-full">
            <Lock size={10} className="text-destructive" />
            <Text className="text-xs text-destructive">{blockedNodes.length} blocked</Text>
          </View>
        )}
      </View>

      {/* Blocked / missing nodes first */}
      {blockedNodes.length > 0 && (
        <View className="mb-3">
          <Text className="text-xs font-semibold text-destructive mb-1.5">⛔ Blocked Workflows</Text>
          {blockedNodes.map((n) => <NodeRow key={n.id} node={n} />)}
        </View>
      )}

      {/* Pending nodes */}
      {pendingNodes.length > 0 && (
        <View className="mb-3">
          <Text className="text-xs font-semibold text-amber-700 mb-1.5">🟡 Pending Steps</Text>
          {pendingNodes.map((n) => <NodeRow key={n.id} node={n} />)}
        </View>
      )}

      {/* Completed nodes */}
      {completedNodes.length > 0 && (
        <View>
          <Text className="text-xs font-semibold text-emerald-700 mb-1.5">✓ Completed Steps</Text>
          {completedNodes.map((n) => <NodeRow key={n.id} node={n} />)}
        </View>
      )}
    </View>
  );
}

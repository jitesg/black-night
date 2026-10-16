/**
 * KnowledgeGraphPanel.tsx
 * Level-7: Investigation Knowledge Graph — node/edge list view with clusters.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { Network, Layers } from 'lucide-react-native';
import { L7PanelShell } from './L7PanelShell';
import type { KnowledgeGraphReport, KGNode, KGNodeType } from '../../../ai/level7/L7Types';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onRefresh?: () => void;
  loading?: boolean;
  report?:  KnowledgeGraphReport;
}

const NODE_TYPE_ICONS: Record<KGNodeType, string> = {
  FIR: '📋', Accused: '👤', Victim: '🙍', Witness: '👁', Vehicle: '🚗',
  Mobile: '📱', Location: '📍', Evidence: '🔬', Court: '⚖️', CaseDiary: '📔',
  PrarthnaPatra: '📄', KnowledgeArticle: '📚', Officer: '👮',
};

const TYPE_ORDER: KGNodeType[] = [
  'FIR', 'Accused', 'Victim', 'Witness', 'Evidence',
  'Court', 'CaseDiary', 'Location', 'Vehicle', 'Mobile',
  'Officer', 'PrarthnaPatra', 'KnowledgeArticle',
];

function NodeRow({ node }: { node: KGNode }) {
  return (
    <View className="flex-row gap-2 items-center py-1.5">
      <Text className="text-base">{NODE_TYPE_ICONS[node.type] ?? '•'}</Text>
      <View className="flex-1">
        <Text className="text-sm text-foreground" numberOfLines={1}>{node.label}</Text>
        <Text className="text-xs text-muted-foreground">{node.type}</Text>
      </View>
    </View>
  );
}

export function KnowledgeGraphPanel({ visible, onClose, onRefresh, loading, report }: Props) {
  const [tab, setTab] = useState<'nodes' | 'edges' | 'clusters'>('nodes');

  const nodesByType = TYPE_ORDER.reduce<Record<string, KGNode[]>>((acc, t) => {
    const ns = (report?.nodes ?? []).filter((n) => n.type === t);
    if (ns.length) acc[t] = ns;
    return acc;
  }, {});

  return (
    <L7PanelShell
      visible={visible} title="Knowledge Graph"
      subtitle="Investigation relationship network"
      onClose={onClose} onRefresh={onRefresh} loading={loading}
    >
      {!report ? (
        <Text className="text-sm text-muted-foreground">No graph data available.</Text>
      ) : (
        <>
          {/* Stats */}
          <View className="flex-row gap-6 py-2">
            <View className="items-center">
              <Text className="text-2xl font-bold text-foreground">{report.stats.nodeCount}</Text>
              <Text className="text-xs text-muted-foreground">Nodes</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-foreground">{report.stats.edgeCount}</Text>
              <Text className="text-xs text-muted-foreground">Edges</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-foreground">{report.stats.clusterCount}</Text>
              <Text className="text-xs text-muted-foreground">Clusters</Text>
            </View>
          </View>

          {/* Tabs */}
          <View className="flex-row gap-2">
            {(['nodes', 'edges', 'clusters'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                className={`px-3 py-1.5 rounded-full ${tab === t ? 'bg-foreground' : 'bg-muted'}`}
              >
                <Text className={`text-xs font-medium ${tab === t ? 'text-background' : 'text-muted-foreground'}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Nodes tab */}
          {tab === 'nodes' && (
            <View className="gap-4">
              {Object.entries(nodesByType).map(([type, nodes]) => (
                <View key={type} className="gap-1">
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {NODE_TYPE_ICONS[type as KGNodeType] ?? ''} {type} ({nodes.length})
                  </Text>
                  {nodes.map((n) => <NodeRow key={n.id} node={n} />)}
                </View>
              ))}
            </View>
          )}

          {/* Edges tab */}
          {tab === 'edges' && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Relationships ({report.edges.length})
              </Text>
              {report.edges.slice(0, 30).map((e, i) => (
                <View key={i} className="flex-row gap-1.5 items-center">
                  <Text className="text-xs text-muted-foreground w-24 text-right" numberOfLines={1}>
                    {report.nodes.find((n) => n.id === e.from)?.label ?? e.from}
                  </Text>
                  <Text className="text-xs text-muted-foreground">→</Text>
                  <Text className="text-xs text-foreground flex-1" numberOfLines={1}>
                    {report.nodes.find((n) => n.id === e.to)?.label ?? e.to}
                  </Text>
                  <Text className="text-xs text-muted-foreground italic">{e.relation}</Text>
                </View>
              ))}
              {report.edges.length > 30 && (
                <Text className="text-xs text-muted-foreground">+{report.edges.length - 30} more…</Text>
              )}
            </View>
          )}

          {/* Clusters tab */}
          {tab === 'clusters' && (
            <View className="gap-3">
              {report.clusters.map((c) => (
                <View key={c.id} className="border border-border rounded-xl px-4 py-3 gap-1">
                  <View className="flex-row items-center gap-2">
                    <Layers size={13} className="text-muted-foreground" />
                    <Text className="text-sm font-medium text-foreground">{c.label}</Text>
                    <Text className="text-xs text-muted-foreground">({c.nodes.length})</Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">{c.type}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </L7PanelShell>
  );
}

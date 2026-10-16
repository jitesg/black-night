/**
 * KnowledgeGraphView.tsx
 * Interactive investigation entity graph. Displays nodes and edges,
 * highlights missing links, orphan nodes, and weak evidence chains.
 * Minimal design with scrollable node list + analysis panel.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
} from 'react-native';
import {
  Circle, AlertTriangle, CheckCircle, XCircle,
  Link, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import type {
  InvestigationKnowledgeGraphReport,
  GraphNode, GraphNodeType,
} from '../../../ai/level5/L5Types';

// ── Node type labels ──────────────────────────────────────────────────────────

const NODE_LABELS: Record<GraphNodeType, string> = {
  'fir':        '📋 FIR',
  'victim':     '🧑 Victim',
  'accused':    '⛓ Accused',
  'witness':    '👁 Witness',
  'evidence':   '🔎 Evidence',
  'medical':    '🏥 Medical',
  'fsl':        '🧪 FSL',
  'court':      '⚖️ Court',
  'case-diary': '📓 Case Diary',
  'karyavahi':  '📝 Steps',
};

// ── Node tile ─────────────────────────────────────────────────────────────────

function NodeTile({ node, onPress, selected }: { node: GraphNode; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-2 px-3 py-2.5 rounded-xl border mb-2 active:opacity-70 ${
        selected ? 'border-primary bg-primary/5' :
        !node.isPresent ? 'border-border bg-muted/50 opacity-60' :
        node.isOrphan ? 'border-amber-300 bg-amber-50' :
        'border-border bg-card'
      }`}
    >
      <Text className="text-base">{NODE_LABELS[node.type]?.slice(0, 2)}</Text>
      <View className="flex-1">
        <Text className={`text-sm font-medium ${node.isPresent ? 'text-foreground' : 'text-muted-foreground'}`}>
          {node.label}
        </Text>
        {node.isCriticalMissing && (
          <Text className="text-xs text-red-600 mt-0.5">⚠️ Critical — Missing</Text>
        )}
        {node.isOrphan && node.isPresent && (
          <Text className="text-xs text-amber-600 mt-0.5">⚠️ Orphan — Not linked</Text>
        )}
      </View>
      {node.isPresent
        ? <CheckCircle size={14} className="text-green-600" />
        : <XCircle size={14} className="text-muted-foreground" />}
    </Pressable>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

type TabId = 'nodes' | 'analysis';

interface Props {
  visible: boolean;
  onClose: () => void;
  onRefresh: () => void;
  report: InvestigationKnowledgeGraphReport | null;
  isLoading: boolean;
}

export function KnowledgeGraphView({ visible, onClose, onRefresh, report, isLoading }: Props) {
  const [tab, setTab]       = useState<TabId>('nodes');
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState<string | null>(null);

  const toggleAnalysis = (key: string) =>
    setAnalysisOpen((p) => p === key ? null : key);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <View>
            <Text className="text-lg font-semibold text-foreground">Knowledge Graph</Text>
            {report && (
              <Text className="text-xs text-muted-foreground mt-0.5">
                {report.presentNodeCount}/{report.totalNodeCount} entities · Strength {report.strengthScore}%
              </Text>
            )}
          </View>
          <View className="flex-row gap-2">
            <Pressable onPress={onRefresh} className="w-8 h-8 items-center justify-center active:opacity-60">
              <RefreshCw size={16} className="text-muted-foreground" />
            </Pressable>
            <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center active:opacity-60">
              <Text className="text-sm font-medium text-primary">Done</Text>
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center gap-3">
            <RefreshCw size={20} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">Building graph…</Text>
          </View>
        ) : !report ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Link size={32} className="text-muted-foreground" />
            <Text className="text-base font-medium text-foreground text-center">No Graph Data</Text>
            <Text className="text-sm text-muted-foreground text-center">Open a FIR to build its knowledge graph.</Text>
          </View>
        ) : (
          <>
            {/* Strength bar */}
            <View className="px-5 py-3 border-b border-border">
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs text-muted-foreground">Graph Completeness</Text>
                <Text className="text-xs font-semibold text-foreground">{report.strengthScore}%</Text>
              </View>
              <View className="h-2 bg-muted rounded-full overflow-hidden">
                <View className="h-full bg-primary rounded-full" style={{ width: `${report.strengthScore}%` as unknown as number }} />
              </View>
              <Text className="text-xs text-muted-foreground mt-1">{report.summary}</Text>
            </View>

            {/* Tabs */}
            <View className="flex-row px-5 pt-3 gap-4 border-b border-border">
              {([['nodes','Entities'],['analysis','Analysis']] as [TabId,string][]).map(([id, label]) => (
                <Pressable key={id} onPress={() => setTab(id)} className="pb-2 active:opacity-70">
                  <Text className={`text-sm font-medium ${tab === id ? 'text-primary' : 'text-muted-foreground'}`}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

              {/* Entities */}
              {tab === 'nodes' && (
                <View>
                  {report.nodes.map((n: GraphNode) => (
                    <View key={n.id}>
                      <NodeTile
                        node={n}
                        selected={selected?.id === n.id}
                        onPress={() => setSelected(selected?.id === n.id ? null : n)}
                      />
                      {selected?.id === n.id && (
                        <View className="bg-muted/40 rounded-xl px-4 py-3 mb-2">
                          <Text className="text-xs text-muted-foreground">{n.details}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Analysis */}
              {tab === 'analysis' && (
                <View className="gap-4">
                  {/* Missing links */}
                  <Pressable
                    onPress={() => toggleAnalysis('missing')}
                    className="flex-row items-center gap-2 active:opacity-70"
                  >
                    <AlertTriangle size={14} className="text-red-500" />
                    <Text className="text-sm font-semibold text-foreground flex-1">
                      Missing Links ({report.analysis.missingLinks.length})
                    </Text>
                    {analysisOpen === 'missing' ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                  </Pressable>
                  {analysisOpen === 'missing' && (
                    <View className="gap-2 pl-5">
                      {report.analysis.missingLinks.map((ml: { from: string; to: string; description: string; severity: string }, i: number) => (
                        <View key={i} className="py-2 border-b border-border">
                          <Text className="text-xs font-medium text-foreground">{ml.from} → {ml.to}</Text>
                          <Text className="text-xs text-muted-foreground mt-0.5">{ml.description}</Text>
                          <Text className="text-xs text-red-500 mt-0.5">{ml.severity.toUpperCase()}</Text>
                        </View>
                      ))}
                      {report.analysis.missingLinks.length === 0 && (
                        <Text className="text-sm text-muted-foreground">No missing links.</Text>
                      )}
                    </View>
                  )}

                  {/* Weak chains */}
                  <Pressable
                    onPress={() => toggleAnalysis('weak')}
                    className="flex-row items-center gap-2 active:opacity-70"
                  >
                    <Circle size={14} className="text-amber-500" />
                    <Text className="text-sm font-semibold text-foreground flex-1">
                      Weak Evidence Chains ({report.analysis.weakChains.length})
                    </Text>
                    {analysisOpen === 'weak' ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                  </Pressable>
                  {analysisOpen === 'weak' && (
                    <View className="gap-2 pl-5">
                      {report.analysis.weakChains.map((wc: { description: string; affectedNodes: string[] }, i: number) => (
                        <View key={i} className="py-2 border-b border-border">
                          <Text className="text-xs text-foreground">{wc.description}</Text>
                        </View>
                      ))}
                      {report.analysis.weakChains.length === 0 && (
                        <Text className="text-sm text-muted-foreground">No weak chains.</Text>
                      )}
                    </View>
                  )}

                  {/* Orphan nodes */}
                  <Pressable
                    onPress={() => toggleAnalysis('orphan')}
                    className="flex-row items-center gap-2 active:opacity-70"
                  >
                    <XCircle size={14} className="text-muted-foreground" />
                    <Text className="text-sm font-semibold text-foreground flex-1">
                      Orphan Entities ({report.analysis.orphanNodes.length})
                    </Text>
                    {analysisOpen === 'orphan' ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                  </Pressable>
                  {analysisOpen === 'orphan' && (
                    <View className="gap-2 pl-5">
                      {report.analysis.orphanNodes.map((o: { nodeId: string; label: string; recommendation: string }, i: number) => (
                        <View key={i} className="py-2 border-b border-border">
                          <Text className="text-xs font-medium text-foreground">{o.label}</Text>
                          <Text className="text-xs text-muted-foreground mt-0.5">{o.recommendation}</Text>
                        </View>
                      ))}
                      {report.analysis.orphanNodes.length === 0 && (
                        <Text className="text-sm text-muted-foreground">No orphan entities.</Text>
                      )}
                    </View>
                  )}

                  {/* Dependency paths */}
                  <View>
                    <Text className="text-sm font-semibold text-foreground mb-2">Dependency Paths</Text>
                    {report.analysis.dependencyPaths.map((dp: { title: string; steps: string[] }, i: number) => (
                      <View key={i} className="mb-3">
                        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{dp.title}</Text>
                        <View className="flex-row flex-wrap gap-1 mt-1">
                          {dp.steps.map((step: string, si: number) => (
                            <View key={si} className="flex-row items-center gap-1">
                              <Text className="text-xs text-foreground">{step}</Text>
                              {si < dp.steps.length - 1 && (
                                <Text className="text-xs text-muted-foreground">→</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Advisory */}
            <View className="px-5 py-3 border-t border-border">
              <Text className="text-xs text-muted-foreground text-center">
                ⚖️ Knowledge graph is advisory only. All decisions remain with the Investigating Officer.
              </Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

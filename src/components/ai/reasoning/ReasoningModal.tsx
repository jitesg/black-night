/**
 * ReasoningModal.tsx
 * Full-screen Decision Support dashboard presented as a bottom sheet.
 * Tabs: Decision Cards | Findings | Health | Dependencies
 *
 * Minimal theme: airiness, whitespace, clean type hierarchy.
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Brain,
  CheckCircle,
  GitBranch,
  List,
  X,
} from 'lucide-react-native';
import type { ReasoningReport } from '@/ai/reasoning/ReasoningTypes';
import { DecisionCardView } from './DecisionCardView';
import { FindingCard } from './FindingCard';
import { HealthPanel } from './HealthPanel';
import { DependencyGraphView } from './DependencyGraphView';

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = 'cards' | 'findings' | 'health' | 'dependencies';

interface TabDef {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onSelect }: { tabs: TabDef[]; active: Tab; onSelect: (t: Tab) => void }) {
  return (
    <View className="flex-row border-b border-border">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <Pressable
            key={t.id}
            onPress={() => onSelect(t.id)}
            className={`flex-1 items-center py-3 gap-0.5 active:opacity-70 ${isActive ? 'border-b-2 border-foreground' : ''}`}
          >
            <View className={isActive ? 'text-foreground' : 'text-muted-foreground'}>{t.icon}</View>
            <View className="flex-row items-center gap-1">
              <Text className={`text-xs ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{t.label}</Text>
              {!!t.badge && t.badge > 0 && (
                <View className="bg-destructive rounded-full w-4 h-4 items-center justify-center">
                  <Text className="text-xs text-white font-bold">{t.badge > 9 ? '9+' : t.badge}</Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  report: ReasoningReport | null;
  isLoading?: boolean;
}

export function ReasoningModal({ visible, onClose, report, isLoading = false }: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('cards');

  const tabs: TabDef[] = [
    { id: 'cards',        label: 'Decisions',    icon: <Brain size={14} />,     badge: report?.decisionCards.filter((c) => c.isBlocking).length },
    { id: 'findings',     label: 'Findings',     icon: <List size={14} />,      badge: report?.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length },
    { id: 'health',       label: 'Health',       icon: <Activity size={14} /> },
    { id: 'dependencies', label: 'Workflow',     icon: <GitBranch size={14} />, badge: report?.dependencyGraph.blockedNodeIds.length },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>

        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <View className="flex-row items-center gap-2">
            <Brain size={18} className="text-foreground" />
            <View>
              <Text className="text-base font-semibold text-foreground">Decision Support</Text>
              {report && (
                <Text className="text-xs text-muted-foreground">
                  {report.firNumber ? `FIR ${report.firNumber}` : 'All Cases'} · {report.rulesEvaluated} rules evaluated
                </Text>
              )}
            </View>
          </View>
          <Pressable onPress={onClose} className="p-2 rounded-full active:opacity-60">
            <X size={18} className="text-muted-foreground" />
          </Pressable>
        </View>

        {/* Loading state */}
        {isLoading && (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" />
            <Text className="text-sm text-muted-foreground">Running investigation analysis…</Text>
          </View>
        )}

        {/* No report */}
        {!isLoading && !report && (
          <View className="flex-1 items-center justify-center px-8 gap-3">
            <AlertTriangle size={32} className="text-muted-foreground" />
            <Text className="text-base font-semibold text-foreground text-center">No Analysis Available</Text>
            <Text className="text-sm text-muted-foreground text-center">Open a FIR to run the investigation analysis engine.</Text>
          </View>
        )}

        {/* Report content */}
        {!isLoading && report && (
          <>
            {/* Executive summary strip */}
            <View className="px-4 py-2.5 bg-muted/30 border-b border-border/50">
              <View className="flex-row items-center gap-2">
                <View className={`px-2 py-0.5 rounded-full ${report.healthReport.overallScore >= 70 ? 'bg-emerald-50' : report.healthReport.overallScore >= 50 ? 'bg-amber-50' : 'bg-red-50'}`}>
                  <Text className={`text-xs font-bold ${report.healthReport.overallScore >= 70 ? 'text-emerald-700' : report.healthReport.overallScore >= 50 ? 'text-amber-700' : 'text-destructive'}`}>
                    {report.healthReport.overallScore}/100 · {report.healthReport.grade}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>
                  {report.findings.filter((f) => f.severity === 'critical').length}🔴 {report.findings.filter((f) => f.severity === 'high').length}🟠 {report.findings.filter((f) => f.severity === 'medium').length}🟡 | {report.rulesFired} rules fired
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground mt-1" numberOfLines={2}>
                {report.nextPriorityAction}
              </Text>
            </View>

            {/* Tab bar */}
            <TabBar tabs={tabs} active={activeTab} onSelect={setActiveTab} />

            {/* Tab content */}
            <ScrollView
              className="flex-1"
              contentContainerClassName="p-4 pb-8"
              contentInsetAdjustmentBehavior="automatic"
            >
              {/* Decision Cards */}
              {activeTab === 'cards' && (
                <View>
                  <Text className="text-xs text-muted-foreground mb-3">
                    Tap any card to expand the AI reasoning and legal basis.
                    All recommendations are advisory — you remain the decision maker.
                  </Text>
                  {report.decisionCards.length === 0 ? (
                    <View className="items-center py-8 gap-2">
                      <CheckCircle size={28} className="text-emerald-500" />
                      <Text className="text-sm text-muted-foreground">No critical decision required right now.</Text>
                    </View>
                  ) : (
                    report.decisionCards.map((card) => (
                      <DecisionCardView key={card.id} card={card} />
                    ))
                  )}
                </View>
              )}

              {/* Findings */}
              {activeTab === 'findings' && (
                <View>
                  <Text className="text-xs text-muted-foreground mb-3">
                    {report.findings.length} finding(s) from {report.rulesEvaluated} rules evaluated across all modules.
                  </Text>
                  {report.findings.length === 0 ? (
                    <View className="items-center py-8 gap-2">
                      <CheckCircle size={28} className="text-emerald-500" />
                      <Text className="text-sm text-muted-foreground">No violations detected.</Text>
                    </View>
                  ) : (
                    report.findings.map((f) => <FindingCard key={f.id} finding={f} />)
                  )}
                </View>
              )}

              {/* Health */}
              {activeTab === 'health' && (
                <HealthPanel report={report.healthReport} />
              )}

              {/* Dependencies */}
              {activeTab === 'dependencies' && (
                <View>
                  <Text className="text-xs text-muted-foreground mb-3">
                    Investigation workflow dependency graph. Blocked steps indicate missing prerequisites.
                  </Text>
                  <DependencyGraphView graph={report.dependencyGraph} />
                </View>
              )}
            </ScrollView>

            {/* Offline mode indicator */}
            {report.offlineMode && (
              <View className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex-row items-center gap-2">
                <AlertTriangle size={12} className="text-amber-600" />
                <Text className="text-xs text-amber-700">Offline Decision Support Mode — using local rules and knowledge base</Text>
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

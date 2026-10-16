/**
 * MultiFIRPanel.tsx
 * Station-wide FIR intelligence for SHO/CO. Displays station metrics,
 * oldest investigations, pending charge sheets, default bail risks,
 * officer workload, crime trends, and overdue case diaries.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
} from 'react-native';
import {
  BarChart2, AlertTriangle, Users, FileText, RefreshCw,
} from 'lucide-react-native';
import type { MultiFIRIntelligenceReport, FIRSummaryItem, OfficerWorkloadItem, CrimeTrendItem } from '../../../ai/level5/L5Types';

// ── FIR summary row ───────────────────────────────────────────────────────────

function FIRRow({ item }: { item: FIRSummaryItem }) {
  return (
    <View className="flex-row items-center gap-3 py-3 border-b border-border">
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground">FIR {item.firNumber}</Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {item.crimeType} · {item.officerName}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="text-xs text-muted-foreground">{item.daysSinceRegistration}d old</Text>
        {item.criticalAlertCount > 0 && (
          <View className="bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            <Text className="text-xs text-red-600 font-medium">{item.criticalAlertCount} critical</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center gap-2 mb-2">
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex-1">{title}</Text>
        {count !== undefined && (
          <Text className="text-xs text-muted-foreground">{count}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'firs' | 'workload' | 'trends';
const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'firs',      label: 'FIRs' },
  { id: 'workload',  label: 'Workload' },
  { id: 'trends',    label: 'Trends' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onRefresh: () => void;
  report: MultiFIRIntelligenceReport | null;
  isLoading: boolean;
}

export function MultiFIRPanel({ visible, onClose, onRefresh, report, isLoading }: Props) {
  const [tab, setTab] = useState<TabId>('overview');
  const m = report?.metrics;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <View>
            <Text className="text-lg font-semibold text-foreground">Station Intelligence</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {report?.stationName ?? 'Station'} · {m?.totalFIRs ?? 0} FIRs
            </Text>
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
            <Text className="text-sm text-muted-foreground">Analysing all FIRs…</Text>
          </View>
        ) : !report ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <BarChart2 size={32} className="text-muted-foreground" />
            <Text className="text-base font-medium text-foreground text-center">No Data Available</Text>
            <Text className="text-sm text-muted-foreground text-center">Station analysis requires FIR context data.</Text>
          </View>
        ) : (
          <>
            {/* Tabs */}
            <View className="flex-row px-5 pt-3 gap-4 border-b border-border">
              {TABS.map((t) => (
                <Pressable key={t.id} onPress={() => setTab(t.id)} className="pb-2 active:opacity-70">
                  <Text className={`text-sm font-medium ${tab === t.id ? 'text-primary' : 'text-muted-foreground'}`}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

              {/* OVERVIEW */}
              {tab === 'overview' && m && (
                <View>
                  {/* Metric grid */}
                  <View className="flex-row flex-wrap gap-3 mb-6">
                    {[
                      { label: 'Total FIRs',       value: m.totalFIRs },
                      { label: 'Pending',           value: m.pendingFIRs },
                      { label: 'Critical',          value: m.criticalFIRCount,       highlight: m.criticalFIRCount > 0 },
                      { label: 'Default Bail Risk', value: m.defaultBailRiskCount,   highlight: m.defaultBailRiskCount > 0 },
                      { label: 'CS Overdue',        value: m.chargeSheetOverdueCount, highlight: m.chargeSheetOverdueCount > 0 },
                      { label: 'Avg Health',        value: `${m.avgHealthScore}` },
                    ].map(({ label, value, highlight }) => (
                      <View key={label} className="w-[30%] bg-card border border-border rounded-xl p-3">
                        <Text className={`text-xl font-bold ${highlight ? 'text-red-600' : 'text-foreground'}`}>{value}</Text>
                        <Text className="text-xs text-muted-foreground mt-0.5">{label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Summary */}
                  <Text className="text-sm text-foreground leading-relaxed mb-4">{report.summary}</Text>

                  {/* High priority */}
                  {report.highPriorityFIRs.length > 0 && (
                    <Section title="High Priority" count={report.highPriorityFIRs.length}>
                      {report.highPriorityFIRs.map((f: FIRSummaryItem) => <FIRRow key={f.firId} item={f} />)}
                    </Section>
                  )}
                </View>
              )}

              {/* FIRS */}
              {tab === 'firs' && (
                <View>
                  <Section title={`Oldest Investigations (${report.oldestInvestigations.length})`}>
                    {report.oldestInvestigations.map((f: FIRSummaryItem) => <FIRRow key={f.firId} item={f} />)}
                    {report.oldestInvestigations.length === 0 && <Text className="text-sm text-muted-foreground">None.</Text>}
                  </Section>
                  <Section title={`Pending Charge Sheets (${report.pendingChargeSheets.length})`}>
                    {report.pendingChargeSheets.map((f: FIRSummaryItem) => <FIRRow key={f.firId} item={f} />)}
                    {report.pendingChargeSheets.length === 0 && <Text className="text-sm text-muted-foreground">None.</Text>}
                  </Section>
                  <Section title={`Default Bail Risks (${report.defaultBailRisks.length})`}>
                    {report.defaultBailRisks.map((f: FIRSummaryItem) => <FIRRow key={f.firId} item={f} />)}
                    {report.defaultBailRisks.length === 0 && <Text className="text-sm text-muted-foreground">None.</Text>}
                  </Section>
                  <Section title={`Overdue Case Diaries (${report.overdueCaseDiaries.length})`}>
                    {report.overdueCaseDiaries.map((f: FIRSummaryItem) => <FIRRow key={f.firId} item={f} />)}
                    {report.overdueCaseDiaries.length === 0 && <Text className="text-sm text-muted-foreground">None.</Text>}
                  </Section>
                  <Section title={`Pending Medical (${report.pendingMedicalReports.length})`}>
                    {report.pendingMedicalReports.map((f: FIRSummaryItem) => <FIRRow key={f.firId} item={f} />)}
                    {report.pendingMedicalReports.length === 0 && <Text className="text-sm text-muted-foreground">None.</Text>}
                  </Section>
                  <Section title={`Pending FSL (${report.pendingFSLReports.length})`}>
                    {report.pendingFSLReports.map((f: FIRSummaryItem) => <FIRRow key={f.firId} item={f} />)}
                    {report.pendingFSLReports.length === 0 && <Text className="text-sm text-muted-foreground">None.</Text>}
                  </Section>
                </View>
              )}

              {/* WORKLOAD */}
              {tab === 'workload' && (
                <View>
                  {report.officerWorkload.map((w: OfficerWorkloadItem) => (
                    <View key={w.officerName} className="flex-row items-center gap-3 py-3 border-b border-border">
                      <Users size={14} className="text-muted-foreground" />
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-foreground">{w.officerName}</Text>
                        <Text className="text-xs text-muted-foreground mt-0.5">
                          {w.pendingFIRs} pending · {w.criticalFIRs} critical
                        </Text>
                      </View>
                      <Text className="text-base font-bold text-foreground">{w.totalFIRs}</Text>
                    </View>
                  ))}
                  {report.officerWorkload.length === 0 && (
                    <Text className="text-sm text-muted-foreground py-6 text-center">No workload data available.</Text>
                  )}
                </View>
              )}

              {/* TRENDS */}
              {tab === 'trends' && (
                <View>
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Crime Distribution</Text>
                  {report.crimeTrends.map((t: CrimeTrendItem) => (
                    <View key={t.crimeType} className="mb-3">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-sm text-foreground">{t.crimeType}</Text>
                        <Text className="text-xs text-muted-foreground">{t.count} ({t.percentage}%)</Text>
                      </View>
                      <View className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <View className="h-full bg-primary rounded-full" style={{ width: `${t.percentage}%` as unknown as number }} />
                      </View>
                    </View>
                  ))}
                  {report.crimeTrends.length === 0 && (
                    <Text className="text-sm text-muted-foreground">No crime trend data.</Text>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Advisory */}
            <View className="px-5 py-3 border-t border-border">
              <Text className="text-xs text-muted-foreground text-center">
                ⚖️ Station intelligence is advisory only. All decisions remain with the officer.
              </Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

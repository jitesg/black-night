/**
 * MemoryPanel.tsx
 * Displays FIR-specific investigation memory — progress timeline,
 * previous recommendations with status, health trend, recurring issues,
 * resolved issues, and long-pending gaps.
 *
 * Minimal design: whitespace-led, typographic hierarchy, no decorative shadows.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
} from 'react-native';
import {
  Clock, TrendingUp, TrendingDown, Minus,
  CheckCircle, AlertCircle, XCircle, Circle,
  ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react-native';
import type { InvestigationMemoryReport, MemoryRecommendation, TrendDirection } from '../../../ai/level5/L5Types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function TrendIcon({ dir }: { dir: TrendDirection }) {
  if (dir === 'improving') return <TrendingUp size={14} className="text-green-600" />;
  if (dir === 'declining') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-muted-foreground" />;
}

function StatusIcon({ status }: { status: MemoryRecommendation['status'] }) {
  switch (status) {
    case 'accepted':  return <CheckCircle size={14} className="text-green-600" />;
    case 'rejected':  return <XCircle size={14} className="text-red-500" />;
    case 'ignored':   return <Minus size={14} className="text-muted-foreground" />;
    default:          return <Circle size={14} className="text-amber-500" />;
  }
}

function statusLabel(s: MemoryRecommendation['status']): string {
  switch (s) {
    case 'accepted': return 'Accepted';
    case 'rejected': return 'Rejected';
    case 'ignored':  return 'Ignored';
    case 'deferred': return 'Deferred';
    default:         return 'Pending';
  }
}

function priorityColor(p: string): string {
  switch (p) {
    case 'critical': return 'text-red-600';
    case 'high':     return 'text-orange-500';
    case 'medium':   return 'text-amber-500';
    default:         return 'text-muted-foreground';
  }
}

// ── Recommendation row ────────────────────────────────────────────────────────

function RecRow({ rec }: { rec: MemoryRecommendation }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="border-b border-border py-3">
      <Pressable
        onPress={() => setOpen((p) => !p)}
        className="flex-row items-start gap-3 active:opacity-70"
      >
        <StatusIcon status={rec.status} />
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground leading-snug">{rec.title}</Text>
          <Text className={`text-xs mt-0.5 ${priorityColor(rec.priority)}`}>
            {rec.priority.toUpperCase()} · {statusLabel(rec.status)}
            {rec.recordedAt ? `  ·  ${rec.recordedAt.slice(0, 10)}` : ''}
          </Text>
        </View>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </Pressable>

      {open && (
        <View className="mt-3 gap-2 pl-5">
          {[
            { label: 'Reason',      value: rec.reason },
            { label: 'Context',     value: rec.supportingContext },
            { label: 'Rule',        value: rec.applicableRule },
            { label: 'Outcome',     value: rec.expectedOutcome },
            { label: 'Risk if ignored', value: rec.riskIfIgnored },
            { label: 'Confidence',  value: `${rec.confidencePct}%` },
          ].map(({ label, value }) =>
            value ? (
              <View key={label}>
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Text>
                <Text className="text-xs text-foreground mt-0.5 leading-relaxed">{value}</Text>
              </View>
            ) : null
          )}
        </View>
      )}
    </View>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onRefresh: () => void;
  report: InvestigationMemoryReport | null;
  isLoading: boolean;
}

export function MemoryPanel({ visible, onClose, onRefresh, report, isLoading }: Props) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'issues' | 'snapshots'>('timeline');

  const rec   = report?.record;
  const ps    = rec?.progressSummary;
  const tabs  = [
    { id: 'timeline' as const,  label: 'Recommendations' },
    { id: 'issues' as const,    label: 'Issues' },
    { id: 'snapshots' as const, label: 'Health Trend' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <View>
            <Text className="text-lg font-semibold text-foreground">Investigation Memory</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {report?.hasMemory
                ? `${report.daysSinceFirstObservation} day(s) of history`
                : 'No history yet'}
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
            <Text className="text-sm text-muted-foreground">Loading memory…</Text>
          </View>
        ) : !report?.hasMemory ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Clock size={32} className="text-muted-foreground" />
            <Text className="text-base font-medium text-foreground text-center">No Investigation Memory</Text>
            <Text className="text-sm text-muted-foreground text-center leading-relaxed">
              AI will start recording observations and recommendations as you use the Copilot for this FIR.
            </Text>
          </View>
        ) : (
          <>
            {/* Progress summary cards */}
            {ps && (
              <View className="flex-row px-5 py-4 gap-3 border-b border-border">
                {[
                  { label: 'Total',    value: ps.totalRecommendations },
                  { label: 'Accepted', value: ps.accepted },
                  { label: 'Pending',  value: ps.pending },
                  { label: 'Ignored',  value: ps.ignored },
                ].map(({ label, value }) => (
                  <View key={label} className="flex-1 items-center">
                    <Text className="text-xl font-bold text-foreground">{value}</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5">{label}</Text>
                  </View>
                ))}
                <View className="flex-1 items-center">
                  <TrendIcon dir={ps.healthTrend} />
                  <Text className="text-xs text-muted-foreground mt-1">Trend</Text>
                </View>
              </View>
            )}

            {/* Summary */}
            {report.summary && (
              <View className="px-5 py-3 border-b border-border">
                <Text className="text-sm text-foreground leading-relaxed">{report.summary}</Text>
              </View>
            )}

            {/* Tabs */}
            <View className="flex-row px-5 pt-3 gap-4 border-b border-border">
              {tabs.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  className="pb-2 active:opacity-70"
                >
                  <Text className={`text-sm font-medium ${activeTab === t.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView
              className="flex-1 px-5"
              contentContainerStyle={{ paddingVertical: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Recommendations timeline */}
              {activeTab === 'timeline' && (
                <View>
                  {(rec?.recommendations.length ?? 0) === 0 ? (
                    <Text className="text-sm text-muted-foreground py-6 text-center">No recommendations recorded yet.</Text>
                  ) : (
                    rec!.recommendations.map((r: MemoryRecommendation) => <RecRow key={r.id} rec={r} />)
                  )}
                </View>
              )}

              {/* Issues */}
              {activeTab === 'issues' && (
                <View className="gap-4 py-2">
                  {/* Recurring */}
                  <View>
                    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Recurring Issues ({rec?.recurringIssues.length ?? 0})
                    </Text>
                    {(rec?.recurringIssues ?? []).map((i: { id?: string; title: string; occurrenceCount: number; firstSeenAt: string; isResolved: boolean }, idx: number) => (
                      <View key={idx} className="flex-row items-start gap-2 py-2 border-b border-border">
                        <AlertCircle size={14} className={i.isResolved ? 'text-green-600' : 'text-amber-500'} />
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-foreground">{i.title}</Text>
                          <Text className="text-xs text-muted-foreground mt-0.5">
                            Seen {i.occurrenceCount}× · First: {i.firstSeenAt.slice(0,10)}
                            {i.isResolved ? ' · ✅ Resolved' : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {(rec?.recurringIssues ?? []).length === 0 && (
                      <Text className="text-sm text-muted-foreground py-2">No recurring issues.</Text>
                    )}
                  </View>

                  {/* Long-pending gaps */}
                  <View>
                    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Long-Pending Gaps ({rec?.longPendingGaps.length ?? 0})
                    </Text>
                    {(rec?.longPendingGaps ?? []).map((g: string, idx: number) => (
                      <View key={idx} className="flex-row items-center gap-2 py-1.5">
                        <Circle size={6} className="text-red-500" />
                        <Text className="text-sm text-foreground">{g}</Text>
                      </View>
                    ))}
                    {(rec?.longPendingGaps ?? []).length === 0 && (
                      <Text className="text-sm text-muted-foreground">No long-pending gaps.</Text>
                    )}
                  </View>

                  {/* Resolved */}
                  <View>
                    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Resolved ({rec?.resolvedIssues.length ?? 0})
                    </Text>
                    {(rec?.resolvedIssues ?? []).map((r: string, idx: number) => (
                      <View key={idx} className="flex-row items-center gap-2 py-1.5">
                        <CheckCircle size={14} className="text-green-600" />
                        <Text className="text-sm text-foreground">{r}</Text>
                      </View>
                    ))}
                    {(rec?.resolvedIssues ?? []).length === 0 && (
                      <Text className="text-sm text-muted-foreground">No resolved issues yet.</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Health snapshots */}
              {activeTab === 'snapshots' && (
                <View className="py-2 gap-2">
                  {(rec?.healthSnapshots ?? []).length === 0 ? (
                    <Text className="text-sm text-muted-foreground py-6 text-center">No health snapshots recorded yet.</Text>
                  ) : (
                    [...(rec?.healthSnapshots ?? [])].reverse().map((s, idx) => (
                      <View key={idx} className="flex-row items-center gap-3 py-2 border-b border-border">
                        <View className="w-10 items-center">
                          <Text className="text-base font-bold text-foreground">{s.overallScore}</Text>
                          <Text className="text-xs text-muted-foreground">{s.grade}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-xs text-muted-foreground">{s.snapshotAt.slice(0, 16).replace('T', ' ')}</Text>
                          <Text className="text-xs text-foreground mt-0.5">
                            Risk: {s.riskLevel} · CS: {s.chargeSheetReadinessPct}%
                          </Text>
                        </View>
                        <TrendIcon dir={idx === 0 ? 'stable' : s.overallScore > (rec?.healthSnapshots[rec.healthSnapshots.length - 1 - idx - 1]?.overallScore ?? s.overallScore) ? 'improving' : 'declining'} />
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>

            {/* Advisory */}
            <View className="px-5 py-3 border-t border-border">
              <Text className="text-xs text-muted-foreground text-center leading-relaxed">
                ⚖️ AI memory is advisory only. All decisions remain with the Investigating Officer.
              </Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

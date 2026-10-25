/**
 * PredictiveAlertsPanel.tsx
 * Displays predicted investigation risks — likelihood, impact, confidence,
 * and preventive actions. Minimal design.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
} from 'react-native';
import {
  AlertTriangle, TrendingUp, Calendar, FileText,
  Shield, Clock, Users, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import type { PredictiveInvestigationReport, PredictiveRisk } from '../../../ai/level5/L5Types';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

// ── Helpers ───────────────────────────────────────────────────────────────────

function impactColor(impact: PredictiveRisk['impact']): string {
  switch (impact) {
    case 'critical': return 'text-red-600';
    case 'high':     return 'text-orange-500';
    case 'medium':   return 'text-amber-500';
    default:         return 'text-muted-foreground';
  }
}

function impactBg(impact: PredictiveRisk['impact']): string {
  switch (impact) {
    case 'critical': return 'bg-red-50 border-red-200';
    case 'high':     return 'bg-orange-50 border-orange-200';
    case 'medium':   return 'bg-amber-50 border-amber-200';
    default:         return 'bg-muted border-border';
  }
}

function RiskIcon({ type }: { type: PredictiveRisk['type'] }) {
  const cls = "text-muted-foreground";
  switch (type) {
    case 'upcoming-court-date':       return <Calendar size={16} className={cls} />;
    case 'charge-sheet-deadline':     return <FileText size={16} className={cls} />;
    case 'default-bail-risk':         return <AlertTriangle size={16} className={cls} />;
    case 'fsl-delay':                 return <TrendingUp size={16} className={cls} />;
    case 'medical-delay':             return <Shield size={16} className={cls} />;
    case 'witness-delay':             return <Users size={16} className={cls} />;
    case 'case-diary-gap':            return <Clock size={16} className={cls} />;
    default:                          return <AlertTriangle size={16} className={cls} />;
  }
}

function ConfidenceBar({ pct }: { pct: number }) {
  return (
    <View className="flex-row items-center gap-2 mt-1">
      <View className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <View className="h-full bg-primary rounded-full" style={{ width: `${pct}%` as unknown as number }} />
      </View>
      <Text className="text-xs text-muted-foreground w-8">{pct}%</Text>
    </View>
  );
}

// ── Risk card ─────────────────────────────────────────────────────────────────

function RiskCard({ risk }: { risk: PredictiveRisk }) {
  const [open, setOpen] = useState(false);

  return (
    <View className={`rounded-xl border p-4 mb-3 ${impactBg(risk.impact)}`}>
      {/* Header row */}
      <Pressable
        onPress={() => setOpen((p) => !p)}
        className="flex-row items-start gap-3 active:opacity-70"
      >
        <RiskIcon type={risk.type} />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground leading-snug">{risk.title}</Text>
          <View className="flex-row items-center gap-3 mt-1 flex-wrap">
            <Text className={`text-xs font-bold ${impactColor(risk.impact)}`}>
              {risk.impact.toUpperCase()}
            </Text>
            <Text className="text-xs text-muted-foreground">
              Likelihood {risk.likelihood}%
            </Text>
            {risk.daysToEvent !== undefined && (
              <Text className="text-xs text-muted-foreground">
                {risk.daysToEvent <= 0 ? '⚠️ Overdue' : `${risk.daysToEvent}d remaining`}
              </Text>
            )}
          </View>
          <Text className="text-xs text-muted-foreground mt-1">Confidence</Text>
          <ConfidenceBar pct={risk.confidence} />
        </View>
        {open
          ? <ChevronUp size={14} className="text-muted-foreground" />
          : <ChevronDown size={14} className="text-muted-foreground" />}
      </Pressable>

      {/* Expanded detail */}
      {open && (
        <View className="mt-3 gap-3 pt-3 border-t border-border">
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Text>
            <Text className="text-xs text-foreground mt-1 leading-relaxed">{risk.description}</Text>
          </View>
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Supporting Context</Text>
            <Text className="text-xs text-foreground mt-1 leading-relaxed">{risk.supportingContext}</Text>
          </View>
          {risk.applicableRule && (
            <View>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Applicable Rule</Text>
              <Text className="text-xs text-foreground mt-1">{risk.applicableRule}</Text>
            </View>
          )}
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risk if Ignored</Text>
            <Text className="text-xs text-red-600 mt-1 leading-relaxed">{risk.riskIfIgnored}</Text>
          </View>
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Preventive Actions</Text>
            {risk.preventiveActions.map((a: { title: string; description: string; urgency: string }, i: number) => (
              <View key={i} className="flex-row gap-2 mb-1.5">
                <Text className="text-xs text-muted-foreground">{i + 1}.</Text>
                <View className="flex-1">
                  <Text className="text-xs font-medium text-foreground">{a.title}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.description}</Text>
                </View>
              </View>
            ))}
          </View>
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
  report: PredictiveInvestigationReport | null;
  isLoading: boolean;
}

export function PredictiveAlertsPanel({ visible, onClose, onRefresh, report, isLoading }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ paddingBottom: NAV_BAR_INSET }} className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <View>
            <Text className="text-lg font-semibold text-foreground">Predictive Alerts</Text>
            {report && (
              <Text className="text-xs text-muted-foreground mt-0.5">
                {report.risks.length} risk(s) · Score {report.overallRiskScore}/100
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
            <Text className="text-sm text-muted-foreground">Analysing risks…</Text>
          </View>
        ) : !report || report.risks.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Shield size={32} className="text-muted-foreground" />
            <Text className="text-base font-medium text-foreground text-center">No Significant Risks</Text>
            <Text className="text-sm text-muted-foreground text-center leading-relaxed">
              {report?.summary ?? 'No predictive risks detected for this investigation.'}
            </Text>
          </View>
        ) : (
          <>
            {/* Summary bar */}
            {report.topRisk && (
              <View className="px-5 py-3 border-b border-border">
                <Text className="text-xs text-muted-foreground">Top risk</Text>
                <Text className="text-sm font-semibold text-foreground mt-0.5">{report.topRisk.title}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">{report.nextActionRequired}</Text>
              </View>
            )}

            {/* Stats row */}
            <View className="flex-row px-5 py-3 gap-4 border-b border-border">
              {[
                { label: 'Critical', value: report.criticalCount, cls: 'text-red-600' },
                { label: 'High',     value: report.highCount,     cls: 'text-orange-500' },
                { label: 'Total',    value: report.risks.length,  cls: 'text-foreground' },
              ].map(({ label, value, cls }) => (
                <View key={label} className="flex-1 items-center">
                  <Text className={`text-2xl font-bold ${cls}`}>{value}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">{label}</Text>
                </View>
              ))}
            </View>

            <ScrollView
              className="flex-1 px-5 pt-4"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {report.risks.map((r: PredictiveRisk) => <RiskCard key={r.id} risk={r} />)}
            </ScrollView>

            {/* Advisory */}
            <View className="px-5 py-3 border-t border-border">
              <Text className="text-xs text-muted-foreground text-center leading-relaxed">
                ⚖️ Predictive alerts are advisory only. All decisions remain with the Investigating Officer.
              </Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

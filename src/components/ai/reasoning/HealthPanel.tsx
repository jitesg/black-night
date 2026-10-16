/**
 * HealthPanel.tsx
 * Visual health report panel with dimension bars and item lists.
 * Minimal theme — clean typography, subtle borders, generous whitespace.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Folder,
  Shield,
  XCircle,
} from 'lucide-react-native';
import type { InvestigationHealthReport } from '@/ai/reasoning/ReasoningTypes';

interface Props {
  report: InvestigationHealthReport;
}

// ── Dimension row ─────────────────────────────────────────────────────────────

function DimensionRow({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const barColor = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-400' : 'bg-destructive';
  return (
    <View className="mb-2.5">
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-1.5">
          <View className="text-muted-foreground">{icon}</View>
          <Text className="text-xs text-muted-foreground">{label}</Text>
        </View>
        <Text className="text-xs font-semibold text-foreground">{value}%</Text>
      </View>
      <View className="h-1 bg-muted rounded-full overflow-hidden">
        <View className={`h-full rounded-full ${barColor}`} style={{ width: `${value}%` }} />
      </View>
    </View>
  );
}

// ── Item list ─────────────────────────────────────────────────────────────────

function ItemList({ title, items, icon, textClass }: { title: string; items: string[]; icon: React.ReactNode; textClass: string }) {
  if (items.length === 0) return null;
  return (
    <View className="mb-3">
      <View className="flex-row items-center gap-1.5 mb-1.5">
        <View className={textClass}>{icon}</View>
        <Text className={`text-xs font-semibold ${textClass}`}>{title} ({items.length})</Text>
      </View>
      {items.slice(0, 5).map((item, i) => (
        <View key={i} className="flex-row items-start gap-2 mb-1">
          <Text className={`text-xs mt-0.5 ${textClass}`}>•</Text>
          <Text className="text-xs text-foreground flex-1" numberOfLines={2}>{item}</Text>
        </View>
      ))}
      {items.length > 5 && (
        <Text className="text-xs text-muted-foreground">+{items.length - 5} more</Text>
      )}
    </View>
  );
}

// ── Grade badge ───────────────────────────────────────────────────────────────

function GradeBadge({ grade, score }: { grade: string; score: number }) {
  const colors = {
    A: 'bg-emerald-50 border-emerald-300 text-emerald-700',
    B: 'bg-green-50 border-green-300 text-green-700',
    C: 'bg-amber-50 border-amber-300 text-amber-700',
    D: 'bg-orange-50 border-orange-300 text-orange-700',
    F: 'bg-red-50 border-red-300 text-red-700',
  }[grade] ?? 'bg-muted border-border text-muted-foreground';

  return (
    <View className={`px-3 py-1 rounded-full border ${colors}`}>
      <Text className={`text-sm font-bold ${colors.split(' ')[2]}`}>{score}/100 · Grade {grade}</Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function HealthPanel({ report }: Props) {
  const [showDimensions, setShowDimensions] = useState(false);
  const [showItems, setShowItems] = useState(false);

  const barColor = report.overallScore >= 75 ? 'bg-emerald-500'
    : report.overallScore >= 50 ? 'bg-amber-400' : 'bg-destructive';

  return (
    <View className="bg-card rounded-2xl overflow-hidden" style={{ borderCurve: 'continuous' } as object}>
      {/* Header */}
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <Activity size={15} className="text-muted-foreground" />
            <Text className="text-sm font-semibold text-foreground">Investigation Health</Text>
          </View>
          <GradeBadge grade={report.grade} score={report.overallScore} />
        </View>

        {/* Overall progress bar */}
        <View className="h-2 bg-muted rounded-full overflow-hidden mb-2">
          <View className={`h-full rounded-full ${barColor}`} style={{ width: `${report.overallScore}%` }} />
        </View>
        <Text className="text-xs text-muted-foreground">{report.label}</Text>

        {/* Quick stat pills */}
        <View className="flex-row gap-2 mt-3 flex-wrap">
          {report.completedItems.length > 0 && (
            <View className="flex-row items-center gap-1 px-2.5 py-1 bg-emerald-50 rounded-full">
              <CheckCircle size={10} className="text-emerald-600" />
              <Text className="text-xs text-emerald-700 font-medium">{report.completedItems.length} done</Text>
            </View>
          )}
          {report.pendingItems.length > 0 && (
            <View className="flex-row items-center gap-1 px-2.5 py-1 bg-amber-50 rounded-full">
              <Clock size={10} className="text-amber-600" />
              <Text className="text-xs text-amber-700 font-medium">{report.pendingItems.length} pending</Text>
            </View>
          )}
          {report.criticalItems.length > 0 && (
            <View className="flex-row items-center gap-1 px-2.5 py-1 bg-red-50 rounded-full">
              <XCircle size={10} className="text-destructive" />
              <Text className="text-xs text-destructive font-medium">{report.criticalItems.length} critical</Text>
            </View>
          )}
          {report.missingItems.length > 0 && (
            <View className="flex-row items-center gap-1 px-2.5 py-1 bg-slate-50 rounded-full">
              <AlertTriangle size={10} className="text-slate-600" />
              <Text className="text-xs text-slate-700 font-medium">{report.missingItems.length} missing</Text>
            </View>
          )}
          {report.deadlineItems.length > 0 && (
            <View className="flex-row items-center gap-1 px-2.5 py-1 bg-violet-50 rounded-full">
              <Calendar size={10} className="text-violet-600" />
              <Text className="text-xs text-violet-700 font-medium">{report.deadlineItems.length} deadlines</Text>
            </View>
          )}
        </View>
      </View>

      {/* Dimensions toggle */}
      <Pressable
        onPress={() => setShowDimensions((v) => !v)}
        className="flex-row items-center justify-between px-4 py-2.5 border-t border-border/30 active:opacity-70"
      >
        <Text className="text-xs font-medium text-muted-foreground">Dimension Scores</Text>
        {showDimensions ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
      </Pressable>
      {showDimensions && (
        <View className="px-4 pb-3">
          <DimensionRow label="Completion"           value={report.completionPct}         icon={<CheckCircle size={11} />} />
          <DimensionRow label="Legal Readiness"      value={report.legalReadiness}        icon={<Shield size={11} />} />
          <DimensionRow label="Court Readiness"      value={report.courtReadiness}        icon={<FileText size={11} />} />
          <DimensionRow label="Evidence Readiness"   value={report.evidenceReadiness}     icon={<Folder size={11} />} />
          <DimensionRow label="Documentation Quality" value={report.documentationQuality} icon={<FileText size={11} />} />
          <DimensionRow label="Timeline Quality"     value={report.timelineQuality}       icon={<Clock size={11} />} />
        </View>
      )}

      {/* Items toggle */}
      <Pressable
        onPress={() => setShowItems((v) => !v)}
        className="flex-row items-center justify-between px-4 py-2.5 border-t border-border/30 active:opacity-70"
      >
        <Text className="text-xs font-medium text-muted-foreground">Item Details</Text>
        {showItems ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
      </Pressable>
      {showItems && (
        <View className="px-4 pb-3">
          <ItemList title="Completed"  items={report.completedItems}  icon={<CheckCircle size={12} />}    textClass="text-emerald-600" />
          <ItemList title="Pending"    items={report.pendingItems}    icon={<Clock size={12} />}           textClass="text-amber-600"  />
          <ItemList title="Critical"   items={report.criticalItems}   icon={<XCircle size={12} />}         textClass="text-destructive" />
          <ItemList title="Missing"    items={report.missingItems}    icon={<AlertTriangle size={12} />}   textClass="text-slate-600"  />
          <ItemList title="Deadlines"  items={report.deadlineItems}   icon={<Calendar size={12} />}        textClass="text-violet-600" />
        </View>
      )}
    </View>
  );
}

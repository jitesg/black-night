/**
 * AuditLogPanel.tsx
 * Displays the AI activity audit log — all recommendations, officer actions,
 * timestamps, FIR references, and module references.
 *
 * Filterable by FIR, date range, officer action, and module.
 */

import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal,
} from 'react-native';
import {
  ClipboardList, CheckCircle, XCircle, Minus,
  Circle, RefreshCw, ChevronDown, ChevronUp, Filter,
} from 'lucide-react-native';
import type {
  AIAuditReport, AuditEntry, OfficerAction,
} from '../../../ai/level5/L5Types';
import { NAV_BAR_INSET } from '@/lib/navBarInset';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ActionIcon({ action }: { action: AuditEntry['officerAction'] }) {
  switch (action) {
    case 'accepted': return <CheckCircle size={14} className="text-green-600" />;
    case 'rejected': return <XCircle size={14} className="text-red-500" />;
    case 'ignored':  return <Minus size={14} className="text-muted-foreground" />;
    default:         return <Circle size={14} className="text-amber-500" />;
  }
}

function actionLabel(a: AuditEntry['officerAction']): string {
  switch (a) {
    case 'accepted': return 'Accepted';
    case 'rejected': return 'Rejected';
    case 'ignored':  return 'Ignored';
    case 'deferred': return 'Deferred';
    default:         return 'Pending';
  }
}

function actionColor(a: AuditEntry['officerAction']): string {
  switch (a) {
    case 'accepted': return 'text-green-600';
    case 'rejected': return 'text-red-500';
    case 'ignored':  return 'text-muted-foreground';
    default:         return 'text-amber-500';
  }
}

// ── Entry row ─────────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <View className="border-b border-border py-3">
      <Pressable
        onPress={() => setOpen((p) => !p)}
        className="flex-row items-start gap-3 active:opacity-70"
      >
        <ActionIcon action={entry.officerAction} />
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground leading-snug">
            {entry.recommendationTitle}
          </Text>
          <View className="flex-row items-center gap-2 mt-0.5 flex-wrap">
            <Text className={`text-xs font-medium ${actionColor(entry.officerAction)}`}>
              {actionLabel(entry.officerAction)}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {entry.module.replace(/-/g, ' ')}
            </Text>
            {entry.firNumber && (
              <Text className="text-xs text-muted-foreground">FIR {entry.firNumber}</Text>
            )}
            <Text className="text-xs text-muted-foreground">
              {entry.timestamp.slice(0, 16).replace('T', ' ')}
            </Text>
          </View>
        </View>
        {open
          ? <ChevronUp size={14} className="text-muted-foreground" />
          : <ChevronDown size={14} className="text-muted-foreground" />}
      </Pressable>

      {open && (
        <View className="mt-3 gap-2 pl-5">
          {[
            { label: 'Reason',  value: entry.recommendationReason },
            { label: 'Context', value: entry.supportingContext },
            { label: 'Rule',    value: entry.applicableRule },
          ].map(({ label, value }) =>
            value ? (
              <View key={label}>
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Text>
                <Text className="text-xs text-foreground mt-0.5 leading-relaxed">{value}</Text>
              </View>
            ) : null
          )}
          <View>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confidence</Text>
            <Text className="text-xs text-foreground mt-0.5">{entry.confidence}%</Text>
          </View>
          {entry.officerActionAt && (
            <View>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Taken At</Text>
              <Text className="text-xs text-foreground mt-0.5">{entry.officerActionAt.slice(0,16).replace('T',' ')}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const ACTION_FILTERS: Array<{ label: string; value: OfficerAction | 'pending' | 'all' }> = [
  { label: 'All',      value: 'all' },
  { label: 'Pending',  value: 'pending' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Ignored',  value: 'ignored' },
  { label: 'Rejected', value: 'rejected' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onRefresh: () => void;
  report: AIAuditReport | null;
  isLoading: boolean;
}

export function AuditLogPanel({ visible, onClose, onRefresh, report, isLoading }: Props) {
  const [filterAction, setFilterAction] = useState<'all' | OfficerAction | 'pending'>('all');

  const entries = (report?.entries ?? []).filter((e) =>
    filterAction === 'all' ? true : e.officerAction === filterAction
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ paddingBottom: NAV_BAR_INSET }} className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <View>
            <Text className="text-lg font-semibold text-foreground">AI Audit Log</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {report?.totalEntries ?? 0} entries · {report?.acceptanceRate ?? 0}% acceptance
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

        {/* Stats row */}
        {report && (
          <View className="flex-row px-5 py-3 gap-4 border-b border-border">
            {[
              { label: 'Accepted', value: report.acceptedCount, cls: 'text-green-600' },
              { label: 'Ignored',  value: report.ignoredCount,  cls: 'text-muted-foreground' },
              { label: 'Rejected', value: report.rejectedCount, cls: 'text-red-500' },
              { label: 'Pending',  value: report.pendingCount,  cls: 'text-amber-500' },
            ].map(({ label, value, cls }) => (
              <View key={label} className="flex-1 items-center">
                <Text className={`text-xl font-bold ${cls}`}>{value}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Filter chips */}
        <View className="flex-row px-5 py-2 gap-2 border-b border-border">
          <Filter size={13} className="text-muted-foreground self-center" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {ACTION_FILTERS.map((f) => (
                <Pressable
                  key={f.value}
                  onPress={() => setFilterAction(f.value)}
                  className={`px-3 py-1 rounded-full border active:opacity-70 ${
                    filterAction === f.value ? 'bg-primary border-primary' : 'bg-muted border-border'
                  }`}
                >
                  <Text className={`text-xs font-medium ${filterAction === f.value ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center gap-3">
            <RefreshCw size={20} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">Loading audit log…</Text>
          </View>
        ) : entries.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <ClipboardList size={32} className="text-muted-foreground" />
            <Text className="text-base font-medium text-foreground text-center">No Audit Entries</Text>
            <Text className="text-sm text-muted-foreground text-center leading-relaxed">
              AI activity will be recorded here as recommendations are surfaced.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              className="flex-1 px-5"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
            >
              {entries.map((e) => <EntryRow key={e.id} entry={e} />)}
            </ScrollView>

            {/* Advisory */}
            <View className="px-5 py-3 border-t border-border">
              <Text className="text-xs text-muted-foreground text-center">
                ⚖️ Audit log is read-only. AI never modifies investigation records.
              </Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

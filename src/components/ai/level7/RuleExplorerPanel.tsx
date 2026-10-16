/**
 * RuleExplorerPanel.tsx
 * Level-7: Rule Engine Studio — violations, passed rules, compliance %.
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ShieldCheck, ShieldX, Info, ChevronDown, ChevronRight } from 'lucide-react-native';
import { L7PanelShell } from './L7PanelShell';
import type { RuleEngineReport, RuleViolation } from '../../../ai/level7/L7Types';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onRefresh?: () => void;
  loading?: boolean;
  report?:  RuleEngineReport;
}

function ViolationCard({ v }: { v: RuleViolation }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="border border-border rounded-xl overflow-hidden">
      <Pressable
        onPress={() => setOpen((x) => !x)}
        className="flex-row items-center gap-3 px-4 py-3 active:opacity-70"
      >
        <ShieldX size={15} className={v.severity === 'critical' ? 'text-destructive' : 'text-muted-foreground'} />
        <View className="flex-1">
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>{v.ruleTitle}</Text>
          <Text className="text-xs text-muted-foreground">{v.category} · Priority {v.priority}</Text>
        </View>
        {open ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />}
      </Pressable>

      {open && (
        <View className="px-4 pb-4 gap-2 border-t border-border pt-3">
          <Text className="text-xs text-muted-foreground">{v.reasoning}</Text>
          <Text className="text-xs text-foreground">{v.explanation}</Text>
          <Text className="text-xs font-medium text-foreground mt-1">→ {v.recommendation}</Text>
          {v.legalReference && (
            <Text className="text-xs text-muted-foreground italic">{v.legalReference}</Text>
          )}
        </View>
      )}
    </View>
  );
}

export function RuleExplorerPanel({ visible, onClose, onRefresh, loading, report }: Props) {
  return (
    <L7PanelShell
      visible={visible} title="Rule Explorer"
      subtitle="Legal compliance rule evaluation"
      onClose={onClose} onRefresh={onRefresh} loading={loading}
    >
      {!report ? (
        <Text className="text-sm text-muted-foreground">No rule data available.</Text>
      ) : (
        <>
          {/* Compliance score */}
          <View className="flex-row items-center gap-6 py-3">
            <View className="items-center">
              <Text className="text-3xl font-bold text-foreground">{report.overallCompliance}%</Text>
              <Text className="text-xs text-muted-foreground">Compliance</Text>
            </View>
            <View className="flex-row gap-4">
              <View className="items-center">
                <Text className="text-xl font-semibold text-destructive">{report.firedRules}</Text>
                <Text className="text-xs text-muted-foreground">Violations</Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-semibold text-foreground">{report.passedRules}</Text>
                <Text className="text-xs text-muted-foreground">Passed</Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-semibold text-muted-foreground">{report.enabledRules}</Text>
                <Text className="text-xs text-muted-foreground">Active Rules</Text>
              </View>
            </View>
          </View>

          {/* Violations */}
          {report.violations.length > 0 ? (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Rule Violations ({report.violations.length})
              </Text>
              {report.violations.map((v) => (
                <ViolationCard key={v.ruleId} v={v} />
              ))}
            </View>
          ) : (
            <View className="flex-row gap-2 items-center py-2">
              <ShieldCheck size={16} className="text-foreground" />
              <Text className="text-sm text-foreground">All rules passed. No violations detected.</Text>
            </View>
          )}

          {/* Passed rules summary */}
          {report.passed.length > 0 && (
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Passed ({report.passed.length})
              </Text>
              {report.passed.map((p) => (
                <View key={p.ruleId} className="flex-row gap-2 items-center">
                  <ShieldCheck size={12} className="text-muted-foreground" />
                  <Text className="text-xs text-muted-foreground">{p.ruleTitle}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </L7PanelShell>
  );
}

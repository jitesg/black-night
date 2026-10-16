/**
 * CourtReadinessPanel.tsx
 * Level-7: Court Readiness — hearing countdown, checklist, warrants/summons.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { L7PanelShell } from './L7PanelShell';
import type { CourtReadinessReport } from '../../../ai/level7/L7Types';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onRefresh?: () => void;
  loading?: boolean;
  report?:  CourtReadinessReport;
}

function ItemIcon({ done, priority }: { done: boolean; priority: string }) {
  if (done) return <CheckCircle size={14} className="text-foreground" />;
  if (priority === 'critical') return <XCircle size={14} className="text-destructive" />;
  return <AlertCircle size={14} className="text-muted-foreground" />;
}

export function CourtReadinessPanel({ visible, onClose, onRefresh, loading, report }: Props) {
  return (
    <L7PanelShell
      visible={visible} title="Court Readiness"
      subtitle="Preparation checklist for next hearing"
      onClose={onClose} onRefresh={onRefresh} loading={loading}
    >
      {!report ? (
        <Text className="text-sm text-muted-foreground">No court readiness data available.</Text>
      ) : (
        <>
          {/* Score + hearing countdown */}
          <View className="flex-row items-center justify-between py-3">
            <View>
              <Text className="text-2xl font-bold text-foreground">{report.score}%</Text>
              <Text className="text-xs text-muted-foreground">Court Readiness</Text>
            </View>
            {report.nextHearing && (
              <View className="items-end gap-0.5">
                <View className="flex-row gap-1.5 items-center">
                  <Calendar size={13} className="text-muted-foreground" />
                  <Text className="text-xs text-muted-foreground">Next hearing</Text>
                </View>
                <Text className="text-sm font-semibold text-foreground">{report.nextHearing}</Text>
                {report.daysToHearing !== undefined && (
                  <Text className={`text-xs font-semibold ${report.daysToHearing <= 3 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {report.daysToHearing <= 0 ? 'Today / Passed' : `${report.daysToHearing} day(s) away`}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Critical issues */}
          {report.criticalIssues.length > 0 && (
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Critical</Text>
              {report.criticalIssues.map((issue, i) => (
                <Text key={i} className="text-xs text-destructive">{issue}</Text>
              ))}
            </View>
          )}

          {/* Warrants / summons summary */}
          {(report.warrants.length > 0 || report.summons.length > 0) && (
            <View className="flex-row gap-4">
              {report.warrants.length > 0 && (
                <View>
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Warrants</Text>
                  {report.warrants.map((w, i) => (
                    <Text key={i} className="text-xs text-destructive">{w}</Text>
                  ))}
                </View>
              )}
              {report.summons.length > 0 && (
                <View>
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summons</Text>
                  {report.summons.map((s, i) => (
                    <Text key={i} className="text-xs text-muted-foreground">{s}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Checklist */}
          <View className="gap-3">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preparation Checklist</Text>
            {report.checklist.map((item) => (
              <View key={item.id} className="flex-row gap-3 items-start">
                <ItemIcon done={item.done} priority={item.priority} />
                <View className="flex-1">
                  <Text className="text-sm text-foreground">{item.title}</Text>
                  {!item.done && item.action && (
                    <Text className="text-xs text-muted-foreground mt-0.5">{item.action}</Text>
                  )}
                  {item.daysLeft !== undefined && item.daysLeft <= 3 && (
                    <Text className="text-xs text-destructive mt-0.5">
                      {item.daysLeft <= 0 ? 'Deadline passed' : `${item.daysLeft} day(s) left`}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </L7PanelShell>
  );
}

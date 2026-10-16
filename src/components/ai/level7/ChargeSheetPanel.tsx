/**
 * ChargeSheetPanel.tsx
 * Level-7: Charge Sheet Validator — readiness checklist with status.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react-native';
import { L7PanelShell } from './L7PanelShell';
import type { ChargeSheetValidatorReport, L7ReadyState } from '../../../ai/level7/L7Types';

interface Props {
  visible:  boolean;
  onClose:  () => void;
  onRefresh?: () => void;
  loading?: boolean;
  report?:  ChargeSheetValidatorReport;
}

function ReadyBadge({ state }: { state: L7ReadyState }) {
  const map = {
    'Ready':           { label: 'Ready',           cls: 'bg-foreground' },
    'Partially Ready': { label: 'Partially Ready', cls: 'bg-muted' },
    'Not Ready':       { label: 'Not Ready',       cls: 'bg-destructive' },
  };
  const { label, cls } = map[state];
  return (
    <View className={`px-3 py-1 rounded-full ${cls}`}>
      <Text className="text-xs font-semibold text-background">{label}</Text>
    </View>
  );
}

function CheckIcon({ status }: { status: string }) {
  if (status === 'Complete')      return <CheckCircle size={15} className="text-foreground" />;
  if (status === 'Missing')       return <XCircle size={15} className="text-destructive" />;
  if (status === 'Not Required')  return <Clock size={15} className="text-muted-foreground" />;
  return <AlertCircle size={15} className="text-muted-foreground" />;
}

export function ChargeSheetPanel({ visible, onClose, onRefresh, loading, report }: Props) {
  return (
    <L7PanelShell
      visible={visible} title="Charge Sheet Validator"
      subtitle="Mandatory document checklist"
      onClose={onClose} onRefresh={onRefresh} loading={loading}
    >
      {!report ? (
        <Text className="text-sm text-muted-foreground">No validation data available.</Text>
      ) : (
        <>
          {/* Readiness header */}
          <View className="flex-row items-center justify-between py-3">
            <View>
              <Text className="text-2xl font-bold text-foreground">{report.overallScore}%</Text>
              <Text className="text-xs text-muted-foreground">Charge Sheet Readiness</Text>
            </View>
            <ReadyBadge state={report.readyState} />
          </View>

          {report.estimatedDaysToReady > 0 && (
            <Text className="text-xs text-muted-foreground">
              Estimated {report.estimatedDaysToReady} day(s) to fully ready
            </Text>
          )}

          {/* Checklist */}
          <View className="gap-3">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Checklist</Text>
            {report.checks.map((c) => (
              <View key={c.id} className="flex-row gap-3 items-start">
                <CheckIcon status={c.status} />
                <View className="flex-1">
                  <Text className="text-sm text-foreground">{c.title}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">{c.explanation}</Text>
                  {c.legalBasis && (
                    <Text className="text-xs text-muted-foreground mt-0.5 italic">{c.legalBasis}</Text>
                  )}
                </View>
                {c.mandatory && c.status === 'Missing' && (
                  <View className="bg-destructive/10 px-1.5 py-0.5 rounded">
                    <Text className="text-xs text-destructive">Mandatory</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Required</Text>
              {report.recommendations.slice(0, 4).map((r, i) => (
                <Text key={i} className="text-xs text-foreground">• {r}</Text>
              ))}
            </View>
          )}
        </>
      )}
    </L7PanelShell>
  );
}

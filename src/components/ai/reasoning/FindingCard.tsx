/**
 * FindingCard.tsx
 * Compact card for a single reasoning Finding.
 * Expandable: tap to reveal detail, recommendation, legal reference, modules.
 * Minimal theme — whitespace-driven, severity shown by a thin left border + badge.
 */

import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  Shield,
  XCircle,
} from 'lucide-react-native';
import type { Finding } from '@/ai/reasoning/ReasoningTypes';

interface Props {
  finding: Finding;
}

// ── Severity helpers ──────────────────────────────────────────────────────────

function severityColors(sev: Finding['severity']) {
  switch (sev) {
    case 'critical': return { border: 'border-l-destructive', bg: 'bg-red-50',    badge: 'bg-red-100 text-destructive',  text: 'text-destructive'  };
    case 'high':     return { border: 'border-l-orange-500',  bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', text: 'text-orange-700'   };
    case 'medium':   return { border: 'border-l-amber-400',   bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700',   text: 'text-amber-700'    };
    case 'low':      return { border: 'border-l-slate-300',   bg: 'bg-slate-50',  badge: 'bg-slate-100 text-slate-600',   text: 'text-slate-600'    };
    default:         return { border: 'border-l-blue-300',    bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-600',     text: 'text-blue-600'     };
  }
}

function SeverityIcon({ sev }: { sev: Finding['severity'] }) {
  const cls = severityColors(sev).text;
  switch (sev) {
    case 'critical': return <XCircle size={13} className={cls} />;
    case 'high':     return <AlertTriangle size={13} className={cls} />;
    case 'medium':   return <AlertTriangle size={13} className={cls} />;
    default:         return <Info size={13} className={cls} />;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FindingCard({ finding }: Props) {
  const [expanded, setExpanded] = useState(false);
  const c = severityColors(finding.severity);

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      className={`mb-2 rounded-xl border-l-4 ${c.border} ${c.bg} overflow-hidden active:opacity-80`}
      style={{ borderCurve: 'continuous' } as object}
    >
      {/* Header row */}
      <View className="flex-row items-start gap-2 px-3 pt-3 pb-2.5">
        <View className="mt-0.5">
          <SeverityIcon sev={finding.severity} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5 flex-wrap mb-0.5">
            <View className={`px-1.5 py-0.5 rounded-full ${c.badge.split(' ')[0]}`}>
              <Text className={`text-xs font-semibold ${c.badge.split(' ')[1]}`}>
                {finding.severity.toUpperCase()}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">{finding.ruleId}</Text>
          </View>
          <Text className="text-sm font-semibold text-foreground leading-snug">{finding.title}</Text>
        </View>
        <View className="mt-0.5">
          {expanded
            ? <ChevronUp size={13} className="text-muted-foreground" />
            : <ChevronDown size={13} className="text-muted-foreground" />}
        </View>
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View className="px-3 pb-3 gap-2 border-t border-border/30 pt-2">
          {/* Detail */}
          <Text className="text-xs text-muted-foreground leading-relaxed">{finding.detail}</Text>

          {/* Recommendation */}
          <View className="flex-row items-start gap-1.5 bg-white/60 rounded-lg px-2.5 py-2">
            <Shield size={11} className="text-emerald-600 mt-0.5" />
            <View className="flex-1">
              <Text className="text-xs font-semibold text-emerald-700 mb-0.5">Recommendation</Text>
              <Text className="text-xs text-foreground leading-relaxed">{finding.recommendation}</Text>
            </View>
          </View>

          {/* Legal reference */}
          {finding.legalReference && (
            <View className="flex-row items-center gap-1.5">
              <FileText size={11} className="text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">{finding.legalReference}</Text>
            </View>
          )}

          {/* Modules analysed */}
          {finding.modulesAnalysed.length > 0 && (
            <View className="flex-row flex-wrap gap-1">
              {finding.modulesAnalysed.map((m) => (
                <View key={m} className="bg-white/70 rounded-full border border-border/40 px-2.5 py-1">
                  <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{m}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

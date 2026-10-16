/**
 * DecisionCardView.tsx
 * Expandable card for a single DecisionCard from the ReasoningEngine.
 * Shows: type badge, title, summary, blocking indicator, item list.
 * Expanded: full explanation — why, evidence, rules triggered, legal basis, confidence.
 * Minimal theme — generous whitespace, severity left-border, no decorative graphics.
 */

import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  Gavel,
  Info,
  ListChecks,
  Lock,
  Shield,
  XCircle,
} from 'lucide-react-native';
import type { DecisionCard } from '@/ai/reasoning/ReasoningTypes';

interface Props {
  card: DecisionCard;
}

// ── Type label + icon ─────────────────────────────────────────────────────────

function cardTypeMeta(type: DecisionCard['type']): { label: string; icon: React.ReactNode } {
  switch (type) {
    case 'next-step':             return { label: 'Next Step',           icon: <ArrowRight  size={12} /> };
    case 'critical-evidence':     return { label: 'Critical Evidence',   icon: <AlertTriangle size={12} /> };
    case 'pending-statements':    return { label: 'Pending Statements',  icon: <ListChecks  size={12} /> };
    case 'court-action':          return { label: 'Court Action',        icon: <Gavel       size={12} /> };
    case 'recommended-documents': return { label: 'Documents',           icon: <FileText    size={12} /> };
    case 'investigation-risk':    return { label: 'Investigation Risk',  icon: <Shield      size={12} /> };
    case 'compliance-gap':        return { label: 'Compliance Gap',      icon: <Info        size={12} /> };
  }
}

// ── Severity colors ───────────────────────────────────────────────────────────

function cardColors(sev: DecisionCard['severity']) {
  switch (sev) {
    case 'critical': return { border: 'border-l-destructive', bg: 'bg-red-50',    badge: 'bg-red-100',    badgeText: 'text-destructive'  };
    case 'high':     return { border: 'border-l-orange-500',  bg: 'bg-orange-50', badge: 'bg-orange-100', badgeText: 'text-orange-700'   };
    case 'medium':   return { border: 'border-l-amber-400',   bg: 'bg-amber-50',  badge: 'bg-amber-100',  badgeText: 'text-amber-700'    };
    default:         return { border: 'border-l-slate-300',   bg: 'bg-slate-50',  badge: 'bg-slate-100',  badgeText: 'text-slate-600'    };
  }
}

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const barColor = value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-400' : 'bg-destructive';
  return (
    <View className="gap-0.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">AI Confidence</Text>
        <Text className="text-xs font-semibold text-foreground">{value}%</Text>
      </View>
      <View className="h-1 bg-muted rounded-full overflow-hidden">
        <View className={`h-full rounded-full ${barColor}`} style={{ width: `${value}%` }} />
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DecisionCardView({ card }: Props) {
  const [expanded, setExpanded] = useState(false);
  const c = cardColors(card.severity);
  const meta = cardTypeMeta(card.type);

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      className={`mb-3 rounded-2xl border-l-4 ${c.border} ${c.bg} overflow-hidden active:opacity-80`}
      style={{ borderCurve: 'continuous' } as object}
    >
      {/* Header */}
      <View className="px-3 pt-3 pb-2.5 gap-1.5">
        {/* Type badge + blocking indicator */}
        <View className="flex-row items-center gap-1.5 flex-wrap">
          <View className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full ${c.badge}`}>
            <View className={c.badgeText}>{meta.icon}</View>
            <Text className={`text-xs font-semibold ${c.badgeText}`}>{meta.label}</Text>
          </View>
          {card.isBlocking && (
            <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10">
              <Lock size={10} className="text-destructive" />
              <Text className="text-xs font-medium text-destructive">Blocking</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <View className="flex-row items-start justify-between gap-2">
          <Text className="text-sm font-semibold text-foreground flex-1 leading-snug">{card.title}</Text>
          {expanded
            ? <ChevronUp size={14} className="text-muted-foreground mt-0.5" />
            : <ChevronDown size={14} className="text-muted-foreground mt-0.5" />}
        </View>

        {/* Summary */}
        <Text className="text-xs text-muted-foreground leading-relaxed" numberOfLines={expanded ? undefined : 2}>
          {card.summary}
        </Text>
      </View>

      {/* Item list (always visible, max 3 collapsed) */}
      {card.items.length > 0 && (
        <View className="px-3 pb-2.5 gap-1">
          {(expanded ? card.items : card.items.slice(0, 3)).map((item, i) => (
            <View key={i} className="flex-row items-start gap-2">
              <Text className="text-xs text-muted-foreground mt-0.5">•</Text>
              <Text className="text-xs text-foreground flex-1 leading-relaxed">{item}</Text>
            </View>
          ))}
          {!expanded && card.items.length > 3 && (
            <Text className="text-xs text-muted-foreground">+{card.items.length - 3} more — tap to expand</Text>
          )}
        </View>
      )}

      {/* Expanded explanation section */}
      {expanded && (
        <View className="px-3 pb-3 pt-2 border-t border-border/30 gap-3">
          {/* Why this recommendation */}
          <View className="gap-1">
            <Text className="text-xs font-semibold text-foreground">Why this recommendation?</Text>
            <Text className="text-xs text-muted-foreground leading-relaxed">{card.explanation.whyThisRecommendation}</Text>
          </View>

          {/* Supporting evidence */}
          {card.explanation.supportingEvidence.length > 0 && (
            <View className="gap-1">
              <Text className="text-xs font-semibold text-foreground">Supporting Evidence</Text>
              {card.explanation.supportingEvidence.map((e, i) => (
                <View key={i} className="flex-row items-start gap-1.5">
                  <Text className="text-xs text-muted-foreground mt-0.5">·</Text>
                  <Text className="text-xs text-muted-foreground flex-1">{e}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Rules triggered */}
          {card.explanation.triggeredRules.length > 0 && (
            <View className="gap-1">
              <Text className="text-xs font-semibold text-foreground">Rules Triggered</Text>
              <View className="flex-row flex-wrap gap-1">
                {card.explanation.triggeredRules.map((r) => (
                  <View key={r} className="px-2 py-0.5 bg-white/60 rounded-full border border-border/30">
                    <Text className="text-xs text-muted-foreground">{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Legal basis */}
          {card.explanation.legalBasis && (
            <View className="flex-row items-start gap-1.5">
              <BookOpen size={11} className="text-muted-foreground mt-0.5" />
              <Text className="text-xs text-muted-foreground flex-1">{card.explanation.legalBasis}</Text>
            </View>
          )}

          {/* Modules analysed */}
          {card.explanation.modulesAnalysed.length > 0 && (
            <View className="flex-row flex-wrap gap-1">
              {card.explanation.modulesAnalysed.map((m) => (
                <View key={m} className="px-2 py-0.5 bg-white/50 rounded-full border border-border/20">
                  <Text className="text-xs text-muted-foreground">{m}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Confidence */}
          <ConfidenceBar value={card.explanation.confidence.value} />

          {/* Missing info */}
          {card.explanation.confidence.missingInformation.length > 0 && (
            <View className="gap-1">
              <Text className="text-xs font-medium text-muted-foreground">Missing Information</Text>
              {card.explanation.confidence.missingInformation.slice(0, 3).map((m, i) => (
                <Text key={i} className="text-xs text-muted-foreground">· {m}</Text>
              ))}
            </View>
          )}

          {/* Advisory disclaimer */}
          <View className="bg-white/50 rounded-lg px-3 py-2">
            <Text className="text-xs text-muted-foreground italic">
              Advisory only — the Investigating Officer remains the final decision maker.
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

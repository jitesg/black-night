/**
 * VisualDecisionCard.tsx
 * Single decision card: 🟢 Healthy / 🟡 Pending / 🔴 Critical
 * Shows Priority, Confidence %, Reason, Action, Impact.
 * Minimal design — whitespace, clear typographic hierarchy, no decorative shadows.
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react-native';
import type { SmartRecommendation, IntelSeverity, IntelPriority } from '@/ai/intelligence/IntelligenceTypes';

// ── Status helpers ─────────────────────────────────────────────────────────────

function statusFromSeverity(s: IntelSeverity): 'critical' | 'pending' | 'healthy' {
  if (s === 'critical' || s === 'high') return 'critical';
  if (s === 'medium') return 'pending';
  return 'healthy';
}

const STATUS_CONFIG = {
  critical: { emoji: '🔴', label: 'Critical', bg: '#fef2f2', border: '#fecaca', text: '#dc2626', Icon: AlertTriangle },
  pending:  { emoji: '🟡', label: 'Pending',  bg: '#fffbeb', border: '#fde68a', text: '#d97706', Icon: Clock         },
  healthy:  { emoji: '🟢', label: 'Healthy',  bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', Icon: CheckCircle2  },
};

const PRIORITY_LABELS: Record<IntelPriority, string> = {
  urgent: 'Urgent',
  high:   'High',
  medium: 'Medium',
  low:    'Low',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  recommendation: SmartRecommendation;
  index?: number;
}

export function VisualDecisionCard({ recommendation: rec, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const status = statusFromSeverity(rec.severity);
  const cfg    = STATUS_CONFIG[status];
  const Icon   = cfg.Icon;

  return (
    <View
      className="mb-3 rounded-2xl overflow-hidden border"
      style={{ backgroundColor: cfg.bg, borderColor: cfg.border, borderCurve: 'continuous' } as object}
    >
      {/* Header row */}
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="px-4 pt-3 pb-3 active:opacity-80"
      >
        <View className="flex-row items-start gap-3">
          {/* Status icon */}
          <View className="mt-0.5">
            <Icon size={16} color={cfg.text} />
          </View>

          {/* Main content */}
          <View className="flex-1">
            <View className="flex-row items-center gap-2 flex-wrap mb-1">
              <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.text }}>
                {cfg.label}
              </Text>
              <View className="px-1.5 py-0.5 rounded-full bg-white/60">
                <Text className="text-xs font-medium" style={{ color: cfg.text }}>
                  {PRIORITY_LABELS[rec.priority]}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground ml-auto">
                {rec.confidencePct}% confidence
              </Text>
            </View>

            {/* Title */}
            <Text className="text-sm font-semibold text-foreground leading-5">
              {index !== undefined ? `${index + 1}. ` : ''}{rec.title}
            </Text>

            {/* Reason — always visible */}
            <Text className="text-xs text-muted-foreground mt-1 leading-4" numberOfLines={expanded ? undefined : 2}>
              {rec.reason}
            </Text>
          </View>

          {/* Expand chevron */}
          <View className="mt-0.5">
            {expanded
              ? <ChevronUp size={14} color={cfg.text} />
              : <ChevronDown size={14} color={cfg.text} />}
          </View>
        </View>
      </Pressable>

      {/* Expanded explainability section */}
      {expanded && (
        <View className="px-4 pb-4 gap-3 border-t" style={{ borderColor: cfg.border }}>
          {/* Supporting Context */}
          {rec.supportingContext ? (
            <View className="mt-3">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Supporting Context</Text>
              <Text className="text-xs text-foreground leading-4">{rec.supportingContext}</Text>
            </View>
          ) : null}

          {/* Applicable Rule */}
          {rec.applicableRule ? (
            <View>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Applicable Rule</Text>
              <Text className="text-xs text-foreground leading-4">{rec.applicableRule}</Text>
            </View>
          ) : null}

          {/* Dependencies */}
          {rec.dependencies.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Dependencies</Text>
              <View className="flex-row flex-wrap gap-1">
                {rec.dependencies.map((dep) => (
                  <View key={dep} className="px-2 py-0.5 rounded-full bg-white/70">
                    <Text className="text-xs text-muted-foreground">{dep}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Expected Outcome */}
          {rec.expectedOutcome ? (
            <View>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Expected Outcome</Text>
              <Text className="text-xs text-foreground leading-4">{rec.expectedOutcome}</Text>
            </View>
          ) : null}

          {/* Legal Reference */}
          {rec.legalReference ? (
            <View className="rounded-lg bg-white/60 px-3 py-2">
              <Text className="text-xs font-medium" style={{ color: cfg.text }}>{rec.legalReference}</Text>
            </View>
          ) : null}

          {/* Advisory footer */}
          <Text className="text-xs text-muted-foreground leading-4 mt-1">
            ⚖️ Advisory only. Action requires officer confirmation.
          </Text>
        </View>
      )}
    </View>
  );
}

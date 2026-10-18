/**
 * VisualDecisionCard.tsx
 * Single decision card: 🟢 Healthy / 🟡 Pending / 🔴 Critical
 * Shows Priority, Confidence %, Reason, Action, Impact.
 * Minimal design — whitespace, clear typographic hierarchy, no decorative shadows.
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, CheckCircle, XCircle } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import type { SmartRecommendation, IntelSeverity, IntelPriority } from '@/ai/intelligence/IntelligenceTypes';
import { AIAuditEngine } from '@/ai/level5/AIAuditEngine';
import { LearningEngine } from '@/ai/level5/LearningEngine';

// ── Status helpers ─────────────────────────────────────────────────────────────

function statusFromSeverity(s: IntelSeverity): 'critical' | 'pending' | 'healthy' {
  if (s === 'critical' || s === 'high') return 'critical';
  if (s === 'medium') return 'pending';
  return 'healthy';
}

const getStatusConfig = (isDark: boolean) => ({
  critical: {
    emoji: '🔴', label: 'Critical',
    bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
    border: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
    text: isDark ? '#f87171' : '#dc2626',
    Icon: AlertTriangle,
  },
  pending: {
    emoji: '🟡', label: 'Pending',
    bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
    border: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
    text: isDark ? '#fbbf24' : '#d97706',
    Icon: Clock,
  },
  healthy: {
    emoji: '🟢', label: 'Healthy',
    bg: isDark ? 'rgba(34, 197, 94, 0.15)' : '#f0fdf4',
    border: isDark ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0',
    text: isDark ? '#4ade80' : '#16a34a',
    Icon: CheckCircle2,
  },
});

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
  auditEntryId?: string;
  crimeType?: string;
}

export function VisualDecisionCard({ recommendation: rec, index, auditEntryId, crimeType }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [officerAction, setOfficerAction] = useState<'accepted' | 'rejected' | null>(null);
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';
  const status = statusFromSeverity(rec.severity);
  const cfg    = getStatusConfig(isDark)[status];
  const Icon   = cfg.Icon;

  const handleAction = (action: 'accepted' | 'rejected') => {
    if (auditEntryId) AIAuditEngine.updateAction(auditEntryId, action);
    LearningEngine.recordFeedback(rec.title, crimeType, rec.dependencies ?? [], action);
    setOfficerAction(action);
  };

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
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.6)' }}
              >
                <Text textBreakStrategy="simple" className="text-xs font-medium" style={{ color: cfg.text }}>
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

      {/* Officer action buttons / feedback confirmation */}
      <View className="px-4 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {officerAction === null ? (
            <>
              <Pressable
                onPress={() => handleAction('accepted')}
                className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg border active:opacity-70"
                style={{
                  borderColor: isDark ? 'rgba(34, 197, 94, 0.4)' : '#bbf7d0',
                  backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#f0fdf4',
                }}
              >
                <CheckCircle size={13} color={isDark ? '#4ade80' : '#16a34a'} />
                <Text className="text-xs font-medium" style={{ color: isDark ? '#4ade80' : '#16a34a' }}>
                  Accept
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleAction('rejected')}
                className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg border active:opacity-70"
                style={{
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#fecaca',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
                }}
              >
                <XCircle size={13} color={isDark ? '#f87171' : '#dc2626'} />
                <Text className="text-xs font-medium" style={{ color: isDark ? '#f87171' : '#dc2626' }}>
                  Not Relevant
                </Text>
              </Pressable>
            </>
          ) : (
            <Text className="text-xs text-muted-foreground">
              {officerAction === 'accepted' ? '✓ Accepted' : '✗ Marked not relevant'}
            </Text>
          )}
        </View>
      </View>

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
                  <View
                    key={dep}
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)' }}
                  >
                    <Text textBreakStrategy="simple" className="text-xs text-muted-foreground">{dep}</Text>
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
            <View
              className="rounded-lg px-3 py-2"
              style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.6)' }}
            >
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

/**
 * InvestigationSummaryCard — MD3 Minimal compact FIR context card.
 * Auto-shown at top of AI Copilot when a FIR is in context.
 * Collapsible: compact health row by default, full next-actions on expand.
 */

import React, { memo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Activity, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Clock, FileText, Shield, Zap,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { T } from '@/lib/typography';
import type { InvestigationContext } from '@/ai/InvestigationContext';
import type { NextActionReport } from '@/ai/NextActionEngine';

interface Props {
  ctx: InvestigationContext;
  report: NextActionReport;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function gradeColor(grade: string, isDark: boolean): string {
  if (grade === 'A' || grade === 'B') return isDark ? '#4ADE80' : '#16A34A';
  if (grade === 'C') return isDark ? '#FBBF24' : '#D97706';
  if (grade === 'D') return isDark ? '#FB923C' : '#EA580C';
  return isDark ? '#F87171' : '#DC2626';
}

function gradeBg(grade: string, isDark: boolean): string {
  if (grade === 'A' || grade === 'B') return isDark ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4';
  if (grade === 'C') return isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB';
  if (grade === 'D') return isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED';
  return isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2';
}

function gradeBorder(grade: string, isDark: boolean): string {
  if (grade === 'A' || grade === 'B') return isDark ? 'rgba(34, 197, 94, 0.3)' : '#BBF7D0';
  if (grade === 'C') return isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A';
  if (grade === 'D') return isDark ? 'rgba(234, 88, 12, 0.3)' : '#FED7AA';
  return isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ count, type }: { count: number; type: 'done' | 'pending' | 'critical' }) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const cfg = {
    done: isDark
      ? { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)', text: '#86EFAC', label: t('ai.done') }
      : { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A', label: t('ai.done') },
    pending: isDark
      ? { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', text: '#FDE68A', label: t('ai.pending') }
      : { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', label: t('ai.pending') },
    critical: isDark
      ? { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#FCA5A5', label: t('ai.critical') }
      : { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', label: t('ai.critical') },
  }[type];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border }}>
      <Text style={{ ...T.caption1, fontWeight: '700', color: cfg.text }}>{count}</Text>
      <Text style={{ ...T.caption2, color: cfg.text }}>{cfg.label}</Text>
    </View>
  );
}

function NextActionRow({ action }: { action: import('@/ai/InvestigationContext').NextAction }) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';
  const isOverdue = (action.daysRemaining ?? 0) < 0;
  const isDue = action.daysRemaining === 0;
  // semantic status row backgrounds with dark mode variants
  const bg = action.priority === 'critical'
    ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2')
    : action.priority === 'high'
      ? (isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED')
      : C.muted;
  const border = action.priority === 'critical'
    ? (isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA')
    : action.priority === 'high'
      ? (isDark ? 'rgba(234, 88, 12, 0.3)' : '#FED7AA')
      : C.border;
  const dot = action.priority === 'critical'
    ? (isDark ? '#F87171' : '#DC2626')
    : action.priority === 'high'
      ? (isDark ? '#FB923C' : '#EA580C')
      : action.priority === 'medium'
        ? (isDark ? '#FBBF24' : '#D97706')
        : C.mutedForeground;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot, marginTop: 5, flexShrink: 0 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...T.caption1, fontWeight: '600', color: C.foreground }} numberOfLines={2}>{action.title}</Text>
        {action.daysRemaining !== undefined && (
          <Text style={{ ...T.caption2, color: isOverdue ? (isDark ? '#F87171' : '#DC2626') : isDue ? (isDark ? '#FBBF24' : '#D97706') : C.mutedForeground, marginTop: 2 }}>
            {isOverdue ? t('ai.daysOverdue', { count: Math.abs(action.daysRemaining) }) : isDue ? t('ai.dueToday') : t('ai.dueInDays', { count: action.daysRemaining })}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const InvestigationSummaryCard = memo(function InvestigationSummaryCard({ ctx, report }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';
  const { caseHealth, caseReadiness } = report;
  const fir = ctx.fir;
  if (!fir) return null;

  const topActions = report.allActions
    .filter(a => a.priority === 'critical' || a.priority === 'high')
    .slice(0, 3);

  const statusPendingBg = isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB';
  const statusDoneBg = isDark ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4';
  const statusPendingText = isDark ? '#FDE68A' : '#D97706';
  const statusDoneText = isDark ? '#86EFAC' : '#16A34A';

  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 6,
      borderRadius: 14, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.card, overflow: 'hidden',
    }}>
      {/* FIR header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 }}>
        <FileText size={13} color={C.mutedForeground} />
        <Text style={{ ...T.footnote, fontWeight: '600', color: C.foreground, flex: 1 }} numberOfLines={1}>
          FIR {fir.fir_number}
        </Text>
        {/* status chip with dark mode variant */}
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: fir.status === 'Pending' ? statusPendingBg : statusDoneBg }}>
          <Text style={{ ...T.caption2, fontWeight: '600', color: fir.status === 'Pending' ? statusPendingText : statusDoneText }}>{fir.status}</Text>
        </View>
        <Pressable onPress={() => setExpanded(v => !v)} style={{ padding: 4 }} className="active:opacity-60">
          {expanded ? <ChevronUp size={14} color={C.mutedForeground} /> : <ChevronDown size={14} color={C.mutedForeground} />}
        </Pressable>
      </View>

      {/* Health row */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Activity size={12} color={C.mutedForeground} />
            <Text style={{ ...T.caption1, color: C.mutedForeground }}>{t('ai.investigationHealth')}</Text>
          </View>
          {/* grade badge */}
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: gradeBg(caseHealth.grade, isDark), borderWidth: 1, borderColor: gradeBorder(caseHealth.grade, isDark) }}>
            <Text style={{ ...T.caption1, fontWeight: '700', color: gradeColor(caseHealth.grade, isDark) }}>
              {caseHealth.score}/100 · {caseHealth.grade}
            </Text>
          </View>
        </View>

        {/* Progress bar — track uses muted surface */}
        <View style={{ height: 3, borderRadius: 2, backgroundColor: C.muted, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${caseHealth.score}%`, backgroundColor: gradeColor(caseHealth.grade, isDark), borderRadius: 2 }} />
        </View>

        {/* Status pills — semantic, fixed */}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <StatusPill count={caseHealth.completedItems} type="done" />
          <StatusPill count={caseHealth.pendingItems}   type="pending" />
          {caseHealth.criticalItems > 0 && <StatusPill count={caseHealth.criticalItems} type="critical" />}
        </View>
      </View>

      {/* Expanded section */}
      {expanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 10 }}>

          {topActions.length > 0 && (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Zap size={11} color={isDark ? '#FBBF24' : '#D97706'} />
                <Text style={{ ...T.caption1, fontWeight: '600', color: C.foreground }}>{t('ai.priorityActions')}</Text>
              </View>
              {topActions.map(a => <NextActionRow key={a.id} action={a} />)}
            </View>
          )}

          {/* Charge sheet readiness */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10,
            borderRadius: 10, borderWidth: 1,
            backgroundColor: caseReadiness.readyForChargeSheet ? (isDark ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4') : C.muted,
            borderColor:     caseReadiness.readyForChargeSheet ? (isDark ? 'rgba(34, 197, 94, 0.3)' : '#BBF7D0') : C.border,
          }}>
            {caseReadiness.readyForChargeSheet
              ? <CheckCircle size={13} color={isDark ? '#4ADE80' : '#16A34A'} />
              : <Clock size={13} color={C.mutedForeground} />}
            <View style={{ flex: 1 }}>
              <Text style={{ ...T.caption1, fontWeight: '600', color: caseReadiness.readyForChargeSheet ? (isDark ? '#86EFAC' : '#16A34A') : C.foreground }}>
                {t('ai.chargeSheetReady', { pct: caseReadiness.readinessScore })}
              </Text>
              {!caseReadiness.readyForChargeSheet && caseReadiness.blockers.length > 0 && (
                <Text style={{ ...T.caption2, color: C.mutedForeground, marginTop: 2 }} numberOfLines={2}>
                  {caseReadiness.blockers[0]}
                </Text>
              )}
            </View>
            {caseReadiness.readyForChargeSheet && <Shield size={13} color={isDark ? '#4ADE80' : '#16A34A'} />}
          </View>

          {/* Missing fields warning */}
          {ctx.confidence.missingFields.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={10} color={isDark ? '#FBBF24' : '#D97706'} />
              <Text style={{ ...T.caption2, color: C.mutedForeground, flex: 1 }} numberOfLines={2}>
                {t('ai.unavailable', { fields: ctx.confidence.missingFields.slice(0, 2).join(', ') })}
                {ctx.confidence.missingFields.length > 2 ? ` ${t('ai.moreCount', { count: ctx.confidence.missingFields.length - 2 })}` : ''}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

/**
 * InvestigationSummaryCard — MD3 Minimal compact FIR context card.
 * Auto-shown at top of AI Copilot when a FIR is in context.
 * Collapsible: compact health row by default, full next-actions on expand.
 */

import React, { memo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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

function gradeColor(grade: string): string {
  return grade === 'A' || grade === 'B' ? '#16A34A'
    : grade === 'C' ? '#D97706'
    : grade === 'D' ? '#EA580C'
    : '#DC2626';
}

function gradeBg(grade: string): string {
  return grade === 'A' || grade === 'B' ? '#F0FDF4'
    : grade === 'C' ? '#FFFBEB'
    : grade === 'D' ? '#FFF7ED'
    : '#FEF2F2';
}

function gradeBorder(grade: string): string {
  return grade === 'A' || grade === 'B' ? '#BBF7D0'
    : grade === 'C' ? '#FDE68A'
    : grade === 'D' ? '#FED7AA'
    : '#FECACA';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ count, type }: { count: number; type: 'done' | 'pending' | 'critical' }) {
  const cfg = {
    done:     { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A', label: 'Done' },
    pending:  { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', label: 'Pending' },
    critical: { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', label: 'Critical' },
  }[type];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border }}>
      <Text style={{ ...T.caption1, fontWeight: '700', color: cfg.text }}>{count}</Text>
      <Text style={{ ...T.caption2, color: cfg.text }}>{cfg.label}</Text>
    </View>
  );
}

function NextActionRow({ action }: { action: import('@/ai/InvestigationContext').NextAction }) {
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  const isOverdue = (action.daysRemaining ?? 0) < 0;
  const isDue = action.daysRemaining === 0;
  // semantic status row backgrounds — fixed for meaning, not surface
  const bg     = action.priority === 'critical' ? '#FEF2F2' : action.priority === 'high' ? '#FFF7ED' : colors.muted;
  const border = action.priority === 'critical' ? '#FECACA' : action.priority === 'high' ? '#FED7AA' : colors.border;
  const dot    = action.priority === 'critical' ? '#DC2626' : action.priority === 'high' ? '#EA580C' : action.priority === 'medium' ? '#D97706' : '#9CA3AF';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot, marginTop: 5, flexShrink: 0 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...T.caption1, fontWeight: '600', color: colors.foreground }} numberOfLines={2}>{action.title}</Text>
        {action.daysRemaining !== undefined && (
          <Text style={{ ...T.caption2, color: isOverdue ? '#DC2626' : isDue ? '#D97706' : colors.mutedForeground, marginTop: 2 }}>
            {isOverdue ? `${Math.abs(action.daysRemaining)}d overdue` : isDue ? 'Due today' : `Due in ${action.daysRemaining}d`}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const InvestigationSummaryCard = memo(function InvestigationSummaryCard({ ctx, report }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  const { caseHealth, caseReadiness } = report;
  const fir = ctx.fir;
  if (!fir) return null;

  const topActions = report.allActions
    .filter(a => a.priority === 'critical' || a.priority === 'high')
    .slice(0, 3);

  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 6,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card, overflow: 'hidden',
    }}>
      {/* FIR header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.muted, gap: 8 }}>
        <FileText size={13} color={colors.mutedForeground} />
        <Text style={{ ...T.footnote, fontWeight: '600', color: colors.foreground, flex: 1 }} numberOfLines={1}>
          FIR {fir.fir_number}
        </Text>
        {/* status chip — intentionally fixed semantic colors */}
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: fir.status === 'Pending' ? '#FFFBEB' : '#F0FDF4' }}>
          <Text style={{ ...T.caption2, fontWeight: '600', color: fir.status === 'Pending' ? '#D97706' : '#16A34A' }}>{fir.status}</Text>
        </View>
        <Pressable onPress={() => setExpanded(v => !v)} style={{ padding: 4 }} className="active:opacity-60">
          {expanded ? <ChevronUp size={14} color={colors.mutedForeground} /> : <ChevronDown size={14} color={colors.mutedForeground} />}
        </Pressable>
      </View>

      {/* Health row */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Activity size={12} color={colors.mutedForeground} />
            <Text style={{ ...T.caption1, color: colors.mutedForeground }}>Investigation Health</Text>
          </View>
          {/* grade badge — semantic accent, fixed */}
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, backgroundColor: gradeBg(caseHealth.grade), borderWidth: 1, borderColor: gradeBorder(caseHealth.grade) }}>
            <Text style={{ ...T.caption1, fontWeight: '700', color: gradeColor(caseHealth.grade) }}>
              {caseHealth.score}/100 · {caseHealth.grade}
            </Text>
          </View>
        </View>

        {/* Progress bar — track uses muted surface */}
        <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.muted, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${caseHealth.score}%`, backgroundColor: gradeColor(caseHealth.grade), borderRadius: 2 }} />
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
        <View style={{ paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.muted, paddingTop: 10, gap: 10 }}>

          {topActions.length > 0 && (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Zap size={11} color="#D97706" />
                <Text style={{ ...T.caption1, fontWeight: '600', color: colors.foreground }}>Priority Actions</Text>
              </View>
              {topActions.map(a => <NextActionRow key={a.id} action={a} />)}
            </View>
          )}

          {/* Charge sheet readiness */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10,
            borderRadius: 10, borderWidth: 1,
            backgroundColor: caseReadiness.readyForChargeSheet ? '#F0FDF4' : colors.muted,
            borderColor:     caseReadiness.readyForChargeSheet ? '#BBF7D0' : colors.border,
          }}>
            {caseReadiness.readyForChargeSheet
              ? <CheckCircle size={13} color="#16A34A" />
              : <Clock size={13} color={colors.mutedForeground} />}
            <View style={{ flex: 1 }}>
              <Text style={{ ...T.caption1, fontWeight: '600', color: caseReadiness.readyForChargeSheet ? '#16A34A' : colors.foreground }}>
                Charge Sheet: {caseReadiness.readinessScore}% ready
              </Text>
              {!caseReadiness.readyForChargeSheet && caseReadiness.blockers.length > 0 && (
                <Text style={{ ...T.caption2, color: colors.mutedForeground, marginTop: 2 }} numberOfLines={2}>
                  {caseReadiness.blockers[0]}
                </Text>
              )}
            </View>
            {caseReadiness.readyForChargeSheet && <Shield size={13} color="#16A34A" />}
          </View>

          {/* Missing fields warning */}
          {ctx.confidence.missingFields.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={10} color="#D97706" />
              <Text style={{ ...T.caption2, color: colors.mutedForeground, flex: 1 }} numberOfLines={2}>
                Unavailable: {ctx.confidence.missingFields.slice(0, 2).join(', ')}
                {ctx.confidence.missingFields.length > 2 ? ` +${ctx.confidence.missingFields.length - 2} more` : ''}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

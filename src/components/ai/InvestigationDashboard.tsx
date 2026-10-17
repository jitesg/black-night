/**
 * InvestigationDashboard — Compact collapsible info cards shown above chat
 * when a FIR is in context and messages list is empty.
 *
 * Cards: Pending Tasks · Recent FIRs · Court Deadlines ·
 *        Today's Activities · Investigation Checklist Progress
 *
 * UI-ONLY: reads from InvestigationContext + NextActionReport (already loaded
 * by AICopilotModal). Zero new data fetching, zero DB changes.
 */

import React, { memo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  CheckSquare, Clock, AlertTriangle, Activity,
  ChevronDown, ChevronUp, TrendingUp, CalendarClock, FileText,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import type { InvestigationContext } from '@/ai/InvestigationContext';
import type { NextActionReport } from '@/ai/NextActionEngine';

interface Props {
  ctx: InvestigationContext;
  report: NextActionReport;
}

// ── Tiny helpers ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  badge,
  badgeColor,
  children,
  defaultExpanded = false,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  title: string;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultExpanded);
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;

  return (
    <View style={{
      borderRadius: 14, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.card, overflow: 'hidden', marginBottom: 8,
    }}>
      <Pressable
        onPress={() => setOpen(v => !v)}
        accessibilityRole="button"
        accessibilityLabel={open ? t('ai.collapseSection', { title }) : t('ai.expandSection', { title })}
        className="active:opacity-70"
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 14, paddingVertical: 11,
          borderBottomWidth: open ? 1 : 0, borderBottomColor: C.border,
        }}
      >
        <View style={{
          width: 30, height: 30, borderRadius: 15,
          backgroundColor: C.muted,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color={C.mutedForeground} strokeWidth={2} />
        </View>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: C.foreground }}>
          {title}
        </Text>
        {badge ? (
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3,
            borderRadius: 10, backgroundColor: badgeColor ?? C.muted,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.mutedForeground }}>{badge}</Text>
          </View>
        ) : null}
        {open
          ? <ChevronUp size={14} color={C.mutedForeground} />
          : <ChevronDown size={14} color={C.mutedForeground} />}
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
          {children}
        </View>
      )}
    </View>
  );
}

function PriorityRow({
  label,
  detail,
  priority,
  daysRemaining,
}: {
  label: string;
  detail?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  daysRemaining?: number;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';
  const dotColor = priority === 'critical' ? (isDark ? '#F87171' : '#DC2626')
    : priority === 'high' ? (isDark ? '#FB923C' : '#EA580C')
    : priority === 'medium' ? (isDark ? '#FBBF24' : '#D97706') : C.mutedForeground;
  // semantic status backgrounds with dark-mode variants
  const bg = priority === 'critical'
    ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2')
    : priority === 'high'
      ? (isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFF7ED')
      : C.muted;
  const border = priority === 'critical'
    ? (isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA')
    : priority === 'high'
      ? (isDark ? 'rgba(234, 88, 12, 0.3)' : '#FED7AA')
      : C.border;
  const isOverdue = (daysRemaining ?? 0) < 0;
  const isDue     = daysRemaining === 0;

  return (
    <View style={{
      flexDirection: 'row', gap: 8, padding: 10,
      borderRadius: 10, backgroundColor: bg,
      borderWidth: 1, borderColor: border,
    }}>
      <View style={{
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: dotColor, marginTop: 6, flexShrink: 0,
      }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: C.foreground }} numberOfLines={2}>
          {label}
        </Text>
        {detail ? (
          <Text style={{ fontSize: 11, color: C.mutedForeground, marginTop: 2 }} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
        {daysRemaining !== undefined && (
          <Text style={{
            fontSize: 11, color: isOverdue ? (isDark ? '#F87171' : '#DC2626') : isDue ? (isDark ? '#FBBF24' : '#D97706') : C.mutedForeground,
            marginTop: 2,
          }}>
            {isOverdue
              ? t('ai.daysOverdue', { count: Math.abs(daysRemaining) })
              : isDue ? t('ai.dueToday')
              : t('ai.dueInDays', { count: daysRemaining })}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: C.muted, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export const InvestigationDashboard = memo(function InvestigationDashboard({ ctx, report }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';
  const { caseHealth, caseReadiness, allActions } = report;
  const fir = ctx.fir;
  if (!fir) return null;

  const pendingActions  = allActions.filter(a => a.priority === 'critical' || a.priority === 'high');
  const criticalCount   = allActions.filter(a => a.priority === 'critical').length;
  // gradeColor is a semantic accent tied to score grade with dark-mode variants
  const gradeColor = caseHealth.grade === 'A' || caseHealth.grade === 'B' ? (isDark ? '#4ADE80' : '#16A34A')
    : caseHealth.grade === 'C' ? (isDark ? '#FBBF24' : '#D97706')
    : caseHealth.grade === 'D' ? (isDark ? '#FB923C' : '#EA580C') : (isDark ? '#F87171' : '#DC2626');

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>

      {/* Checklist progress */}
      <SectionCard
        icon={TrendingUp}
        title={t('ai.investigationProgress')}
        badge={`${caseHealth.score}% · ${caseHealth.grade}`}
        badgeColor={
          caseHealth.grade === 'A' || caseHealth.grade === 'B'
            ? (isDark ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7')
            : caseHealth.grade === 'C'
              ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF9C3')
              : (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2')
        }
        defaultExpanded
      >
        <ProgressBar value={caseHealth.score} color={gradeColor} />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <StatChip
            label={`${caseHealth.completedItems} ${t('ai.done')}`}
            color={isDark ? '#86EFAC' : '#16A34A'}
            bg={isDark ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4'}
          />
          <StatChip
            label={`${caseHealth.pendingItems} ${t('ai.pending')}`}
            color={isDark ? '#FDE68A' : '#D97706'}
            bg={isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB'}
          />
          {caseHealth.criticalItems > 0 && (
            <StatChip
              label={`${caseHealth.criticalItems} ${t('ai.critical')}`}
              color={isDark ? '#FCA5A5' : '#DC2626'}
              bg={isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2'}
            />
          )}
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10,
          borderRadius: 10, borderWidth: 1,
          backgroundColor: caseReadiness.readyForChargeSheet ? (isDark ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4') : C.muted,
          borderColor:     caseReadiness.readyForChargeSheet ? (isDark ? 'rgba(34, 197, 94, 0.3)' : '#BBF7D0') : C.border,
        }}>
          <Text style={{
            fontSize: 12, fontWeight: '600',
            color: caseReadiness.readyForChargeSheet ? (isDark ? '#86EFAC' : '#16A34A') : C.foreground,
            flex: 1,
          }}>
            {t('ai.chargeSheetReady', { pct: caseReadiness.readinessScore })}
          </Text>
          {!caseReadiness.readyForChargeSheet && caseReadiness.blockers.length > 0 && (
            <Text style={{ fontSize: 11, color: C.mutedForeground }} numberOfLines={1}>
              {caseReadiness.blockers[0]}
            </Text>
          )}
        </View>
      </SectionCard>

      {/* Pending / priority actions */}
      {pendingActions.length > 0 && (
        <SectionCard
          icon={CheckSquare}
          title={t('ai.pendingActions')}
          badge={criticalCount > 0 ? `${criticalCount} ${t('ai.critical')}` : `${pendingActions.length}`}
          badgeColor={criticalCount > 0 ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2') : C.muted}
          defaultExpanded={criticalCount > 0}
        >
          {pendingActions.slice(0, 5).map(a => (
            <PriorityRow
              key={a.id}
              label={a.title}
              priority={a.priority}
              daysRemaining={a.daysRemaining}
            />
          ))}
          {pendingActions.length > 5 && (
            <Text style={{ fontSize: 11, color: C.mutedForeground, textAlign: 'center', paddingVertical: 4 }}>
              {t('ai.moreActions', { count: pendingActions.length - 5 })}
            </Text>
          )}
        </SectionCard>
      )}

      {/* Court deadlines */}
      {ctx.courtDocs && ctx.courtDocs.length > 0 && (
        <SectionCard
          icon={CalendarClock}
          title={t('ai.courtDeadlines')}
          badge={`${ctx.courtDocs.length}`}
          defaultExpanded={false}
        >
          {ctx.courtDocs.slice(0, 3).map((doc, i) => {
            const daysLeft = doc.deadline_date
              ? Math.round((new Date(doc.deadline_date).getTime() - Date.now()) / 86_400_000)
              : undefined;
            return (
              <PriorityRow
                key={i}
                label={doc.document_title || doc.doc_type}
                detail={doc.court_name}
                priority={
                  daysLeft !== undefined && daysLeft <= 2 ? 'critical'
                  : daysLeft !== undefined && daysLeft <= 7 ? 'high'
                  : 'medium'
                }
                daysRemaining={daysLeft}
              />
            );
          })}
        </SectionCard>
      )}

      {/* ── Missing fields warning ───────────────────────────────────────────── */}
      {ctx.confidence.missingFields.length > 0 && (
        <SectionCard
          icon={AlertTriangle}
          title={t('ai.missingInformation')}
          badge={`${ctx.confidence.missingFields.length}`}
          badgeColor={isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF9C3'}
          defaultExpanded={false}
        >
          {ctx.confidence.missingFields.slice(0, 6).map((f, i) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingVertical: 6,
              borderBottomWidth: i < Math.min(ctx.confidence.missingFields.length, 6) - 1 ? 1 : 0,
              borderBottomColor: C.border,
            }}>
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isDark ? '#FBBF24' : '#D97706' }} />
              <Text style={{ fontSize: 12, color: C.foreground }}>{f}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {/* ── Active FIR info ──────────────────────────────────────────────────── */}
      <SectionCard
        icon={FileText}
        title={`FIR ${fir.fir_number}`}
        badge={fir.status}
        badgeColor={fir.status === 'Pending'
          ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF9C3')
          : (isDark ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7')}
        defaultExpanded={false}
      >
        <InfoRow label={t('ai.complainant')} value={fir.complainant_name ?? '—'} />
        <InfoRow label={t('ai.offenceDate')} value={fir.date_of_occurrence ?? '—'} />
        <InfoRow label={t('ai.status')} value={fir.status ?? '—'} />
        <InfoRow label={t('ai.confidence')} value={`${Math.round(ctx.confidence.overallScore * 100)}%`} />
      </SectionCard>

      {/* ── Recent case diaries ──────────────────────────────────────────────── */}
      {ctx.caseDiaries && ctx.caseDiaries.length > 0 && (
        <SectionCard
          icon={Activity}
          title={t('ai.recentCaseDiaries')}
          badge={`${ctx.caseDiaries.length}`}
          defaultExpanded={false}
        >
          {ctx.caseDiaries.slice(0, 3).map((cd, i) => (
            <View key={i} style={{
              paddingVertical: 8,
              borderBottomWidth: i < Math.min(ctx.caseDiaries.length, 3) - 1 ? 1 : 0,
              borderBottomColor: C.border,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: C.foreground }} numberOfLines={1}>
                {t('ai.caseDiaryEntry')}
              </Text>
              {cd.preparation_date ? (
                <Text style={{ fontSize: 11, color: C.mutedForeground, marginTop: 2 }}>
                  {cd.preparation_date}
                </Text>
              ) : null}
              {cd.places_visited ? (
                <Text style={{ fontSize: 11, color: C.mutedForeground, marginTop: 1 }} numberOfLines={1}>
                  {cd.places_visited}
                </Text>
              ) : null}
            </View>
          ))}
        </SectionCard>
      )}
    </View>
  );
});

function StatChip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{
      paddingHorizontal: 9, paddingVertical: 4,
      borderRadius: 10, backgroundColor: bg,
    }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, color: colors.mutedForeground, width: 90 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: colors.foreground, flex: 1, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}

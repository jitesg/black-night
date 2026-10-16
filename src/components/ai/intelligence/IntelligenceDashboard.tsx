/**
 * IntelligenceDashboard.tsx
 * Main dashboard view inside IntelligenceModal.
 * Tabs: Summary | Recommendations | Compliance | Evidence | Contradictions | Risks
 * Minimal, whitespace-first layout.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {
  Shield,
  AlertTriangle,
  ListChecks,
  GitBranch,
  TrendingUp,
  FileWarning,
} from 'lucide-react-native';
import type { InvestigationIntelligenceReport, HealthStatus } from '@/ai/intelligence/IntelligenceTypes';
import { IntelligenceScorePanel } from './IntelligenceScorePanel';
import { VisualDecisionCard } from './VisualDecisionCard';

// ── Tab config ─────────────────────────────────────────────────────────────────

type TabId = 'summary' | 'recs' | 'compliance' | 'evidence' | 'contradictions' | 'risks';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'summary',        label: 'Summary'         },
  { id: 'recs',           label: 'Actions'         },
  { id: 'compliance',     label: 'Compliance'      },
  { id: 'evidence',       label: 'Evidence'        },
  { id: 'contradictions', label: 'Contradictions'  },
  { id: 'risks',          label: 'Risks'           },
];

// ── Health badge ───────────────────────────────────────────────────────────────

const HEALTH_CONFIG: Record<HealthStatus, { bg: string; text: string; label: string }> = {
  healthy:  { bg: '#f0fdf4', text: '#16a34a', label: '🟢 Healthy'  },
  pending:  { bg: '#fffbeb', text: '#d97706', label: '🟡 Pending'  },
  critical: { bg: '#fef2f2', text: '#dc2626', label: '🔴 Critical' },
};

function SeverityChip({ label, color }: { label: string; color: string }) {
  return (
    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '22' }}>
      <Text className="text-xs font-semibold" style={{ color }}>{label}</Text>
    </View>
  );
}

// ── Sub-panels ─────────────────────────────────────────────────────────────────

function SummaryPanel({ report }: { report: InvestigationIntelligenceReport }) {
  const h = report.healthReport;
  const hCfg = HEALTH_CONFIG[h.healthStatus];

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      {/* Health Status Banner */}
      <View className="rounded-2xl p-4 mb-4" style={{ backgroundColor: hCfg.bg, borderCurve: 'continuous' } as object}>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold" style={{ color: hCfg.text }}>{hCfg.label}</Text>
          <Text className="text-xs text-muted-foreground">
            Context: {report.contextConfidencePct}%
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground leading-4">{h.executiveSummary}</Text>
      </View>

      {/* Score panel */}
      <IntelligenceScorePanel report={report.scoreReport} />

      {/* Critical Issues */}
      {h.criticalIssues.length > 0 && (
        <View className="bg-card rounded-2xl p-4 mb-4" style={{ borderCurve: 'continuous' } as object}>
          <View className="flex-row items-center gap-2 mb-3">
            <AlertTriangle size={14} color="#dc2626" />
            <Text className="text-sm font-semibold text-foreground">Critical Issues</Text>
          </View>
          {h.criticalIssues.map((issue, i) => (
            <View key={i} className="flex-row items-start gap-2 mb-2">
              <Text className="text-destructive text-sm mt-0.5">•</Text>
              <Text className="flex-1 text-xs text-foreground leading-4">{issue}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Pending Work */}
      {h.pendingWork.length > 0 && (
        <View className="bg-card rounded-2xl p-4 mb-4" style={{ borderCurve: 'continuous' } as object}>
          <Text className="text-sm font-semibold text-foreground mb-3">Pending Work</Text>
          {h.pendingWork.map((item, i) => (
            <View key={i} className="flex-row items-start gap-2 mb-2">
              <Text className="text-muted-foreground text-sm mt-0.5">◦</Text>
              <Text className="flex-1 text-xs text-foreground leading-4">{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Evidence + Court Status */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1 bg-card rounded-2xl p-4" style={{ borderCurve: 'continuous' } as object}>
          <Text className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Evidence</Text>
          <Text className="text-xs text-foreground leading-4">{h.evidenceStatus}</Text>
        </View>
        <View className="flex-1 bg-card rounded-2xl p-4" style={{ borderCurve: 'continuous' } as object}>
          <Text className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Court</Text>
          <Text className="text-xs text-foreground leading-4">{h.courtStatus}</Text>
        </View>
      </View>

      {/* Charge sheet */}
      <View className="bg-card rounded-2xl p-4 mb-4" style={{ borderCurve: 'continuous' } as object}>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-foreground">Charge Sheet Readiness</Text>
          <Text className="text-sm font-bold text-foreground">{h.chargeSheetReadinessPct}%</Text>
        </View>
        <View className="h-2 rounded-full bg-muted overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${h.chargeSheetReadinessPct}%`,
              backgroundColor: h.chargeSheetReadinessPct >= 70 ? '#16a34a' : h.chargeSheetReadinessPct >= 40 ? '#d97706' : '#dc2626',
            }}
          />
        </View>
        {report.chargeSheetReport.criticalBlockers.length > 0 && (
          <Text className="text-xs text-destructive mt-2">
            {report.chargeSheetReport.criticalBlockers.length} critical blocker(s) remaining
          </Text>
        )}
      </View>

      {/* Playbook */}
      {report.playbookReport && (
        <View className="bg-card rounded-2xl p-4 mb-4" style={{ borderCurve: 'continuous' } as object}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-foreground">
              {report.playbookReport.crimeCategory} Playbook
            </Text>
            <Text className="text-sm font-bold text-foreground">{report.playbookReport.coveragePct}%</Text>
          </View>
          <View className="h-2 rounded-full bg-muted overflow-hidden mb-2">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${report.playbookReport.coveragePct}%` }}
            />
          </View>
          <Text className="text-xs text-muted-foreground">{report.playbookReport.summary}</Text>
        </View>
      )}

      {/* Advisory */}
      <View className="bg-muted rounded-2xl p-4 mb-8" style={{ borderCurve: 'continuous' } as object}>
        <Text className="text-xs text-muted-foreground leading-4">{h.advisory}</Text>
      </View>
    </ScrollView>
  );
}

function RecommendationsPanel({ report }: { report: InvestigationIntelligenceReport }) {
  const recs = report.recommendationReport.recommendations;
  if (recs.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-4xl mb-3">✅</Text>
        <Text className="text-base font-semibold text-foreground mb-1">No Urgent Actions</Text>
        <Text className="text-sm text-muted-foreground text-center px-8">Investigation appears on track.</Text>
      </View>
    );
  }
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      <Text className="text-xs text-muted-foreground mb-3">
        {recs.length} recommendation(s) · {report.recommendationReport.blockingCount} blocking
      </Text>
      {recs.map((rec, i) => (
        <VisualDecisionCard key={rec.id} recommendation={rec} index={i} />
      ))}
      <View className="h-8" />
    </ScrollView>
  );
}

function CompliancePanel({ report }: { report: InvestigationIntelligenceReport }) {
  const c = report.complianceReport;
  const allFindings = [...c.legalRisks, ...c.missingProcedures];
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      {/* Header stat */}
      <View className="bg-card rounded-2xl p-4 mb-4" style={{ borderCurve: 'continuous' } as object}>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-foreground">Legal Compliance</Text>
          <Text className="text-xl font-bold text-foreground">{c.compliancePct}%</Text>
        </View>
        <View className="h-2 rounded-full bg-muted overflow-hidden mb-2">
          <View
            className="h-full rounded-full"
            style={{ width: `${c.compliancePct}%`, backgroundColor: c.compliancePct >= 80 ? '#16a34a' : c.compliancePct >= 50 ? '#d97706' : '#dc2626' }}
          />
        </View>
        <Text className="text-xs text-muted-foreground">{c.passedChecks}/{c.totalChecks} checks passed</Text>
      </View>

      {allFindings.length === 0 ? (
        <View className="items-center py-8">
          <Text className="text-3xl mb-2">✅</Text>
          <Text className="text-sm text-muted-foreground">No compliance issues found.</Text>
        </View>
      ) : (
        allFindings.map((f) => (
          <View key={f.ruleId} className="bg-card rounded-2xl p-4 mb-3" style={{ borderCurve: 'continuous' } as object}>
            <View className="flex-row items-center gap-2 mb-2">
              <SeverityChip
                label={f.severity.toUpperCase()}
                color={f.severity === 'critical' ? '#dc2626' : f.severity === 'high' ? '#d97706' : '#2563eb'}
              />
              <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>{f.ruleTitle}</Text>
            </View>
            <Text className="text-xs text-muted-foreground leading-4 mb-2">{f.detail}</Text>
            <Text className="text-xs text-primary leading-4">{f.recommendation}</Text>
            <Text className="text-xs text-muted-foreground mt-1">{f.legalReference}</Text>
          </View>
        ))
      )}
      <View className="h-8" />
    </ScrollView>
  );
}

function EvidencePanel({ report }: { report: InvestigationIntelligenceReport }) {
  const e = report.evidenceGraphReport;
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      {/* Strength score */}
      <View className="bg-card rounded-2xl p-4 mb-4" style={{ borderCurve: 'continuous' } as object}>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-semibold text-foreground">Evidence Strength</Text>
          <Text className="text-xl font-bold text-foreground">{e.strengthScore}/100</Text>
        </View>
        <View className="h-2 rounded-full bg-muted overflow-hidden mb-2">
          <View
            className="h-full rounded-full"
            style={{ width: `${e.strengthScore}%`, backgroundColor: e.strengthScore >= 70 ? '#16a34a' : e.strengthScore >= 40 ? '#d97706' : '#dc2626' }}
          />
        </View>
        <Text className="text-xs text-muted-foreground">
          {e.presentNodeCount}/{e.totalNodeCount} evidence nodes present · {e.brokenLinkCount} broken links
        </Text>
      </View>

      {/* Nodes */}
      <View className="bg-card rounded-2xl p-4 mb-4" style={{ borderCurve: 'continuous' } as object}>
        <Text className="text-sm font-semibold text-foreground mb-3">Evidence Nodes</Text>
        <View className="flex-row flex-wrap gap-2">
          {e.nodes.map((n) => (
            <View
              key={n.id}
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: n.isPresent ? (n.isOrphan ? '#fffbeb' : '#f0fdf4') : '#fef2f2' }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: n.isPresent ? (n.isOrphan ? '#d97706' : '#16a34a') : '#dc2626' }}
              >
                {n.isPresent ? '✓' : '✗'} {n.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Issues */}
      {e.issues.map((issue, i) => (
        <View key={i} className="bg-card rounded-2xl p-4 mb-3" style={{ borderCurve: 'continuous' } as object}>
          <View className="flex-row items-center gap-2 mb-1">
            <SeverityChip
              label={issue.severity.toUpperCase()}
              color={issue.severity === 'critical' ? '#dc2626' : issue.severity === 'high' ? '#d97706' : '#6b7280'}
            />
          </View>
          <Text className="text-xs text-foreground leading-4 mb-1">{issue.description}</Text>
          <Text className="text-xs text-primary leading-4">{issue.recommendation}</Text>
        </View>
      ))}
      <View className="h-8" />
    </ScrollView>
  );
}

function ContradictionsPanel({ report }: { report: InvestigationIntelligenceReport }) {
  const c = report.contradictionReport;
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      <View className="flex-row gap-3 mb-4">
        {[
          { label: 'Critical', count: c.criticalCount, color: '#dc2626' },
          { label: 'Warning',  count: c.warningCount,  color: '#d97706' },
          { label: 'Info',     count: c.infoCount,     color: '#6b7280' },
        ].map((s) => (
          <View key={s.label} className="flex-1 bg-card rounded-2xl p-3 items-center" style={{ borderCurve: 'continuous' } as object}>
            <Text className="text-xl font-bold" style={{ color: s.color }}>{s.count}</Text>
            <Text className="text-xs text-muted-foreground">{s.label}</Text>
          </View>
        ))}
      </View>

      {c.contradictions.length === 0 ? (
        <View className="items-center py-8">
          <Text className="text-3xl mb-2">✅</Text>
          <Text className="text-sm text-muted-foreground">No contradictions detected.</Text>
        </View>
      ) : (
        c.contradictions.map((item) => (
          <View
            key={item.id}
            className="bg-card rounded-2xl p-4 mb-3"
            style={{ borderCurve: 'continuous' } as object}
          >
            <View className="flex-row items-center gap-2 mb-2">
              <SeverityChip
                label={item.type.toUpperCase()}
                color={item.type === 'critical' ? '#dc2626' : item.type === 'warning' ? '#d97706' : '#6b7280'}
              />
            </View>
            <Text className="text-sm font-semibold text-foreground mb-1">{item.title}</Text>
            <Text className="text-xs text-muted-foreground leading-4 mb-2">{item.description}</Text>
            <Text className="text-xs text-primary leading-4">{item.recommendation}</Text>
            {item.legalImplication && (
              <Text className="text-xs text-destructive leading-4 mt-1">{item.legalImplication}</Text>
            )}
            <View className="flex-row flex-wrap gap-1 mt-2">
              {item.modulesInvolved.map((m) => (
                <View key={m} className="px-2 py-0.5 bg-muted rounded-full">
                  <Text className="text-xs text-muted-foreground">{m}</Text>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
      <View className="h-8" />
    </ScrollView>
  );
}

function RisksPanel({ report }: { report: InvestigationIntelligenceReport }) {
  const r = report.riskReport;
  const riskColor = (rl: string) => rl === 'high' ? '#dc2626' : rl === 'medium' ? '#d97706' : '#16a34a';
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      {/* Overall risk badge */}
      <View
        className="rounded-2xl p-4 mb-4"
        style={{
          backgroundColor: riskColor(r.overallRiskLevel) + '18',
          borderCurve: 'continuous',
        } as object}
      >
        <Text className="text-sm font-semibold" style={{ color: riskColor(r.overallRiskLevel) }}>
          Overall Risk: {r.overallRiskLevel.toUpperCase()}
        </Text>
        <Text className="text-xs text-muted-foreground mt-1">{r.summary}</Text>
      </View>

      {r.risks.length === 0 ? (
        <View className="items-center py-8">
          <Text className="text-3xl mb-2">✅</Text>
          <Text className="text-sm text-muted-foreground">No significant risks detected.</Text>
        </View>
      ) : (
        r.risks.map((risk) => (
          <View key={risk.id} className="bg-card rounded-2xl p-4 mb-3" style={{ borderCurve: 'continuous' } as object}>
            <View className="flex-row items-center gap-2 mb-2">
              <SeverityChip label={risk.riskLevel.toUpperCase()} color={riskColor(risk.riskLevel)} />
              <SeverityChip label={`${risk.likelihood}% likely`} color="#6b7280" />
              {risk.daysToEvent !== undefined && (
                <SeverityChip label={risk.daysToEvent === 0 ? 'Overdue' : `${risk.daysToEvent}d`} color={risk.daysToEvent === 0 ? '#dc2626' : '#d97706'} />
              )}
            </View>
            <Text className="text-sm font-semibold text-foreground mb-1">{risk.title}</Text>
            <Text className="text-xs text-muted-foreground leading-4 mb-2">{risk.reason}</Text>
            <Text className="text-xs text-primary leading-4">{risk.recommendation}</Text>
          </View>
        ))
      )}
      <View className="h-8" />
    </ScrollView>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

interface Props {
  report: InvestigationIntelligenceReport;
}

export function IntelligenceDashboard({ report }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('summary');

  return (
    <View className="flex-1">
      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-grow-0 border-b border-border"
        contentContainerClassName="px-4"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className="mr-1 active:opacity-70"
            >
              <View className={`px-3 py-3 border-b-2 ${isActive ? 'border-primary' : 'border-transparent'}`}>
                <Text className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tab content */}
      <View className="flex-1 px-4 pt-4">
        {activeTab === 'summary'        && <SummaryPanel         report={report} />}
        {activeTab === 'recs'           && <RecommendationsPanel report={report} />}
        {activeTab === 'compliance'     && <CompliancePanel      report={report} />}
        {activeTab === 'evidence'       && <EvidencePanel        report={report} />}
        {activeTab === 'contradictions' && <ContradictionsPanel  report={report} />}
        {activeTab === 'risks'          && <RisksPanel           report={report} />}
      </View>
    </View>
  );
}

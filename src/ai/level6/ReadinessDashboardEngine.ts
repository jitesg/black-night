/**
 * ReadinessDashboardEngine.ts
 * Level-6: Generates investigation readiness dashboard with 8 dimensions
 * and an overall grade A–F.
 *
 * SAFETY: Read-only. Never writes to any repository or database.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  InvestigationReadinessReport,
  ReadinessDimension,
  L6Grade,
} from './L6Types';

function gradeFromScore(score: number): L6Grade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function dim(
  label: string,
  score: number,
  description: string,
  items: string[],
  criticalIssues: string[]
): ReadinessDimension {
  return { label, score, grade: gradeFromScore(score), description, items, criticalIssues };
}

export class ReadinessDashboardEngine {
  static analyze(ctx: InvestigationContext): InvestigationReadinessReport {
    const fir       = ctx.fir;
    const firId     = ctx.activeFirId;
    const firNumber = fir?.fir_number;
    const health    = ctx.caseHealth;
    const k         = ctx.karyvahi;

    function hasKaryvahi(re: RegExp) {
      return k.all.some((kv) => re.test(kv.name.toLowerCase()));
    }

    // ── 1. Investigation Score ────────────────────────────────────────────────
    const invScore = health.score;
    const investigationScore = dim(
      'Investigation Score', invScore,
      `Overall investigation health: ${health.grade}`,
      [
        `Completed karyvahi: ${k.completed.length}/${k.all.length}`,
        `Pending: ${k.pending.length}`,
        `Critical items: ${health.criticalItems}`,
      ],
      health.criticalItems > 0 ? [`${health.criticalItems} critical pending item(s)`] : []
    );

    // ── 2. Compliance ─────────────────────────────────────────────────────────
    const overdueCount    = ctx.overdueItems.length;
    const complianceScore = Math.max(0, 100 - overdueCount * 15);
    const compliance      = dim(
      'Compliance', complianceScore,
      `${overdueCount} overdue compliance item(s)`,
      ctx.overdueItems.slice(0, 4).map((o) => `${o.title}: ${o.daysOverdue}d overdue`),
      overdueCount >= 3 ? [`${overdueCount} overdue items require immediate attention`] : []
    );

    // ── 3. Evidence Strength ──────────────────────────────────────────────────
    const hasSeizure  = hasKaryvahi(/seizure|muddemal/);
    const hasFSL      = hasKaryvahi(/fsl|forensic/);
    const hasMedical  = hasKaryvahi(/medical|doctor/);
    let evidenceScore = 30;
    if (hasSeizure)  evidenceScore += 25;
    if (hasFSL)      evidenceScore += 25;
    if (hasMedical)  evidenceScore += 20;
    const evidenceStrength = dim(
      'Evidence Strength', evidenceScore,
      `Physical evidence and forensic analysis status`,
      [
        hasSeizure ? 'Seizure evidence recorded' : 'No seizure evidence',
        hasFSL     ? 'FSL report obtained'        : 'FSL report missing',
        hasMedical ? 'Medical report obtained'    : 'Medical report missing',
      ],
      [
        ...(!hasSeizure ? ['No seizure/evidence recorded'] : []),
        ...(!hasFSL     ? ['FSL report missing']           : []),
        ...(!hasMedical ? ['Medical examination missing']  : []),
      ]
    );

    // ── 4. Documentation ──────────────────────────────────────────────────────
    const totalK    = k.all.length;
    const completePct = totalK > 0 ? Math.round((k.completed.length / totalK) * 100) : 0;
    const hasDiary  = ctx.caseDiaries.length > 0;
    const docScore  = Math.round(completePct * 0.7 + (hasDiary ? 30 : 0));
    const documentation = dim(
      'Documentation', docScore,
      `Karyvahi ${completePct}% complete. ${ctx.caseDiaries.length} case diary entry(ies).`,
      [
        `Total karyvahi: ${totalK}`,
        `Completed: ${k.completed.length}`,
        `Pending: ${k.pending.length}`,
        `Case diaries: ${ctx.caseDiaries.length}`,
      ],
      [
        ...(k.pending.length > 3 ? [`${k.pending.length} pending karyvahi`] : []),
        ...(!hasDiary ? ['No case diary entries'] : []),
      ]
    );

    // ── 5. Court Readiness ────────────────────────────────────────────────────
    const courtCount     = ctx.courtDocs.length;
    const urgentCourt    = ctx.courtDocs.filter((d) => {
      if (!d.deadline_date) return false;
      const days = Math.ceil((new Date(d.deadline_date).getTime() - Date.now()) / 86_400_000);
      return days >= 0 && days <= 7;
    }).length;
    const courtScore     = urgentCourt >= 2 ? 20 : urgentCourt === 1 ? 40 : courtCount > 0 ? 70 : 85;
    const courtReadiness = dim(
      'Court Readiness', courtScore,
      `${courtCount} court document(s). ${urgentCourt} deadline(s) within 7 days.`,
      [
        `Court documents: ${courtCount}`,
        `Urgent deadlines: ${urgentCourt}`,
        `Overdue court items: ${ctx.overdueItems.filter(o => o.module.toLowerCase().includes('court')).length}`,
      ],
      urgentCourt > 0 ? [`${urgentCourt} court deadline(s) within 7 days`] : []
    );

    // ── 6. Charge Sheet Readiness ─────────────────────────────────────────────
    const csItems   = [hasKaryvahi(/arrest/), hasMedical, hasFSL, hasKaryvahi(/witness|bayan/), ctx.caseDiaries.length > 0];
    const csScore   = Math.round((csItems.filter(Boolean).length / csItems.length) * 100);
    const chargeSheetReadiness = dim(
      'Charge Sheet Readiness', csScore,
      `${csItems.filter(Boolean).length}/${csItems.length} critical items completed`,
      [
        hasKaryvahi(/arrest/)       ? '✓ Arrest recorded'        : '✗ No arrest karyvahi',
        hasMedical                  ? '✓ Medical report obtained' : '✗ Medical report missing',
        hasFSL                      ? '✓ FSL report obtained'     : '✗ FSL report missing',
        hasKaryvahi(/witness|bayan/) ? '✓ Witnesses recorded'      : '✗ No witness statements',
        ctx.caseDiaries.length > 0   ? '✓ Case diary updated'      : '✗ No case diary',
      ],
      csItems.map((v, i) => !v ? ['arrest', 'medical report', 'FSL report', 'witness statements', 'case diary'][i] as string : null)
        .filter(Boolean) as string[]
    );

    // ── 7. Timeline Health ────────────────────────────────────────────────────
    const lastDiaryDate  = ctx.caseDiaries[0]?.preparation_date;
    const daysSinceDiary = lastDiaryDate
      ? Math.floor((Date.now() - new Date(lastDiaryDate).getTime()) / 86_400_000)
      : 999;
    const timelineScore  = daysSinceDiary > 14 ? 20 : daysSinceDiary > 7 ? 50 : daysSinceDiary > 3 ? 75 : 95;
    const timelineHealth = dim(
      'Timeline Health', timelineScore,
      `Last case diary: ${daysSinceDiary === 999 ? 'Never' : daysSinceDiary + ' day(s) ago'}`,
      [
        `Case diary entries: ${ctx.caseDiaries.length}`,
        `Last updated: ${lastDiaryDate ?? 'N/A'}`,
        `Timeline events: ${ctx.timeline.length}`,
      ],
      daysSinceDiary > 14 ? ['Case diary critically outdated — update immediately'] : []
    );

    // ── 8. Risk Score ─────────────────────────────────────────────────────────
    const riskRaw    = Math.min(100, overdueCount * 12 + (urgentCourt * 20) + (daysSinceDiary > 14 ? 20 : 0));
    const riskScore  = dim(
      'Risk Score', riskRaw,
      `${riskRaw < 30 ? 'Low' : riskRaw < 60 ? 'Moderate' : 'High'} overall risk`,
      [
        `Overdue items: ${overdueCount}`,
        `Urgent court: ${urgentCourt}`,
        `Pending bail: ${ctx.prarthnaPatra.filter(p => p.status === 'Pending').length}`,
      ],
      riskRaw >= 60 ? ['High risk investigation — immediate attention required'] : []
    );

    // ── Aggregate ─────────────────────────────────────────────────────────────
    const weights  = [0.15, 0.12, 0.16, 0.12, 0.14, 0.15, 0.08, 0.08];
    const scores   = [invScore, complianceScore, evidenceScore, docScore, courtScore, csScore, timelineScore, 100 - riskRaw];
    const overall  = Math.round(scores.reduce((acc, s, i) => acc + s * weights[i], 0));
    const grade    = gradeFromScore(overall);
    const gradeLabels: Record<L6Grade, string> = {
      A: 'Excellent — Investigation ready for charge sheet.',
      B: 'Good — Minor gaps need attention.',
      C: 'Fair — Significant gaps require resolution.',
      D: 'Poor — Critical issues must be addressed urgently.',
      F: 'Critical — Investigation at risk. Immediate supervisor attention required.',
    };

    const allCritical = [
      ...investigationScore.criticalIssues,
      ...compliance.criticalIssues,
      ...evidenceStrength.criticalIssues,
      ...documentation.criticalIssues,
      ...courtReadiness.criticalIssues,
      ...chargeSheetReadiness.criticalIssues,
      ...timelineHealth.criticalIssues,
      ...riskScore.criticalIssues,
    ];

    return {
      generatedAt:          new Date().toISOString(),
      firId,
      firNumber,
      investigationScore,
      compliance,
      evidenceStrength,
      documentation,
      courtReadiness,
      chargeSheetReadiness,
      timelineHealth,
      riskScore,
      overallScore:         overall,
      overallGrade:         grade,
      gradeLabel:           gradeLabels[grade],
      criticalIssues:       allCritical.slice(0, 8),
      topRecommendations:   allCritical.slice(0, 3).map((i) => `Address: ${i}`),
      summary:              `Grade ${grade}: ${overall}/100. ${gradeLabels[grade]} ${allCritical.length > 0 ? `${allCritical.length} critical issue(s) found.` : ''}`,
    };
  }
}

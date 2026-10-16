/**
 * PredictiveInvestigationEngine.ts
 * Predicts future investigation risks from InvestigationContext.
 *
 * Outputs likelihood, impact, confidence, and preventive actions for each
 * identified risk. All inference is rule-based + context-driven.
 *
 * SAFETY: Read-only advisory. Never modifies investigation records.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  PredictiveRisk,
  PredictiveRiskType,
  PredictiveInvestigationReport,
} from './L5Types';
import type { IntelPriority } from '../intelligence/IntelligenceTypes';

const MS_PER_DAY = 86_400_000;

function daysSince(ts?: number | string): number {
  if (!ts) return 0;
  const t = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

function daysUntil(dateStr?: string | null): number | undefined {
  if (!dateStr) return undefined;
  const delta = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(delta / MS_PER_DAY);
}

function mkRisk(
  type: PredictiveRiskType,
  title: string,
  description: string,
  likelihood: number,
  impact: PredictiveRisk['impact'],
  confidence: number,
  supportingContext: string,
  preventiveActions: PredictiveRisk['preventiveActions'],
  riskIfIgnored: string,
  opts: { daysToEvent?: number; dueDate?: string; applicableRule?: string } = {}
): PredictiveRisk {
  return {
    id: `pred-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    description,
    likelihood,
    impact,
    confidence,
    supportingContext,
    preventiveActions,
    riskIfIgnored,
    ...opts,
  };
}

// ── Urgency helper ────────────────────────────────────────────────────────────
// IntelPriority = 'urgent' | 'high' | 'medium' | 'low'
function urgency(days: number | undefined): IntelPriority {
  if (days === undefined) return 'medium';
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'high';
  if (days <= 14) return 'medium';
  return 'low';
}

export class PredictiveInvestigationEngine {
  static analyze(ctx: InvestigationContext): PredictiveInvestigationReport {
    const risks: PredictiveRisk[] = [];
    const fir = ctx.fir;
    const firNumber = fir?.fir_number ?? '—';

    // ── 1. Default Bail Risk ───────────────────────────────────────────────────
    // OverdueItem shape: { id, module, title, daysOverdue, route, color }
    const bailItem = ctx.overdueItems.find(
      (o) => o.module.toLowerCase().includes('bail') || o.title.toLowerCase().includes('bail')
    );
    if (bailItem) {
      // daysOverdue is positive = already overdue; negate to get "days until" (negative = already passed)
      const days = bailItem.daysOverdue > 0 ? 0 : undefined;
      risks.push(mkRisk(
        'default-bail-risk',
        'Default Bail Risk',
        `Accused may be entitled to default bail if charge sheet is not filed within the statutory deadline.`,
        days !== undefined && days <= 7 ? 92 : 78,
        'critical',
        88,
        `FIR ${firNumber} — custody deadline approaching. ${days !== undefined ? `~${days} day(s) remaining.` : ''}`,
        [
          {
            title: 'Expedite Charge Sheet',
            description: 'Prioritise completing charge sheet documentation immediately.',
            urgency: urgency(days),
          },
          {
            title: 'Legal Consultation',
            description: 'Consult with PP/SPP regarding extension application if needed.',
            urgency: 'high',
          },
        ],
        'Accused may be released on default bail; investigation compromised.',
        { daysToEvent: days, applicableRule: 'BNSS Section 187(2)' }
      ));
    }

    // ── 2. Charge Sheet Deadline ───────────────────────────────────────────────
    const csItem = ctx.overdueItems.find(
      (o) => o.module.toLowerCase().includes('charge') || o.title.toLowerCase().includes('charge sheet')
    );
    const daysRegistered = daysSince(fir?.created_at);
    if (daysRegistered > 50 || csItem) {
      const likelihood = csItem ? 80 : Math.min(90, 40 + daysRegistered);
      const daysLeft   = csItem
        ? (csItem.daysOverdue > 0 ? 0 : Math.max(0, 60 - daysRegistered))
        : Math.max(0, 60 - daysRegistered);
      risks.push(mkRisk(
        'charge-sheet-deadline',
        'Charge Sheet Deadline Risk',
        'Investigation is approaching the statutory deadline for filing the charge sheet.',
        likelihood,
        daysLeft !== undefined && daysLeft <= 10 ? 'critical' : 'high',
        80,
        `FIR ${firNumber} registered ${daysRegistered} days ago. ${daysLeft !== undefined ? `${daysLeft} day(s) to deadline.` : ''}`,
        [
          {
            title: 'Complete Pending Sections',
            description: 'Ensure all evidence, witness statements, and medical reports are compiled.',
            urgency: urgency(daysLeft),
          },
          {
            title: 'Supervisor Review',
            description: 'Request SHO review and expedite charge sheet filing.',
            urgency: 'high',
          },
        ],
        'Non-filing within deadline may lead to default bail and legal complications.',
        { daysToEvent: daysLeft, applicableRule: 'BNSS Section 193' }
      ));
    }

    // ── 3. Upcoming Court Date ─────────────────────────────────────────────────
    // NyayalayDocument uses deadline_date (not next_hearing_date)
    for (const doc of ctx.courtDocs) {
      const days = daysUntil(doc.deadline_date);
      if (days !== undefined && days >= 0 && days <= 21) {
        risks.push(mkRisk(
          'upcoming-court-date',
          `Court Deadline in ${days} Day(s)`,
          `A court deadline is approaching in ${days} day(s). Ensure all required documents and compliance reports are ready.`,
          95,
          days <= 3 ? 'high' : days <= 7 ? 'high' : 'medium',
          95,
          `Case: ${doc.vad_sankhya ?? '—'}. Deadline: ${doc.deadline_date}.`,
          [
            {
              title: 'Prepare Compliance Report',
              description: 'Draft and submit court compliance report before deadline.',
              urgency: urgency(days),
            },
            {
              title: 'Verify Evidence Custody',
              description: 'Confirm all exhibits/evidence are accounted for before hearing.',
              urgency: urgency(days),
            },
          ],
          'Non-compliance may result in adverse court orders or contempt.',
          { daysToEvent: days, dueDate: doc.deadline_date ?? undefined }
        ));
      }
    }

    // ── 4. FSL Delay ──────────────────────────────────────────────────────────
    // KaryvahiSummary: { all, completed, pending, completionPct } — no counts
    const seizureCount = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('seizure') || k.name.toLowerCase().includes('muddemal')
    ).length;
    const hasFSLEvidence = seizureCount > 0;
    const fslDays = daysSince(fir?.created_at);
    if (hasFSLEvidence && fslDays > 30) {
      risks.push(mkRisk(
        'fsl-delay',
        'FSL Report Delay',
        'Seized material has not received FSL examination results, which may delay charge sheet preparation.',
        75,
        'high',
        72,
        `${seizureCount} seized item(s). Investigation age: ${fslDays} days.`,
        [
          {
            title: 'Send FSL Reminder',
            description: 'Issue formal reminder to FSL for pending examination.',
            urgency: 'high',
          },
          {
            title: 'Follow-Up With SHO',
            description: 'Escalate pending FSL to SHO for departmental follow-up.',
            urgency: 'medium',
          },
        ],
        'Charge sheet may be incomplete without FSL report, weakening prosecution case.',
        { applicableRule: 'BNSS Section 234' }
      ));
    }

    // ── 5. Medical Report Delay ────────────────────────────────────────────────
    const hasVictim = !!ctx.fir?.complainant_name;
    const medAge = daysSince(fir?.created_at);
    if (hasVictim && medAge > 7) {
      risks.push(mkRisk(
        'medical-delay',
        'Medical Examination Report Pending',
        'Victim medical examination report may be pending. Delay weakens prosecution case.',
        68,
        'high',
        70,
        `Victim present. Investigation age: ${medAge} days. No medical report confirmed.`,
        [
          {
            title: 'Obtain Medical Report',
            description: 'Contact medical officer and obtain formal written report.',
            urgency: 'high',
          },
        ],
        'Missing medical evidence may result in acquittal on key charges.',
        { applicableRule: 'BNSS Section 176' }
      ));
    }

    // ── 6. Witness Statement Delay ─────────────────────────────────────────────
    const witnessItem = ctx.karyvahi;
    const witnessAge = daysSince(fir?.created_at);
    if (witnessAge > 14) {
      risks.push(mkRisk(
        'witness-delay',
        'Witness Statements May Be Incomplete',
        'Witness statements should be recorded at the earliest. Delay may affect reliability and legal admissibility.',
        60,
        'medium',
        65,
        `Investigation age: ${witnessAge} days. Witness examination status unconfirmed.`,
        [
          {
            title: 'Record Witness Statements',
            description: 'Under Section 180 BNSS, record witness statements without further delay.',
            urgency: 'medium',
          },
        ],
        'Delayed statements are more susceptible to challenge in court.',
        { applicableRule: 'BNSS Section 180' }
      ));
    }

    // ── 7. Case Diary Gap ──────────────────────────────────────────────────────
    const lastCaseDiaryTs = ctx.caseDiaries.length
      ? Math.max(...ctx.caseDiaries.map((cd) => cd.created_at ?? 0))
      : undefined;
    const daysSinceCD = lastCaseDiaryTs ? daysSince(lastCaseDiaryTs) : daysSince(fir?.created_at);
    if (daysSinceCD > 7) {
      risks.push(mkRisk(
        'case-diary-gap',
        'Case Diary Not Updated Recently',
        `Case diary has not been updated for ${daysSinceCD} days. Regular updates are mandatory.`,
        82,
        'medium',
        85,
        `Last case diary: ${daysSinceCD} days ago.`,
        [
          {
            title: 'Update Case Diary',
            description: 'Add a case diary entry recording latest investigation steps.',
            urgency: daysSinceCD > 14 ? 'high' : 'medium',
          },
        ],
        'Irregular case diary may be flagged by court as supervisory failure.',
        { applicableRule: 'BNSS Section 194' }
      ));
    }

    // ── Score & sort ───────────────────────────────────────────────────────────
    risks.sort((a, b) => {
      const impactRank = { critical: 4, high: 3, medium: 2, low: 1 };
      return (impactRank[b.impact] - impactRank[a.impact]) || (b.likelihood - a.likelihood);
    });

    const overallRiskScore = risks.length === 0 ? 10 : Math.min(
      100,
      Math.round(
        risks.reduce((acc, r) => acc + (r.likelihood * (r.impact === 'critical' ? 1.5 : r.impact === 'high' ? 1.2 : r.impact === 'medium' ? 1.0 : 0.7)), 0) /
        Math.max(risks.length, 1)
      )
    );

    const criticalCount = risks.filter((r) => r.impact === 'critical').length;
    const highCount     = risks.filter((r) => r.impact === 'high').length;
    const topRisk       = risks[0] ?? null;

    const summary = risks.length === 0
      ? '✅ No significant predictive risks detected.'
      : `⚠️ ${risks.length} risk(s) identified. ` +
        `${criticalCount} critical, ${highCount} high. ` +
        `Top risk: "${topRisk?.title ?? '—'}".`;

    return {
      generatedAt: new Date().toISOString(),
      firId: fir?.id,
      firNumber,
      overallRiskScore,
      risks,
      criticalCount,
      highCount,
      topRisk,
      nextActionRequired: topRisk?.preventiveActions[0]?.title ?? 'No immediate action required.',
      summary,
    };
  }
}

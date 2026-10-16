/**
 * OfficerDecisionAssistant.ts
 * Level-6: Before every recommendation shows: Why, Evidence used, Rules applied,
 * Confidence, Alternatives, Risk if ignored.
 * Officer always makes the final decision.
 *
 * SAFETY: Read-only advisory. Never writes. requiresOfficerDecision = true always.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  OfficerDecisionAssistantReport,
  DecisionAssistance,
  DecisionAlternative,
} from './L6Types';
import type { IntelPriority, IntelSeverity } from '../intelligence/IntelligenceTypes';

let idxCounter = 0;

function mkDecision(
  title: string,
  why: string,
  evidenceUsed: string[],
  rulesApplied: string[],
  confidence: number,
  alternatives: DecisionAlternative[],
  riskIfIgnored: string,
  expectedOutcome: string,
  legalBasis: string,
  priority: IntelPriority,
  severity: IntelSeverity
): DecisionAssistance {
  idxCounter += 1;
  return {
    id:                    `l6-dec-${idxCounter}`,
    recommendationTitle:   title,
    why,
    evidenceUsed,
    rulesApplied,
    confidencePct:         confidence,
    alternatives,
    riskIfIgnored,
    expectedOutcome,
    legalBasis,
    priority,
    severity,
    requiresOfficerDecision: true,
  };
}

export class OfficerDecisionAssistant {
  static analyze(ctx: InvestigationContext): OfficerDecisionAssistantReport {
    idxCounter = 0;
    const decisions: DecisionAssistance[] = [];
    const fir    = ctx.fir;
    const firId  = ctx.activeFirId;
    const karyvahiNames = ctx.karyvahi.all.map((k) => k.name.toLowerCase());

    function hasK(re: RegExp): boolean { return karyvahiNames.some((n) => re.test(n)); }

    // ── Decision 1: Medical Report ─────────────────────────────────────────────
    if (!hasK(/medical|doctor/)) {
      decisions.push(mkDecision(
        'Obtain Medical Examination Report',
        'FIR mentions injuries/crime but no medical examination karyvahi is recorded. Medical evidence is essential for charge sheet.',
        ['FIR crime type: ' + (fir?.crime_type ?? 'N/A'), 'Karyvahi records: medical examination absent'],
        ['BNSS Sec 185 — Examination of accused by medical practitioner', 'BNSS Sec 186 — Examination of arrested person'],
        82,
        [
          { title: 'Request government hospital examination', description: 'Route through government doctor for admissibility.', pros: ['Admissible in court', 'Quick turnaround'], cons: ['May require transportation'], confidencePct: 85 },
          { title: 'Private medical certificate', description: 'Obtain from private doctor with counter-signature.', pros: ['Faster'], cons: ['May need additional corroboration'], confidencePct: 65 },
        ],
        'Lack of medical evidence weakens prosecution case. Defence may exploit absence.',
        'Medical report corroborates FIR allegations and strengthens charge sheet.',
        'BNSS Sec 185', 'urgent', 'high'
      ));
    }

    // ── Decision 2: FSL Referral ───────────────────────────────────────────────
    if (hasK(/seizure|muddemal/) && !hasK(/fsl|forensic/)) {
      decisions.push(mkDecision(
        'Send Seized Items for FSL Examination',
        'Seizure karyvahi is recorded but no FSL referral exists. Forensic analysis is required to establish evidence chain.',
        ['Seizure karyvahi present', 'FSL karyvahi absent', 'Case type: ' + (fir?.crime_type ?? 'N/A')],
        ['BNSS Sec 349 — Examination of persons accused', 'BNSS Sec 105 — Seizure procedure'],
        88,
        [
          { title: 'Government FSL referral', description: 'Official FSL examination through prescribed channels.', pros: ['Legally binding', 'Court-admissible'], cons: ['Takes 30–90 days'], confidencePct: 90 },
          { title: 'In-house preliminary test', description: 'Quick test for narcotics/substances.', pros: ['Immediate result'], cons: ['Not final evidence'], confidencePct: 55 },
        ],
        'Without FSL report, evidence may be inadmissible. Defence can challenge authenticity.',
        'FSL analysis scientifically validates seized items and strengthens prosecution evidence.',
        'BNSS Sec 349', 'urgent', 'critical'
      ));
    }

    // ── Decision 3: Witness Statements ────────────────────────────────────────
    if (!hasK(/witness|bayan/)) {
      decisions.push(mkDecision(
        'Record Witness Statements',
        'No witness statement karyvahi recorded. Witness testimony is a critical pillar of the investigation.',
        ['Witness karyvahi: absent', 'Case diary entries: ' + ctx.caseDiaries.length],
        ['BNSS Sec 180 — Examination of witnesses', 'BNSS Sec 175 — Power to summon persons'],
        85,
        [
          { title: 'Record statements in custody', description: 'Record all available witnesses under Sec 180 BNSS.', pros: ['Direct evidence', 'Strengthens prosecution'], cons: ['Witnesses may be unavailable'], confidencePct: 88 },
          { title: 'Issue notices for statement', description: 'Issue formal notices to non-cooperative witnesses.', pros: ['Legal compulsion'], cons: ['Delays process'], confidencePct: 72 },
        ],
        'Without witness testimony, prosecution relies solely on physical evidence. High acquittal risk.',
        'Recorded statements provide eyewitness corroboration for all FIR allegations.',
        'BNSS Sec 180', 'high', 'high'
      ));
    }

    // ── Decision 4: Case Diary Update ─────────────────────────────────────────
    const lastDiaryDate = ctx.caseDiaries[0]?.preparation_date;
    const daysSinceDiary = lastDiaryDate
      ? Math.floor((Date.now() - new Date(lastDiaryDate).getTime()) / 86_400_000)
      : 999;
    if (daysSinceDiary > 7 || ctx.caseDiaries.length === 0) {
      decisions.push(mkDecision(
        'Update Case Diary',
        `Case diary ${ctx.caseDiaries.length === 0 ? 'not started' : `not updated for ${daysSinceDiary} days`}. Regular documentation is mandatory.`,
        ['Last case diary: ' + (lastDiaryDate ?? 'None'), 'Pending karyvahi: ' + ctx.karyvahi.pending.length],
        ['BNSS Sec 193 — Case diary maintenance', 'Court rulings on investigation diligence'],
        90,
        [
          { title: 'Comprehensive entry covering all activities', description: 'Document all investigation steps taken since last entry.', pros: ['Complete record', 'Prevents oversight'], cons: ['Time consuming'], confidencePct: 92 },
          { title: 'Brief progress note', description: 'Short entry noting status.', pros: ['Quick'], cons: ['May miss important details'], confidencePct: 68 },
        ],
        'Gaps in case diary suggest investigation negligence. Court may draw adverse inference.',
        'Regular diary entries demonstrate active investigation and protect against accusations of negligence.',
        'BNSS Sec 193', 'high', 'high'
      ));
    }

    // ── Decision 5: Charge Sheet Preparation ──────────────────────────────────
    if (ctx.caseHealth.readinessForChargeSheet) {
      decisions.push(mkDecision(
        'Initiate Charge Sheet Preparation',
        'Investigation health score and evidence status indicate charge sheet readiness. Timely filing prevents default bail.',
        ['Health score: ' + ctx.caseHealth.score + '/100', 'Completed karyvahi: ' + ctx.karyvahi.completed.length, 'Overdue items: ' + ctx.overdueItems.length],
        ['BNSS Sec 250 — Charge sheet filing', 'BNSS Sec 479 — Default bail provisions'],
        87,
        [
          { title: 'File charge sheet within statutory deadline', description: 'Ensure all supporting documents are attached.', pros: ['Prevents default bail', 'Court compliance'], cons: ['Must be comprehensive'], confidencePct: 90 },
          { title: 'Supplementary charge sheet later', description: 'File initial sheet and supplement with additional evidence.', pros: ['Buys time'], cons: ['Court may question delay'], confidencePct: 60 },
        ],
        'Failure to file charge sheet in time results in default bail under BNSS Sec 479.',
        'Timely charge sheet secures custody, advances prosecution, and demonstrates investigative diligence.',
        'BNSS Sec 250', 'urgent', 'critical'
      ));
    }

    // ── Sort by severity ──────────────────────────────────────────────────────
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    decisions.sort((a, b) => (order[a.severity] ?? 5) - (order[b.severity] ?? 5));

    const criticalCount = decisions.filter((d) => d.severity === 'critical').length;

    return {
      generatedAt:  new Date().toISOString(),
      firId,
      decisions,
      topDecision:  decisions[0] ?? null,
      criticalCount,
      summary: decisions.length === 0
        ? 'No critical decisions required at this time.'
        : `${decisions.length} decision(s) require officer attention — ${criticalCount} critical.`,
    };
  }
}

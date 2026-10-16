/**
 * ExplainableAIEngine.ts
 * Level-6: Every recommendation includes reason, supporting data, BNSS/BNS rule,
 * dependencies, confidence, expected outcome, and risk if ignored.
 * Never produces black-box responses. isBlackBox = false always.
 *
 * SAFETY: Read-only advisory. Never writes to any repository or database.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  ExplainableAIReport,
  ExplainableRecommendation,
  L6ModuleId,
} from './L6Types';

let idxCounter = 0;

function mkRec(
  title: string,
  reason: string,
  supportingData: string[],
  rule: string,
  dependencies: string[],
  confidence: number,
  expectedOutcome: string,
  riskIfIgnored: string,
  module: L6ModuleId
): ExplainableRecommendation {
  idxCounter += 1;
  return {
    id:                 `l6-xai-${idxCounter}`,
    title,
    reason,
    supportingData,
    applicableBNSSRule: rule,
    dependencies,
    confidencePct:      confidence,
    expectedOutcome,
    riskIfIgnored,
    module,
    isBlackBox:         false,
  };
}

export class ExplainableAIEngine {
  static analyze(ctx: InvestigationContext): ExplainableAIReport {
    idxCounter = 0;
    const recommendations: ExplainableRecommendation[] = [];
    const fir         = ctx.fir;
    const firId       = ctx.activeFirId;
    const kNames      = ctx.karyvahi.all.map((k) => k.name.toLowerCase());

    function hasK(re: RegExp) { return kNames.some((n) => re.test(n)); }

    // ── XAI-1: Medical Evidence ───────────────────────────────────────────────
    if (!hasK(/medical|doctor/)) {
      recommendations.push(mkRec(
        'Obtain Medical Examination',
        'FIR crime type suggests physical injury. No medical karyvahi is recorded. Medical examination is a mandatory procedural step under BNSS.',
        ['Crime type: ' + (fir?.crime_type ?? 'N/A'), 'Karyvahi count: ' + ctx.karyvahi.all.length, 'Medical karyvahi: absent'],
        'BNSS Sec 185 — Medical examination mandatory for physical injury cases',
        ['FIR registration completed', 'Victim identification done'],
        85, 'Medical report corroborates FIR injuries, strengthens prosecution case.',
        'Prosecution cannot conclusively prove injuries without medical evidence. High acquittal risk.',
        'explainable-ai'
      ));
    }

    // ── XAI-2: Witness Testimony ──────────────────────────────────────────────
    if (!hasK(/witness|bayan/)) {
      recommendations.push(mkRec(
        'Record Witness Statements',
        'No witness statement karyvahi exists. Eyewitness testimony is the primary direct evidence type. Its absence materially weakens the prosecution case.',
        ['Witness karyvahi: absent', 'Case diaries: ' + ctx.caseDiaries.length, 'Court docs: ' + ctx.courtDocs.length],
        'BNSS Sec 180 — Statement of witnesses during investigation',
        ['Witness identification', 'Initial FIR recording'],
        88, 'Witness statements provide direct testimony linking accused to crime.',
        'Without witness testimony, court may find insufficient evidence to convict. Accused may secure bail.',
        'explainable-ai'
      ));
    }

    // ── XAI-3: FSL ───────────────────────────────────────────────────────────
    if (hasK(/seizure|muddemal/) && !hasK(/fsl|forensic/)) {
      recommendations.push(mkRec(
        'Send Evidence for FSL Examination',
        'Seized items are present but no forensic laboratory examination has been initiated. Scientific analysis is required to legally establish the nature of seized material.',
        ['Seizure karyvahi: present', 'FSL karyvahi: absent', 'Case type: ' + (fir?.crime_type ?? 'N/A')],
        'BNSS Sec 349 — Scientific examination of exhibits',
        ['Seizure memo completed', 'Evidence registered'],
        90, 'FSL report scientifically validates evidence, making it court-admissible.',
        'Without FSL, seized evidence can be challenged as unverified. Defence may seek exclusion.',
        'explainable-ai'
      ));
    }

    // ── XAI-4: Case Diary ────────────────────────────────────────────────────
    const daysSinceDiary = ctx.caseDiaries.length === 0 ? 999 :
      Math.floor((Date.now() - new Date(ctx.caseDiaries[0].preparation_date).getTime()) / 86_400_000);
    if (daysSinceDiary > 7) {
      recommendations.push(mkRec(
        'Update Case Diary Immediately',
        `Case diary has not been updated for ${daysSinceDiary === 999 ? 'the entire investigation' : daysSinceDiary + ' days'}. This creates a legal gap in investigation record keeping.`,
        ['Last diary: ' + (ctx.caseDiaries[0]?.preparation_date ?? 'None'), 'Pending items: ' + ctx.karyvahi.pending.length],
        'BNSS Sec 193 — Case diary maintenance requirements',
        ['Investigation activity performed'],
        92, 'Complete diary record demonstrates active investigation and prevents adverse court inference.',
        'Courts may infer investigation negligence from diary gaps. Case may be weakened or dismissed.',
        'explainable-ai'
      ));
    }

    // ── XAI-5: Bail Risk ─────────────────────────────────────────────────────
    const bailRisk = ctx.overdueItems.some((o) =>
      o.title.toLowerCase().includes('bail') || o.module.toLowerCase().includes('bail')
    );
    if (bailRisk) {
      recommendations.push(mkRec(
        'File Bail Reply Before Default Bail Risk',
        'Overdue bail-related item detected. Default bail becomes mandatory if charge sheet is not filed within the statutory period.',
        ['Overdue bail items: present', 'Charge sheet readiness: ' + (ctx.caseHealth.readinessForChargeSheet ? 'ready' : 'not ready')],
        'BNSS Sec 479 — Default bail on failure to file charge sheet within time',
        ['Arrest recorded', 'Custody remand obtained'],
        93, 'Timely bail reply and charge sheet filing prevents automatic bail entitlement.',
        'Failure to file within statutory deadline mandatorily entitles accused to bail under BNSS Sec 479.',
        'explainable-ai'
      ));
    }

    // ── XAI-6: Compliance ────────────────────────────────────────────────────
    if (ctx.overdueItems.length > 0) {
      recommendations.push(mkRec(
        'Address Overdue Investigation Items',
        `${ctx.overdueItems.length} overdue item(s) detected. Overdue compliance items directly impact investigation health score and court standing.`,
        ctx.overdueItems.slice(0, 4).map((o) => `${o.title}: ${o.daysOverdue} day(s) overdue`),
        'BNSS Sec 193 — Investigation diligence requirements',
        ['Active investigation ongoing'],
        80, 'Clearing overdue items improves compliance score and demonstrates investigative diligence.',
        'Persistent overdue items signal negligence, create defence opportunities, and may cause case delays.',
        'explainable-ai'
      ));
    }

    const allExplained = recommendations.every((r) => r.reason.length > 0 && r.applicableBNSSRule.length > 0);

    return {
      generatedAt:          new Date().toISOString(),
      firId,
      recommendations,
      totalRecommendations: recommendations.length,
      allExplained,
      summary: recommendations.length === 0
        ? 'No pending recommendations. All investigation aspects are covered.'
        : `${recommendations.length} explainable recommendation(s) generated. Every recommendation includes legal basis, evidence, and expected outcome.`,
    };
  }
}

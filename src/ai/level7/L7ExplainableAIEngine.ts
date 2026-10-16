/**
 * L7ExplainableAIEngine.ts
 * Level-7: Enhanced explainable AI — every recommendation includes reason,
 * evidence used, rules applied, dependencies, confidence, alternatives,
 * expected outcome, and risk if ignored.
 *
 * SAFETY: Read-only. No DB access. No black-box decisions.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  L7ExplainableReport, L7ExplainableRec, L7Alternative,
} from './L7Types';

let _recSeq = 0;
function recId(): string { return `xai-l7-${++_recSeq}`; }

function mkAlt(title: string, description: string, tradeoff: string, confidence: number): L7Alternative {
  return { title, description, tradeoff, confidence };
}

function mkRec(
  title: string,
  reason: string,
  evidenceUsed: string[],
  rulesApplied: string[],
  dependencies: string[],
  confidence: number,
  alternatives: L7Alternative[],
  expectedOutcome: string,
  riskIfIgnored: string,
  legalBasis: string,
): L7ExplainableRec {
  return {
    id: recId(),
    title,
    reason,
    evidenceUsed,
    rulesApplied,
    dependencies,
    confidence,
    alternatives,
    expectedOutcome,
    riskIfIgnored,
    legalBasis,
    module: 'explainable-ai',
  };
}

export class L7ExplainableAIEngine {
  static analyze(ctx: InvestigationContext): L7ExplainableReport {
    _recSeq = 0;
    const recs: L7ExplainableRec[] = [];
    const kCompleted = ctx.karyvahi.completed;
    const kAll       = ctx.karyvahi.all;
    const fir        = ctx.fir;

    const doneK = (pats: string[]) => kCompleted.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));
    const hasK  = (pats: string[]) => kAll.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));

    const crimeType  = (fir?.crime_type ?? '').toLowerCase();
    const isViolent  = /assault|murder|rape|hurt|kidnap|मारपीट|हत्या|बलात्कार/.test(crimeType);
    const firAge     = fir
      ? Math.floor((Date.now() - new Date(fir.date_of_information ?? fir.created_at).getTime()) / 86_400_000)
      : 0;
    const lastDiary  = ctx.caseDiaries[0];
    const daysSinceDiary = lastDiary
      ? Math.floor((Date.now() - new Date(lastDiary.preparation_date).getTime()) / 86_400_000)
      : 999;

    // ── XAI-1: Witness Statements ─────────────────────────────────────────────
    if (!doneK(['bayan', 'witness', 'statement', 'बयान'])) {
      recs.push(mkRec(
        'Record Witness Statements Immediately',
        'No witness statements (Bayan) recorded. Oral testimony is the primary pillar of prosecution in non-scientific cases.',
        ['Karyvahi list shows no completed bayan/witness entries', `FIR crime type: ${fir?.crime_type ?? 'N/A'}`],
        ['L7-BNSS-002', 'BNSS Sec 180'],
        ['FIR registered (satisfied)', 'Witness identification (pending)'],
        90,
        [
          mkAlt('Record statements in next 24 hours', 'Call all named witnesses and record statements.', 'Requires officer availability and witness cooperation.', 88),
          mkAlt('Issue Sec 179 notice to witnesses', 'Formally summon witnesses for statement recording.', 'Slower but legally stronger if witness is uncooperative.', 72),
        ],
        'Oral evidence corroborates FIR allegations. Prosecution case strengthened significantly.',
        'Without witness testimony, prosecution relies solely on circumstantial evidence. Acquittal probability increases significantly.',
        'BNSS Sec 180',
      ));
    }

    // ── XAI-2: Medical Report ─────────────────────────────────────────────────
    if (isViolent && !doneK(['medical', 'mlc', 'doctor', 'hospital'])) {
      recs.push(mkRec(
        'Obtain Medical Certificate (MLC) Urgently',
        `Crime type "${fir?.crime_type}" involves physical injury. Medical evidence is mandatory under BNSS Sec 176.`,
        [`FIR crime type: ${fir?.crime_type}`, 'No medical karyvahi completed'],
        ['L7-BNSS-001', 'BNSS Sec 176'],
        ['FIR registered (satisfied)', 'Complainant available (assumed)'],
        92,
        [
          mkAlt('Visit hospital directly with complainant', 'Escort complainant to government hospital for MLC.', 'Most direct. Requires complainant cooperation.', 90),
          mkAlt('Send requisition to CMO', 'Send written requisition to Chief Medical Officer.', 'More formal. May take 1–2 days longer.', 75),
        ],
        'MLC provides objective proof of injury type, weapon used, and timeline. Admissible as expert evidence.',
        'Without MLC, physical injury allegations are unproven. Defense will argue exaggeration or fabrication. Bail becomes easier.',
        'BNSS Sec 176',
      ));
    }

    // ── XAI-3: Seizure Memo ───────────────────────────────────────────────────
    if (!doneK(['seizure', 'panchnama', 'muddemal', 'पंचनामा'])) {
      recs.push(mkRec(
        'Prepare Seizure Memo (Panchnama)',
        'No seizure memo found. Evidence seized without proper documentation is legally vulnerable to challenge.',
        ['No seizure/panchnama karyvahi completed', 'Investigation in progress'],
        ['L7-BNSS-004', 'BNSS Sec 185'],
        ['Evidence collection (assumed from FIR)', 'Panch witnesses availability'],
        87,
        [
          mkAlt('Conduct fresh seizure with panch witnesses', 'Re-conduct or document seizure with two independent witnesses.', 'Ideal. Ensures full legal compliance.', 88),
          mkAlt('Retrospective documentation', 'Document seizure with delayed panchnama if evidence already seized.', 'Weaker legally. Court may question delay.', 60),
        ],
        'Properly documented seizure creates admissible evidence chain. Court cannot exclude duly witnessed exhibits.',
        'Unwitnessed seizure can be challenged as planted evidence. Court may exclude material evidence entirely.',
        'BNSS Sec 185 / CrPC 100',
      ));
    }

    // ── XAI-4: Case Diary Update ──────────────────────────────────────────────
    if (daysSinceDiary > 7 || ctx.caseDiaries.length === 0) {
      const gap = ctx.caseDiaries.length === 0 ? 'never started' : `${daysSinceDiary} days since last entry`;
      recs.push(mkRec(
        'Update Case Diary Immediately',
        `Case diary has not been updated (${gap}). Diary gaps suggest investigation negligence to courts.`,
        [`Last diary preparation_date: ${lastDiary?.preparation_date ?? 'None'}`, `Days since update: ${daysSinceDiary}`],
        ['L7-BNSS-007', 'BNSS Sec 193'],
        ['Investigation activities performed (check karyvahi)'],
        88,
        [
          mkAlt('Update diary today with all activities', 'Record all investigation steps performed since last entry.', 'Must be done regardless of other tasks.', 95),
          mkAlt('Seek supervisor extension', 'Request extension from DSP if valid operational reasons exist.', 'Only if genuine operational impediment exists.', 55),
        ],
        'Current diary demonstrates active investigation. Protects officer from court criticism.',
        'Courts draw adverse inference from investigation gaps. Prosecution case weakened. Officer may face departmental inquiry.',
        'BNSS Sec 193',
      ));
    }

    // ── XAI-5: Charge Sheet Deadline ──────────────────────────────────────────
    if (firAge > 50 && !doneK(['charge sheet', 'arop patra', 'आरोप पत्र'])) {
      recs.push(mkRec(
        'Initiate Charge Sheet Preparation Urgently',
        `FIR is ${firAge} days old. Charge sheet deadline under BNSS Sec 479 is 60 days for custody cases.`,
        [`FIR age: ${firAge} days`, 'Charge sheet not filed'],
        ['L7-BNS-001', 'BNSS Sec 479'],
        ['Medical report', 'Witness statements', 'FSL report', 'Seizure memo'],
        94,
        [
          mkAlt('File complete charge sheet', 'Complete all documents and file with court immediately.', 'Best option. Requires all evidence ready.', 90),
          mkAlt('File interim charge sheet', 'File with available documents, supplementary later.', 'Prevents default bail. Legally permissible.', 75),
        ],
        'Timely charge sheet prevents default bail. Court proceeds with trial. Accused remains in custody.',
        'Default bail granted under BNSS Sec 479 if charge sheet not filed within deadline. Accused released. Investigation compromised.',
        'BNSS Sec 479',
      ));
    }

    // ── XAI-6: FSL Follow-up ─────────────────────────────────────────────────
    if (hasK(['fsl']) && !doneK(['fsl report', 'forensic report', 'fsl result'])) {
      recs.push(mkRec(
        'Follow Up on Pending FSL Report',
        'FSL sample sent but forensic report not received. Scientific evidence chain is incomplete.',
        ['FSL karyvahi present', 'No FSL report karyvahi completed'],
        ['L7-BNSS-006', 'BNSS Sec 349'],
        ['FSL sample dispatch (confirmed)', 'FSL lab acknowledgment receipt'],
        82,
        [
          mkAlt('Visit FSL lab with requisition letter', 'Personal follow-up with authorization letter from SP.', 'Fastest. Shows urgency.', 80),
          mkAlt('Send written reminder to FSL Director', 'Official reminder through proper channel.', 'Formal. Takes longer.', 65),
        ],
        'FSL report provides scientific basis for prosecution. Expert witness can testify in court.',
        'Without FSL report, charge sheet is incomplete. Court may request supplementary report. Scientific evidence gap weakens case.',
        'BNSS Sec 349',
      ));
    }

    const sorted = recs.sort((a, b) => b.confidence - a.confidence);
    const topPriority = sorted[0] ?? null;

    return {
      generatedAt: new Date().toISOString(),
      firId: ctx.activeFirId,
      recommendations: sorted,
      topPriority,
      blackBoxRisk: 'All recommendations above include full evidence trail, rule references, and alternatives. No recommendation is issued without explicit reasoning.',
    };
  }
}

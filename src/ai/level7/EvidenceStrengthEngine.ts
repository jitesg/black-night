/**
 * EvidenceStrengthEngine.ts
 * Level-7: Evaluates evidence strength per allegation across 6 evidence types.
 *
 * SAFETY: Read-only. Pure analysis on InvestigationContext. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  EvidenceStrengthReport, AllegationEvidence, EvidenceScore, EvidenceType, L7Grade,
} from './L7Types';

function toGrade(score: number): L7Grade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function scoreToVerdict(score: number): AllegationEvidence['verdict'] {
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Moderate';
  if (score >= 35) return 'Weak';
  return 'Insufficient';
}

function mkScore(
  type: EvidenceType,
  score: number,
  available: boolean,
  items: string[],
  weaknesses: string[],
  missing: string[],
  contradictions: string[],
): EvidenceScore {
  return { type, score, available, items, weaknesses, missing, contradictions };
}

export class EvidenceStrengthEngine {
  static analyze(ctx: InvestigationContext): EvidenceStrengthReport {
    const kAll       = ctx.karyvahi.all;
    const kCompleted = ctx.karyvahi.completed;
    const fir        = ctx.fir;
    const crimeType  = (fir?.crime_type ?? '').toLowerCase();
    const isViolent  = /assault|murder|rape|hurt|kidnap|dacoity|robbery|मारपीट|हत्या|बलात्कार/.test(crimeType);

    const hasK  = (pats: string[]) => kAll.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));
    const doneK = (pats: string[]) => kCompleted.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));

    // ── Documentary ──────────────────────────────────────────────────────────
    const docItems: string[] = [];
    const docMissing: string[] = [];
    let docScore = 0;
    if (fir) { docItems.push(`FIR ${fir.fir_number}`); docScore += 20; }
    if (ctx.caseDiaries.length > 0) { docItems.push(`Case Diary (${ctx.caseDiaries.length} entries)`); docScore += 20; }
    else docMissing.push('Case Diary');
    if (doneK(['seizure', 'panchnama'])) { docItems.push('Seizure Memo / Panchnama'); docScore += 20; }
    else docMissing.push('Seizure Memo (Panchnama)');
    if (doneK(['arrest memo', 'arrest'])) { docItems.push('Arrest Memo'); docScore += 20; }
    else if (hasK(['arrest', 'giraftari'])) docMissing.push('Arrest Memo');
    if (ctx.gdEntries.length > 0) { docItems.push(`GD Entries (${ctx.gdEntries.length})`); docScore += 20; }
    else docMissing.push('GD Entries');

    // ── Oral ─────────────────────────────────────────────────────────────────
    const oralItems: string[] = [];
    const oralMissing: string[] = [];
    let oralScore = 0;
    const witnessDone = doneK(['bayan', 'witness', 'statement', 'बयान']);
    if (witnessDone) { oralItems.push('Witness Statements (Bayan)'); oralScore += 50; }
    else oralMissing.push('Witness Statements');
    const complainantBayan = doneK(['complainant statement', 'vadi bayan', 'vadini bayan']);
    if (complainantBayan) { oralItems.push('Complainant/Victim Statement'); oralScore += 30; }
    else oralMissing.push('Complainant Statement');
    const accusedStatement = doneK(['accused statement', 'section 160', 'notice 160']);
    if (accusedStatement) { oralItems.push('Accused Statement (Sec 160)'); oralScore += 20; }

    // ── Scientific ───────────────────────────────────────────────────────────
    const sciItems: string[] = [];
    const sciMissing: string[] = [];
    let sciScore = 0;
    const fslDone = doneK(['fsl report', 'fsl result', 'forensic report']);
    const fslPending = hasK(['fsl']) && !fslDone;
    if (fslDone) { sciItems.push('FSL Report Received'); sciScore += 60; }
    else if (fslPending) { sciMissing.push('FSL Report (Pending)'); sciScore += 10; }
    else { sciMissing.push('FSL Not Initiated'); }
    const photoDone = doneK(['photography', 'videography', 'photo', 'e-sakshya']);
    if (photoDone) { sciItems.push('Photography/Videography'); sciScore += 40; }
    else sciMissing.push('Photography/Videography');

    // ── Medical ──────────────────────────────────────────────────────────────
    const medItems: string[] = [];
    const medMissing: string[] = [];
    let medScore = isViolent ? 0 : 60; // not applicable for non-violent
    if (isViolent) {
      const medDone = doneK(['medical', 'mlc', 'doctor', 'hospital', 'चिकित्सा']);
      if (medDone) { medItems.push('Medical Certificate/MLC'); medScore = 70; }
      else medMissing.push('Medical Certificate (MLC)');
      const expertDone = doneK(['expert opinion', 'doctor opinion', 'autopsy', 'pm report']);
      if (expertDone) { medItems.push('Expert Medical Opinion'); medScore = Math.min(100, medScore + 30); }
      else if (isViolent) medMissing.push('Expert Medical Opinion');
    } else {
      medItems.push('Medical evidence not required for this crime type');
    }

    // ── Digital ──────────────────────────────────────────────────────────────
    const digItems: string[] = [];
    const digMissing: string[] = [];
    let digScore = 40; // neutral if no digital angle
    const cctv = doneK(['cctv', 'video evidence', 'digital evidence', 'cyber', 'सीसीटीवी']);
    if (cctv) { digItems.push('CCTV/Digital Evidence'); digScore = 80; }
    const mobileEvidence = hasK(['mobile', 'call record', 'cdr', 'tower']);
    if (mobileEvidence) { digItems.push('Mobile/CDR Evidence'); digScore = Math.min(100, digScore + 20); }
    if (!cctv && !mobileEvidence) digMissing.push('Digital/CCTV Evidence (if applicable)');

    // ── Circumstantial ───────────────────────────────────────────────────────
    const circItems: string[] = [];
    const circMissing: string[] = [];
    let circScore = 0;
    if (ctx.caseDiaries.length >= 3) { circItems.push('Multiple case diary entries'); circScore += 30; }
    if (kCompleted.length >= 5) { circItems.push(`${kCompleted.length} investigation steps completed`); circScore += 30; }
    if (fir?.ghatnasthal) { circItems.push(`Crime location: ${fir.ghatnasthal}`); circScore += 20; }
    else circMissing.push('Crime location documentation');
    if (kCompleted.length < 3) circMissing.push('Insufficient investigation steps completed');
    circScore = Math.min(circScore, 100);

    // ── Contradictions ───────────────────────────────────────────────────────
    const contradictions: string[] = [];
    if (fslPending && doneK(['medical'])) contradictions.push('Medical done but FSL pending — scientific chain incomplete');
    if (doneK(['arrest']) && !doneK(['arrest memo'])) contradictions.push('Arrest recorded but arrest memo missing');

    // ── Allegation analysis ──────────────────────────────────────────────────
    const allegations: AllegationEvidence[] = [];
    const crimeLabel = fir?.crime_type ?? 'Main Offence';
    const mainScores: EvidenceScore[] = [
      mkScore('Documentary', docScore,    docScore > 0,  docItems,  [],     docMissing,  []),
      mkScore('Oral',        oralScore,   oralScore > 0, oralItems, [],     oralMissing, []),
      mkScore('Scientific',  sciScore,    sciScore > 0,  sciItems,  [],     sciMissing,  []),
      mkScore('Medical',     medScore,    medScore > 0,  medItems,  [],     medMissing,  []),
      mkScore('Digital',     digScore,    digScore > 0,  digItems,  [],     digMissing,  []),
      mkScore('Circumstantial', circScore,circScore > 0, circItems, [],     circMissing, []),
    ];
    const mainOverall = Math.round(mainScores.reduce((s, x) => s + x.score, 0) / mainScores.length);
    const mainGaps = [...docMissing, ...oralMissing, ...sciMissing, ...medMissing].filter((x) => !x.includes('not required'));
    allegations.push({
      allegation: crimeLabel,
      scores: mainScores,
      overallScore: mainOverall,
      verdict: scoreToVerdict(mainOverall),
      criticalGaps: mainGaps.slice(0, 5),
    });

    // Section-based allegation (if multiple sections)
    const sections = (fir?.section ?? '').split(/[,;\/]/).map((s) => s.trim()).filter(Boolean);
    for (const sec of sections.slice(0, 3)) {
      if (sec === fir?.section) continue;
      allegations.push({
        allegation: `Section ${sec}`,
        scores: mainScores.map((s) => ({ ...s, score: Math.max(0, s.score - 10) })),
        overallScore: Math.max(0, mainOverall - 10),
        verdict: scoreToVerdict(Math.max(0, mainOverall - 10)),
        criticalGaps: mainGaps.slice(0, 3),
      });
    }

    const overallScore = Math.round(allegations.reduce((s, a) => s + a.overallScore, 0) / Math.max(1, allegations.length));

    return {
      generatedAt: new Date().toISOString(),
      firId: ctx.activeFirId,
      allegations,
      overallScore,
      overallGrade: toGrade(overallScore),
      weakEvidence: [...docMissing, ...oralMissing].slice(0, 5),
      missingEvidence: [...sciMissing, ...medMissing].slice(0, 5),
      contradictions,
      recommendations: [
        ...docMissing.map((m) => `Complete documentary evidence: ${m}`),
        ...oralMissing.map((m) => `Record oral evidence: ${m}`),
        ...contradictions.map((c) => `Resolve contradiction: ${c}`),
      ].slice(0, 6),
    };
  }
}

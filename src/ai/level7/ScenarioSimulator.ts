/**
 * ScenarioSimulator.ts
 * Level-7: Simulates investigation scenarios and generates consequences,
 * legal impact, risks, and recommended actions.
 *
 * SAFETY: Read-only advisory. Pure analysis. No DB access. No writes.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  ScenarioSimulatorReport, SimulationScenario, SimulationResult,
  ScenarioType, ImpactItem, RiskItem, L7Severity,
} from './L7Types';

// ── Scenario catalogue ────────────────────────────────────────────────────────

const ALL_SCENARIOS: SimulationScenario[] = [
  {
    id: 'sim-001', type: 'medical-report-delayed',
    title: 'Medical Report Delayed',
    description: 'Hospital has not submitted MLC/medical report despite repeated follow-ups.',
    trigger: 'Medical karyvahi present but FSL/medical report not received within 30 days.',
  },
  {
    id: 'sim-002', type: 'arrest-cancelled',
    title: 'Arrest Cancelled / Bail Anticipated',
    description: 'Accused likely to secure anticipatory bail or arrest is being reconsidered.',
    trigger: 'Arrest pending and bail application filed.',
  },
  {
    id: 'sim-003', type: 'witness-hostile',
    title: 'Witness Turned Hostile',
    description: 'A key witness has retracted or contradicted earlier statement.',
    trigger: 'Witness statement present but contradiction detected.',
  },
  {
    id: 'sim-004', type: 'fsl-contradicts-witness',
    title: 'FSL Contradicts Witness Statement',
    description: 'Forensic science laboratory report contradicts witness oral testimony.',
    trigger: 'FSL report received and witness statements recorded.',
  },
  {
    id: 'sim-005', type: 'bail-granted',
    title: 'Bail Granted',
    description: 'Court has granted regular or anticipatory bail to the accused.',
    trigger: 'Bail application pending or accused in custody.',
  },
  {
    id: 'sim-006', type: 'new-evidence-received',
    title: 'New Evidence Received',
    description: 'Fresh documentary or forensic evidence received after charge sheet preparation began.',
    trigger: 'Investigation near charge sheet stage.',
  },
  {
    id: 'sim-007', type: 'witness-absent',
    title: 'Witness Unavailable / Absconding',
    description: 'Key witness cannot be located or is not cooperating.',
    trigger: 'Witness named in FIR but no bayan recorded.',
  },
  {
    id: 'sim-008', type: 'charge-sheet-delayed',
    title: 'Charge Sheet Filing Delayed',
    description: 'Investigation not completed within 60-day charge sheet deadline.',
    trigger: 'FIR older than 55 days with charge sheet not ready.',
  },
  {
    id: 'sim-009', type: 'accused-absconding',
    title: 'Accused Absconding',
    description: 'Accused has evaded arrest and cannot be located.',
    trigger: 'Arrest not completed despite FIR registered.',
  },
];

// ── Impact builder ────────────────────────────────────────────────────────────

function mkImpact(area: string, description: string, severity: L7Severity): ImpactItem {
  return { area, description, severity };
}
function mkRisk(risk: string, probability: RiskItem['probability'], mitigation: string): RiskItem {
  return { risk, probability, mitigation };
}

function simulateSingle(
  scenario: SimulationScenario,
  ctx: InvestigationContext,
): SimulationResult {
  const fir = ctx.fir;
  const firNum = fir?.fir_number ?? 'FIR';
  const kCompleted = ctx.karyvahi.completed;
  const doneK = (pats: string[]) => kCompleted.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));

  switch (scenario.type) {
    case 'medical-report-delayed':
      return {
        scenarioId: scenario.id, scenarioTitle: scenario.title,
        consequences: [
          'Medical evidence chain incomplete — prosecution cannot prove physical injury.',
          'Defense will challenge the absence of contemporaneous medical documentation.',
          'Charge sheet filing may be delayed until MLC is obtained.',
        ],
        investigationImpact: [
          mkImpact('Evidence', 'Physical injury evidence lacks corroboration.', 'high'),
          mkImpact('Charge Sheet', 'Cannot file complete charge sheet without MLC.', 'critical'),
          mkImpact('Timeline', 'Investigation timeline extended by medical delay.', 'medium'),
        ],
        legalImpact: [
          mkImpact('Prosecution', 'Court may draw adverse inference from missing medical report.', 'high'),
          mkImpact('Bail', 'Defense may use incomplete evidence to argue for bail.', 'high'),
          mkImpact('BNSS Compliance', 'BNSS Sec 176 compliance failure — mandatory for injury offences.', 'critical'),
        ],
        risks: [
          mkRisk('Acquittal due to missing medical evidence', 'High', 'Escalate to CMO immediately. Send written follow-up.'),
          mkRisk('Bail granted due to incomplete charge sheet', 'Medium', 'File interim charge sheet citing pending FSL/MLC.'),
          mkRisk('Court criticism of investigation quality', 'Medium', 'Maintain diary record of follow-up attempts.'),
        ],
        recommendedActions: [
          'Send formal written request to hospital CMO for MLC.',
          'Visit hospital with SP authorization letter if needed.',
          'Record all follow-up attempts in case diary.',
          'Consult DSP before considering interim charge sheet.',
          'Document all hospital communication for court record.',
        ],
        overallSeverity: 'critical',
        confidencePct: 88,
      };

    case 'arrest-cancelled':
      return {
        scenarioId: scenario.id, scenarioTitle: scenario.title,
        consequences: [
          `Accused in ${firNum} may be released on bail.`,
          'Investigation loses custody advantage for accused examination.',
          'Witness intimidation risk increases significantly.',
        ],
        investigationImpact: [
          mkImpact('Accused Examination', 'Cannot conduct custodial examination under BNSS Sec 187.', 'high'),
          mkImpact('Witness Safety', 'Risk of witness intimidation after accused release.', 'critical'),
          mkImpact('Evidence Preservation', 'Accused may destroy evidence if released.', 'high'),
        ],
        legalImpact: [
          mkImpact('Bail Conditions', 'Court may impose conditions — monitor compliance.', 'medium'),
          mkImpact('Accused Rights', 'Accused has right to anticipatory bail under BNSS.', 'info'),
          mkImpact('Charge Sheet Timeline', 'Charge sheet must still be filed within 60 days.', 'critical'),
        ],
        risks: [
          mkRisk('Witness intimidation by released accused', 'High', 'Provide witness protection. Record witness addresses.'),
          mkRisk('Evidence tampering', 'Medium', 'Secure all seized evidence in malkhana.'),
          mkRisk('Accused absconds after bail', 'Medium', 'Ensure surety and address verification.'),
        ],
        recommendedActions: [
          'Secure all evidence immediately in malkhana.',
          'Inform all witnesses of accused release.',
          'Coordinate with court for bail conditions including no-contact order.',
          'Accelerate charge sheet preparation.',
          'Record accused address and surety details.',
        ],
        overallSeverity: 'high',
        confidencePct: 82,
      };

    case 'witness-hostile':
      return {
        scenarioId: scenario.id, scenarioTitle: scenario.title,
        consequences: [
          'Oral evidence pillar weakened — prosecution loses key testimony.',
          'Defense will use contradiction to challenge entire case.',
          'Remaining evidence must carry the full prosecution burden.',
        ],
        investigationImpact: [
          mkImpact('Oral Evidence', 'Key witness testimony contradicted — oral evidence weakened.', 'critical'),
          mkImpact('Corroboration', 'Need additional witness or documentary corroboration urgently.', 'high'),
          mkImpact('Charge Sheet', 'Charge sheet narrative must address contradiction.', 'high'),
        ],
        legalImpact: [
          mkImpact('Prosecution', 'Hostile witness allows cross-examination by prosecution under Sec 154.', 'medium'),
          mkImpact('Court Credibility', 'Court will scrutinize all evidence more strictly.', 'high'),
          mkImpact('Evidence Act', 'Prior statement under Sec 180 BNSS may be used to contradict.', 'medium'),
        ],
        risks: [
          mkRisk('Case collapse if witness is sole material witness', 'High', 'Identify corroborating witnesses immediately.'),
          mkRisk('Defense argues police tutoring of witness', 'Medium', 'Ensure all statements were recorded without coercion.'),
          mkRisk('Bail granted to accused due to weak oral evidence', 'High', 'Rely on documentary and scientific evidence.'),
        ],
        recommendedActions: [
          'Declare witness hostile in court proceedings.',
          'Cross-examine using original Section 180 statement.',
          'Identify additional corroborating witnesses.',
          'Rely on documentary/forensic evidence chain.',
          'Consult Public Prosecutor before court hearing.',
        ],
        overallSeverity: 'critical',
        confidencePct: 85,
      };

    case 'fsl-contradicts-witness':
      return {
        scenarioId: scenario.id, scenarioTitle: scenario.title,
        consequences: [
          'Scientific and oral evidence in direct contradiction.',
          'Court will likely favor scientific/FSL evidence over oral testimony.',
          'Defense will use contradiction to demolish prosecution case.',
        ],
        investigationImpact: [
          mkImpact('Evidence Chain', 'Fundamental contradiction in evidence chain.', 'critical'),
          mkImpact('Case Theory', 'Investigation narrative requires reassessment.', 'critical'),
          mkImpact('Charge Sheet', 'Charge sheet cannot ignore FSL-witness contradiction.', 'high'),
        ],
        legalImpact: [
          mkImpact('Scientific Evidence', 'FSL report is admissible expert evidence (BNSS Sec 349).', 'high'),
          mkImpact('Oral Evidence', 'Witness may be cross-examined on FSL findings.', 'medium'),
          mkImpact('Acquittal Risk', 'Unexplained contradiction leads to benefit of doubt for accused.', 'critical'),
        ],
        risks: [
          mkRisk('Acquittal due to unexplained contradiction', 'High', 'Investigate reason for contradiction immediately.'),
          mkRisk('Prosecution case theory collapses', 'High', 'Rebuild case theory around scientific evidence.'),
          mkRisk('Officer faces departmental inquiry for poor investigation', 'Medium', 'Document all investigation steps carefully.'),
        ],
        recommendedActions: [
          'Consult DSP/SP and Public Prosecutor immediately.',
          'Obtain FSL expert opinion on contradiction.',
          'Re-examine witness with FSL findings.',
          'Consider filing supplementary charge sheet.',
          'Document all steps to show bona fide investigation.',
        ],
        overallSeverity: 'critical',
        confidencePct: 90,
      };

    case 'bail-granted':
      return {
        scenarioId: scenario.id, scenarioTitle: scenario.title,
        consequences: [
          'Accused released from custody.',
          'Court oversight through bail conditions.',
          'Investigation must continue within bail framework.',
        ],
        investigationImpact: [
          mkImpact('Custodial Examination', 'Custodial examination no longer possible.', 'high'),
          mkImpact('Witness Safety', 'Enhanced witness protection measures needed.', 'high'),
          mkImpact('Evidence', 'Ensure all evidence already secured and documented.', 'medium'),
        ],
        legalImpact: [
          mkImpact('Bail Conditions', 'Monitor accused compliance with bail conditions.', 'medium'),
          mkImpact('Default Bail Risk', 'If charge sheet not filed timely, default bail accrues.', 'critical'),
          mkImpact('Investigation Timeline', 'Must complete charge sheet within statutory period.', 'critical'),
        ],
        risks: [
          mkRisk('Accused violates bail conditions', 'Medium', 'File bail cancellation application immediately on violation.'),
          mkRisk('Witness tampering by accused', 'High', 'Obtain no-contact bail condition from court.'),
          mkRisk('Accused absconds', 'Low', 'Ensure surety is property-owner in jurisdiction.'),
        ],
        recommendedActions: [
          'Verify bail conditions are appropriately restrictive.',
          'Obtain no-contact order for all witnesses.',
          'Accelerate charge sheet preparation.',
          'Monitor accused movements through surety.',
          'Secure all evidence immediately.',
        ],
        overallSeverity: 'high',
        confidencePct: 80,
      };

    case 'new-evidence-received':
      return {
        scenarioId: scenario.id, scenarioTitle: scenario.title,
        consequences: [
          'New evidence may strengthen or complicate existing charge sheet.',
          'Investigation timeline extended to incorporate fresh evidence.',
          'Evidence chain must be updated with proper documentation.',
        ],
        investigationImpact: [
          mkImpact('Evidence Strength', 'Potential to significantly strengthen prosecution case.', 'info'),
          mkImpact('Documentation', 'Fresh seizure memo / panchnama required for new evidence.', 'high'),
          mkImpact('Timeline', 'Case diary must be updated with new evidence discovery.', 'high'),
        ],
        legalImpact: [
          mkImpact('Charge Sheet', 'Supplementary charge sheet may be required.', 'medium'),
          mkImpact('Disclosure', 'All new evidence must be disclosed to accused (BNSS Sec 230).', 'high'),
          mkImpact('Chain of Custody', 'New evidence chain of custody must be documented.', 'critical'),
        ],
        risks: [
          mkRisk('New evidence procedurally challenged', 'Medium', 'Follow proper seizure and custody protocols.'),
          mkRisk('Late evidence excluded by court', 'Low', 'File supplementary charge sheet with court permission.'),
        ],
        recommendedActions: [
          'Prepare fresh seizure memo for new evidence immediately.',
          'Update case diary with new evidence details.',
          'Send for FSL analysis if applicable.',
          'Consult PP on need for supplementary charge sheet.',
          'Document chain of custody from discovery point.',
        ],
        overallSeverity: 'medium',
        confidencePct: 75,
      };

    case 'witness-absent':
      return {
        scenarioId: scenario.id, scenarioTitle: scenario.title,
        consequences: [
          'Key eyewitness testimony cannot be recorded.',
          'Investigation lacks oral evidence corroboration.',
        ],
        investigationImpact: [
          mkImpact('Oral Evidence', 'Witness statement gap weakens prosecution case.', 'high'),
          mkImpact('Investigation Timeline', 'Delay in recording statement extends investigation.', 'medium'),
        ],
        legalImpact: [
          mkImpact('BNSS Sec 179', 'Issue formal notice under Sec 179 for examination.', 'medium'),
          mkImpact('Non-Compliance', 'Witness may be summoned through court.', 'medium'),
        ],
        risks: [mkRisk('Witness permanently unavailable', 'Medium', 'Record other corroborative witnesses. Document attempts.')],
        recommendedActions: [
          'Issue formal notice under BNSS Sec 179.',
          'Record all witness tracing attempts in diary.',
          'Identify alternative corroborating witnesses.',
          'Approach court for witness summons if needed.',
        ],
        overallSeverity: 'high', confidencePct: 78,
      };

    case 'charge-sheet-delayed':
      return {
        scenarioId: scenario.id, scenarioTitle: scenario.title,
        consequences: [
          'Statutory 60-day deadline approaching or passed.',
          'Default bail becomes available to accused.',
          'SP/DSP must be informed of delay with reasons.',
        ],
        investigationImpact: [
          mkImpact('Default Bail', 'Accused entitled to bail if charge sheet not filed.', 'critical'),
          mkImpact('Investigation Pressure', 'Expedite all remaining investigation immediately.', 'critical'),
        ],
        legalImpact: [
          mkImpact('BNSS Sec 479', 'Default bail accrues after 60 days without charge sheet.', 'critical'),
          mkImpact('Court Criticism', 'Delay will be noted by court and may affect officer.', 'high'),
        ],
        risks: [
          mkRisk('Default bail granted to accused', 'High', 'File charge sheet immediately. Seek extension with reasons.'),
          mkRisk('Departmental action for delay', 'Medium', 'Document valid reasons for delay in diary.'),
        ],
        recommendedActions: [
          'File charge sheet within 24 hours if possible.',
          'Seek DSP/SP extension approval with documented reasons.',
          'Prioritize mandatory documents over optional ones.',
          'Consult PP on minimum documents for admissible charge sheet.',
        ],
        overallSeverity: 'critical', confidencePct: 92,
      };

    case 'accused-absconding':
      return {
        scenarioId: scenario.id, scenarioTitle: scenario.title,
        consequences: [
          'Arrest cannot be effected — investigation hampered.',
          'Proclamation under BNSS Sec 84 may be required.',
          'Charge sheet can still be filed as challan.',
        ],
        investigationImpact: [
          mkImpact('Arrest', 'Accused not in custody — custodial examination impossible.', 'high'),
          mkImpact('Charge Sheet', 'File challan (charge sheet) before court without accused.', 'medium'),
        ],
        legalImpact: [
          mkImpact('BNSS Sec 84', 'Issue proclamation for absconding accused.', 'high'),
          mkImpact('Attachment', 'Attach accused property under BNSS Sec 85 if absconding.', 'medium'),
        ],
        risks: [mkRisk('Accused remains at large', 'Medium', 'Issue LOC and inform all border checkposts.')],
        recommendedActions: [
          'Issue proclamation under BNSS Sec 84.',
          'Attach accused property under BNSS Sec 85.',
          'Issue Look-Out Circular (LOC) / Non-Bailable Warrant.',
          'File challan before court with absconding status.',
          'Inform SP/DSP of absconder status.',
        ],
        overallSeverity: 'high', confidencePct: 85,
      };

    default:
      return {
        scenarioId: scenario.id, scenarioTitle: scenario.title,
        consequences: ['Scenario analysis not available for this type.'],
        investigationImpact: [],
        legalImpact: [],
        risks: [],
        recommendedActions: ['Consult DSP/SP for guidance on this scenario.'],
        overallSeverity: 'medium', confidencePct: 60,
      };
  }
}

// ── Active scenario filter ────────────────────────────────────────────────────

function getActiveScenarios(ctx: InvestigationContext): SimulationScenario[] {
  const kAll       = ctx.karyvahi.all;
  const kCompleted = ctx.karyvahi.completed;
  const hasK  = (pats: string[]) => kAll.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));
  const doneK = (pats: string[]) => kCompleted.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));
  const fir   = ctx.fir;
  const firAge = fir
    ? Math.floor((Date.now() - new Date(fir.date_of_information ?? fir.created_at).getTime()) / 86_400_000)
    : 0;

  const active: SimulationScenario[] = [];

  if (hasK(['medical', 'doctor', 'mlc']) && !doneK(['medical report', 'mlc received']))
    active.push(ALL_SCENARIOS.find((s) => s.type === 'medical-report-delayed')!);

  if (hasK(['arrest', 'giraftari']) && ctx.prarthnaPatra.length > 0)
    active.push(ALL_SCENARIOS.find((s) => s.type === 'arrest-cancelled')!);

  if (doneK(['bayan', 'witness', 'statement']))
    active.push(ALL_SCENARIOS.find((s) => s.type === 'witness-hostile')!);

  if (doneK(['fsl report']) && doneK(['bayan', 'witness']))
    active.push(ALL_SCENARIOS.find((s) => s.type === 'fsl-contradicts-witness')!);

  if (ctx.prarthnaPatra.some((p) => /bail/i.test(p.matter ?? '')))
    active.push(ALL_SCENARIOS.find((s) => s.type === 'bail-granted')!);

  if (firAge > 55 && !doneK(['charge sheet', 'arop patra']))
    active.push(ALL_SCENARIOS.find((s) => s.type === 'charge-sheet-delayed')!);

  if (!hasK(['arrest', 'giraftari']) && firAge > 14)
    active.push(ALL_SCENARIOS.find((s) => s.type === 'accused-absconding')!);

  // Always include new-evidence as a proactive scenario
  active.push(ALL_SCENARIOS.find((s) => s.type === 'new-evidence-received')!);

  return active.filter(Boolean);
}

// ── Public API ────────────────────────────────────────────────────────────────

export class ScenarioSimulator {
  /** Returns all defined scenario types */
  static getAllScenarios(): SimulationScenario[] {
    return [...ALL_SCENARIOS];
  }

  /** Simulate a specific scenario type against a context */
  static simulate(type: ScenarioType, ctx: InvestigationContext): SimulationResult {
    const scenario = ALL_SCENARIOS.find((s) => s.type === type);
    if (!scenario) throw new Error(`Unknown scenario type: ${type}`);
    return simulateSingle(scenario, ctx);
  }

  /** Auto-detect and simulate all relevant scenarios for a context */
  static analyzeAll(ctx: InvestigationContext): ScenarioSimulatorReport {
    const active  = getActiveScenarios(ctx);
    const results = active.map((s) => simulateSingle(s, ctx));
    return {
      generatedAt: new Date().toISOString(),
      firId:       ctx.activeFirId,
      scenarios:   active,
      results:     results.sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        return (order[a.overallSeverity] ?? 5) - (order[b.overallSeverity] ?? 5);
      }),
    };
  }
}

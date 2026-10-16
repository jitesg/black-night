/**
 * ChargeSheetValidator.ts
 * Level-7: Validates charge-sheet readiness against mandatory checklist.
 *
 * SAFETY: Read-only. Pure analysis on InvestigationContext. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  ChargeSheetValidatorReport, ChargeSheetCheckItem, L7ReadyState,
} from './L7Types';

function mkCheck(
  id: string, title: string, mandatory: boolean, present: boolean,
  explanation: string, legalBasis?: string,
): ChargeSheetCheckItem {
  const status: ChargeSheetCheckItem['status'] = present
    ? 'Complete'
    : mandatory ? 'Missing' : 'Incomplete';
  return { id, title, mandatory, present, status, explanation, legalBasis };
}

export class ChargeSheetValidator {
  static validate(ctx: InvestigationContext): ChargeSheetValidatorReport {
    const kAll       = ctx.karyvahi.all;
    const kCompleted = ctx.karyvahi.completed;
    const fir        = ctx.fir;
    const crimeType  = (fir?.crime_type ?? '').toLowerCase();
    const isViolent  = /assault|murder|rape|hurt|kidnap|dacoity|robbery|मारपीट|हत्या|बलात्कार/.test(crimeType);

    const hasK  = (pats: string[]) => kAll.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));
    const doneK = (pats: string[]) => kCompleted.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));

    const firAge = fir
      ? Math.floor((Date.now() - new Date(fir.date_of_information ?? fir.created_at).getTime()) / 86_400_000)
      : 0;

    const checks: ChargeSheetCheckItem[] = [
      mkCheck('cs-fir',     'FIR Registered',
        true, !!fir,
        fir ? `FIR ${fir.fir_number} registered.` : 'FIR not found in context.',
        'BNSS Sec 173'),
      mkCheck('cs-diary',   'Case Diary Maintained',
        true, ctx.caseDiaries.length > 0,
        ctx.caseDiaries.length > 0
          ? `${ctx.caseDiaries.length} diary entries present.`
          : 'No case diary entries. Mandatory for charge sheet.',
        'BNSS Sec 193'),
      mkCheck('cs-witness', 'Witness Statements Recorded',
        true, doneK(['bayan', 'witness', 'statement', 'बयान']),
        doneK(['bayan', 'witness', 'statement', 'बयान'])
          ? 'Witness statements completed.'
          : 'No witness statements recorded. Charge sheet without Bayan is incomplete.',
        'BNSS Sec 180'),
      mkCheck('cs-medical', 'Medical Report (if applicable)',
        isViolent, isViolent ? doneK(['medical', 'mlc', 'doctor', 'hospital']) : true,
        isViolent
          ? doneK(['medical', 'mlc', 'doctor']) ? 'Medical report obtained.' : 'Medical report missing for violent offence.'
          : 'Not applicable for this crime type.',
        'BNSS Sec 176'),
      mkCheck('cs-fsl',     'FSL Report (if applicable)',
        hasK(['fsl']), hasK(['fsl']) ? doneK(['fsl report', 'fsl result']) : true,
        hasK(['fsl'])
          ? doneK(['fsl report', 'fsl result']) ? 'FSL report received.' : 'FSL sent but report not received.'
          : 'FSL not required / not initiated.',
        'BNSS Sec 349'),
      mkCheck('cs-seizure', 'Seizure Memo (Panchnama)',
        true, doneK(['seizure', 'panchnama', 'muddemal', 'पंचनामा']),
        doneK(['seizure', 'panchnama']) ? 'Seizure memo prepared.' : 'No seizure memo. Evidence chain incomplete.',
        'BNSS Sec 185'),
      mkCheck('cs-site',    'Site Inspection (Ghatnasthal)',
        true, doneK(['ghatnasthal', 'site inspection', 'scene', 'निरीक्षण']),
        doneK(['ghatnasthal', 'site inspection']) ? 'Site inspection completed.' : 'Site inspection not performed.',
        'BNSS Sec 177'),
      mkCheck('cs-arrest',  'Arrest Documentation',
        hasK(['arrest', 'giraftari']), hasK(['arrest', 'giraftari']) ? doneK(['arrest memo']) : true,
        hasK(['arrest', 'giraftari'])
          ? doneK(['arrest memo']) ? 'Arrest memo prepared.' : 'Arrest done but memo missing.'
          : 'No arrest in this case.',
        'BNSS Sec 47'),
      mkCheck('cs-compliance', 'Legal Compliance (Deadlines)',
        true, firAge <= 60,
        firAge <= 60
          ? `FIR is ${firAge} days old — within charge sheet deadline.`
          : `FIR is ${firAge} days old — charge sheet deadline may have passed. Default bail risk.`,
        'BNSS Sec 479'),
      mkCheck('cs-gd',     'GD Entry for Investigation',
        false, ctx.gdEntries.length > 0,
        ctx.gdEntries.length > 0 ? `${ctx.gdEntries.length} GD entries present.` : 'No GD entries recorded.',
        'Police SOP'),
    ];

    const mandatory      = checks.filter((c) => c.mandatory);
    const missingMandatory = mandatory.filter((c) => !c.present);
    const allMissing     = checks.filter((c) => !c.present).map((c) => c.title);
    const criticalMissing = missingMandatory.map((c) => c.title);
    const completedCount = checks.filter((c) => c.present).length;
    const score          = Math.round((completedCount / checks.length) * 100);

    let readyState: L7ReadyState;
    if (criticalMissing.length === 0 && score >= 80) readyState = 'Ready';
    else if (score >= 50) readyState = 'Partially Ready';
    else readyState = 'Not Ready';

    const estimatedDays = criticalMissing.length * 3 + (allMissing.length - criticalMissing.length) * 1;

    return {
      generatedAt: new Date().toISOString(),
      firId: ctx.activeFirId,
      readyState,
      overallScore: score,
      checks,
      missingItems: allMissing,
      criticalMissing,
      recommendations: criticalMissing.map((m) => `Complete before filing charge sheet: ${m}`),
      estimatedDaysToReady: estimatedDays,
    };
  }
}

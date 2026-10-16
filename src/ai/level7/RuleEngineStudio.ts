/**
 * RuleEngineStudio.ts
 * Level-7: Configurable Rule Engine — supports BNSS, BNS, Police SOPs,
 * Department Orders, Court Procedures, Local Investigation Policies.
 *
 * SAFETY: Read-only. Pure analysis. No DB access. No writes.
 * Future rule packs can be registered via registerPack() without changing business logic.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  L7Rule, RuleEngineReport, RuleViolation, RulePassEntry, L7RuleCategory,
} from './L7Types';

// ── Built-in rule catalogue ───────────────────────────────────────────────────

const BUILT_IN_RULES: L7Rule[] = [
  {
    id: 'L7-BNSS-001', version: '1.0', category: 'BNSS', priority: 1, enabled: true,
    title: 'Medical Examination Mandatory',
    description: 'Injury/assault offences require MLC/medical report.',
    conditions: ['Crime type includes assault/injury/rape/murder', 'No medical karyvahi completed'],
    recommendation: 'Obtain MLC from hospital. Attach doctor opinion to case diary.',
    reasoning: 'Medical evidence corroborates injury allegations and is admissible as expert evidence.',
    explanation: 'Without MLC, prosecution cannot prove physical injury in court. Acquittal risk is high.',
    legalReference: 'BNSS Sec 176 / CrPC 164A', tags: ['medical', 'evidence', 'mandatory'],
  },
  {
    id: 'L7-BNSS-002', version: '1.0', category: 'BNSS', priority: 2, enabled: true,
    title: 'Witness Statement Not Recorded',
    description: 'No Bayan/witness statement recorded in investigation.',
    conditions: ['No bayan karyvahi present', 'Investigation active'],
    recommendation: 'Record statements of all eyewitnesses under BNSS Sec 180.',
    reasoning: 'Oral testimony is primary evidence in non-scientific cases.',
    explanation: 'Absent witness statements leave allegations uncorroborated. Bail becomes easier for accused.',
    legalReference: 'BNSS Sec 180', tags: ['witness', 'statement', 'oral-evidence'],
  },
  {
    id: 'L7-BNSS-003', version: '1.0', category: 'BNSS', priority: 2, enabled: true,
    title: 'Crime Scene Inspection Missing',
    description: 'Ghatnasthal Nirikshan not performed.',
    conditions: ['No ghatnasthal/site inspection karyvahi completed'],
    recommendation: 'Conduct site inspection. Prepare Panchnama with witnesses.',
    reasoning: 'Scene examination preserves physical evidence and establishes locus of crime.',
    explanation: 'Missing scene inspection weakens prosecution case on place/manner of offence.',
    legalReference: 'BNSS Sec 177', tags: ['scene', 'inspection', 'panchnama'],
  },
  {
    id: 'L7-BNSS-004', version: '1.0', category: 'BNSS', priority: 1, enabled: true,
    title: 'Seizure Memo (Panchnama) Missing',
    description: 'Evidence collected but no seizure memo documented.',
    conditions: ['Evidence referenced in FIR', 'No seizure/panchnama karyvahi completed'],
    recommendation: 'Prepare Panchnama in presence of panch witnesses. Describe all items seized.',
    reasoning: 'Unwitnessed seizure is inadmissible. Court may reject evidence.',
    explanation: 'Seizure without proper documentation makes evidence legally vulnerable to challenge.',
    legalReference: 'BNSS Sec 185 / CrPC 100', tags: ['seizure', 'evidence', 'documentary'],
  },
  {
    id: 'L7-BNSS-005', version: '1.0', category: 'BNSS', priority: 1, enabled: true,
    title: 'Arrest Memo Not Prepared',
    description: 'Arrest performed but memo not documented.',
    conditions: ['Arrest karyvahi present', 'No arrest memo recorded'],
    recommendation: 'Prepare arrest memo. Notify nominee/family within 12 hours.',
    reasoning: 'Arrest memo is mandatory constitutional safeguard under Article 22.',
    explanation: 'Missing arrest memo violates BNSS Sec 47, enabling bail application on procedural grounds.',
    legalReference: 'BNSS Sec 47', tags: ['arrest', 'mandatory', 'constitutional'],
  },
  {
    id: 'L7-BNSS-006', version: '1.0', category: 'BNSS', priority: 1, enabled: true,
    title: 'FSL Report Pending',
    description: 'Scientific evidence (FSL) sent but report not received.',
    conditions: ['FSL karyvahi present', 'No FSL report karyvahi completed'],
    recommendation: 'Follow up with FSL. Attach FSL receipt to case diary.',
    reasoning: 'Scientific evidence is often decisive in assault/murder cases.',
    explanation: 'Charge sheet without FSL report is incomplete and may be returned by court.',
    legalReference: 'BNSS Sec 349', tags: ['fsl', 'scientific', 'forensic'],
  },
  {
    id: 'L7-BNSS-007', version: '1.0', category: 'BNSS', priority: 2, enabled: true,
    title: 'Case Diary Not Updated',
    description: 'Case diary not updated for more than 7 days.',
    conditions: ['Last case diary entry > 7 days ago'],
    recommendation: 'Update case diary immediately with all investigation activities.',
    reasoning: 'Regular case diary maintenance demonstrates active investigation diligence.',
    explanation: 'Courts infer investigation neglect from diary gaps. Adverse inference can be drawn.',
    legalReference: 'BNSS Sec 193', tags: ['diary', 'documentation', 'compliance'],
  },
  {
    id: 'L7-BNS-001', version: '1.0', category: 'BNS', priority: 2, enabled: true,
    title: 'Charge Sheet Deadline Risk',
    description: 'Charge sheet deadline approaching (60 days for custody cases).',
    conditions: ['FIR > 50 days old', 'Charge sheet not filed'],
    recommendation: 'Prepare charge sheet immediately. Review with SP/DSP.',
    reasoning: 'Failure to file charge sheet within statutory period results in default bail.',
    explanation: 'Default bail under BNSS Sec 479 cannot be contested once granted.',
    legalReference: 'BNSS Sec 479 / BNS charge sheet timeline', tags: ['charge-sheet', 'deadline', 'bail'],
  },
  {
    id: 'L7-SOP-001', version: '1.0', category: 'Police SOP', priority: 3, enabled: true,
    title: 'GD Entry Missing for Investigation Activity',
    description: 'Investigation movement not recorded in General Diary.',
    conditions: ['Active investigation', 'No GD entry for last 3 days'],
    recommendation: 'Record all investigation movements in GD with details.',
    reasoning: 'GD is an official police register establishing accountability.',
    explanation: 'Missing GD entries create accountability gaps and may affect service record.',
    legalReference: 'Police Station SOP — General Diary Maintenance', tags: ['gd', 'sop', 'accountability'],
  },
  {
    id: 'L7-COURT-001', version: '1.0', category: 'Court Procedure', priority: 1, enabled: true,
    title: 'Court Deadline Imminent',
    description: 'Court compliance deadline within 3 days.',
    conditions: ['Court document deadline <= 3 days'],
    recommendation: 'Prepare and submit court compliance report immediately.',
    reasoning: 'Non-compliance with court orders results in contempt of court proceedings.',
    explanation: 'Delayed court compliance risks warrant issue against investigating officer.',
    legalReference: 'BNSS Sec 230 / Court SOP', tags: ['court', 'deadline', 'compliance'],
  },
];

// ── Registry: packs can be added at runtime ───────────────────────────────────

const _registry: L7Rule[] = [...BUILT_IN_RULES];

export const RuleEngineStudio = {
  /** Register a new rule pack (idempotent by rule id) */
  registerPack(rules: L7Rule[]): void {
    for (const r of rules) {
      const idx = _registry.findIndex((x) => x.id === r.id);
      if (idx >= 0) _registry[idx] = r;
      else _registry.push(r);
    }
  },

  /** Get all rules, optionally filtered */
  getRules(opts?: { category?: L7RuleCategory; enabled?: boolean }): L7Rule[] {
    return _registry.filter((r) => {
      if (opts?.category !== undefined && r.category !== opts.category) return false;
      if (opts?.enabled  !== undefined && r.enabled  !== opts.enabled)  return false;
      return true;
    });
  },

  /** Core evaluator — returns violations + passes */
  evaluate(ctx: InvestigationContext): RuleEngineReport {
    const enabled = _registry.filter((r) => r.enabled);
    const violations: RuleViolation[] = [];
    const passed: RulePassEntry[]     = [];

    const kAll       = ctx.karyvahi.all;
    const kCompleted = ctx.karyvahi.completed;
    const hasK  = (patterns: string[]) => kAll.some((k) => patterns.some((p) => k.name.toLowerCase().includes(p.toLowerCase())));
    const doneK = (patterns: string[]) => kCompleted.some((k) => patterns.some((p) => k.name.toLowerCase().includes(p.toLowerCase())));
    const fir   = ctx.fir;
    const firAge = fir
      ? Math.floor((Date.now() - new Date(fir.date_of_information ?? fir.created_at).getTime()) / 86_400_000)
      : 0;
    const lastDiary = ctx.caseDiaries[0];
    const daysSinceDiary = lastDiary
      ? Math.floor((Date.now() - new Date(lastDiary.preparation_date).getTime()) / 86_400_000)
      : 999;
    const nearCourtDeadline = ctx.courtDocs.some((d) => {
      if (!d.deadline_date) return false;
      const days = Math.ceil((new Date(d.deadline_date).getTime() - Date.now()) / 86_400_000);
      return days >= 0 && days <= 3;
    });
    const crimeType = (fir?.crime_type ?? '').toLowerCase();
    const isViolent = /assault|murder|rape|hurt|kidnap|robbery|dacoity|मारपीट|हत्या|बलात्कार/.test(crimeType);

    for (const rule of enabled) {
      let fired = false;

      switch (rule.id) {
        case 'L7-BNSS-001':
          fired = isViolent && !doneK(['medical', 'doctor', 'mlc', 'hospital', 'चिकित्सा']);
          break;
        case 'L7-BNSS-002':
          fired = !hasK(['bayan', 'witness', 'statement', 'gavah', 'बयान', 'गवाह']);
          break;
        case 'L7-BNSS-003':
          fired = !doneK(['ghatnasthal', 'site inspection', 'scene', 'निरीक्षण']);
          break;
        case 'L7-BNSS-004':
          fired = !doneK(['seizure', 'panchnama', 'muddemal', 'पंचनामा', 'जब्ती']);
          break;
        case 'L7-BNSS-005':
          fired = hasK(['arrest', 'giraftari', 'गिरफ्तारी']) && !doneK(['arrest memo']);
          break;
        case 'L7-BNSS-006':
          fired = hasK(['fsl']) && !doneK(['fsl report', 'fsl result', 'forensic']);
          break;
        case 'L7-BNSS-007':
          fired = daysSinceDiary > 7;
          break;
        case 'L7-BNS-001':
          fired = firAge > 50 && !doneK(['charge sheet', 'arop patra', 'आरोप पत्र']);
          break;
        case 'L7-SOP-001':
          fired = ctx.gdEntries.length === 0;
          break;
        case 'L7-COURT-001':
          fired = nearCourtDeadline;
          break;
        default:
          fired = false;
      }

      if (fired) {
        violations.push({
          ruleId: rule.id, ruleTitle: rule.title, category: rule.category,
          severity: rule.priority === 1 ? 'critical' : rule.priority === 2 ? 'high' : 'medium',
          priority: rule.priority, recommendation: rule.recommendation,
          reasoning: rule.reasoning, explanation: rule.explanation,
          legalReference: rule.legalReference,
        });
      } else {
        passed.push({ ruleId: rule.id, ruleTitle: rule.title, category: rule.category });
      }
    }

    const byCategory = {} as Record<L7RuleCategory, number>;
    for (const r of enabled) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;

    const compliance = enabled.length === 0 ? 100
      : Math.round((passed.length / enabled.length) * 100);

    return {
      generatedAt: new Date().toISOString(),
      firId: ctx.activeFirId,
      totalRules: _registry.length,
      enabledRules: enabled.length,
      firedRules: violations.length,
      passedRules: passed.length,
      rulesByCategory: byCategory,
      violations: violations.sort((a, b) => a.priority - b.priority),
      passed,
      overallCompliance: compliance,
    };
  },
};

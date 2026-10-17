/**
 * rules.ts
 * Configuration-driven investigation rule catalogue.
 *
 * EXTENSIBILITY: Add new rules here with ZERO code changes elsewhere.
 * The RuleEngine reads this array at runtime — no recompilation needed.
 * Rules are pure data — no functions, no side effects.
 */

import type { InvestigationRule } from './ReasoningTypes';

export const INVESTIGATION_RULES: InvestigationRule[] = [
  // ── RULE-001: Medical examination ─────────────────────────────────────────
  {
    id: 'RULE-001',
    title: 'Medical Examination Pending',
    description: 'Injury or assault-related offences require a medical examination report.',
    priority: 1,
    severity: 'critical',
    applicableCrimeTypes: ['Assault', 'Grievous Hurt', 'Rape', 'Murder', 'Kidnapping', 'Domestic Violence', 'मारपीट', 'हत्या', 'बलात्कार', 'दुष्कर्म'],
    applicableSections: ['IPC 302', 'IPC 304', 'IPC 307', 'IPC 323', 'IPC 324', 'IPC 325', 'IPC 326', 'IPC 354', 'IPC 376', 'BNS 103', 'BNS 109', 'BNS 118', 'BNS 63'],
    requiredProceedingsPresent: ['medical', 'doctor', 'hospital', 'MLC', 'चिकित्सा', 'अस्पताल'],
    recommendation: 'Arrange medical examination of victim/accused immediately. Collect MLC report and doctor\'s opinion.',
    modulesAnalysed: ['FIR', 'Karyvahi', 'CaseDiary'],
    legalReference: 'BNSS Section 176 / CrPC Section 164A — Medical examination mandatory for offences involving injury.',
  },

  // ── RULE-002: Witness statement missing ───────────────────────────────────
  {
    id: 'RULE-002',
    title: 'Witness Statement Missing',
    description: 'No witness statement (Bayan) has been recorded in the investigation.',
    priority: 2,
    severity: 'high',
    requiredProceedingsPresent: ['bayan', 'statement', 'witness', 'gavah', 'बयान', 'गवाह', 'साक्षी'],
    recommendation: 'Record statements of all available witnesses under BNSS Section 180. Document each statement in Case Diary.',
    modulesAnalysed: ['Karyvahi', 'CaseDiary'],
    legalReference: 'BNSS Section 180 / CrPC Section 161 — Oral examination of witnesses by police.',
  },

  // ── RULE-003: Site inspection missing ────────────────────────────────────
  {
    id: 'RULE-003',
    title: 'Crime Scene Inspection Missing',
    description: 'Ghatnasthal Nirikshan (site inspection) has not been performed.',
    priority: 2,
    severity: 'high',
    requiredProceedingsPresent: ['ghatnasthal', 'site inspection', 'scene', 'स्थल', 'निरीक्षण', 'घटनास्थल'],
    recommendation: 'Conduct Ghatnasthal Nirikshan immediately. Prepare site inspection report with photographs.',
    modulesAnalysed: ['Karyvahi', 'CaseDiary'],
    legalReference: 'BNSS Section 177 — Investigation at scene of offence.',
  },

  // ── RULE-004: Seizure memo missing ───────────────────────────────────────
  {
    id: 'RULE-004',
    title: 'Seizure Memo (Panchnama) Missing',
    description: 'Evidence was likely collected but no seizure memo or panchnama is recorded.',
    priority: 2,
    severity: 'high',
    requiredProceedingsPresent: ['seizure', 'panchnama', 'muddemal', 'जब्ती', 'पंचनामा', 'मुददेमाल'],
    recommendation: 'Prepare seizure memo (Panchnama) in presence of witnesses. Record all seized items with descriptions.',
    modulesAnalysed: ['Karyvahi', 'CaseDiary'],
    legalReference: 'BNSS Section 185 / CrPC Section 100 — Search and seizure must be witnessed.',
  },

  // ── RULE-005: Arrest memo absent ─────────────────────────────────────────
  {
    id: 'RULE-005',
    title: 'Arrest Memo Missing',
    description: 'Arrest action is recorded but arrest memo is not documented.',
    priority: 1,
    severity: 'critical',
    requiredProceedingsPresent: ['arrest', 'giraftari', 'गिरफ्तारी', 'arrested'],
    requiredProceedingsCompleted: ['arrest memo', 'giraftari memo', 'गिरफ्तारी मेमो'],
    recommendation: 'Prepare arrest memo immediately. Inform family/nominee of arrested person as required by BNSS.',
    modulesAnalysed: ['Karyvahi', 'CaseDiary'],
    legalReference: 'BNSS Section 47 — Arrest memo mandatory. Family notification mandatory.',
  },

  // ── RULE-006: Bail granted but order absent ───────────────────────────────
  {
    id: 'RULE-006',
    title: 'Bail Order Not Filed',
    description: 'Bail has been granted in court but the bail order document is not uploaded.',
    priority: 2,
    severity: 'high',
    requiredCourtDocTypes: ['Bail'],
    recommendation: 'Obtain certified copy of bail order from court. Upload to Nyayalay module and link to FIR.',
    modulesAnalysed: ['Court', 'Karyvahi'],
    legalReference: 'BNSS Section 479 — Bail conditions must be documented.',
  },

  // ── RULE-007: Court hearing without preparation ───────────────────────────
  {
    id: 'RULE-007',
    title: 'Upcoming Court Hearing — Preparation Required',
    description: 'A court hearing is scheduled within 7 days but no preparation Karyvahi is recorded.',
    priority: 1,
    severity: 'critical',
    requiredCourtDocTypes: ['Summons', 'Warrant', 'Challan'],
    recommendation: 'Prepare court report, gather all documents, and ensure all witnesses are notified.',
    modulesAnalysed: ['Court', 'Karyvahi', 'CaseDiary'],
    legalReference: 'BNSS — Police duty to produce accused and documents on scheduled date.',
  },

  // ── RULE-008: FSL report pending ─────────────────────────────────────────
  {
    id: 'RULE-008',
    title: 'FSL Report Pending',
    description: 'FSL (Forensic Science Laboratory) was requested but report has not been received.',
    priority: 2,
    severity: 'high',
    requiredProceedingsPresent: ['fsl', 'forensic', 'lab report', 'एफएसएल', 'फोरेंसिक'],
    recommendation: 'Follow up with FSL for pending report. Document follow-up action in Case Diary.',
    modulesAnalysed: ['Karyvahi', 'CaseDiary'],
    legalReference: 'BNSS Section 349 — Scientific evidence admissibility requires complete FSL chain.',
  },

  // ── RULE-009: Mandatory BNSS notice missing ───────────────────────────────
  {
    id: 'RULE-009',
    title: 'Mandatory BNSS Notice Missing',
    description: 'A notice under BNSS Section 35 or 179 is required but not issued.',
    priority: 2,
    severity: 'high',
    applicableSections: ['BNSS 35', 'BNSS 179', 'BNSS 41', 'CrPC 41A'],
    requiredProceedingsPresent: ['notice', 'summons', 'नोटिस', 'समन'],
    recommendation: 'Issue mandatory notice to accused/witness. Record acknowledgement. File copy in case diary.',
    modulesAnalysed: ['Karyvahi', 'CaseDiary', 'Court'],
    legalReference: 'BNSS Section 35(3) / 179 — Notice mandatory before arrest in cognizable cases.',
  },

  // ── RULE-010: Mandatory Case Diary entry missing ──────────────────────────
  {
    id: 'RULE-010',
    title: 'Case Diary Entry Missing',
    description: 'No Case Diary entry has been made for more than 7 days.',
    priority: 2,
    severity: 'high',
    requiresCaseDiary: true,
    recommendation: 'Prepare Case Diary entry for each day of investigation activity as required by law.',
    modulesAnalysed: ['CaseDiary', 'FIR'],
    legalReference: 'BNSS Section 193 / CrPC Section 172 — Daily diary of investigation mandatory.',
  },

  // ── RULE-011: Charge sheet incomplete ────────────────────────────────────
  {
    id: 'RULE-011',
    title: 'Charge Sheet Completion Pending',
    description: 'Charge sheet deadline approaching but key investigation steps are incomplete.',
    priority: 1,
    severity: 'critical',
    onlyWhenPending: true,
    requiredProceedingsPresent: ['charge sheet', 'challan', 'चालान', 'आरोप पत्र'],
    recommendation: 'Complete all pending karyvahi before filing charge sheet. Ensure all evidence, witnesses, and documents are in order.',
    modulesAnalysed: ['FIR', 'Karyvahi', 'CaseDiary', 'Court'],
    legalReference: 'BNSS Section 193 — Charge sheet must be filed within prescribed period.',
  },

  // ── RULE-012: Complainant statement missing ───────────────────────────────
  {
    id: 'RULE-012',
    title: 'Complainant / Victim Statement Missing',
    description: 'No statement of the complainant or victim is on record.',
    priority: 2,
    severity: 'high',
    requiredProceedingsPresent: ['bayan vadi', 'complainant statement', 'victim statement', 'वादी', 'पीड़ित', 'शिकायतकर्ता', 'वादी/वादिनी का बयान'],
    recommendation: 'Record statement of complainant/victim under BNSS Section 180. Ensure signature and witness.',
    modulesAnalysed: ['Karyvahi', 'CaseDiary'],
    legalReference: 'BNSS Section 180 — Complainant statement is primary evidence.',
  },

  // ── RULE-013: Accused examination missing ────────────────────────────────
  {
    id: 'RULE-013',
    title: 'Accused Examination Not Recorded',
    description: 'Accused has not been examined or statement is absent.',
    priority: 3,
    severity: 'medium',
    requiredProceedingsPresent: ['accused statement', 'aaropit bayan', 'आरोपी', 'examination of accused'],
    recommendation: 'Record accused examination under BNSS Section 183. Ensure rights are communicated.',
    modulesAnalysed: ['Karyvahi', 'CaseDiary'],
    legalReference: 'BNSS Section 183 — Examination of accused by Magistrate.',
  },

  // ── RULE-014: Videography missing ────────────────────────────────────────
  {
    id: 'RULE-014',
    title: 'e-Sakshya Videography Missing',
    description: 'Mandatory videography through e-Sakshya app has not been performed.',
    priority: 3,
    severity: 'medium',
    requiredProceedingsPresent: ['e-sakshya', 'videography', 'video', 'ई-साक्ष्य', 'वीडियोग्राफी', 'ई-साक्ष्य ऐप से वीडियोग्राफी'],
    recommendation: 'Conduct e-Sakshya videography of crime scene, seizure, and key investigation actions.',
    modulesAnalysed: ['Karyvahi'],
    legalReference: 'BNSS Section 105 — Mandatory videography for specified offences.',
  },

  // ── RULE-015: Nakal Chick / Rapat not reviewed ────────────────────────────
  {
    id: 'RULE-015',
    title: 'Nakal Chick / Rapat Review Pending',
    description: 'Avlokan of Nakal Chick and Nakal Rapat has not been completed.',
    priority: 3,
    severity: 'medium',
    requiredProceedingsCompleted: ['avlokan nakal chick', 'avlokan nakal rapat', 'नकल चिक', 'नकल रपट', 'नकल चिक का अवलोकन', 'नकल रपट का अवलोकन'],
    recommendation: 'Complete review of Nakal Chick and Nakal Rapat entries.',
    modulesAnalysed: ['FIR', 'Karyvahi'],
  },

  // ── RULE-016: Prarthna Patra deadline approaching ─────────────────────────
  {
    id: 'RULE-016',
    title: 'Prarthna Patra Deadline Approaching',
    description: 'One or more Prarthna Patra (petitions) have an approaching deadline.',
    priority: 2,
    severity: 'high',
    recommendation: 'Review pending Prarthna Patra and prepare disposal reports before deadline.',
    modulesAnalysed: ['PrarthnaPatra'],
    legalReference: 'SP/DCP directives — Petitions must be disposed within prescribed time.',
  },

  // ── RULE-017: No GD entry in 48 hours ────────────────────────────────────
  {
    id: 'RULE-017',
    title: 'General Diary Entry Gap',
    description: 'No General Diary entry has been made in the last 48 hours during active investigation.',
    priority: 4,
    severity: 'medium',
    recommendation: 'Make GD entry for all movements, actions, and activities as required.',
    modulesAnalysed: ['GD', 'FIR'],
    legalReference: 'Standing Order — All police movements must be recorded in GD.',
  },
];

/** Fast lookup by rule ID */
export function getRuleById(id: string): InvestigationRule | undefined {
  return INVESTIGATION_RULES.find((r) => r.id === id);
}

/** Get all rules applicable to a given crime type and sections */
export function getApplicableRules(crimeType: string, sections: string): InvestigationRule[] {
  const ct = crimeType.toLowerCase();
  const sec = sections.toLowerCase();
  return INVESTIGATION_RULES.filter((r) => {
    const crimeMatch = !r.applicableCrimeTypes || r.applicableCrimeTypes.some((c) => ct.includes(c.toLowerCase()));
    const sectionMatch = !r.applicableSections || r.applicableSections.some((s) => sec.includes(s.toLowerCase()));
    return crimeMatch && sectionMatch;
  }).sort((a, b) => a.priority - b.priority);
}

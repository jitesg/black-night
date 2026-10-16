/**
 * complianceRules.ts
 * Configuration-driven legal compliance rules for the LegalComplianceEngine.
 * Each rule includes a checkKey that the engine maps to a pure function.
 *
 * SAFETY: Pure configuration. No DB access.
 */

import type { ComplianceRule } from './IntelligenceTypes';

export const COMPLIANCE_RULES: ComplianceRule[] = [
  // ── Arrest & Custody ──────────────────────────────────────────────────────
  {
    id: 'CMP-001',
    title: 'Arrest Memo Not Prepared',
    description: 'Accused arrested but Arrest Memo not found in investigation record.',
    severity: 'critical',
    legalReference: 'BNSS Section 47 — Arrest memo with two witnesses mandatory.',
    checkKey: 'arrest_without_memo',
    recommendation: 'Prepare arrest memo immediately with two witness signatures.',
    category: 'arrest',
  },
  {
    id: 'CMP-002',
    title: 'Court Production within 24 Hours Missed',
    description: 'Accused arrested but not produced in court within 24 hours.',
    severity: 'critical',
    legalReference: 'BNSS Section 56 — Every arrested person must be produced before magistrate within 24 hours.',
    checkKey: 'production_deadline_missed',
    recommendation: 'Produce accused in court immediately. Seek bail/remand as applicable.',
    category: 'custody',
  },
  {
    id: 'CMP-003',
    title: 'Custody Period Exceeded Without Court Permission',
    description: 'Accused in custody beyond 15/60/90 days without court order.',
    severity: 'critical',
    legalReference: 'BNSS Section 187 — Maximum custody periods strictly defined.',
    checkKey: 'custody_period_exceeded',
    recommendation: 'Ensure all court remand orders are in place. File charge sheet or seek bail immediately.',
    category: 'custody',
  },
  // ── Notice & Search ───────────────────────────────────────────────────────
  {
    id: 'CMP-004',
    title: 'Search Without Witness (Panchnama Missing)',
    description: 'Search was conducted but no witness/panchnama documentation found.',
    severity: 'high',
    legalReference: 'BNSS Section 185 — Search must be conducted in presence of two independent witnesses.',
    checkKey: 'search_without_panchnama',
    recommendation: 'Prepare retrospective panchnama with available witnesses. Document the search properly.',
    category: 'search',
  },
  {
    id: 'CMP-005',
    title: 'Seizure Without Panchnama',
    description: 'Evidence seized but no seizure memo/panchnama prepared.',
    severity: 'high',
    legalReference: 'BNSS Section 187 — All seizures must be documented with panchnama.',
    checkKey: 'seizure_without_memo',
    recommendation: 'Prepare seizure memo with independent witnesses. Evidence without memo may be inadmissible.',
    category: 'seizure',
  },
  // ── Charge Sheet Timelines ─────────────────────────────────────────────────
  {
    id: 'CMP-006',
    title: 'Charge Sheet Period Approaching (50+ Days)',
    description: 'FIR registered 50+ days ago without charge sheet filed.',
    severity: 'high',
    legalReference: 'BNSS Section 193 — Charge sheet must be filed within 60/90 days to prevent default bail.',
    checkKey: 'chargesheet_deadline_approaching',
    recommendation: 'Complete all pending investigation. Prepare charge sheet immediately.',
    category: 'chargesheet',
  },
  {
    id: 'CMP-007',
    title: 'Default Bail Risk — Charge Sheet Overdue',
    description: 'Accused in custody and charge sheet period (60/90 days) has expired.',
    severity: 'critical',
    legalReference: 'BNSS Section 479 — Accused entitled to default bail if charge sheet not filed in time.',
    checkKey: 'default_bail_risk',
    recommendation: 'File charge sheet immediately or accused will obtain default bail.',
    category: 'bail',
  },
  // ── Medical & FSL ──────────────────────────────────────────────────────────
  {
    id: 'CMP-008',
    title: 'Medical Examination of Victim Missing',
    description: 'Victim medical examination / MLC not obtained for offence involving bodily harm.',
    severity: 'high',
    legalReference: 'BNSS Section 198 — Mandatory medical examination for cases involving injury.',
    checkKey: 'medical_exam_missing',
    recommendation: 'Obtain MLC / medical examination report from government hospital immediately.',
    category: 'medical',
  },
  {
    id: 'CMP-009',
    title: 'FSL Report Not Obtained',
    description: 'Physical evidence collected but FSL referral and report not on record.',
    severity: 'high',
    legalReference: 'BNSS Section 349 — FSL examination of physical evidence is mandatory.',
    checkKey: 'fsl_missing',
    recommendation: 'Send evidence to FSL immediately. Follow up for report.',
    category: 'fsl',
  },
  // ── Court Compliance ───────────────────────────────────────────────────────
  {
    id: 'CMP-010',
    title: 'Court Deadline Missed',
    description: 'One or more Nyayalay documents have passed their deadline without completion.',
    severity: 'critical',
    legalReference: 'BNSS — Failure to comply with court orders constitutes contempt.',
    checkKey: 'court_deadline_missed',
    recommendation: 'Contact court immediately. Explain delay. File compliance report.',
    category: 'court',
  },
  {
    id: 'CMP-011',
    title: 'Case Diary Not Maintained',
    description: 'Investigation in progress but no Case Diary entries recorded.',
    severity: 'high',
    legalReference: 'BNSS Section 193 — Case Diary is a statutory obligation of the investigating officer.',
    checkKey: 'case_diary_missing',
    recommendation: 'Start maintaining Case Diary immediately. Record all investigation steps.',
    category: 'court',
  },
  {
    id: 'CMP-012',
    title: 'Investigation Inactivity — No Action in 7+ Days',
    description: 'No karyvahi or case diary entry recorded in the past 7 days on a pending case.',
    severity: 'high',
    legalReference: 'BNSS Section 193 — Investigation must be diligently and continuously pursued.',
    checkKey: 'investigation_inactive',
    recommendation: 'Take immediate investigative action. Record all steps in Case Diary.',
    category: 'court',
  },
];

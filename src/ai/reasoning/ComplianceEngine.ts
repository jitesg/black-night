/**
 * ComplianceEngine.ts
 * Checks mandatory proceeding and documentation requirements from BNSS / CrPC.
 * Produces structured compliance findings with legal references.
 *
 * Distinct from PolicyEngine (which checks time-based deadlines) —
 * ComplianceEngine checks whether MANDATORY actions exist at all.
 *
 * SAFETY: Read-only. Pure analysis. No writes.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { Finding } from './ReasoningTypes';

interface MandatoryRequirement {
  id: string;
  title: string;
  description: string;
  severity: Finding['severity'];
  legalReference: string;
  recommendation: string;
  modulesAnalysed: string[];
  /** true = this requirement only applies when there are no FIR proceedings recorded */
  requiresFIR?: boolean;
  check: (ctx: InvestigationContext) => boolean; // true = MISSING (fires finding)
}

const MANDATORY_REQUIREMENTS: MandatoryRequirement[] = [
  {
    id: 'COMP-001',
    title: 'Zero Karyvahi Despite Pending FIR',
    description: 'No investigation steps (Karyvahi) recorded for a pending FIR.',
    severity: 'critical',
    legalReference: 'BNSS Section 193 — Investigation must proceed without delay.',
    recommendation: 'Immediately begin investigation. Record each step as Karyvahi.',
    modulesAnalysed: ['FIR', 'Karyvahi'],
    requiresFIR: true,
    check: (ctx) => ctx.fir?.status === 'Pending' && ctx.karyvahi.all.length === 0,
  },
  {
    id: 'COMP-002',
    title: 'No Case Diary for FIR',
    description: 'Not a single Case Diary entry exists for this FIR.',
    severity: 'high',
    legalReference: 'BNSS Section 193 / CrPC 172 — Daily diary is a statutory requirement.',
    recommendation: 'Create Case Diary entries for all investigation activities taken so far.',
    modulesAnalysed: ['CaseDiary', 'FIR'],
    requiresFIR: true,
    check: (ctx) => ctx.fir?.status === 'Pending' && ctx.caseDiaries.length === 0,
  },
  {
    id: 'COMP-003',
    title: 'e-Sakshya Videography Not Initiated',
    description: 'Mandatory videography for investigation has not been started.',
    severity: 'medium',
    legalReference: 'BNSS Section 105 — Videography mandatory for serious offences.',
    recommendation: 'Initiate e-Sakshya videography using approved app for all key investigation activities.',
    modulesAnalysed: ['Karyvahi'],
    requiresFIR: true,
    check: (ctx) => {
      if (!ctx.fir) return false;
      const serious = /murder|rape|robbery|kidnap|हत्या|बलात्कार|डकैती|अपहरण/i.test(ctx.fir.crime_type ?? '');
      if (!serious) return false;
      return !ctx.karyvahi.all.some((k) => /video|e-sakshya|ई-साक्ष्य/i.test(k.name));
    },
  },
  {
    id: 'COMP-004',
    title: 'Bail Granted Without Documentation',
    description: 'An accused is marked as bailed/released without any court bail documentation.',
    severity: 'high',
    legalReference: 'BNSS Section 479 — All bail orders must be documented.',
    recommendation: 'Upload certified bail order. Record bail conditions.',
    modulesAnalysed: ['Court', 'Karyvahi'],
    check: (ctx) => {
      const hasBailKaryvahi = ctx.karyvahi.completed.some((k) => /bail|ज़मानत/i.test(k.name));
      const hasBailCourtDoc = ctx.courtDocs.some((d) => d.sub_type === 'Bail');
      return hasBailKaryvahi && !hasBailCourtDoc;
    },
  },
  {
    id: 'COMP-005',
    title: 'Witness Count Insufficient',
    description: 'Fewer than 2 distinct witness statements recorded.',
    severity: 'medium',
    legalReference: 'BNSS Section 180 — Corroborative witness statements strengthen prosecution.',
    recommendation: 'Identify and record statements from at least 2 independent witnesses.',
    modulesAnalysed: ['Karyvahi'],
    requiresFIR: true,
    check: (ctx) => {
      const witnessEntries = ctx.karyvahi.all.filter((k) =>
        /bayan|statement|witness|gavah|बयान|गवाह/i.test(k.name)
      );
      return ctx.fir?.status === 'Pending' && witnessEntries.length < 2;
    },
  },
  {
    id: 'COMP-006',
    title: 'No Court Proceedings Despite Arrest',
    description: 'Arrest Karyvahi exists but no court documents/proceedings recorded.',
    severity: 'high',
    legalReference: 'BNSS Section 57 — Arrested person must be produced before Magistrate within 24 hours.',
    recommendation: 'Produce arrested person before Magistrate. File court documents immediately.',
    modulesAnalysed: ['Karyvahi', 'Court'],
    check: (ctx) => {
      const hasArrest = ctx.karyvahi.completed.some((k) => /arrest|giraftari|गिरफ्तारी/i.test(k.name));
      return hasArrest && ctx.courtDocs.length === 0;
    },
  },
];

export class ComplianceEngine {
  static evaluate(ctx: InvestigationContext): Finding[] {
    const findings: Finding[] = [];
    const now = new Date().toISOString();
    let fc = 0;

    for (const req of MANDATORY_REQUIREMENTS) {
      if (req.requiresFIR && !ctx.fir) continue;
      try {
        if (req.check(ctx)) {
          findings.push({
            id: `comp-finding-${++fc}`,
            ruleId: req.id,
            ruleTitle: req.title,
            severity: req.severity,
            title: req.title,
            detail: req.description,
            recommendation: req.recommendation,
            modulesAnalysed: req.modulesAnalysed,
            legalReference: req.legalReference,
            generatedAt: now,
          });
        }
      } catch {
        // Non-fatal
      }
    }

    return findings;
  }
}

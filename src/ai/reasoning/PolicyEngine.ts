/**
 * PolicyEngine.ts
 * Checks BNSS / CrPC compliance requirements against the context.
 * Produces compliance-specific Findings flagging missing mandatory actions.
 *
 * SAFETY: Read-only. Pure analysis. No writes.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { Finding } from './ReasoningTypes';
import { nylDaysUntilDeadline } from '@/lib/db/nyayalayRepo';

interface PolicyCheck {
  id: string;
  title: string;
  description: string;
  severity: Finding['severity'];
  legalReference: string;
  check: (ctx: InvestigationContext) => boolean; // true = VIOLATION (fires finding)
  recommendation: string;
  modulesAnalysed: string[];
}

const POLICY_CHECKS: PolicyCheck[] = [
  {
    id: 'POL-001',
    title: 'FIR Not Registered — Cognizable Offence',
    description: 'Cognizable offence reported but FIR has not been registered.',
    severity: 'critical',
    legalReference: 'BNSS Section 173 — Cognizable offence mandates immediate FIR registration.',
    check: (ctx) => ctx.confidence.fir === 'empty' || ctx.confidence.fir === 'unavailable',
    recommendation: 'Register FIR immediately under BNSS Section 173.',
    modulesAnalysed: ['FIR'],
  },
  {
    id: 'POL-002',
    title: 'Investigation Inactivity — No Action in 7+ Days',
    description: 'No investigation Karyvahi or Case Diary entry in the past 7 days.',
    severity: 'high',
    legalReference: 'BNSS Section 193 — Investigation must be diligently pursued.',
    check: (ctx) => {
      if (!ctx.fir || ctx.fir.status !== 'Pending') return false;
      const allDates: number[] = [];
      ctx.karyvahi.all.forEach((k) => { if (k.updated_at) allDates.push(k.updated_at); });
      ctx.caseDiaries.forEach((c) => {
        if (c.preparation_date) allDates.push(new Date(c.preparation_date).getTime() / 1000);
      });
      if (allDates.length === 0) return true;
      const latestSec = Math.max(...allDates);
      const daysSince = (Date.now() / 1000 - latestSec) / 86400;
      return daysSince > 7;
    },
    recommendation: 'Take immediate investigative action and record in Case Diary.',
    modulesAnalysed: ['Karyvahi', 'CaseDiary'],
  },
  {
    id: 'POL-003',
    title: 'Court Deadline Missed',
    description: 'One or more court documents have passed their deadline.',
    severity: 'critical',
    legalReference: 'BNSS — Failure to comply with court dates constitutes contempt.',
    check: (ctx) => ctx.courtDocs.some((d) => {
      if (!d.deadline_date || d.status === 'Finished') return false;
      return nylDaysUntilDeadline(d.deadline_date, d.status) < 0;
    }),
    recommendation: 'Immediately contact the court. Explain reasons for delay. File compliance report.',
    modulesAnalysed: ['Court'],
  },
  {
    id: 'POL-004',
    title: 'Charge Sheet Period Approaching',
    description: 'FIR is pending and charge sheet period is nearing.',
    severity: 'high',
    legalReference: 'BNSS Section 193 — 60/90 days charge sheet filing period.',
    check: (ctx) => {
      if (!ctx.fir || ctx.fir.status !== 'Pending') return false;
      const firDate = ctx.fir.date_of_occurrence || ctx.fir.created_at;
      if (!firDate) return false;
      const firMs = typeof firDate === 'number' ? firDate * 1000 : new Date(firDate).getTime();
      const daysSince = (Date.now() - firMs) / 86400000;
      return daysSince >= 50; // warn at 50 days
    },
    recommendation: 'Review all pending investigation steps. Prepare for charge sheet filing.',
    modulesAnalysed: ['FIR', 'Karyvahi'],
  },
  {
    id: 'POL-005',
    title: 'Prarthna Patra Overdue',
    description: 'One or more Prarthna Patras have exceeded their response deadline.',
    severity: 'high',
    legalReference: 'SP/DCP Circular — Petitions must be disposed within 15 days.',
    check: (ctx) => ctx.prarthnaPatra.some((p) => {
      if (!p.deadline_date || p.status === 'Finished' || p.status === 'Nistarit') return false;
      return new Date(p.deadline_date).getTime() < Date.now();
    }),
    recommendation: 'Dispose overdue Prarthna Patras immediately. Update records.',
    modulesAnalysed: ['PrarthnaPatra'],
  },
  {
    id: 'POL-006',
    title: 'Nirodhatmak Karyvahi Overdue',
    description: 'Preventive action (Nirodhatmak Karyvahi) deadline has passed.',
    severity: 'medium',
    legalReference: 'BNSS preventive provisions.',
    check: (ctx) => ctx.nirodhatmak.some((n) => {
      // Use proceeding_date as reference; flag if status is not 'Closed'
      if (!n.proceeding_date || n.status === 'Closed') return false;
      const procMs = new Date(n.proceeding_date).getTime();
      const daysSince = (Date.now() - procMs) / 86400000;
      return daysSince > 30; // flag if open proceeding is older than 30 days
    }),
    recommendation: 'Complete or update Nirodhatmak Karyvahi with follow-up action.',
    modulesAnalysed: ['Nirodhatmak'],
  },
];

export class PolicyEngine {
  static evaluate(ctx: InvestigationContext): Finding[] {
    const now = new Date().toISOString();
    const findings: Finding[] = [];
    let counter = 0;

    for (const check of POLICY_CHECKS) {
      try {
        if (check.check(ctx)) {
          findings.push({
            id: `pol-finding-${++counter}`,
            ruleId: check.id,
            ruleTitle: check.title,
            severity: check.severity,
            title: check.title,
            detail: check.description,
            recommendation: check.recommendation,
            modulesAnalysed: check.modulesAnalysed,
            legalReference: check.legalReference,
            generatedAt: now,
          });
        }
      } catch {
        // Non-fatal — skip this check
      }
    }

    return findings;
  }
}

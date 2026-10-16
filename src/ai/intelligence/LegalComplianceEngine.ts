/**
 * LegalComplianceEngine.ts
 * Validates investigation against BNSS/BNS compliance rules.
 *
 * SAFETY: Read-only. Consumes InvestigationContext only. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { LegalComplianceReport, ComplianceFinding } from './IntelligenceTypes';
import { COMPLIANCE_RULES } from './complianceRules';

// ── Check implementations (keyed by rule checkKey) ────────────────────────────

function hasArrest(ctx: InvestigationContext): boolean {
  return ctx.karyvahi.all.some((k) => /arrest|गिरफ्तार/i.test(k.name));
}

function hasArrestMemo(ctx: InvestigationContext): boolean {
  return ctx.karyvahi.all.some((k) => /arrest\s*memo|गिरफ्तारी.*पंचनामा/i.test(k.name));
}

function hasCourtProduction(ctx: InvestigationContext): boolean {
  return ctx.karyvahi.all.some((k) => /court.*production|production.*court|पेशी|produced/i.test(k.name)) ||
    ctx.courtDocs.some((d) => /production|remand|पेशी/i.test(d.doc_type));
}

function hasSeizure(ctx: InvestigationContext): boolean {
  return ctx.karyvahi.all.some((k) => /seizure|जब्ती|panchnama|पंचनामा/i.test(k.name));
}

function hasSeizureMemo(ctx: InvestigationContext): boolean {
  return ctx.karyvahi.all.some((k) => /seizure.*memo|memo.*seizure|जब्ती.*पंचनामा|seizure panchnama/i.test(k.name));
}

function hasMedical(ctx: InvestigationContext): boolean {
  return ctx.karyvahi.all.some((k) => /medical|mlc|post.mortem|doctor|hospital/i.test(k.name));
}

function hasFSL(ctx: InvestigationContext): boolean {
  return ctx.karyvahi.all.some((k) => /fsl|forensic|lab|chemical/i.test(k.name));
}

function daysSinceFIR(ctx: InvestigationContext): number {
  if (!ctx.fir) return 0;
  const firDate = ctx.fir.date_of_information
    ? new Date(ctx.fir.date_of_information)
    : new Date(ctx.fir.created_at * 1000);
  return Math.floor((Date.now() - firDate.getTime()) / 86_400_000);
}

function daysSinceLastActivity(ctx: InvestigationContext): number {
  const dates: number[] = [
    ...ctx.karyvahi.all.map((k) => k.created_at * 1000),
    ...ctx.caseDiaries.map((d) => new Date(d.preparation_date).getTime()),
  ];
  if (dates.length === 0) return 999;
  return Math.floor((Date.now() - Math.max(...dates)) / 86_400_000);
}

function hasMissedCourtDeadline(ctx: InvestigationContext): boolean {
  const today = new Date().toISOString().split('T')[0];
  return ctx.courtDocs.some((d) => d.deadline_date < today && d.status === 'Pending');
}

const CHECK_FUNCTIONS: Record<string, (ctx: InvestigationContext) => boolean> = {
  arrest_without_memo:          (ctx) => hasArrest(ctx) && !hasArrestMemo(ctx),
  production_deadline_missed:   (ctx) => hasArrest(ctx) && !hasCourtProduction(ctx),
  custody_period_exceeded:      (ctx) => {
    const days = daysSinceFIR(ctx);
    return hasArrest(ctx) && days > 90 && ctx.fir?.status === 'Pending';
  },
  search_without_panchnama:     (ctx) => {
    const hasSearch = ctx.karyvahi.all.some((k) => /search|तलाशी/i.test(k.name));
    return hasSearch && !ctx.karyvahi.all.some((k) => /panchnama|पंचनामा/i.test(k.name));
  },
  seizure_without_memo:         (ctx) => hasSeizure(ctx) && !hasSeizureMemo(ctx),
  chargesheet_deadline_approaching: (ctx) => {
    const days = daysSinceFIR(ctx);
    return days >= 50 && days < 60 && ctx.fir?.status === 'Pending';
  },
  default_bail_risk:            (ctx) => {
    const days = daysSinceFIR(ctx);
    return hasArrest(ctx) && days >= 60 && ctx.fir?.status === 'Pending';
  },
  medical_exam_missing:         (ctx) => {
    const needsMedical = /murder|attempt|robbery|dacoity|accident|assault|pocso|violence/i
      .test(`${ctx.fir?.crime_type ?? ''} ${ctx.fir?.section ?? ''}`);
    return needsMedical && !hasMedical(ctx);
  },
  fsl_missing:                  (ctx) => {
    const needsFSL = /murder|attempt|robbery|ndps|arms|pocso|assault/i
      .test(`${ctx.fir?.crime_type ?? ''} ${ctx.fir?.section ?? ''}`);
    return needsFSL && hasSeizure(ctx) && !hasFSL(ctx);
  },
  court_deadline_missed:        (ctx) => hasMissedCourtDeadline(ctx),
  case_diary_missing:           (ctx) => ctx.caseDiaries.length === 0 && ctx.karyvahi.all.length > 0,
  investigation_inactive:       (ctx) => {
    const days = daysSinceLastActivity(ctx);
    return days >= 7 && ctx.fir?.status === 'Pending';
  },
};

// ── Engine ────────────────────────────────────────────────────────────────────

export class LegalComplianceEngine {
  static evaluate(ctx: InvestigationContext): LegalComplianceReport {
    const findings: ComplianceFinding[] = [];

    for (const rule of COMPLIANCE_RULES) {
      const checkFn = CHECK_FUNCTIONS[rule.checkKey];
      if (!checkFn) continue;
      try {
        if (checkFn(ctx)) {
          findings.push({
            ruleId: rule.id,
            ruleTitle: rule.title,
            severity: rule.severity,
            category: rule.category,
            detail: rule.description,
            recommendation: rule.recommendation,
            legalReference: rule.legalReference,
          });
        }
      } catch {
        // Skip rule on error — never crash the engine
      }
    }

    const totalChecks  = COMPLIANCE_RULES.length;
    const failedChecks = findings.length;
    const passedChecks = totalChecks - failedChecks;
    const compliancePct = Math.round((passedChecks / totalChecks) * 100);

    const legalRisks = findings.filter((f) =>
      ['arrest', 'custody', 'chargesheet', 'bail'].includes(f.category)
    );
    const missingProcedures = findings.filter((f) =>
      ['search', 'seizure', 'medical', 'fsl', 'court'].includes(f.category)
    );

    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const highCount     = findings.filter((f) => f.severity === 'high').length;

    const summary =
      `Legal Compliance: ${compliancePct}%. ` +
      `${passedChecks}/${totalChecks} checks passed. ` +
      (criticalCount > 0 ? `🔴 ${criticalCount} critical violations. ` : '') +
      (highCount > 0 ? `🟡 ${highCount} high-risk gaps. ` : '') +
      (findings.length === 0 ? '✅ No compliance issues found.' : '');

    return {
      compliancePct,
      totalChecks,
      passedChecks,
      failedChecks,
      legalRisks,
      missingProcedures,
      criticalCount,
      highCount,
      summary,
    };
  }
}

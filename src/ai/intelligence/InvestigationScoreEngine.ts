/**
 * InvestigationScoreEngine.ts
 * Computes weighted investigation quality scores across 6 dimensions.
 *
 * SAFETY: Read-only. Consumes InvestigationContext only. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { InvestigationScoreReport, ScoreDimension, IntelGrade } from './IntelligenceTypes';

// ── Scoring weights (must sum to 1.0) ─────────────────────────────────────────
const WEIGHTS = {
  investigationQuality: 0.25,
  evidenceStrength:     0.20,
  documentation:        0.15,
  legalCompliance:      0.20,
  courtReadiness:       0.10,
  timelineDiscipline:   0.10,
} as const;

function grade(score: number): IntelGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

function dim(name: string, score: number, weight: number, items: string[]): ScoreDimension {
  return { name, score: Math.min(100, Math.max(0, Math.round(score))), weight, grade: grade(score), items };
}

function has(ctx: InvestigationContext, pattern: RegExp, completed = false): boolean {
  const list = completed ? ctx.karyvahi.completed : ctx.karyvahi.all;
  return list.some((k) => pattern.test(k.name));
}

export class InvestigationScoreEngine {
  static evaluate(ctx: InvestigationContext): InvestigationScoreReport {
    const today = new Date().toISOString().split('T')[0];

    // ── 1. Investigation Quality ──────────────────────────────────────────────
    let iqScore = 0;
    const iqItems: string[] = [];
    if (ctx.fir) { iqScore += 15; iqItems.push('✓ FIR Registered'); }
    if (has(ctx, /scene|ghatnasthal|spot/i, false)) { iqScore += 20; iqItems.push('✓ Scene Inspected'); }
    if (has(ctx, /arrest|गिरफ्तार/i, false)) { iqScore += 20; iqItems.push('✓ Accused Arrested'); }
    if (has(ctx, /statement|bayan|witness/i, true)) { iqScore += 25; iqItems.push('✓ Witness Statements Completed'); }
    else if (has(ctx, /statement|bayan|witness/i, false)) { iqScore += 10; iqItems.push('🟡 Witness Statements In Progress'); }
    const karyPct = ctx.karyvahi.completionPct;
    iqScore += Math.round(karyPct * 0.2);
    iqItems.push(`Investigation completion: ${karyPct}%`);

    // ── 2. Evidence Strength ──────────────────────────────────────────────────
    let esScore = 0;
    const esItems: string[] = [];
    if (has(ctx, /seizure|evidence|exhibit/i, true)) { esScore += 30; esItems.push('✓ Evidence Seized & Documented'); }
    if (has(ctx, /medical|mlc|post.mortem/i, false)) { esScore += 20; esItems.push('✓ Medical Evidence Obtained'); }
    if (has(ctx, /fsl|forensic|lab/i, false)) { esScore += 25; esItems.push('✓ FSL Referral Made'); }
    if (has(ctx, /cctv|footage|video/i, false)) { esScore += 15; esItems.push('✓ CCTV/Footage Collected'); }
    if (has(ctx, /panchnama|panchana/i, false)) { esScore += 10; esItems.push('✓ Panchnama Prepared'); }

    // ── 3. Documentation ──────────────────────────────────────────────────────
    let docScore = 0;
    const docItems: string[] = [];
    if (ctx.caseDiaries.length > 0) { docScore += 35; docItems.push(`✓ ${ctx.caseDiaries.length} Case Diary entrie(s)`); }
    if (has(ctx, /arrest.*memo|गिरफ्तारी.*पंचनामा/i, false)) { docScore += 25; docItems.push('✓ Arrest Memo Prepared'); }
    if (has(ctx, /seizure.*memo|panchnama.*seizure/i, false)) { docScore += 20; docItems.push('✓ Seizure Memo Prepared'); }
    if (ctx.prarthnaPatra.length > 0) { docScore += 10; docItems.push('✓ Applications Filed'); }
    if (ctx.gdEntries.length > 0) { docScore += 10; docItems.push('✓ GD Entries Present'); }

    // ── 4. Legal Compliance ───────────────────────────────────────────────────
    let lcScore = 100;
    const lcItems: string[] = [];
    const hasArrest  = has(ctx, /arrest|गिरफ्तार/i, false);
    const hasMemo    = has(ctx, /arrest.*memo/i, false);
    const daysFIR = ctx.fir
      ? Math.floor((Date.now() - (ctx.fir.date_of_information ? new Date(ctx.fir.date_of_information).getTime() : ctx.fir.created_at * 1000)) / 86_400_000)
      : 0;
    if (hasArrest && !hasMemo) { lcScore -= 25; lcItems.push('🔴 Arrest Memo Missing (-25)'); }
    if (daysFIR >= 60 && ctx.fir?.status === 'Pending') { lcScore -= 30; lcItems.push('🔴 Default Bail Risk (-30)'); }
    else if (daysFIR >= 50) { lcItems.push('🟡 Charge Sheet Deadline Approaching'); }
    const overdueCount = ctx.courtDocs.filter((d) => d.status === 'Pending' && d.deadline_date < today).length;
    if (overdueCount > 0) { lcScore -= (overdueCount * 15); lcItems.push(`🔴 ${overdueCount} Court Deadlines Missed`); }
    if (ctx.caseDiaries.length === 0 && ctx.karyvahi.all.length > 0) { lcScore -= 20; lcItems.push('🔴 Case Diary Not Maintained (-20)'); }
    if (lcItems.length === 0) lcItems.push('✓ All compliance checks passed');

    // ── 5. Court Readiness ────────────────────────────────────────────────────
    let crScore = 0;
    const crItems: string[] = [];
    const pending = ctx.courtDocs.filter((d) => d.status === 'Pending' && d.deadline_date >= today);
    const finished = ctx.courtDocs.filter((d) => d.status === 'Finished');
    if (finished.length > 0) { crScore += Math.min(50, finished.length * 15); crItems.push(`✓ ${finished.length} court actions completed`); }
    if (pending.length === 0 && ctx.courtDocs.length > 0) { crScore += 30; crItems.push('✓ No pending overdue court items'); }
    if (has(ctx, /court.*production|peshi|remand/i, false)) { crScore += 20; crItems.push('✓ Court Production Done'); }
    if (crItems.length === 0) crItems.push('No court data available');

    // ── 6. Timeline Discipline ────────────────────────────────────────────────
    let tdScore = 100;
    const tdItems: string[] = [];
    const dates = [
      ...ctx.karyvahi.all.map((k) => k.created_at * 1000),
      ...ctx.caseDiaries.map((d) => new Date(d.preparation_date).getTime()),
    ];
    const daysSinceLast = dates.length > 0
      ? Math.floor((Date.now() - Math.max(...dates)) / 86_400_000)
      : 999;
    if (daysSinceLast >= 10) { tdScore -= 30; tdItems.push(`🔴 ${daysSinceLast} days since last activity`); }
    else if (daysSinceLast >= 5) { tdScore -= 10; tdItems.push(`🟡 ${daysSinceLast} days since last activity`); }
    else tdItems.push(`✓ Last activity ${daysSinceLast} day(s) ago`);
    if (overdueCount > 0) { tdScore -= 20; tdItems.push(`🔴 ${overdueCount} overdue deadline(s)`); }

    // ── Weighted overall ──────────────────────────────────────────────────────
    const iq = dim('Investigation Quality',  iqScore,  WEIGHTS.investigationQuality, iqItems);
    const es = dim('Evidence Strength',       esScore,  WEIGHTS.evidenceStrength,     esItems);
    const dc = dim('Documentation',           docScore, WEIGHTS.documentation,        docItems);
    const lc = dim('Legal Compliance',        Math.max(0, lcScore), WEIGHTS.legalCompliance, lcItems);
    const cr = dim('Court Readiness',         crScore,  WEIGHTS.courtReadiness,       crItems);
    const td2 = dim('Timeline Discipline',    Math.max(0, tdScore), WEIGHTS.timelineDiscipline, tdItems);

    const overall = Math.round(
      iq.score  * WEIGHTS.investigationQuality +
      es.score  * WEIGHTS.evidenceStrength     +
      dc.score  * WEIGHTS.documentation        +
      lc.score  * WEIGHTS.legalCompliance      +
      cr.score  * WEIGHTS.courtReadiness       +
      td2.score * WEIGHTS.timelineDiscipline
    );

    const g = grade(overall);
    const label =
      g === 'A' ? 'Excellent — Investigation on Track'       :
      g === 'B' ? 'Good Progress — Minor Gaps'               :
      g === 'C' ? 'Needs Attention — Several Gaps'           :
      g === 'D' ? 'Critical Issues — Immediate Action Needed':
                  'Investigation Stalled — Urgent Intervention';

    const summary =
      `Investigation Score: ${overall}/100 (${g}) — ${label}. ` +
      `Quality: ${iq.score}, Evidence: ${es.score}, Documentation: ${dc.score}, ` +
      `Compliance: ${lc.score}, Court: ${cr.score}, Timeline: ${td2.score}.`;

    return {
      overallScore: overall,
      grade: g,
      label,
      investigationQuality: iq,
      evidenceStrength: es,
      documentation: dc,
      legalCompliance: lc,
      courtReadiness: cr,
      timelineDiscipline: td2,
      trend: 'unknown',
      summary,
    };
  }
}

/**
 * HealthEngine.ts
 * Computes the full InvestigationHealthReport from all engine outputs.
 *
 * Dimensions:
 *   completion %        — Karyvahi done/total
 *   legal readiness     — no critical rule/policy violations
 *   court readiness     — court docs present + no overdue
 *   evidence readiness  — key evidence karyvahi completed
 *   documentation qual  — case diary + GD completeness
 *   timeline quality    — no major gaps or wrong sequences
 *
 * SAFETY: Read-only. Pure computation.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { Finding, TimelineGap, InvestigationHealthReport } from './ReasoningTypes';
import { nylDaysUntilDeadline } from '@/lib/db/nyayalayRepo';

export class HealthEngine {
  static compute(
    ctx: InvestigationContext,
    allFindings: Finding[],
    timelineGaps: TimelineGap[]
  ): InvestigationHealthReport {
    const sev = (s: string) => allFindings.filter((f) => f.severity === s).length;

    // ── Dimension scores (0–100) ──────────────────────────────────────────

    // 1. Completion % from Karyvahi
    const completionPct = ctx.karyvahi.all.length > 0
      ? Math.round((ctx.karyvahi.completed.length / ctx.karyvahi.all.length) * 100)
      : ctx.fir ? 10 : 0;

    // 2. Legal readiness — penalise for critical + high violations
    const critCount = sev('critical');
    const highCount = sev('high');
    const legalReadiness = Math.max(0, 100 - critCount * 20 - highCount * 8);

    // 3. Court readiness
    let courtReadiness = 100;
    if (ctx.courtDocs.length === 0 && ctx.fir) {
      courtReadiness = 60;
    } else {
      const overdueCourt = ctx.courtDocs.filter(
        (d) => d.deadline_date && d.status !== 'Finished' && nylDaysUntilDeadline(d.deadline_date, d.status) < 0
      );
      courtReadiness = Math.max(0, 100 - overdueCourt.length * 25);
    }

    // 4. Evidence readiness — check key evidence karyvahi
    const evidencePatterns = [
      /seizure|panchnama|पंचनामा/i,
      /medical|mlc|चिकित्सा/i,
      /fsl|forensic|फोरेंसिक/i,
      /video|e-sakshya|ई-साक्ष्य/i,
    ];
    const evidenceHits = evidencePatterns.filter((p) =>
      ctx.karyvahi.completed.some((k) => p.test(k.name))
    ).length;
    const evidenceReadiness = Math.round((evidenceHits / evidencePatterns.length) * 100);

    // 5. Documentation quality
    let docQuality = 100;
    if (ctx.caseDiaries.length === 0) docQuality -= 40;
    if (ctx.gdEntries.length === 0) docQuality -= 20;
    const pendingPP = ctx.prarthnaPatra.filter((p) => p.status === 'Pending').length;
    docQuality = Math.max(0, docQuality - pendingPP * 5);

    // 6. Timeline quality — penalise for gaps
    const timelineQuality = Math.max(0, 100 - timelineGaps.length * 15);

    // ── Composite score ────────────────────────────────────────────────────
    const overallScore = Math.round(
      completionPct * 0.25 +
      legalReadiness * 0.25 +
      courtReadiness * 0.15 +
      evidenceReadiness * 0.15 +
      docQuality * 0.10 +
      timelineQuality * 0.10
    );

    const grade = HealthEngine._grade(overallScore);
    const label = HealthEngine._label(grade, overallScore);

    // ── Item lists ─────────────────────────────────────────────────────────
    const completedItems: string[] = [];
    const pendingItems: string[] = [];
    const criticalItems: string[] = [];
    const missingItems: string[] = [];
    const deadlineItems: string[] = [];

    // FIR
    if (ctx.fir) completedItems.push('FIR Registered');
    else missingItems.push('FIR Not Registered');

    // Karyvahi
    ctx.karyvahi.completed.forEach((k) => completedItems.push(k.name));
    ctx.karyvahi.pending.forEach((k) => pendingItems.push(k.name));

    // Case Diary
    if (ctx.caseDiaries.length > 0) completedItems.push(`Case Diary (${ctx.caseDiaries.length} entries)`);
    else if (ctx.fir) missingItems.push('Case Diary — No entries');

    // Court
    ctx.courtDocs.forEach((d) => {
      if (!d.deadline_date) return;
      const daysLeft = nylDaysUntilDeadline(d.deadline_date, d.status);
      if (d.status === 'Finished') {
        completedItems.push(`Court: ${d.document_title || d.doc_type}`);
      } else if (daysLeft < 0) {
        criticalItems.push(`OVERDUE: ${d.document_title || d.doc_type} (${Math.abs(daysLeft)}d overdue)`);
      } else if (daysLeft <= 7) {
        deadlineItems.push(`${d.document_title || d.doc_type} — ${daysLeft}d remaining`);
      } else {
        pendingItems.push(`Court: ${d.document_title || d.doc_type}`);
      }
    });

    // Prarthna Patra
    ctx.prarthnaPatra.forEach((p) => {
      if (p.status === 'Finished' || p.status === 'Nistarit') {
        completedItems.push(`Prarthna Patra: ${p.matter ?? 'Petition'}`);
      } else if (p.deadline_date && new Date(p.deadline_date).getTime() < Date.now()) {
        criticalItems.push(`Overdue Petition: ${p.matter ?? 'Petition'}`);
      } else {
        pendingItems.push(`Petition: ${p.matter ?? 'Petition'}`);
      }
    });

    // Add critical findings as critical items
    allFindings.filter((f) => f.severity === 'critical').forEach((f) => {
      criticalItems.push(f.title);
    });

    return {
      overallScore,
      completionPct,
      legalReadiness,
      courtReadiness,
      evidenceReadiness,
      documentationQuality: docQuality,
      timelineQuality,
      grade,
      label,
      completedItems,
      pendingItems,
      criticalItems,
      missingItems,
      deadlineItems,
    };
  }

  private static _grade(score: number): InvestigationHealthReport['grade'] {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  private static _label(grade: string, score: number): string {
    if (grade === 'A') return 'Excellent — Investigation well on track';
    if (grade === 'B') return 'Good Progress — Minor gaps to address';
    if (grade === 'C') return 'Needs Attention — Several issues identified';
    if (grade === 'D') return 'At Risk — Critical actions required';
    return 'Critical — Immediate intervention required';
  }
}

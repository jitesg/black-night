/**
 * ChargeSheetEngine.ts
 * Evaluates charge sheet readiness and identifies blockers.
 *
 * SAFETY: Read-only. Consumes InvestigationContext only. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { ChargeSheetReport, ChargeSheetItem } from './IntelligenceTypes';

// Counter is local to each evaluate() call — no shared mutable module state
function mkItemFactory(counter: { n: number }) {
  return function mkItem(
    category: ChargeSheetItem['category'],
    title: string,
    isPresent: boolean,
    isCritical: boolean,
    detail?: string,
  ): ChargeSheetItem {
    return { id: `CS-${String(++counter.n).padStart(3, '0')}`, category, title, isPresent, isCritical, detail };
  };
}

export class ChargeSheetEngine {
  static evaluate(ctx: InvestigationContext): ChargeSheetReport {
    const counter = { n: 0 };
    const mkItem = mkItemFactory(counter);
    const allItems: ChargeSheetItem[] = [];

    const has = (pattern: RegExp, inCompleted = true) =>
      inCompleted
        ? ctx.karyvahi.completed.some((k) => pattern.test(k.name))
        : ctx.karyvahi.all.some((k) => pattern.test(k.name));

    // ── FIR ──────────────────────────────────────────────────────────────────
    allItems.push(mkItem('fir', 'FIR Registered',     !!ctx.fir,               true,  ctx.fir?.fir_number));
    allItems.push(mkItem('fir', 'FIR Number Present', !!ctx.fir?.fir_number,   true));
    allItems.push(mkItem('fir', 'Crime Type Defined',  !!ctx.fir?.crime_type,  true));
    allItems.push(mkItem('fir', 'Sections Mentioned',  !!ctx.fir?.section,     true));

    // ── Victim ────────────────────────────────────────────────────────────────
    allItems.push(mkItem('victim', 'Complainant Information', !!ctx.fir?.complainant_name, true));
    const hasMedical = has(/medical|mlc|post.mortem|hospital|injury/i, false);
    const needsMedical = /murder|attempt|robbery|assault|accident|pocso/i.test(ctx.fir?.crime_type ?? '');
    if (needsMedical) {
      allItems.push(mkItem('medical', 'Medical Examination / MLC', hasMedical, true));
    }

    // ── Accused ────────────────────────────────────────────────────────────────
    const hasAccused = has(/accused|arrest|आरोपी/i, false);
    allItems.push(mkItem('accused', 'Accused Identified', hasAccused, true));
    if (hasAccused) {
      const hasArrestMemo = has(/arrest.*memo|गिरफ्तारी.*पंचनामा/i, false);
      allItems.push(mkItem('accused', 'Arrest Memo Prepared', hasArrestMemo, true));
    }

    // ── Witnesses ─────────────────────────────────────────────────────────────
    const hasWitnesses = has(/statement|bayan|witness|गवाह/i, false);
    allItems.push(mkItem('witness', 'Witness Statements Recorded', hasWitnesses, true));
    const completedWitnesses = has(/statement|bayan|witness|गवाह/i, true);
    allItems.push(mkItem('witness', 'Witness Statements Completed', completedWitnesses, false));

    // ── Evidence ──────────────────────────────────────────────────────────────
    const hasSeizure = has(/seizure|जब्ती|recovery|panchnama/i, false);
    allItems.push(mkItem('evidence', 'Evidence Seized / Documented', hasSeizure, false));
    const hasSeizureMemo = has(/seizure.*memo|panchnama.*seizure|seizure.*panchana/i, false);
    if (hasSeizure) {
      allItems.push(mkItem('evidence', 'Seizure Memo / Panchnama Prepared', hasSeizureMemo, true));
    }

    // ── FSL ───────────────────────────────────────────────────────────────────
    const needsFSL = /murder|ndps|arms|pocso|robbery/i.test(ctx.fir?.crime_type ?? '');
    if (needsFSL) {
      const hasFSL = has(/fsl|forensic|lab/i, false);
      allItems.push(mkItem('fsl', 'FSL Referral Made', hasFSL, true));
    }

    // ── Case Diary ─────────────────────────────────────────────────────────────
    allItems.push(mkItem('casediary', 'Case Diary Maintained', ctx.caseDiaries.length > 0, true));
    allItems.push(mkItem('casediary', 'Recent Case Diary Entry', ctx.caseDiaries.length >= 3, false));

    // ── Investigation Actions ─────────────────────────────────────────────────
    const karyPct = ctx.karyvahi.completionPct;
    allItems.push(mkItem('karyvahi', 'Investigation Actions ≥60% Complete', karyPct >= 60, true, `${karyPct}% complete`));
    allItems.push(mkItem('karyvahi', 'Investigation Actions ≥80% Complete', karyPct >= 80, false, `${karyPct}% complete`));

    // ── Scene Inspection ──────────────────────────────────────────────────────
    const hasScene = has(/scene|ghatnasthal|spot|inspection/i, false);
    allItems.push(mkItem('evidence', 'Scene of Crime Inspected', hasScene, false));

    // ── Court Work ────────────────────────────────────────────────────────────
    const hasCourtProduction = ctx.courtDocs.length > 0 || has(/court.*production|production.*court|remand|पेशी/i, false);
    allItems.push(mkItem('court', 'Court Production Completed', hasCourtProduction, hasAccused));
    const overdueCourtDocs = ctx.courtDocs.filter((d) => d.status === 'Pending' && d.deadline_date < new Date().toISOString().split('T')[0]);
    allItems.push(mkItem('court', 'No Overdue Court Deadlines', overdueCourtDocs.length === 0, true,
      overdueCourtDocs.length > 0 ? `${overdueCourtDocs.length} overdue` : undefined));

    // ── Documentation ─────────────────────────────────────────────────────────
    allItems.push(mkItem('documentation', 'FIR Status: Active',
      ctx.fir?.status === 'Pending', false));

    // ── Scoring ───────────────────────────────────────────────────────────────
    const presentItems    = allItems.filter((i) => i.isPresent);
    const criticalBlockers = allItems.filter((i) => !i.isPresent && i.isCritical);
    const missingItems    = allItems.filter((i) => !i.isPresent);
    const completedItems  = presentItems;

    const readinessPct = allItems.length > 0
      ? Math.round((presentItems.length / allItems.length) * 100)
      : 0;

    const nextSteps: string[] = criticalBlockers.slice(0, 5).map((b) => `Complete: ${b.title}`);
    if (nextSteps.length === 0 && readinessPct >= 80) {
      nextSteps.push('Investigation near complete — prepare and file charge sheet.');
    }

    const summary =
      `Charge Sheet Readiness: ${readinessPct}%. ` +
      `${presentItems.length}/${allItems.length} requirements met. ` +
      (criticalBlockers.length > 0
        ? `🔴 ${criticalBlockers.length} critical blocker(s). `
        : '✅ No critical blockers. ');

    return {
      readinessPct,
      totalItems: allItems.length,
      presentItems: presentItems.length,
      criticalBlockers,
      missingItems,
      completedItems,
      nextSteps,
      summary,
    };
  }
}

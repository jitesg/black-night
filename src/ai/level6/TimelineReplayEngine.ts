/**
 * TimelineReplayEngine.ts
 * Level-6: Generates a chronological replay of investigation events.
 * Identifies missing periods, gaps, delayed investigation, and critical gaps.
 *
 * SAFETY: Read-only. Never writes to any repository or database.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  TimelineReplayReport,
  TimelineReplayEntry,
  TimelineGap,
} from './L6Types';

const MS_PER_DAY = 86_400_000;
const GAP_THRESHOLD_DAYS = 5;

function toDateStr(val?: string | number | null): string {
  if (!val) return '';
  const d = typeof val === 'number' ? new Date(val) : new Date(val);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round(Math.abs(db - da) / MS_PER_DAY);
}

export class TimelineReplayEngine {
  static analyze(ctx: InvestigationContext): TimelineReplayReport {
    const firId     = ctx.activeFirId;
    const fir       = ctx.fir;
    const firNumber = fir?.fir_number;
    const entries: TimelineReplayEntry[] = [];

    // ── FIR Registration ──────────────────────────────────────────────────────
    if (fir?.date_of_information) {
      entries.push({
        id:          'tlr-fir',
        date:        toDateStr(fir?.date_of_information),
        eventType:   'FIR',
        title:       `FIR Registered: ${firNumber ?? '—'}`,
        description: `Crime: ${fir.crime_type ?? '—'} | Sections: ${fir.section ?? '—'}`,
        isCompleted: true,
        isCritical:  false,
        isMissing:   false,
        isGap:       false,
        module:      'FIR',
      });
    }

    // ── Karyvahi entries ──────────────────────────────────────────────────────
    ctx.karyvahi.all.forEach((k, idx) => {
      const date = toDateStr(new Date(k.created_at).toISOString().slice(0, 10));
      if (!date) return;
      entries.push({
        id:          `tlr-karyvahi-${idx}`,
        date,
        eventType:   'Karyvahi',
        title:       k.name,
        description: k.precautions ?? '',
        isCompleted: k.is_completed === 1,
        isCritical:  false,
        isMissing:   false,
        isGap:       false,
        module:      'Karyvahi',
      });
    });

    // ── Case Diary entries ────────────────────────────────────────────────────
    ctx.caseDiaries.forEach((cd, idx) => {
      const date = toDateStr(cd.preparation_date);
      if (!date) return;
      entries.push({
        id:          `tlr-cd-${idx}`,
        date,
        eventType:   'CaseDiary',
        title:       `Case Diary — ${date}`,
        description: cd.places_visited ?? '',
        isCompleted: true,
        isCritical:  false,
        isMissing:   false,
        isGap:       false,
        module:      'CaseDiary',
      });
    });

    // ── Court documents ───────────────────────────────────────────────────────
    ctx.courtDocs.forEach((d, idx) => {
      const date = toDateStr(d.deadline_date);
      if (!date) return;
      entries.push({
        id:          `tlr-court-${idx}`,
        date,
        eventType:   'Court',
        title:       `Court: ${d.vad_sankhya ?? d.doc_type ?? 'Document'}`,
        description: `Deadline: ${d.deadline_date ?? 'N/A'}`,
        isCompleted: d.status === 'Finished',
        isCritical:  !!d.deadline_date && new Date(d.deadline_date).getTime() < Date.now(),
        isMissing:   false,
        isGap:       false,
        module:      'Court',
      });
    });

    // ── GD entries ────────────────────────────────────────────────────────────
    ctx.gdEntries.forEach((g, idx) => {
      const date = toDateStr(g.preparation_date);
      if (!date) return;
      entries.push({
        id:          `tlr-gd-${idx}`,
        date,
        eventType:   'GD',
        title:       `GD Entry`,
        description: g.vivran_content ?? '',
        isCompleted: true,
        isCritical:  false,
        isMissing:   false,
        isGap:       false,
        module:      'GD',
      });
    });

    // ── Sort by date ascending ────────────────────────────────────────────────
    entries.sort((a, b) => a.date.localeCompare(b.date));

    // ── Detect gaps ───────────────────────────────────────────────────────────
    const gaps: TimelineGap[] = [];
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const curr = entries[i];
      if (!prev.date || !curr.date) continue;
      const gapDays = daysBetween(prev.date, curr.date);
      if (gapDays >= GAP_THRESHOLD_DAYS) {
        entries[i] = { ...curr, isGap: true, gapDays };
        const severity = gapDays >= 14 ? 'critical' : gapDays >= 7 ? 'high' : 'medium';
        gaps.push({
          fromDate:       prev.date,
          toDate:         curr.date,
          gapDays,
          description:    `No investigation activity for ${gapDays} days between ${prev.date} and ${curr.date}.`,
          severity,
          recommendation: 'Review investigation diary for this period. Ensure all activities are recorded.',
        });
      }
    }

    // ── Next expected event ───────────────────────────────────────────────────
    let nextExpected = 'Update case diary with latest investigation progress.';
    const hasRecentDiary = ctx.caseDiaries.length > 0 &&
      daysBetween(toDateStr(ctx.caseDiaries[0].preparation_date), new Date().toISOString().slice(0, 10)) <= 7;
    if (!hasRecentDiary) nextExpected = 'Case diary entry overdue — update investigation progress.';
    if (ctx.overdueItems.length > 0) nextExpected = `Address overdue item: ${ctx.overdueItems[0].title}`;

    const criticalGaps  = gaps.filter((g) => g.severity === 'critical').length;
    const today         = new Date().toISOString().slice(0, 10);
    const firDate       = fir?.date_of_information ? toDateStr(fir.date_of_information) : today;
    const investigationDurationDays = daysBetween(firDate, today);

    return {
      generatedAt:               new Date().toISOString(),
      firId,
      firNumber,
      entries,
      gaps,
      nextExpectedEvent:         nextExpected,
      delayedInvestigation:      criticalGaps > 0 || gaps.length >= 3,
      criticalGaps,
      totalEntries:              entries.length,
      totalGaps:                 gaps.length,
      investigationDurationDays,
      summary: entries.length === 0
        ? 'No investigation timeline data available.'
        : `${entries.length} events over ${investigationDurationDays} days. ${gaps.length} gap(s) detected (${criticalGaps} critical).`,
    };
  }
}

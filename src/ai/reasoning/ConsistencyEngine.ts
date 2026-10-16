/**
 * ConsistencyEngine.ts
 * Cross-module contradiction and inconsistency detector.
 *
 * Compares information across FIR, Karyvahi, CaseDiary, Court, GD,
 * PrarthnaPatra, Knowledge, and Analytics to detect:
 *   • Missing cross-references
 *   • Contradictory information
 *   • Duplicate records
 *   • Incomplete / orphaned entries
 *   • Timeline inconsistencies
 *
 * SAFETY: Read-only. Pure analysis. No writes.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { Finding, TimelineGap } from './ReasoningTypes';
import { nylDaysUntilDeadline } from '@/lib/db/nyayalayRepo';

export class ConsistencyEngine {
  static evaluate(ctx: InvestigationContext): {
    findings: Finding[];
    timelineGaps: TimelineGap[];
  } {
    const findings: Finding[] = [];
    const timelineGaps: TimelineGap[] = [];
    const now = new Date().toISOString();
    let fc = 0;
    let tgc = 0;

    const newFinding = (
      ruleId: string,
      severity: Finding['severity'],
      title: string,
      detail: string,
      recommendation: string,
      modules: string[],
      legalRef?: string
    ): Finding => ({
      id: `con-finding-${++fc}`,
      ruleId,
      ruleTitle: title,
      severity,
      title,
      detail,
      recommendation,
      modulesAnalysed: modules,
      legalReference: legalRef,
      generatedAt: now,
    });

    const newGap = (
      gapType: TimelineGap['gapType'],
      title: string,
      description: string,
      severity: Finding['severity'],
      affectedDate?: string,
      daysGap?: number,
    ): TimelineGap => ({
      id: `tg-${++tgc}`,
      gapType,
      title,
      description,
      severity,
      affectedDate,
      daysGap,
    });

    // ── 1. FIR vs Court cross-reference ──────────────────────────────────────
    if (ctx.fir && ctx.courtDocs.length > 0) {
      const firNum = ctx.fir.fir_number?.trim().toLowerCase();
      const unmatchedCourt = ctx.courtDocs.filter(
        (d) => d.fir_number && d.fir_number.trim().toLowerCase() !== firNum
      );
      if (unmatchedCourt.length > 0) {
        findings.push(newFinding(
          'CON-001', 'medium',
          'Court Document FIR Number Mismatch',
          `${unmatchedCourt.length} court document(s) reference a different FIR number than the active FIR (${ctx.fir.fir_number}).`,
          'Verify court document FIR references. Update if incorrectly linked.',
          ['FIR', 'Court']
        ));
      }
    }

    // ── 2. Duplicate Case Diary entries on same date ──────────────────────────
    if (ctx.caseDiaries.length > 1) {
      const dateCounts: Record<string, number> = {};
      ctx.caseDiaries.forEach((c) => {
        if (c.preparation_date) dateCounts[c.preparation_date] = (dateCounts[c.preparation_date] ?? 0) + 1;
      });
      const duplicateDates = Object.entries(dateCounts).filter(([, cnt]) => cnt > 1);
      if (duplicateDates.length > 0) {
        findings.push(newFinding(
          'CON-002', 'low',
          'Duplicate Case Diary Dates',
          `Multiple Case Diary entries found for: ${duplicateDates.map(([d]) => d).join(', ')}.`,
          'Review and merge duplicate Case Diary entries for the same date.',
          ['CaseDiary']
        ));
      }
    }

    // ── 3. Court deadline imminent (within 3 days) ────────────────────────────
    if (ctx.courtDocs.length > 0) {
      const imminentDocs = ctx.courtDocs.filter((d) => {
        if (!d.deadline_date || d.status === 'Finished') return false;
        const days = nylDaysUntilDeadline(d.deadline_date, d.status);
        return days >= 0 && days <= 3;
      });
      if (imminentDocs.length > 0) {
        findings.push(newFinding(
          'CON-003', 'critical',
          'Court Deadline Within 3 Days',
          `${imminentDocs.length} court document(s) have a deadline within 3 days: ${imminentDocs.map((d) => d.document_title || d.doc_type).join(', ')}.`,
          'Prepare all required documents and court submissions immediately.',
          ['Court'],
          'BNSS — Court compliance is mandatory.'
        ));
      }
    }

    // ── 4. Karyvahi completion gap (pending > completed) ─────────────────────
    if (ctx.fir && ctx.karyvahi.all.length > 0) {
      const pending = ctx.karyvahi.pending.length;
      const total = ctx.karyvahi.all.length;
      if (pending > total / 2 && total >= 5) {
        findings.push(newFinding(
          'CON-004', 'medium',
          'Investigation Heavily Pending',
          `${pending} of ${total} Karyvahi steps are pending (${Math.round((pending / total) * 100)}%).`,
          'Review and accelerate pending investigation steps.',
          ['Karyvahi']
        ));
      }
    }

    // ── 5. FIR open but no Karyvahi at all ───────────────────────────────────
    if (ctx.fir && ctx.fir.status === 'Pending' && ctx.karyvahi.all.length === 0) {
      findings.push(newFinding(
        'CON-005', 'high',
        'No Investigation Action Recorded',
        'FIR is registered and pending but no Karyvahi (investigation steps) exist.',
        'Begin investigation immediately. Record each action as Karyvahi.',
        ['FIR', 'Karyvahi']
      ));
    }

    // ── 6. Prarthna Patra status cross-check ─────────────────────────────────
    if (ctx.fir && ctx.prarthnaPatra.length > 0) {
      // Check for overdue petitions linked to this investigation
      const unlinked = ctx.prarthnaPatra.filter(
        (p) => p.status !== 'Finished' && p.status !== 'Nistarit' && p.deadline_date &&
               new Date(p.deadline_date).getTime() < Date.now()
      );
      if (unlinked.length > 0) {
        findings.push(newFinding(
          'CON-006', 'low',
          'Prarthna Patra FIR Reference Mismatch',
          `${unlinked.length} petition(s) are overdue and not yet disposed.`,
          'Dispose overdue Prarthna Patras immediately. Update status records.',
          ['PrarthnaPatra', 'FIR']
        ));
      }
    }

    // ── 7. Timeline gaps — no case diary entry in 7 days ─────────────────────
    if (ctx.fir && ctx.fir.status === 'Pending') {
      const diaryDates = ctx.caseDiaries.map((c) => c.preparation_date).filter(Boolean).sort();
      if (diaryDates.length > 0) {
        const lastDate = new Date(diaryDates[diaryDates.length - 1]);
        const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
        if (daysSince > 7) {
          timelineGaps.push(newGap(
            'long-inactivity',
            'Investigation Diary Gap',
            `No Case Diary entry for ${daysSince} days.`,
            'high',
            diaryDates[diaryDates.length - 1],
            daysSince
          ));
        }
      } else if (ctx.fir) {
        timelineGaps.push(newGap(
          'missing-event',
          'No Case Diary Entries',
          'FIR is registered but no Case Diary entries have been made.',
          'high'
        ));
      }
    }

    // ── 8. GD entry references FIR not present in system ─────────────────────
    // (Light check — just flag if GD is empty while FIR is pending)
    if (ctx.fir && ctx.fir.status === 'Pending' && ctx.gdEntries.length === 0) {
      timelineGaps.push(newGap(
        'missing-event',
        'No General Diary Entries',
        'No GD entries found. All police movements during investigation must be recorded.',
        'medium'
      ));
    }

    return { findings, timelineGaps };
  }
}

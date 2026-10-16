/**
 * TimelineEngine.ts
 * Constructs a chronological investigation timeline and detects:
 *   • Missing events
 *   • Wrong sequence
 *   • Long inactivity
 *   • Deadline violations
 *
 * SAFETY: Read-only. No DB access. Pure computation.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { TimelineGap, Finding } from './ReasoningTypes';
import { nylDaysUntilDeadline } from '@/lib/db/nyayalayRepo';

export interface TimelineAnalysis {
  events: Array<{
    date: string;
    time?: string;
    module: string;
    title: string;
    status: 'completed' | 'pending' | 'overdue';
    isCritical: boolean;
  }>;
  gaps: TimelineGap[];
  findings: Finding[];
}

export class TimelineEngine {
  static analyze(ctx: InvestigationContext): TimelineAnalysis {
    const events: TimelineAnalysis['events'] = [];
    const gaps: TimelineGap[] = [];
    const findings: Finding[] = [];
    const now = new Date().toISOString();
    let gc = 0;
    let fc = 0;

    const todayMs = Date.now();
    const today = new Date(todayMs).toISOString().split('T')[0];

    // ── Collect events ────────────────────────────────────────────────────────

    // FIR
    if (ctx.fir) {
      events.push({
        date: ctx.fir.date_of_occurrence ?? (ctx.fir.created_at ? new Date(ctx.fir.created_at * 1000).toISOString().split('T')[0] : today),
        module: 'FIR',
        title: `FIR ${ctx.fir.fir_number} Registered — ${ctx.fir.crime_type}`,
        status: 'completed',
        isCritical: false,
      });
    }

    // Karyvahi
    ctx.karyvahi.all.forEach((k) => {
      const dateMs = k.updated_at ? k.updated_at * 1000 : k.created_at ? k.created_at * 1000 : null;
      if (!dateMs) return;
      events.push({
        date: new Date(dateMs).toISOString().split('T')[0],
        module: 'Karyvahi',
        title: k.name,
        status: k.is_completed === 1 ? 'completed' : 'pending',
        isCritical: false,
      });
    });

    // Case Diaries
    ctx.caseDiaries.forEach((c) => {
      if (!c.preparation_date) return;
      events.push({
        date: c.preparation_date,
        module: 'CaseDiary',
        title: `Case Diary Entry — ${c.preparation_date}`,
        status: 'completed',
        isCritical: false,
      });
    });

    // Court documents
    ctx.courtDocs.forEach((d) => {
      if (!d.deadline_date) return;
      const daysLeft = nylDaysUntilDeadline(d.deadline_date, d.status);
      const overdue = d.status !== 'Finished' && daysLeft < 0;
      events.push({
        date: d.deadline_date,
        module: 'Court',
        title: `${d.document_title || d.doc_type} — ${d.court_name}`,
        status: d.status === 'Finished' ? 'completed' : overdue ? 'overdue' : 'pending',
        isCritical: overdue || (d.status !== 'Finished' && daysLeft <= 3),
      });
    });

    // Prarthna Patra
    ctx.prarthnaPatra.forEach((p) => {
      if (!p.deadline_date) return;
      const pDate = new Date(p.deadline_date).getTime();
      const overdue = p.status === 'Pending' && pDate < todayMs;
      events.push({
        date: p.deadline_date,
        module: 'PrarthnaPatra',
        title: `Prarthna Patra — ${p.matter || 'Petition'}`,
        status: (p.status === 'Finished' || p.status === 'Nistarit') ? 'completed' : overdue ? 'overdue' : 'pending',
        isCritical: overdue,
      });
    });

    // GD entries
    ctx.gdEntries.slice(-5).forEach((g) => {
      if (!g.preparation_date) return;
      events.push({
        date: g.preparation_date,
        module: 'GD',
        title: `GD Entry — ${g.gd_type}`,
        status: 'completed',
        isCritical: false,
      });
    });

    // Sort chronologically
    events.sort((a, b) => a.date.localeCompare(b.date));

    // ── Gap detection ─────────────────────────────────────────────────────────

    // Check for overdue court events
    const overdueCourtEvents = events.filter((e) => e.module === 'Court' && e.status === 'overdue');
    if (overdueCourtEvents.length > 0) {
      gaps.push({
        id: `tg-${++gc}`,
        gapType: 'deadline-violation',
        title: 'Court Deadline(s) Missed',
        description: `${overdueCourtEvents.length} court deadline(s) have passed without completion.`,
        severity: 'critical',
        affectedDate: overdueCourtEvents[0].date,
      });
      findings.push({
        id: `tml-finding-${++fc}`,
        ruleId: 'TML-001',
        ruleTitle: 'Court Deadline Violated',
        severity: 'critical',
        title: 'Court Deadline Violated',
        detail: `${overdueCourtEvents.length} court document(s) passed their deadline.`,
        recommendation: 'Immediately address overdue court documents. Seek adjournment if necessary.',
        modulesAnalysed: ['Court'],
        generatedAt: now,
        legalReference: 'BNSS — Court compliance is mandatory.',
      });
    }

    // Check for inactivity gaps > 7 days between consecutive events
    for (let i = 1; i < events.length; i++) {
      const prevMs = new Date(events[i - 1].date).getTime();
      const currMs = new Date(events[i].date).getTime();
      const gapDays = Math.floor((currMs - prevMs) / 86400000);
      if (gapDays > 10) {
        gaps.push({
          id: `tg-${++gc}`,
          gapType: 'long-inactivity',
          title: `${gapDays}-Day Investigation Gap`,
          description: `No investigation activity recorded between ${events[i - 1].date} and ${events[i].date}.`,
          severity: gapDays > 20 ? 'high' : 'medium',
          affectedDate: events[i - 1].date,
          daysGap: gapDays,
        });
      }
    }

    // Check for FIR without scene inspection sequence
    if (ctx.fir) {
      const hasScene = ctx.karyvahi.completed.some((k) =>
        /ghatnasthal|scene|inspection|स्थल/i.test(k.name)
      );
      const hasSeizure = ctx.karyvahi.completed.some((k) =>
        /seizure|panchnama|पंचनामा|जब्ती/i.test(k.name)
      );
      // Seizure before scene inspection is a wrong sequence
      if (hasSeizure && !hasScene) {
        gaps.push({
          id: `tg-${++gc}`,
          gapType: 'wrong-sequence',
          title: 'Wrong Sequence: Seizure Before Scene Inspection',
          description: 'Evidence seizure is recorded but crime scene inspection is missing — wrong investigation sequence.',
          severity: 'medium',
        });
      }
    }

    // Missing FIR registration event
    if (!ctx.fir) {
      gaps.push({
        id: `tg-${++gc}`,
        gapType: 'missing-event',
        title: 'FIR Not Registered',
        description: 'Investigation activity exists but no FIR registration found.',
        severity: 'critical',
      });
    }

    return { events, gaps, findings };
  }
}

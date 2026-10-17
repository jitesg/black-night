/**
 * EventDrivenIntelligenceEngine.ts
 * Level-6: Detects investigation events from InvestigationContext and generates
 * internal event objects that trigger intelligence refreshes.
 *
 * SAFETY: Read-only. Never writes to any repository or database.
 * No auto-save. No direct SQLite access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  EventDrivenIntelligenceReport,
  InvestigationEvent,
  InvestigationEventType,
} from './L6Types';

const MS_PER_DAY = 86_400_000;

function daysSince(ts?: number | string | null): number {
  if (!ts) return 0;
  const t = typeof ts === 'string' ? new Date(ts).getTime() : (ts as number);
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

function daysUntil(dateStr?: string | null): number | undefined {
  if (!dateStr) return undefined;
  const delta = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(delta / MS_PER_DAY);
}

function mkEvent(
  type: InvestigationEventType,
  firId: string | undefined,
  firNumber: string | undefined,
  description: string,
  severity: InvestigationEvent['severity'],
  requiresImmediateAttention: boolean,
  suggestedActions: string[]
): InvestigationEvent {
  return {
    id:        `l6-evt-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    firId,
    firNumber,
    description,
    triggeredAt: new Date().toISOString(),
    severity,
    requiresImmediateAttention,
    suggestedActions,
  };
}

export class EventDrivenIntelligenceEngine {
  static analyze(ctx: InvestigationContext): EventDrivenIntelligenceReport {
    const events: InvestigationEvent[] = [];
    const fir       = ctx.fir;
    const firId     = ctx.activeFirId;
    const firNumber = fir?.fir_number;

    // ── 1. FIR Created ────────────────────────────────────────────────────────
    if (fir) {
      const firAge = daysSince(fir.date_of_information ?? new Date(fir.created_at).toISOString().slice(0, 10));
      if (firAge <= 1) {
        events.push(mkEvent(
          'fir-created', firId, firNumber,
          `FIR ${firNumber ?? ''} registered. Initiate first investigation steps immediately.`,
          'high', true,
          ['Record initial statement', 'Conduct scene examination', 'Prepare case diary']
        ));
      }
    }

    // ── 2. FIR Updated ────────────────────────────────────────────────────────
    if (fir && ctx.caseDiaries.length > 0) {
      const lastDiary = ctx.caseDiaries[0];
      const daysSinceDiary = daysSince(lastDiary.preparation_date);
      if (daysSinceDiary <= 1) {
        events.push(mkEvent(
          'fir-updated', firId, firNumber,
          `Case diary updated recently. Investigation is active.`,
          'info', false,
          ['Review latest diary entry', 'Check pending karyvahi']
        ));
      }
    }

    // ── 3. Arrest Completed ───────────────────────────────────────────────────
    const arrestKaryvahi = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('arrest') || k.name.toLowerCase().includes('giraftari')
    );
    if (arrestKaryvahi.length > 0) {
      events.push(mkEvent(
        'arrest-completed', firId, firNumber,
        `Arrest recorded. Custody deadline clock started. Ensure charge sheet within statutory period.`,
        'critical', true,
        ['File bail reply if applicable', 'Update case diary', 'Initiate charge sheet preparation']
      ));
    }

    // ── 4. Evidence Added ─────────────────────────────────────────────────────
    const seizureKaryvahi = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('seizure') || k.name.toLowerCase().includes('muddemal')
    );
    if (seizureKaryvahi.length > 0) {
      events.push(mkEvent(
        'evidence-added', firId, firNumber,
        `${seizureKaryvahi.length} seizure/evidence karyvahi recorded. FSL referral may be required.`,
        'medium', false,
        ['Send for FSL examination', 'Prepare seizure memo', 'Update evidence register']
      ));
    }

    // ── 5. Medical Report Received ────────────────────────────────────────────
    const medKaryvahi = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('medical') || k.name.toLowerCase().includes('doctor')
    );
    const pendingMedical = medKaryvahi.some((k) => k.is_completed === 0);
    const receivedMedical = medKaryvahi.some((k) => k.is_completed === 1);
    if (receivedMedical) {
      events.push(mkEvent(
        'medical-report-received', firId, firNumber,
        `Medical examination completed. Review report findings and update investigation record.`,
        'medium', false,
        ['Review medical report', 'Cross-reference with FIR injuries', 'Update case diary']
      ));
    }
    if (pendingMedical) {
      events.push(mkEvent(
        'deadline-near', firId, firNumber,
        `Medical examination karyvahi is pending. Ensure timely completion.`,
        'high', true,
        ['Follow up with hospital', 'Update medical karyvahi status']
      ));
    }

    // ── 6. FSL Received ───────────────────────────────────────────────────────
    const fslKaryvahi = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('fsl') || k.name.toLowerCase().includes('forensic')
    );
    if (fslKaryvahi.some((k) => k.is_completed === 1)) {
      events.push(mkEvent(
        'fsl-received', firId, firNumber,
        `FSL report received. Incorporate findings into charge sheet preparation.`,
        'medium', false,
        ['Review FSL findings', 'Update evidence record', 'Prepare charge sheet section']
      ));
    }

    // ── 7. Witness Added ──────────────────────────────────────────────────────
    const witnessKaryvahi = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('witness') || k.name.toLowerCase().includes('bayan') || k.name.includes('बयान') || k.name.includes('वादी') || k.name.includes('गवाह')
    );
    if (witnessKaryvahi.length > 0) {
      events.push(mkEvent(
        'witness-added', firId, firNumber,
        `${witnessKaryvahi.length} witness-related karyvahi recorded. Verify statement consistency.`,
        'medium', false,
        ['Cross-check witness statements', 'Identify contradictions', 'Schedule follow-up if needed']
      ));
    }

    // ── 8. Court Date Changed ─────────────────────────────────────────────────
    const courtDocs = ctx.courtDocs.filter((d) => d.deadline_date);
    for (const doc of courtDocs) {
      const days = daysUntil(doc.deadline_date);
      if (days !== undefined && days >= 0 && days <= 3) {
        events.push(mkEvent(
          'court-date-changed', firId, firNumber,
          `Court deadline in ${days} day(s): ${doc.vad_sankhya ?? 'N/A'}. Compliance report required.`,
          'critical', true,
          ['Prepare compliance report', 'Verify evidence custody', 'Consult supervising officer']
        ));
      }
    }

    // ── 9. Charge Sheet Updated ───────────────────────────────────────────────
    const csKaryvahi = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('charge sheet') || k.name.toLowerCase().includes('challan')
    );
    if (csKaryvahi.length > 0) {
      events.push(mkEvent(
        'charge-sheet-updated', firId, firNumber,
        `Charge sheet related karyvahi detected. Review charge sheet readiness status.`,
        'high', false,
        ['Check charge sheet readiness', 'Verify all mandatory items', 'Consult legal compliance']
      ));
    }

    // ── 10. Bail Granted ──────────────────────────────────────────────────────
    const bailKaryvahi = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('bail') || k.name.toLowerCase().includes('zamanat')
    );
    if (bailKaryvahi.length > 0) {
      events.push(mkEvent(
        'bail-granted', firId, firNumber,
        `Bail-related karyvahi detected. Monitor accused compliance with bail conditions.`,
        'high', true,
        ['Track bail conditions compliance', 'Update accused status', 'Notify supervising officer']
      ));
    }

    // ── 11. Deadline Near ─────────────────────────────────────────────────────
    const overdueCount = ctx.overdueItems.length;
    if (overdueCount > 0) {
      events.push(mkEvent(
        'deadline-near', firId, firNumber,
        `${overdueCount} overdue item(s) detected. Immediate attention required.`,
        'critical', true,
        ctx.overdueItems.slice(0, 3).map((o) => `Resolve: ${o.title}`)
      ));
    }

    // ── 12. Investigation Closed ──────────────────────────────────────────────
    if (fir?.status === 'Finished') {
      events.push(mkEvent(
        'investigation-closed', firId, firNumber,
        `Investigation marked as finished. Ensure all documents are properly filed.`,
        'info', false,
        ['Verify final documentation', 'Confirm charge sheet filed', 'Archive investigation records']
      ));
    }

    const criticalEventCount = events.filter((e) => e.severity === 'critical').length;
    const highEventCount     = events.filter((e) => e.severity === 'high').length;
    const sorted = events.sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
    });

    return {
      generatedAt:             new Date().toISOString(),
      firId,
      events:                  sorted,
      criticalEventCount,
      highEventCount,
      mostRecentEvent:         sorted[0] ?? null,
      intelligenceRefreshedAt: new Date().toISOString(),
      summary: events.length === 0
        ? 'No significant investigation events detected at this time.'
        : `${events.length} event(s) detected — ${criticalEventCount} critical, ${highEventCount} high priority.`,
    };
  }
}

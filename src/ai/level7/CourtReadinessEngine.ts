/**
 * CourtReadinessEngine.ts
 * Level-7: Analyzes court readiness — hearings, warrants, summons,
 * pending documents, evidence, deadlines.
 *
 * SAFETY: Read-only. Pure analysis. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  CourtReadinessReport, CourtChecklistItem, L7ReadyState, L7Severity,
} from './L7Types';

function daysUntil(dateStr?: string | null): number | undefined {
  if (!dateStr) return undefined;
  const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  return d;
}

function mkItem(
  id: string, title: string, done: boolean,
  priority: L7Severity, daysLeft?: number, legalBasis?: string, action?: string,
): CourtChecklistItem {
  return { id, title, done, priority, daysLeft, legalBasis, action };
}

export class CourtReadinessEngine {
  static analyze(ctx: InvestigationContext): CourtReadinessReport {
    const kCompleted = ctx.karyvahi.completed;
    const kAll       = ctx.karyvahi.all;
    const doneK = (pats: string[]) => kCompleted.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));
    const hasK  = (pats: string[]) => kAll.some((k) => pats.some((p) => k.name.toLowerCase().includes(p)));

    // Upcoming court doc with nearest deadline
    const upcoming = ctx.courtDocs
      .filter((d) => d.deadline_date && d.status !== 'Finished')
      .sort((a, b) => new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime());

    const nextDoc      = upcoming[0];
    const nextHearing  = nextDoc?.deadline_date ?? undefined;
    const daysToHearing = nextHearing ? daysUntil(nextHearing) : undefined;

    const warrants = ctx.courtDocs
      .filter((d) => /warrant/i.test(d.doc_type ?? ''))
      .map((d) => d.vad_sankhya ?? d.document_title ?? 'Warrant');
    const summons = ctx.courtDocs
      .filter((d) => /summons|notice/i.test(d.doc_type ?? ''))
      .map((d) => d.vad_sankhya ?? d.document_title ?? 'Summons');

    const pendingDocs = ctx.courtDocs
      .filter((d) => d.status === 'Pending')
      .map((d) => d.document_title ?? d.doc_type ?? 'Court Document');

    // ── Checklist ─────────────────────────────────────────────────────────────
    const checklist: CourtChecklistItem[] = [
      mkItem('cr-diary', 'Case Diary Updated',
        ctx.caseDiaries.length > 0, 'critical', undefined, 'BNSS Sec 193',
        'Update case diary with latest investigation steps.'),
      mkItem('cr-witness', 'Witness Statements Complete',
        doneK(['bayan', 'witness', 'statement']), 'high', undefined, 'BNSS Sec 180',
        'Complete all pending witness statements before hearing.'),
      mkItem('cr-medical', 'Medical Report Available',
        doneK(['medical', 'mlc', 'doctor']), 'high', undefined, 'BNSS Sec 176',
        'Obtain MLC/medical report and attach to case diary.'),
      mkItem('cr-fsl', 'FSL Report Available',
        hasK(['fsl']) ? doneK(['fsl report', 'forensic report']) : true,
        'high', undefined, 'BNSS Sec 349',
        'Follow up with FSL for pending forensic report.'),
      mkItem('cr-seizure', 'Seizure Memo Ready',
        doneK(['seizure', 'panchnama']), 'high', undefined, 'BNSS Sec 185',
        'Prepare or verify seizure memo with all exhibits.'),
      mkItem('cr-compliance', 'Court Compliance Report Ready',
        ctx.courtDocs.filter((d) => d.status === 'Finished').length > 0, 'critical',
        daysToHearing ?? undefined, 'BNSS Sec 230',
        'Prepare court compliance report for next hearing.'),
      mkItem('cr-warrant', 'Pending Warrants Addressed',
        warrants.length === 0, 'critical', undefined, 'Court SOP',
        'Execute and return all pending warrants before hearing.'),
      mkItem('cr-summons', 'Summons Served',
        summons.length === 0, 'high', undefined, 'BNSS Sec 64',
        'Serve all pending summons and file service report.'),
      mkItem('cr-custody', 'Accused Custody Status Documented',
        doneK(['custody', 'remand', 'bail', 'arrest']) ||
        ctx.prarthnaPatra.some((p) => p.status === 'Finished'),
        'medium', undefined, 'BNSS Sec 187',
        'Ensure accused custody status and bail orders are documented.'),
      mkItem('cr-evidence', 'Evidence Chain Documented',
        doneK(['evidence', 'exhibit', 'muddemal', 'seizure']), 'high', undefined,
        'Evidence Act', 'Document complete evidence chain with custody records.'),
    ];

    const done         = checklist.filter((c) => c.done).length;
    const score        = Math.round((done / checklist.length) * 100);
    const critical     = checklist.filter((c) => !c.done && c.priority === 'critical');
    const high         = checklist.filter((c) => !c.done && c.priority === 'high');

    let readyState: L7ReadyState;
    if (critical.length === 0 && score >= 80) readyState = 'Ready';
    else if (score >= 50) readyState = 'Partially Ready';
    else readyState = 'Not Ready';

    const criticalIssues = [
      ...critical.map((c) => `⛔ ${c.title} — ${c.action ?? ''}`),
      ...high.slice(0, 2).map((c) => `⚠ ${c.title} — ${c.action ?? ''}`),
    ].slice(0, 6);

    return {
      generatedAt: new Date().toISOString(),
      firId: ctx.activeFirId,
      nextHearing,
      daysToHearing,
      readyState,
      score,
      checklist,
      pendingDocs,
      warrants,
      summons,
      criticalIssues,
      recommendations: checklist
        .filter((c) => !c.done)
        .map((c) => c.action ?? c.title)
        .slice(0, 5),
    };
  }
}

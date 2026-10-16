/**
 * DependencyGraphEngine.ts
 * Level-6: Builds the investigation dependency tree showing what blocks what.
 * Highlights missing dependencies that block charge sheet completion.
 *
 * SAFETY: Read-only. Never writes to any repository or database.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { DependencyGraphReport, DepNode, DepNodeType } from './L6Types';

function makeNode(
  id: string,
  type: DepNodeType,
  label: string,
  isPresent: boolean,
  depth: number,
  children: string[],
  parents: string[],
  details: string,
  isBlocking: boolean = false,
  legalReference?: string
): DepNode {
  return {
    id, type, label,
    isPresent,
    isMissing:  !isPresent,
    isBlocking: isBlocking && !isPresent,
    isLeaf:     children.length === 0,
    depth,
    children,
    parents,
    details,
    legalReference,
  };
}

export class DependencyGraphEngine {
  static analyze(ctx: InvestigationContext): DependencyGraphReport {
    const fir    = ctx.fir;
    const firId  = ctx.activeFirId;
    const karyvahiNames = ctx.karyvahi.all.map((k) => k.name.toLowerCase());

    function hasKaryvahi(pattern: RegExp): boolean {
      return karyvahiNames.some((n) => pattern.test(n));
    }

    // ── Presence checks ───────────────────────────────────────────────────────
    const hasMedical   = hasKaryvahi(/medical|doctor|injury/);
    const hasFSL       = hasKaryvahi(/fsl|forensic/);
    const hasExpert    = hasKaryvahi(/expert|opinion/);
    const hasDiary     = ctx.caseDiaries.length > 0;
    const hasArrest    = hasKaryvahi(/arrest|giraftari/);
    const hasSeizure   = hasKaryvahi(/seizure|muddemal/);
    const hasWitness   = hasKaryvahi(/witness|bayan/);
    const hasCourt     = ctx.courtDocs.length > 0;
    const hasBailReply = ctx.prarthnaPatra.length > 0;
    const hasNotice    = hasKaryvahi(/notice/);

    // Charge sheet readiness = all critical deps present
    const chargeSheetReady = hasMedical && hasFSL && hasDiary && hasArrest && hasWitness;

    // ── Node definitions (depth 0 = charge-sheet root) ────────────────────────
    const nodes: DepNode[] = [
      // Root
      makeNode('charge-sheet', 'charge-sheet', 'Charge Sheet', chargeSheetReady, 0,
        [], [], 'Final investigation document filed in court.', true, 'BNSS Sec 250'),

      // Depth 1
      makeNode('case-diary', 'case-diary', 'Case Diary', hasDiary, 1,
        ['charge-sheet'], [], 'Running record of all investigation activities.', true, 'BNSS Sec 193'),
      makeNode('medical-report', 'medical-report', 'Medical Report', hasMedical, 1,
        ['expert-opinion', 'case-diary'], [], 'Injury / post-mortem medical examination report.', true, 'BNSS Sec 185'),
      makeNode('witness-statement', 'witness-statement', 'Witness Statements', hasWitness, 1,
        ['case-diary'], [], 'Recorded statements of witnesses.', true, 'BNSS Sec 180'),
      makeNode('arrest', 'arrest', 'Arrest Memo', hasArrest, 1,
        ['bail-reply', 'court-filing'], [], 'Arrest memo and production record.', false, 'BNSS Sec 35'),
      makeNode('seizure', 'seizure', 'Seizure Memo', hasSeizure, 1,
        ['fsl-report', 'case-diary'], [], 'Seizure/muddemal documentation.', false, 'BNSS Sec 105'),

      // Depth 2
      makeNode('fsl-report', 'fsl-report', 'FSL Report', hasFSL, 2,
        ['expert-opinion', 'case-diary'], ['seizure'], 'Forensic Science Laboratory analysis report.', true, 'BNSS Sec 349'),
      makeNode('expert-opinion', 'expert-opinion', 'Expert Opinion', hasExpert, 2,
        ['case-diary'], ['medical-report', 'fsl-report'], 'Expert medical or forensic opinion.', false, 'BNSS Sec 357'),
      makeNode('bail-reply', 'bail-reply', 'Bail Reply', hasBailReply, 2,
        ['court-filing'], ['arrest'], 'Reply to bail application in court.', false, 'BNSS Sec 479'),
      makeNode('notice', 'notice', 'Notice', hasNotice, 2,
        ['witness-statement'], [], 'Notice served to witness/accused.', false, 'BNSS Sec 179'),

      // Depth 3
      makeNode('court-filing', 'court-filing', 'Court Filing', hasCourt, 3,
        [], ['bail-reply', 'arrest'], 'Documents filed in court.', false, 'BNSS Sec 230'),
      makeNode('prarthna-patra', 'prarthna-patra', 'Prarthna Patra', ctx.prarthnaPatra.length > 0, 3,
        [], [], 'Applications / prarthna patra filed.', false, ''),
    ];

    // ── Compute blocking chain ────────────────────────────────────────────────
    const missingCritical = nodes.filter((n) => n.isBlocking && n.isMissing);
    const blockingChain   = missingCritical
      .sort((a, b) => b.depth - a.depth)
      .map((n) => n.label);

    const presentCount  = nodes.filter((n) => n.isPresent).length;
    const completionPct = Math.round((presentCount / nodes.length) * 100);

    return {
      generatedAt:    new Date().toISOString(),
      firId,
      nodes,
      rootNodeId:     'charge-sheet',
      missingCritical,
      blockingChain,
      completionPct,
      summary: missingCritical.length === 0
        ? `All critical dependencies met. Investigation is charge-sheet ready.`
        : `${missingCritical.length} critical dependency gap(s) blocking charge sheet: ${blockingChain.slice(0, 3).join(', ')}.`,
    };
  }
}

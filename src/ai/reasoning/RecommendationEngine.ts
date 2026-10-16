/**
 * RecommendationEngine.ts
 * Produces Decision Cards from findings, risks, and context.
 *
 * Decision Card types:
 *   next-step, critical-evidence, pending-statements, court-action,
 *   recommended-documents, investigation-risk, compliance-gap
 *
 * SAFETY: Read-only. Pure computation. AI NEVER makes legal decisions.
 */

import type { DecisionCard, Finding, RiskItem } from './ReasoningTypes';
import type { InvestigationContext } from '../InvestigationContext';
import { ExplanationEngine } from './ExplanationEngine';
import { nylDaysUntilDeadline } from '@/lib/db/nyayalayRepo';

export class RecommendationEngine {
  static buildDecisionCards(
    findings: Finding[],
    risks: RiskItem[],
    ctx: InvestigationContext
  ): DecisionCard[] {
    const cards: DecisionCard[] = [];
    let counter = 0;

    const newCard = (
      type: DecisionCard['type'],
      title: string,
      summary: string,
      items: string[],
      severity: DecisionCard['severity'],
      isBlocking: boolean,
      linkedFinding?: Finding
    ): DecisionCard => {
      const explanation = linkedFinding
        ? ExplanationEngine.explain(linkedFinding, ctx)
        : {
            recommendationId: `card-${++counter}`,
            whyThisRecommendation: summary,
            supportingEvidence: ['Derived from cross-module analysis'],
            triggeredRules: [],
            modulesAnalysed: ['All modules'],
            confidence: { value: 75, evidenceUsed: [], missingInformation: [], alternativePossibilities: [], explanation: 'Advisory analysis.' },
          };
      return { id: `card-${++counter}`, type, title, summary, items, severity, explanation, isBlocking };
    };

    // ── 1. Critical Next Step ──────────────────────────────────────────────
    const criticalFindings = findings.filter((f) => f.severity === 'critical').slice(0, 1);
    const highFindings = findings.filter((f) => f.severity === 'high');
    const primaryFinding = criticalFindings[0] ?? highFindings[0];

    if (primaryFinding) {
      cards.push(newCard(
        'next-step',
        'Immediate Next Step',
        primaryFinding.recommendation,
        [
          primaryFinding.recommendation,
          ...highFindings.slice(0, 2).map((f) => f.title),
        ].filter(Boolean),
        primaryFinding.severity,
        primaryFinding.severity === 'critical',
        primaryFinding
      ));
    } else if (ctx.fir) {
      // All good — suggest routine next step
      cards.push(newCard(
        'next-step',
        'Next Investigation Step',
        'Investigation is progressing well. Continue with remaining Karyvahi.',
        ['Review pending Karyvahi steps', 'Update Case Diary'],
        'info',
        false
      ));
    }

    // ── 2. Critical Missing Evidence ──────────────────────────────────────
    const evidenceFindings = findings.filter((f) =>
      ['RULE-001', 'RULE-003', 'RULE-004', 'RULE-008', 'RULE-014'].includes(f.ruleId)
    );
    if (evidenceFindings.length > 0) {
      cards.push(newCard(
        'critical-evidence',
        'Critical Missing Evidence',
        `${evidenceFindings.length} evidence gap(s) that could weaken prosecution.`,
        evidenceFindings.map((f) => f.title),
        evidenceFindings[0].severity,
        evidenceFindings.some((f) => f.severity === 'critical'),
        evidenceFindings[0]
      ));
    }

    // ── 3. Pending Statements ────────────────────────────────────────────
    const statementFindings = findings.filter((f) =>
      ['RULE-002', 'RULE-012', 'RULE-013', 'COMP-005'].includes(f.ruleId)
    );
    if (statementFindings.length > 0) {
      cards.push(newCard(
        'pending-statements',
        'Pending Statements',
        `${statementFindings.length} statement(s) required to strengthen the case.`,
        statementFindings.map((f) => f.recommendation),
        statementFindings[0].severity,
        false,
        statementFindings[0]
      ));
    }

    // ── 4. Court Actions ─────────────────────────────────────────────────
    const imminentCourtDocs = ctx.courtDocs.filter((d) => {
      if (!d.deadline_date || d.status === 'Finished') return false;
      const days = nylDaysUntilDeadline(d.deadline_date, d.status);
      return days <= 7;
    });
    const courtFindings = findings.filter((f) =>
      ['RULE-006', 'RULE-007', 'POL-003', 'CON-003', 'COMP-006'].includes(f.ruleId)
    );
    if (imminentCourtDocs.length > 0 || courtFindings.length > 0) {
      const items = [
        ...imminentCourtDocs.map((d) => {
          const days = nylDaysUntilDeadline(d.deadline_date, d.status);
          return `${d.document_title || d.doc_type} — ${days < 0 ? Math.abs(days) + 'd overdue' : days + 'd remaining'}`;
        }),
        ...courtFindings.map((f) => f.recommendation),
      ];
      cards.push(newCard(
        'court-action',
        'Upcoming Court Actions',
        `${imminentCourtDocs.length} court deadline(s) require attention.`,
        items.slice(0, 5),
        imminentCourtDocs.some((d) => nylDaysUntilDeadline(d.deadline_date, d.status) < 0) ? 'critical' : 'high',
        imminentCourtDocs.some((d) => nylDaysUntilDeadline(d.deadline_date, d.status) < 0),
        courtFindings[0]
      ));
    }

    // ── 5. Recommended Documents ─────────────────────────────────────────
    const docFindings = findings.filter((f) =>
      ['RULE-009', 'RULE-010', 'RULE-015', 'RULE-016', 'COMP-002'].includes(f.ruleId)
    );
    if (docFindings.length > 0) {
      cards.push(newCard(
        'recommended-documents',
        'Recommended Documents',
        `${docFindings.length} documentation action(s) required.`,
        docFindings.map((f) => f.recommendation).slice(0, 4),
        docFindings[0].severity,
        false,
        docFindings[0]
      ));
    }

    // ── 6. Investigation Risks ───────────────────────────────────────────
    const topRisks = risks.filter((r) => r.level === 'critical' || r.level === 'high').slice(0, 4);
    if (topRisks.length > 0) {
      cards.push(newCard(
        'investigation-risk',
        'Investigation Risks',
        `${topRisks.length} risk(s) identified that may affect case outcome.`,
        topRisks.map((r) => `[${r.level.toUpperCase()}] ${r.title} — ${r.impact}`),
        topRisks[0].level,
        topRisks.some((r) => r.level === 'critical')
      ));
    }

    // ── 7. Compliance Gaps ───────────────────────────────────────────────
    const compFindings = findings.filter((f) => f.ruleId.startsWith('COMP-'));
    if (compFindings.length > 0) {
      cards.push(newCard(
        'compliance-gap',
        'Compliance Gaps',
        `${compFindings.length} mandatory legal requirement(s) not yet met.`,
        compFindings.map((f) => `${f.title}: ${f.recommendation}`).slice(0, 4),
        compFindings[0].severity,
        compFindings.some((f) => f.severity === 'critical'),
        compFindings[0]
      ));
    }

    // Sort: blocking critical first
    const sOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    cards.sort((a, b) => {
      if (a.isBlocking !== b.isBlocking) return a.isBlocking ? -1 : 1;
      return (sOrder[a.severity] ?? 4) - (sOrder[b.severity] ?? 4);
    });

    return cards;
  }
}

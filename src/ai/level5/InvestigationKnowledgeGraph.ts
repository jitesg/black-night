/**
 * InvestigationKnowledgeGraph.ts
 * Builds an interactive investigation entity graph from InvestigationContext.
 *
 * Produces nodes (FIR, Victim, Accused, Witnesses, Evidence, Medical, FSL,
 * Court, Case Diary, Karyavahi) and edges representing their relationships.
 * Highlights missing links, weak evidence chains, orphan nodes, and dependency
 * paths.
 *
 * SAFETY: Read-only. Never modifies investigation data.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  GraphNode,
  GraphEdge,
  GraphNodeType,
  GraphEdgeType,
  GraphAnalysis,
  InvestigationKnowledgeGraphReport,
} from './L5Types';
import type { IntelSeverity } from '../intelligence/IntelligenceTypes';

// ── Node factory ──────────────────────────────────────────────────────────────

function node(
  id: string,
  type: GraphNodeType,
  label: string,
  isPresent: boolean,
  isCriticalMissing: boolean,
  details: string
): GraphNode {
  return { id, type, label, isPresent, isOrphan: false, isCriticalMissing, details };
}

// ── Edge factory ──────────────────────────────────────────────────────────────

function edge(
  id: string,
  type: GraphEdgeType,
  sourceId: string,
  targetId: string,
  label: string,
  isPresent: boolean,
  isRequired: boolean
): GraphEdge {
  return { id, type, sourceId, targetId, label, isPresent, isBroken: !isPresent && isRequired, isRequired };
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class InvestigationKnowledgeGraph {
  static build(ctx: InvestigationContext): InvestigationKnowledgeGraphReport {
    const fir     = ctx.fir;
    const nodes:  GraphNode[] = [];
    const edges:  GraphEdge[] = [];

    // ── FIR node ──────────────────────────────────────────────────────────────
    const firPresent = !!fir;
    const firNode = node(
      'fir', 'fir',
      firPresent ? `FIR ${fir!.fir_number}` : 'FIR',
      firPresent, !firPresent,
      firPresent
        ? `${fir!.crime_type} — ${fir!.section}\nRegistered: ${fir!.date_of_information ?? '—'}`
        : 'No FIR loaded in context.'
    );
    nodes.push(firNode);

    // ── Victim (complainant) node ─────────────────────────────────────────────
    const victimPresent = !!(fir?.complainant_name);
    const victimNode = node(
      'victim', 'victim',
      victimPresent ? fir!.complainant_name : 'Victim',
      victimPresent, !victimPresent,
      victimPresent
        ? `Age: ${fir!.complainant_age ?? '—'}  Mobile: ${fir!.complainant_mobile ?? '—'}`
        : 'No complainant/victim information.'
    );
    nodes.push(victimNode);
    edges.push(edge('e-fir-victim', 'fir-victim', 'fir', 'victim', 'complainant/victim', victimPresent, true));

    // ── Accused nodes — derive from karyvahi names that mention arrest/accused
    const accusedList = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('accused') || k.name.toLowerCase().includes('arrest')
    );
    const unknownCount = fir?.unknown_accused_count ?? 0;

    if (accusedList.length > 0) {
      accusedList.slice(0, 5).forEach((a, i) => {
        const accId = `accused-${i}`;
        nodes.push(node(accId, 'accused', `Accused ${i + 1}`, true, false, `Accused in FIR ${fir?.fir_number ?? ''}`));
        edges.push(edge(`e-fir-acc-${i}`, 'fir-accused', 'fir', accId, 'accused', true, true));
        edges.push(edge(`e-acc-evi-${i}`, 'accused-evidence', accId, 'evidence', 'linked evidence', false, false));
      });
    } else {
      const accId = 'accused-unknown';
      const label = unknownCount > 0 ? `${unknownCount} Unknown Accused` : 'Accused (Not Identified)';
      nodes.push(node(accId, 'accused', label, unknownCount > 0, unknownCount === 0, 'Accused not yet formally identified.'));
      edges.push(edge('e-fir-acc', 'fir-accused', 'fir', accId, 'accused', unknownCount > 0, true));
    }

    // ── Witness node ──────────────────────────────────────────────────────────
    const witnessSteps = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('witness') || k.name.toLowerCase().includes('बयान')
    );
    const witnessPresent = witnessSteps.length > 0;
    nodes.push(node(
      'witness', 'witness',
      witnessPresent ? `Witnesses (${witnessSteps.length})` : 'Witnesses',
      witnessPresent, !witnessPresent,
      witnessPresent ? `${witnessSteps.length} witness action(s) recorded.` : 'No witness statements recorded.'
    ));
    edges.push(edge('e-fir-wit', 'fir-witness', 'fir', 'witness', 'witnesses', witnessPresent, true));
    edges.push(edge('e-vic-wit', 'victim-witness', 'victim', 'witness', 'victim/witness', victimPresent && witnessPresent, false));

    // ── Evidence node ─────────────────────────────────────────────────────────
    const seizureCount = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('seizure') || k.name.toLowerCase().includes('muddemal')
    ).length;
    const evidencePresent = seizureCount > 0;
    nodes.push(node(
      'evidence', 'evidence',
      evidencePresent ? `Evidence (${seizureCount} seized)` : 'Evidence',
      evidencePresent, !evidencePresent,
      evidencePresent ? `${seizureCount} seizure(s) recorded.` : 'No evidence seized yet.'
    ));
    edges.push(edge('e-acc-evi', 'accused-evidence', 'accused-0', 'evidence', 'accused-evidence link', evidencePresent, false));
    edges.push(edge('e-evi-sei', 'evidence-seizure', 'evidence', 'evidence', 'seizure memo', evidencePresent, evidencePresent));

    // ── Medical node ──────────────────────────────────────────────────────────
    const medSteps = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('medical') || k.name.toLowerCase().includes('doctor')
    );
    const medPresent = medSteps.length > 0;
    nodes.push(node(
      'medical', 'medical',
      medPresent ? 'Medical Reports' : 'Medical (Pending)',
      medPresent, victimPresent && !medPresent,
      medPresent ? `${medSteps.length} medical action(s).` : 'Medical examination not yet completed.'
    ));
    edges.push(edge('e-vic-med', 'victim-medical', 'victim', 'medical', 'medical examination', medPresent, victimPresent));

    // ── FSL node ──────────────────────────────────────────────────────────────
    const fslSteps = ctx.karyvahi.all.filter(
      (k) => k.name.toLowerCase().includes('fsl') || k.name.toLowerCase().includes('forensic')
    );
    const fslPresent = fslSteps.length > 0;
    nodes.push(node(
      'fsl', 'fsl',
      fslPresent ? 'FSL Reports' : 'FSL (Pending)',
      fslPresent, evidencePresent && !fslPresent,
      fslPresent ? `${fslSteps.length} FSL submission(s).` : 'FSL examination not yet requested.'
    ));
    edges.push(edge('e-evi-fsl', 'evidence-fsl', 'evidence', 'fsl', 'sent to FSL', fslPresent, evidencePresent));

    // ── Court node — use deadline_date (NyayalayDocument has no next_hearing_date)
    const courtPresent = ctx.courtDocs.length > 0;
    const nextDeadline = ctx.courtDocs.find((d) => d.deadline_date)?.deadline_date;
    nodes.push(node(
      'court', 'court',
      courtPresent ? `Court (${ctx.courtDocs.length} doc${ctx.courtDocs.length > 1 ? 's' : ''})` : 'Court',
      courtPresent, false,
      courtPresent ? `Next deadline: ${nextDeadline ?? 'N/A'}` : 'No court documents yet.'
    ));
    edges.push(edge('e-all-court', 'all-court', 'fir', 'court', 'court proceedings', courtPresent, false));

    // ── Case Diary node ───────────────────────────────────────────────────────
    const cdPresent = ctx.caseDiaries.length > 0;
    nodes.push(node(
      'case-diary', 'case-diary',
      cdPresent ? `Case Diary (${ctx.caseDiaries.length})` : 'Case Diary',
      cdPresent, !cdPresent,
      cdPresent ? `${ctx.caseDiaries.length} entries.` : 'No case diary entries.'
    ));
    edges.push(edge('e-all-cd', 'all-case-diary', 'fir', 'case-diary', 'documented in', cdPresent, true));

    // ── Karyavahi node ────────────────────────────────────────────────────────
    const kPresent = ctx.karyvahi.all.length > 0;
    nodes.push(node(
      'karyavahi', 'karyavahi',
      kPresent ? `Investigation Steps (${ctx.karyvahi.all.length})` : 'Investigation Steps',
      kPresent, !kPresent,
      kPresent
        ? `${ctx.karyvahi.completed.length} completed / ${ctx.karyvahi.pending.length} pending`
        : 'No investigation steps recorded.'
    ));
    edges.push(edge('e-all-kary', 'all-case-diary', 'fir', 'karyavahi', 'investigation steps', kPresent, true));

    // ── Graph analysis ────────────────────────────────────────────────────────
    const missingLinks: GraphAnalysis['missingLinks'] = [];
    const weakChains:   GraphAnalysis['weakChains']   = [];
    const orphanNodes:  GraphAnalysis['orphanNodes']  = [];

    if (!victimPresent) {
      missingLinks.push({ from: 'FIR', to: 'Victim', description: 'No complainant/victim linked to FIR.', severity: 'critical' as IntelSeverity });
    }
    if (victimPresent && !medPresent) {
      missingLinks.push({ from: 'Victim', to: 'Medical', description: 'Medical examination not completed.', severity: 'high' as IntelSeverity });
    }
    if (evidencePresent && !fslPresent) {
      missingLinks.push({ from: 'Evidence', to: 'FSL', description: 'Seized evidence not sent for FSL examination.', severity: 'high' as IntelSeverity });
    }
    if (!witnessPresent) {
      missingLinks.push({ from: 'FIR', to: 'Witness', description: 'No witness statements recorded.', severity: 'medium' as IntelSeverity });
    }
    if (!cdPresent) {
      missingLinks.push({ from: 'FIR', to: 'Case Diary', description: 'No case diary entries found.', severity: 'medium' as IntelSeverity });
    }

    if (!evidencePresent && ctx.caseDiaries.length > 0) {
      weakChains.push({ description: 'Case diary exists but no evidence has been seized.', affectedNodes: ['evidence'] });
    }
    if (evidencePresent && accusedList.length === 0) {
      weakChains.push({ description: 'Evidence seized but no accused formally identified.', affectedNodes: ['accused-unknown', 'evidence'] });
    }

    // Mark orphan nodes
    const connectedIds = new Set(edges.filter((e) => e.isPresent).flatMap((e) => [e.sourceId, e.targetId]));
    for (const n of nodes) {
      if (n.isPresent && !connectedIds.has(n.id)) {
        n.isOrphan = true;
        orphanNodes.push({ nodeId: n.id, label: n.label, recommendation: `Link ${n.label} to related investigation entities.` });
      }
    }

    const dependencyPaths: GraphAnalysis['dependencyPaths'] = [
      { title: 'Charge Sheet Readiness', steps: ['FIR', 'Accused Identified', 'Evidence Seized', 'FSL Report', 'Witness Statements', 'Medical Report', 'Charge Sheet'] },
      { title: 'Court Compliance', steps: ['FIR', 'Court Document', 'Compliance Report', 'Hearing Date Met'] },
      { title: 'Evidence Chain', steps: ['Seizure', 'FSL Submission', 'FSL Report', 'Evidence Exhibit in CS'] },
    ];

    const analysis: GraphAnalysis = { missingLinks, weakChains, orphanNodes, dependencyPaths };

    // ── Scoring ───────────────────────────────────────────────────────────────
    const presentCount   = nodes.filter((n) => n.isPresent).length;
    const totalCount     = nodes.length;
    const strengthScore  = Math.round((presentCount / totalCount) * 100);
    const criticalMissing = nodes.filter((n) => n.isCriticalMissing).length;

    const summary =
      `Graph: ${presentCount}/${totalCount} entities present. ` +
      `${criticalMissing} critical missing. ` +
      `${missingLinks.length} broken link(s). ` +
      `Strength score: ${strengthScore}/100.`;

    return {
      generatedAt: new Date().toISOString(),
      firId: fir?.id,
      nodes,
      edges,
      analysis,
      strengthScore,
      presentNodeCount: presentCount,
      totalNodeCount:   totalCount,
      missingCriticalCount: criticalMissing,
      summary,
    };
  }
}

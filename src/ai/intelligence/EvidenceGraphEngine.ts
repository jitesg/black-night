/**
 * EvidenceGraphEngine.ts
 * Builds logical evidence relationships and detects weak/broken chains.
 *
 * SAFETY: Read-only. Consumes InvestigationContext only. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  EvidenceGraphReport,
  EvidenceNode,
  EvidenceEdge,
  EvidenceChainIssue,
  EvidenceNodeType,
} from './IntelligenceTypes';

type NodeDef = { id: string; type: EvidenceNodeType; label: string };

const NODE_DEFS: NodeDef[] = [
  { id: 'victim',      type: 'victim',      label: 'Victim'             },
  { id: 'medical',     type: 'medical',     label: 'Medical Report'     },
  { id: 'witness',     type: 'witness',     label: 'Witness Statement'  },
  { id: 'scene',       type: 'scene',       label: 'Scene of Crime'     },
  { id: 'weapon',      type: 'weapon',      label: 'Weapon / Exhibit'   },
  { id: 'fsl',         type: 'fsl',         label: 'FSL Report'         },
  { id: 'accused',     type: 'accused',     label: 'Accused'            },
  { id: 'motive',      type: 'motive',      label: 'Motive'             },
  { id: 'chargesheet', type: 'chargesheet', label: 'Charge Sheet'       },
];

// Pattern → nodeId presence detection
const PRESENCE_PATTERNS: Record<string, RegExp> = {
  victim:      /victim|complainant|पीड़ित|bayan|statement.*victim|victim.*statement/i,
  medical:     /medical|mlc|post.mortem|doctor|hospital|injury/i,
  witness:     /witness|gavah|statement|bayan|गवाह/i,
  scene:       /scene|ghatnasthal|spot|inspection|panchnama|पंचनामा/i,
  weapon:      /weapon|हथियार|seizure|exhibit|recovery|knife|gun|rod/i,
  fsl:         /fsl|forensic|lab|chemical|ballistic/i,
  accused:     /accused|arrest|आरोपी|culprit/i,
  motive:      /motive|reason|dispute|grudge|financial/i,
  chargesheet: /charge.sheet|challan|final.report/i,
};

// Expected causal chain: from → to
const EXPECTED_EDGES: Array<{ from: string; to: string }> = [
  { from: 'victim',  to: 'medical'     },
  { from: 'victim',  to: 'witness'     },
  { from: 'scene',   to: 'weapon'      },
  { from: 'weapon',  to: 'fsl'         },
  { from: 'accused', to: 'weapon'      },
  { from: 'accused', to: 'motive'      },
  { from: 'fsl',     to: 'chargesheet' },
  { from: 'witness', to: 'chargesheet' },
  { from: 'medical', to: 'chargesheet' },
];

export class EvidenceGraphEngine {
  static evaluate(ctx: InvestigationContext): EvidenceGraphReport {
    const karyNames = ctx.karyvahi.all.map((k) => k.name);
    const allText = karyNames.join(' ').toLowerCase();

    // Build nodes
    const nodes: EvidenceNode[] = NODE_DEFS.map((def) => {
      const isPresent = PRESENCE_PATTERNS[def.id]?.test(allText) ?? false;
      return {
        id: def.id,
        type: def.type,
        label: def.label,
        isPresent,
        isLinked: false,
        isOrphan: false,
        isDuplicate: false,
        linkedTo: [],
      };
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const edges: EvidenceEdge[] = [];
    const issues: EvidenceChainIssue[] = [];

    // Build edges based on expected chain
    for (const exp of EXPECTED_EDGES) {
      const fromNode = nodeMap.get(exp.from);
      const toNode   = nodeMap.get(exp.to);
      if (!fromNode || !toNode) continue;

      if (fromNode.isPresent && toNode.isPresent) {
        edges.push({ from: exp.from, to: exp.to, strength: 'strong' });
        fromNode.linkedTo.push(exp.to);
        toNode.linkedTo.push(exp.from);
      } else if (fromNode.isPresent && !toNode.isPresent) {
        edges.push({ from: exp.from, to: exp.to, strength: 'broken', reason: `${toNode.label} is missing` });
        issues.push({
          severity: 'high',
          type: 'broken-link',
          description: `${fromNode.label} exists but ${toNode.label} is missing — breaks the evidence chain.`,
          affectedNodes: [exp.from, exp.to],
          recommendation: `Obtain ${toNode.label} to strengthen this evidence link.`,
        });
      } else if (!fromNode.isPresent && toNode.isPresent) {
        edges.push({ from: exp.from, to: exp.to, strength: 'weak', reason: `${fromNode.label} is missing` });
      }
    }

    // Mark linked status
    nodes.forEach((n) => {
      n.isLinked = n.linkedTo.length > 0;
    });

    // Detect orphans — present but not linked
    const presentNodes = nodes.filter((n) => n.isPresent);
    presentNodes.forEach((n) => {
      if (!n.isLinked) {
        n.isOrphan = true;
        issues.push({
          severity: 'medium',
          type: 'orphan',
          description: `${n.label} is present but not connected to any other evidence node.`,
          affectedNodes: [n.id],
          recommendation: `Link ${n.label} to relevant evidence (witness, medical, etc.) to strengthen the chain.`,
        });
      }
    });

    // Detect duplicate karyvahi entries (same pattern matched multiple times)
    const karySet = new Set<string>();
    const duplicates: string[] = [];
    for (const k of karyNames) {
      const key = k.toLowerCase().replace(/\s+/g, ' ').trim();
      if (karySet.has(key)) duplicates.push(k);
      else karySet.add(key);
    }
    if (duplicates.length > 0) {
      issues.push({
        severity: 'info',
        type: 'duplicate',
        description: `Possible duplicate investigation records found: ${duplicates.slice(0, 3).join(', ')}`,
        affectedNodes: [],
        recommendation: 'Review and consolidate duplicate investigation entries.',
      });
    }

    // Missing critical nodes
    const criticalNodes = ['victim', 'witness', 'accused'];
    criticalNodes.forEach((id) => {
      const node = nodeMap.get(id);
      if (node && !node.isPresent) {
        issues.push({
          severity: 'critical',
          type: 'missing-node',
          description: `Critical evidence node "${node.label}" is absent from the investigation record.`,
          affectedNodes: [id],
          recommendation: `${node.label} records must be created. This is a critical gap.`,
        });
      }
    });

    // Compute strength score
    const strongEdges  = edges.filter((e) => e.strength === 'strong').length;
    const totalEdges   = EXPECTED_EDGES.length;
    const presentCount = presentNodes.length;
    const totalCount   = NODE_DEFS.length;
    const nodeScore    = Math.round((presentCount / totalCount) * 50);
    const edgeScore    = Math.round((strongEdges / Math.max(totalEdges, 1)) * 50);
    const strengthScore = nodeScore + edgeScore;

    const orphanCount     = nodes.filter((n) => n.isOrphan).length;
    const brokenLinkCount = edges.filter((e) => e.strength === 'broken').length;

    const summary =
      `Evidence Graph: ${strengthScore}/100 strength. ` +
      `${presentCount}/${totalCount} evidence nodes present. ` +
      `${strongEdges}/${totalEdges} chain links active. ` +
      (brokenLinkCount > 0 ? `⚠️ ${brokenLinkCount} broken links. ` : '') +
      (orphanCount > 0 ? `${orphanCount} orphan nodes. ` : '');

    return {
      nodes,
      edges,
      strengthScore,
      issues,
      presentNodeCount: presentCount,
      totalNodeCount: totalCount,
      orphanCount,
      brokenLinkCount,
      summary,
    };
  }
}

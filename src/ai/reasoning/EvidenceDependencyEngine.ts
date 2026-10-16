/**
 * EvidenceDependencyEngine.ts
 * Constructs an investigation dependency graph and identifies blocked workflows.
 *
 * Standard investigation workflow:
 *   FIR Registration → Crime Scene Inspection → Evidence Seizure →
 *   Witness Statements → Medical Examination → FSL Report →
 *   Accused Examination → Case Diary → Court Proceedings → Charge Sheet
 *
 * SAFETY: Read-only. No DB access. Pure computation.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type { DependencyGraph, DependencyNode } from './ReasoningTypes';

// ── Node definitions ─────────────────────────────────────────────────────────

interface NodeDef {
  id: string;
  label: string;
  dependsOn: string[];
  /** Karyvahi name patterns that mark this node as completed */
  completionPatterns?: string[];
  /** Check via specific module presence rather than karyvahi */
  customCheck?: (ctx: InvestigationContext) => 'completed' | 'pending' | 'missing';
}

const NODE_DEFINITIONS: NodeDef[] = [
  {
    id: 'node-fir',
    label: 'FIR Registration',
    dependsOn: [],
    customCheck: (ctx) => ctx.fir ? 'completed' : 'missing',
  },
  {
    id: 'node-scene',
    label: 'Crime Scene Inspection',
    dependsOn: ['node-fir'],
    completionPatterns: ['ghatnasthal', 'scene inspection', 'स्थल निरीक्षण', 'site inspection'],
  },
  {
    id: 'node-seizure',
    label: 'Evidence Seizure / Panchnama',
    dependsOn: ['node-scene'],
    completionPatterns: ['seizure', 'panchnama', 'muddemal', 'पंचनामा', 'जब्ती'],
  },
  {
    id: 'node-witness',
    label: 'Witness Statements',
    dependsOn: ['node-fir'],
    completionPatterns: ['bayan', 'statement', 'witness', 'gavah', 'बयान', 'गवाह'],
  },
  {
    id: 'node-complainant',
    label: 'Complainant / Victim Statement',
    dependsOn: ['node-fir'],
    completionPatterns: ['bayan vadi', 'complainant', 'victim statement', 'वादी बयान', 'पीड़ित'],
  },
  {
    id: 'node-medical',
    label: 'Medical Examination',
    dependsOn: ['node-fir'],
    completionPatterns: ['medical', 'mlc', 'doctor', 'hospital', 'चिकित्सा', 'अस्पताल'],
  },
  {
    id: 'node-fsl',
    label: 'FSL Report',
    dependsOn: ['node-seizure'],
    completionPatterns: ['fsl', 'forensic', 'lab report', 'फोरेंसिक', 'एफएसएल'],
  },
  {
    id: 'node-doctor-statement',
    label: "Doctor's Opinion / Statement",
    dependsOn: ['node-medical'],
    completionPatterns: ['doctor statement', 'medical opinion', 'doctor opinion', 'चिकित्सक'],
  },
  {
    id: 'node-accused',
    label: 'Accused Examination',
    dependsOn: ['node-fir'],
    completionPatterns: ['accused', 'aaropit', 'आरोपी', 'arrest', 'giraftari', 'गिरफ्तारी'],
  },
  {
    id: 'node-arrest-memo',
    label: 'Arrest Memo',
    dependsOn: ['node-accused'],
    completionPatterns: ['arrest memo', 'giraftari memo', 'गिरफ्तारी मेमो'],
  },
  {
    id: 'node-casediary',
    label: 'Case Diary Entries',
    dependsOn: ['node-fir'],
    customCheck: (ctx) =>
      ctx.caseDiaries.length > 0 ? 'completed' : ctx.fir ? 'pending' : 'missing',
  },
  {
    id: 'node-videography',
    label: 'e-Sakshya Videography',
    dependsOn: ['node-scene'],
    completionPatterns: ['e-sakshya', 'videography', 'video', 'ई-साक्ष्य'],
  },
  {
    id: 'node-court',
    label: 'Court Proceedings',
    dependsOn: ['node-casediary', 'node-witness', 'node-accused'],
    customCheck: (ctx) =>
      ctx.courtDocs.length > 0 ? 'completed' : ctx.fir ? 'pending' : 'missing',
  },
  {
    id: 'node-chargesheet',
    label: 'Charge Sheet',
    dependsOn: ['node-court', 'node-fsl', 'node-doctor-statement', 'node-arrest-memo'],
    completionPatterns: ['charge sheet', 'challan', 'चालान', 'आरोप पत्र'],
  },
];

// ── Engine ────────────────────────────────────────────────────────────────────

export class EvidenceDependencyEngine {
  static build(ctx: InvestigationContext): DependencyGraph {
    const nodeMap = new Map<string, DependencyNode>();

    // Build node statuses
    for (const def of NODE_DEFINITIONS) {
      const status = EvidenceDependencyEngine._resolveStatus(ctx, def);
      nodeMap.set(def.id, {
        id: def.id,
        label: def.label,
        status,
        dependsOn: def.dependsOn,
      });
    }

    // Mark blocked nodes (a node is blocked if any dependency is missing/blocked/pending)
    for (const def of NODE_DEFINITIONS) {
      const node = nodeMap.get(def.id)!;
      if (node.status === 'completed') continue;
      const blockedByDep = def.dependsOn.some((depId) => {
        const dep = nodeMap.get(depId);
        return dep && (dep.status === 'missing' || dep.status === 'blocked');
      });
      if (blockedByDep) {
        const blockingDep = def.dependsOn.find((depId) => {
          const dep = nodeMap.get(depId);
          return dep && (dep.status === 'missing' || dep.status === 'blocked');
        });
        const blockingNode = blockingDep ? nodeMap.get(blockingDep) : undefined;
        nodeMap.set(def.id, {
          ...node,
          status: 'blocked',
          blockReason: blockingNode ? `Waiting for: ${blockingNode.label}` : 'Dependency incomplete',
          severity: 'high',
        });
      }
    }

    const nodes = Array.from(nodeMap.values());
    const blockedNodeIds = nodes.filter((n) => n.status === 'blocked' || n.status === 'missing').map((n) => n.id);

    // Compute critical path (longest chain of completed → pending nodes)
    const criticalPath = EvidenceDependencyEngine._computeCriticalPath(nodeMap);

    return { nodes, blockedNodeIds, criticalPath };
  }

  private static _resolveStatus(ctx: InvestigationContext, def: NodeDef): DependencyNode['status'] {
    if (def.customCheck) return def.customCheck(ctx);
    if (!ctx.fir) return 'missing';
    if (!def.completionPatterns) return 'pending';
    const done = ctx.karyvahi.completed.some((k) =>
      def.completionPatterns!.some((p) => k.name.toLowerCase().includes(p.toLowerCase()))
    );
    if (done) return 'completed';
    // Present but not completed
    const present = ctx.karyvahi.all.some((k) =>
      def.completionPatterns!.some((p) => k.name.toLowerCase().includes(p.toLowerCase()))
    );
    return present ? 'pending' : 'missing';
  }

  private static _computeCriticalPath(nodeMap: Map<string, DependencyNode>): string[] {
    // DFS from charge sheet backwards through completed/pending nodes
    const path: string[] = [];
    const visited = new Set<string>();

    const dfs = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = nodeMap.get(id);
      if (!node) return;
      node.dependsOn.forEach(dfs);
      path.push(id);
    };

    dfs('node-chargesheet');
    return path;
  }
}

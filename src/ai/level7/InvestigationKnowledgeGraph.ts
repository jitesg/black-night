/**
 * InvestigationKnowledgeGraph.ts
 * Level-7: Builds a rich relationship graph across all investigation entities.
 * Expands on L5 graph with PrarthnaPatra, KnowledgeArticles, Court, GD nodes.
 *
 * SAFETY: Read-only. Pure analysis. No DB access.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  KnowledgeGraphReport, KGNode, KGEdge, KGCluster, KGNodeType,
} from './L7Types';

let _nodeSeq = 0;
function nid(prefix: string): string { return `${prefix}-${++_nodeSeq}`; }

function mkNode(id: string, type: KGNodeType, label: string, data?: Record<string, string | number | boolean>): KGNode {
  return { id, type, label, data };
}
function mkEdge(from: string, to: string, relation: string, weight = 1, bidi = false): KGEdge {
  return { from, to, relation, weight, bidirectional: bidi };
}

export class InvestigationKnowledgeGraph {
  static build(ctx: InvestigationContext): KnowledgeGraphReport {
    _nodeSeq = 0;
    const nodes: KGNode[] = [];
    const edges: KGEdge[] = [];
    const clusters: KGCluster[] = [];

    const fir = ctx.fir;

    // ── FIR root node ─────────────────────────────────────────────────────────
    const firNodeId = 'fir-root';
    if (fir) {
      nodes.push(mkNode(firNodeId, 'FIR', `FIR ${fir.fir_number}`, {
        crimeType: fir.crime_type, status: fir.status,
        section: fir.section,
      }));
    }

    // ── Location ──────────────────────────────────────────────────────────────
    if (fir?.ghatnasthal) {
      const locId = nid('loc');
      nodes.push(mkNode(locId, 'Location', fir.ghatnasthal));
      edges.push(mkEdge(firNodeId, locId, 'occurred_at'));
    }

    // ── Complainant as Victim node ────────────────────────────────────────────
    if (fir?.complainant_name) {
      const victimId = nid('victim');
      nodes.push(mkNode(victimId, 'Victim', fir.complainant_name, {
        mobile: fir.complainant_mobile ?? '',
        address: fir.complainant_address ?? '',
      }));
      edges.push(mkEdge(firNodeId, victimId, 'complainant'));
      clusters.push({ id: 'cl-persons', label: 'Persons', nodes: [victimId], type: 'Victim' });
    }

    // ── Karyvahi → extract accused / vehicle / mobile patterns ───────────────
    const vehicleIds: string[] = [];
    const mobileIds: string[] = [];
    const officerIds: string[] = [];
    const accusedSet = new Set<string>();

    for (const k of ctx.karyvahi.all) {
      // Officer node (from karyvahi names hint)
      if (/officer|inspector|si|asi|constable/i.test(k.name)) {
        const offId = nid('officer');
        nodes.push(mkNode(offId, 'Officer', k.name));
        edges.push(mkEdge(firNodeId, offId, 'investigated_by'));
        officerIds.push(offId);
      }

      const text = (k.precautions ?? '') + ' ' + k.name;

      // Vehicle patterns
      const vehs = text.match(/[A-Z]{2}\s?\d{2}\s?[A-Z]{1,3}\s?\d{4}/gi) ?? [];
      for (const veh of vehs) {
        const vehLabel = veh.replace(/\s/g, '').toUpperCase();
        if (!vehicleIds.some((v) => nodes.find((n) => n.id === v)?.label === vehLabel)) {
          const vehId = nid('veh');
          nodes.push(mkNode(vehId, 'Vehicle', vehLabel));
          edges.push(mkEdge(firNodeId, vehId, 'associated_vehicle'));
          vehicleIds.push(vehId);
        }
      }

      // Mobile patterns
      const mobs = text.match(/[6-9]\d{9}/g) ?? [];
      for (const mob of mobs) {
        if (!mobileIds.some((m) => nodes.find((n) => n.id === m)?.label === mob)) {
          const mobId = nid('mob');
          nodes.push(mkNode(mobId, 'Mobile', mob));
          edges.push(mkEdge(firNodeId, mobId, 'associated_mobile'));
          mobileIds.push(mobId);
        }
      }

      // Accused names from arrest karyvahi
      if (/arrest|giraftari/i.test(k.name) && k.precautions) {
        const nameMatch = k.precautions.match(/(?:accused|name)[:\s]+([A-Za-z\u0900-\u097F\s]+)/i);
        if (nameMatch?.[1]) {
          const accusedName = nameMatch[1].trim().slice(0, 40);
          if (!accusedSet.has(accusedName)) {
            accusedSet.add(accusedName);
            const accId = nid('accused');
            nodes.push(mkNode(accId, 'Accused', accusedName));
            edges.push(mkEdge(firNodeId, accId, 'accused_in', 2));
          }
        }
      }
    }

    // ── Case Diary nodes ──────────────────────────────────────────────────────
    const diaryIds: string[] = [];
    for (const cd of ctx.caseDiaries.slice(0, 5)) {
      const cdId = nid('diary');
      nodes.push(mkNode(cdId, 'CaseDiary', `Diary ${cd.preparation_date}`, {
        date: cd.preparation_date,
      }));
      edges.push(mkEdge(firNodeId, cdId, 'documented_in'));
      diaryIds.push(cdId);
    }

    // ── Evidence (seizure/FSL karyvahi) ───────────────────────────────────────
    const evidenceIds: string[] = [];
    for (const k of ctx.karyvahi.completed.filter((k) =>
      /seizure|panchnama|fsl|evidence|exhibit|muddemal|photo|video/i.test(k.name)
    ).slice(0, 6)) {
      const evId = nid('ev');
      nodes.push(mkNode(evId, 'Evidence', k.name, { completed: true }));
      edges.push(mkEdge(firNodeId, evId, 'evidence_collected'));
      evidenceIds.push(evId);
    }

    // ── Witness nodes (from bayan karyvahi) ───────────────────────────────────
    const witnessIds: string[] = [];
    for (const k of ctx.karyvahi.all.filter((k) =>
      /bayan|witness|statement|बयान|गवाह/i.test(k.name)
    ).slice(0, 4)) {
      const wId = nid('witness');
      nodes.push(mkNode(wId, 'Witness', k.name.replace(/bayan|witness|statement/gi, '').trim() || `Witness ${witnessIds.length + 1}`));
      edges.push(mkEdge(firNodeId, wId, 'witness_in', 2));
      witnessIds.push(wId);
    }

    // ── Court nodes ───────────────────────────────────────────────────────────
    const courtIds: string[] = [];
    for (const d of ctx.courtDocs.slice(0, 4)) {
      const cId = nid('court');
      nodes.push(mkNode(cId, 'Court', d.court_name || d.document_title || 'Court Document', {
        status: d.status, deadline: d.deadline_date,
      }));
      edges.push(mkEdge(firNodeId, cId, 'court_proceeding'));
      courtIds.push(cId);
    }

    // ── Prarthna Patra nodes ──────────────────────────────────────────────────
    const ppIds: string[] = [];
    for (const pp of ctx.prarthnaPatra.slice(0, 3)) {
      const ppId = nid('pp');
      nodes.push(mkNode(ppId, 'PrarthnaPatra', `${pp.petition_type} — ${pp.date_of_receipt}`, {
        status: pp.status,
      }));
      edges.push(mkEdge(firNodeId, ppId, 'related_petition'));
      ppIds.push(ppId);
    }

    // ── Knowledge Article nodes ───────────────────────────────────────────────
    const artIds: string[] = [];
    for (const k of ctx.relevantKnowledge.slice(0, 4)) {
      const artId = nid('art');
      nodes.push(mkNode(artId, 'KnowledgeArticle', k.title, { category: k.category }));
      edges.push(mkEdge(firNodeId, artId, 'legal_reference', 1, true));
      artIds.push(artId);
    }

    // ── Cross edges: evidence → court ─────────────────────────────────────────
    for (const evId of evidenceIds.slice(0, 2)) {
      for (const cId of courtIds.slice(0, 1)) {
        edges.push(mkEdge(evId, cId, 'submitted_to', 1));
      }
    }

    // ── Cross edges: witness → court ──────────────────────────────────────────
    for (const wId of witnessIds.slice(0, 2)) {
      for (const cId of courtIds.slice(0, 1)) {
        edges.push(mkEdge(wId, cId, 'to_testify_in', 1));
      }
    }

    // ── Cross edges: diary → evidence ─────────────────────────────────────────
    for (const dId of diaryIds.slice(0, 1)) {
      for (const eId of evidenceIds.slice(0, 2)) {
        edges.push(mkEdge(dId, eId, 'documents'));
      }
    }

    // ── Clusters ──────────────────────────────────────────────────────────────
    if (vehicleIds.length)  clusters.push({ id: 'cl-vehicles',  label: 'Vehicles',  nodes: vehicleIds,  type: 'Vehicle'  });
    if (mobileIds.length)   clusters.push({ id: 'cl-mobiles',   label: 'Mobiles',   nodes: mobileIds,   type: 'Mobile'   });
    if (evidenceIds.length) clusters.push({ id: 'cl-evidence',  label: 'Evidence',  nodes: evidenceIds, type: 'Evidence' });
    if (witnessIds.length)  clusters.push({ id: 'cl-witnesses', label: 'Witnesses', nodes: witnessIds,  type: 'Witness'  });
    if (courtIds.length)    clusters.push({ id: 'cl-court',     label: 'Court',     nodes: courtIds,    type: 'Court'    });
    if (diaryIds.length)    clusters.push({ id: 'cl-diary',     label: 'Case Diaries', nodes: diaryIds, type: 'CaseDiary' });
    if (artIds.length)      clusters.push({ id: 'cl-laws',      label: 'Legal Refs', nodes: artIds,     type: 'KnowledgeArticle' });

    return {
      generatedAt: new Date().toISOString(),
      firId: ctx.activeFirId,
      nodes,
      edges,
      clusters,
      stats: { nodeCount: nodes.length, edgeCount: edges.length, clusterCount: clusters.length },
    };
  }
}

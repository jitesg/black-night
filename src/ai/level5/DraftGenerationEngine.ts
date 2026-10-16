/**
 * DraftGenerationEngine.ts
 * Generates structured, editable draft documents from InvestigationContext.
 *
 * SAFETY INVARIANTS:
 *  - Never auto-saves. Every draft has requiresOfficerReview = true.
 *  - isApproved is always false at generation time.
 *  - Officer must explicitly approve via existing workflow before any save.
 */

import type { InvestigationContext } from '../InvestigationContext';
import type {
  L5DraftType,
  GeneratedDraft,
  DraftSection,
  DraftGenerationReport,
} from './L5Types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function today(): string {
  const d = new Date();
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
}

function placeholder(label: string): string {
  return `[${label}]`;
}

function section(
  id: string,
  title: string,
  content: string,
  isPlaceholder = false,
  legalRef?: string
): DraftSection {
  return { id, title, content, isPlaceholder, legalReference: legalRef };
}

// ── Template builders ─────────────────────────────────────────────────────────

function buildCaseDiary(ctx: InvestigationContext): DraftSection[] {
  const fir    = ctx.fir;
  const officer = ctx.officer?.name ?? placeholder('Officer Name');
  const station = ctx.workspace?.police_station ?? placeholder('Police Station');
  return [
    section('cd-header', 'Header',
      `Case Diary — FIR No. ${fir?.fir_number ?? placeholder('FIR Number')}\n` +
      `Date: ${today()}\nInvestigating Officer: ${officer}\nPolice Station: ${station}`),
    section('cd-fir', 'FIR Details',
      `FIR Number: ${fir?.fir_number ?? placeholder('FIR Number')}\n` +
      `Section: ${fir?.section ?? placeholder('Section')}\n` +
      `Crime Type: ${fir?.crime_type ?? placeholder('Crime Type')}\n` +
      `Date of Occurrence: ${fir?.date_of_occurrence ?? placeholder('Date')}`),
    section('cd-steps', 'Investigation Steps Taken Today',
      placeholder('Describe investigation steps taken today'), true),
    section('cd-evidence', 'Evidence Collected / Seized',
      placeholder('List evidence collected or seized today'), true),
    section('cd-witness', 'Witnesses Examined',
      placeholder('List witnesses examined'), true),
    section('cd-next', 'Next Steps Planned',
      placeholder('Describe next planned steps'), true),
    section('cd-sig', 'Signature',
      `Investigating Officer: ${officer}\nDate: ${today()}`),
  ];
}

function buildNotice(ctx: InvestigationContext): DraftSection[] {
  const fir    = ctx.fir;
  const officer = ctx.officer?.name ?? placeholder('Officer Name');
  const station = ctx.workspace?.police_station ?? placeholder('Police Station');
  return [
    section('n-header', 'Notice Header',
      `NOTICE\nUnder Section ${placeholder('Applicable Section')}\n` +
      `Police Station: ${station}\nDate: ${today()}`),
    section('n-to', 'Addressed To',
      `To,\n${placeholder('Name of person')}\n${placeholder('Address')}`, true),
    section('n-subject', 'Subject',
      `Subject: FIR No. ${fir?.fir_number ?? placeholder('FIR Number')} — ` +
      `${fir?.crime_type ?? placeholder('Crime Type')}`),
    section('n-body', 'Body',
      `You are hereby directed to appear before the undersigned at Police Station ` +
      `${station} on ${placeholder('Date and Time')} in connection with the above matter.\n\n` +
      `Failure to comply will attract action under applicable provisions of BNSS.`, false, 'BNSS Section 179'),
    section('n-sig', 'Signature',
      `${officer}\nInvestigating Officer\n${station}`),
  ];
}

function buildArrestMemo(ctx: InvestigationContext): DraftSection[] {
  const fir    = ctx.fir;
  const officer = ctx.officer?.name ?? placeholder('Officer Name');
  const station = ctx.workspace?.police_station ?? placeholder('Police Station');
  return [
    section('am-header', 'Arrest Memo Header',
      `ARREST MEMO\nFIR No. ${fir?.fir_number ?? placeholder('FIR Number')}\nDate: ${today()}\nTime: ${placeholder('Time of Arrest')}`),
    section('am-accused', 'Accused Details',
      `Name: ${placeholder('Accused Name')}\nFather/Husband: ${placeholder("Father's Name")}\n` +
      `Age: ${placeholder('Age')}  Gender: ${placeholder('Gender')}\n` +
      `Address: ${placeholder('Full Address')}`, true),
    section('am-grounds', 'Grounds of Arrest',
      `Arrested in connection with FIR No. ${fir?.fir_number ?? placeholder('FIR Number')}, ` +
      `Section ${fir?.section ?? placeholder('Section')} — ` +
      `${fir?.crime_type ?? placeholder('Crime Type')}.\n` +
      `${placeholder('Additional grounds')}`, true, 'BNSS Section 35'),
    section('am-witnesses', 'Arrest Witnesses',
      `1. ${placeholder('Witness 1 Name, Address')}\n2. ${placeholder('Witness 2 Name, Address')}`, true),
    section('am-sig', 'Officer Signature',
      `Arresting Officer: ${officer}\nPolice Station: ${station}\nDate: ${today()}`),
  ];
}

function buildSeizureMemo(ctx: InvestigationContext): DraftSection[] {
  const fir    = ctx.fir;
  const officer = ctx.officer?.name ?? placeholder('Officer Name');
  const station = ctx.workspace?.police_station ?? placeholder('Police Station');
  return [
    section('sm-header', 'Seizure Memo Header',
      `SEIZURE MEMO\nFIR No. ${fir?.fir_number ?? placeholder('FIR Number')}\nDate: ${today()}\nPlace of Seizure: ${placeholder('Location')}`),
    section('sm-list', 'List of Seized Articles',
      `1. ${placeholder('Article 1 — Description, Quantity, Condition')}\n` +
      `2. ${placeholder('Article 2 — Description, Quantity, Condition')}`, true),
    section('sm-witnesses', 'Panchnama Witnesses',
      `1. ${placeholder('Witness 1')}\n2. ${placeholder('Witness 2')}`, true),
    section('sm-sig', 'Signature',
      `Seizing Officer: ${officer}\nPolice Station: ${station}\nDate: ${today()}`),
  ];
}

function buildSearchMemo(ctx: InvestigationContext): DraftSection[] {
  const fir    = ctx.fir;
  const officer = ctx.officer?.name ?? placeholder('Officer Name');
  const station = ctx.workspace?.police_station ?? placeholder('Police Station');
  return [
    section('sch-header', 'Search Memo Header',
      `SEARCH MEMO\nFIR No. ${fir?.fir_number ?? placeholder('FIR Number')}\nDate: ${today()}\nTime: ${placeholder('Search Time')}`),
    section('sch-premises', 'Premises Searched',
      `Address: ${placeholder('Full Address of Premises')}\nOwner/Occupant: ${placeholder('Name')}`, true),
    section('sch-result', 'Result of Search',
      placeholder('Describe what was found / not found'), true, 'BNSS Section 185'),
    section('sch-witnesses', 'Search Witnesses',
      `1. ${placeholder('Witness 1')}\n2. ${placeholder('Witness 2')}`, true),
    section('sch-sig', 'Signature',
      `Searching Officer: ${officer}\nPolice Station: ${station}\nDate: ${today()}`),
  ];
}

function buildChargeSheetSummary(ctx: InvestigationContext): DraftSection[] {
  const fir    = ctx.fir;
  const officer = ctx.officer?.name ?? placeholder('Officer Name');
  const station = ctx.workspace?.police_station ?? placeholder('Police Station');
  const health  = ctx.caseHealth;
  return [
    section('cs-header', 'Charge Sheet Summary Header',
      `CHARGE SHEET SUMMARY\nFIR No. ${fir?.fir_number ?? placeholder('FIR Number')}\n` +
      `Sections: ${fir?.section ?? placeholder('Sections')}\nPolice Station: ${station}\nDate: ${today()}`),
    section('cs-facts', 'Brief Facts',
      `Crime Type: ${fir?.crime_type ?? placeholder('Crime Type')}\n` +
      `Date of Occurrence: ${fir?.date_of_occurrence ?? placeholder('Date')}\n` +
      `Place: ${fir?.ghatnasthal ?? placeholder('Location')}\n` +
      `Complainant: ${fir?.complainant_name ?? placeholder('Name')}`),
    section('cs-accused', 'Accused Persons',
      placeholder('List all accused with name, address, role'), true),
    section('cs-evidence', 'Evidence Summary',
      health?.missingEvidence?.length
        ? `Note: Following evidence pending: ${health.missingEvidence.join(', ')}`
        : placeholder('List key evidence items'), !!(health?.missingEvidence?.length)),
    section('cs-witnesses', 'Key Witnesses',
      placeholder('List witnesses and summary of their statements'), true),
    section('cs-legal', 'Applicable Sections & Legal Basis',
      `Sections: ${fir?.section ?? placeholder('Sections')}\n` +
      placeholder('Briefly justify each section applied'), true),
    section('cs-conclusion', 'Conclusion',
      placeholder('State whether sufficient evidence exists for trial'), true, 'BNSS Section 193'),
    section('cs-sig', 'Investigating Officer',
      `${officer}\n${station}\nDate: ${today()}`),
  ];
}

function buildCourtReply(ctx: InvestigationContext): DraftSection[] {
  const fir    = ctx.fir;
  const officer = ctx.officer?.name ?? placeholder('Officer Name');
  const station = ctx.workspace?.police_station ?? placeholder('Police Station');
  const court   = ctx.courtDocs[0];
  return [
    section('cr-header', 'Court Reply Header',
      `COMPLIANCE REPORT / REPLY\nCourt: ${court?.court_name ?? placeholder('Court Name')}\n` +
      `Case No.: ${court?.vad_sankhya ?? placeholder('Case Number')}\n` +
      `FIR No.: ${fir?.fir_number ?? placeholder('FIR Number')}\nDate: ${today()}`),
    section('cr-compliance', 'Compliance Details',
      placeholder('Detail all steps taken in compliance with court orders'), true),
    section('cr-pending', 'Pending Actions',
      placeholder('List any actions still pending and reason'), true),
    section('cr-sig', 'Signature',
      `${officer}\nInvestigating Officer\n${station}`),
  ];
}

function buildPrarthnaPatraReply(ctx: InvestigationContext): DraftSection[] {
  const officer = ctx.officer?.name ?? placeholder('Officer Name');
  const station = ctx.workspace?.police_station ?? placeholder('Police Station');
  const pp      = ctx.prarthnaPatra[0];
  return [
    section('pp-header', 'Prarthna Patra Reply Header',
      `REPLY TO PETITION\nPetition No.: ${pp?.registration_number ?? placeholder('Petition Number')}\n` +
      `Date of Receipt: ${pp?.date_of_receipt ?? placeholder('Date')}\nDate: ${today()}`),
    section('pp-facts', 'Facts of the Matter',
      placeholder('Summarise the petition and investigation findings'), true),
    section('pp-action', 'Action Taken',
      placeholder('Describe action taken in response to petition'), true),
    section('pp-disposal', 'Disposal / Outcome',
      placeholder('State final disposal or status of petition'), true),
    section('pp-sig', 'Signature',
      `${officer}\n${station}\nDate: ${today()}`),
  ];
}

function buildInvestigationNotes(ctx: InvestigationContext): DraftSection[] {
  const fir    = ctx.fir;
  const officer = ctx.officer?.name ?? placeholder('Officer Name');
  const health  = ctx.caseHealth;
  return [
    section('in-overview', 'Investigation Overview',
      `FIR No.: ${fir?.fir_number ?? placeholder('FIR Number')}\n` +
      `Crime: ${fir?.crime_type ?? placeholder('Crime Type')}\n` +
      `Current Stage: ${health?.label ?? 'Under Investigation'}\n` +
      `Health Score: ${health?.score ?? '—'}/100 (${health?.grade ?? '—'})`),
    section('in-progress', 'Investigation Progress',
      `Completed: ${health?.completedItems ?? 0} items\n` +
      `Pending: ${health?.pendingItems ?? 0} items\n` +
      `Critical: ${health?.criticalItems ?? 0} items`),
    section('in-gaps', 'Identified Gaps',
      health?.missingEvidence?.length
        ? `Missing evidence: ${health.missingEvidence.join(', ')}`
        : 'No critical gaps identified.'),
    section('in-next', 'Next Steps',
      ctx.nextActions.slice(0, 5).map((a, i) =>
        `${i + 1}. [${a.priority.toUpperCase()}] ${a.title}`
      ).join('\n') || placeholder('Describe next planned actions'), true),
    section('in-sig', 'Officer Notes',
      `Recorded by: ${officer}\nDate: ${today()}`),
  ];
}

// ── Registry ──────────────────────────────────────────────────────────────────

const TEMPLATES: Record<
  L5DraftType,
  (ctx: InvestigationContext) => DraftSection[]
> = {
  'case-diary':          buildCaseDiary,
  'notice':              buildNotice,
  'arrest-memo':         buildArrestMemo,
  'seizure-memo':        buildSeizureMemo,
  'search-memo':         buildSearchMemo,
  'charge-sheet-summary': buildChargeSheetSummary,
  'court-reply':         buildCourtReply,
  'prarthna-patra-reply': buildPrarthnaPatraReply,
  'investigation-notes': buildInvestigationNotes,
};

const DRAFT_TITLES: Record<L5DraftType, string> = {
  'case-diary':          'Case Diary',
  'notice':              'Notice',
  'arrest-memo':         'Arrest Memo',
  'seizure-memo':        'Seizure Memo',
  'search-memo':         'Search Memo',
  'charge-sheet-summary': 'Charge Sheet Summary',
  'court-reply':         'Court Compliance Reply',
  'prarthna-patra-reply': 'Prarthna Patra Reply',
  'investigation-notes': 'Investigation Notes',
};

// ── Engine ────────────────────────────────────────────────────────────────────

export class DraftGenerationEngine {
  static generate(
    ctx: InvestigationContext,
    type: L5DraftType
  ): DraftGenerationReport {
    try {
      const builder = TEMPLATES[type];
      if (!builder) {
        return {
          draft: null,
          success: false,
          errorMessage: `Draft type "${type}" is not supported.`,
          missingDataCount: 0,
          advisory:
            'AI-generated drafts are advisory only. Officer must review, edit, and explicitly approve before saving.',
        };
      }

      const sections   = builder(ctx);
      const missing    = sections.filter((s) => s.isPlaceholder);
      const fullText   = sections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
      const legalRefs  = sections.flatMap((s) => s.legalReference ? [s.legalReference] : []);
      const firId      = ctx.fir?.id;
      const firNumber  = ctx.fir?.fir_number;

      const confidence = Math.max(
        30,
        100 - (missing.length * 10) - (ctx.fir ? 0 : 20)
      );

      const draft: GeneratedDraft = {
        id:                   `draft-${type}-${uid()}`,
        type,
        title:                DRAFT_TITLES[type],
        firId,
        firNumber,
        generatedAt:          new Date().toISOString(),
        sections,
        fullText,
        missingDataFields:    missing.map((s) => s.title),
        legalReferences:      [...new Set(legalRefs)],
        requiresOfficerReview: true,
        isApproved:           false,
        confidencePct:        confidence,
        advisory:
          'This draft was generated using available investigation data. ' +
          'It must be reviewed, edited, and explicitly approved by the Investigating Officer before saving. ' +
          'AI never saves drafts automatically.',
      };

      return {
        draft,
        success:          true,
        missingDataCount: missing.length,
        advisory:         draft.advisory,
      };
    } catch (err) {
      return {
        draft: null,
        success: false,
        errorMessage: String(err),
        missingDataCount: 0,
        advisory: 'Draft generation failed. Please try again or draft manually.',
      };
    }
  }
}

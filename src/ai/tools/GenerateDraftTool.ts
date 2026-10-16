/**
 * GenerateDraftTool.ts — Generates draft documents from case context.
 * Content is HTML compatible with DocumentEditor.
 * NEVER auto-saves. Always opens in editor for user review.
 */
import { getFIRById } from '@/lib/db/firRepo';
import { getKaryvahiByFIR } from '@/lib/db/firKaryvahiRepo';
import { getCaseDiariesByFIR } from '@/lib/db/caseDiaryRepo';
import { getWorkspaceSettings } from '@/lib/db/workspaceRepo';
import { generateUUID } from '@/lib/db/database';
import type { AITool, AIDraft, DraftType } from '../AITypes';

export interface GenerateDraftInput {
  type: DraftType;
  firId?: string;
  customContext?: string;
}

export const GenerateDraftTool: AITool<GenerateDraftInput, AIDraft> = {
  name: 'GenerateDraftTool',
  description: 'Generates a draft document (Case Diary, GD, Timeline, etc.) based on case context. Never auto-saves.',
  async execute({ type, firId, customContext }) {
    const ws = await getWorkspaceSettings();
    const today = new Date().toLocaleDateString('en-IN');
    let fir = null;
    let karyvahi: unknown[] = [];
    let diaries: unknown[] = [];

    if (firId) {
      try {
        fir = await getFIRById(firId);
        karyvahi = await getKaryvahiByFIR(firId, 'AI-Draft');
        diaries = await getCaseDiariesByFIR(firId);
      } catch {
        // non-fatal
      }
    }

    const content = buildDraftContent(type, {
      ws,
      fir,
      karyvahi,
      diaries,
      today,
      customContext,
    });

    return {
      id: generateUUID(),
      type,
      title: getDraftTitle(type, fir?.fir_number),
      content,
      createdAt: Date.now(),
      firId: firId ?? undefined,
      firNumber: fir?.fir_number ?? undefined,
    };
  },
};

// ── Draft content builders ──────────────────────────────────────────────────

function getDraftTitle(type: DraftType, firNumber?: string): string {
  const suffix = firNumber ? ` — FIR ${firNumber}` : '';
  const titles: Record<DraftType, string> = {
    'case-diary': `Case Diary${suffix}`,
    'gd': `General Diary${suffix}`,
    'prarthna-patra': `Prarthna Patra${suffix}`,
    'court-report': `Court Report${suffix}`,
    'bnss-proceedings': `BNSS Proceedings${suffix}`,
    'investigation-notes': `Investigation Notes${suffix}`,
    'charge-sheet-summary': `Charge Sheet Summary${suffix}`,
    'timeline': `Investigation Timeline${suffix}`,
    'evidence-summary': `Evidence Summary${suffix}`,
    'witness-summary': `Witness Summary${suffix}`,
    'pending-work-summary': `Pending Work Summary${suffix}`,
    'notice': `Notice${suffix}`,
  };
  return titles[type] ?? `Draft${suffix}`;
}

interface DraftContext {
  ws: { police_station: string; district: string; officer_name: string };
  fir: { fir_number: string; section: string; crime_type: string; complainant_name: string; date_of_occurrence?: string } | null;
  karyvahi: unknown[];
  diaries: unknown[];
  today: string;
  customContext?: string;
}

function buildDraftContent(type: DraftType, ctx: DraftContext): string {
  const header = `
    <p><strong>Police Station:</strong> ${ctx.ws.police_station || '[Police Station]'}</p>
    <p><strong>District:</strong> ${ctx.ws.district || '[District]'}</p>
    <p><strong>Officer:</strong> ${ctx.ws.officer_name || '[Officer Name]'}</p>
    <p><strong>Date:</strong> ${ctx.today}</p>
    <hr/>
  `;

  const firInfo = ctx.fir
    ? `<p><strong>FIR No:</strong> ${ctx.fir.fir_number} | <strong>Section:</strong> ${ctx.fir.section} | <strong>Crime:</strong> ${ctx.fir.crime_type}</p>
       <p><strong>Complainant:</strong> ${ctx.fir.complainant_name}</p>`
    : `<p><em>[FIR details not available — please fill in manually]</em></p>`;

  switch (type) {
    case 'case-diary':
      return `<h2>Case Diary</h2>${header}${firInfo}
        <h3>Today's Investigation Activities</h3>
        <p>${ctx.customContext ?? '[Describe investigation activities carried out today]'}</p>
        <h3>Places Visited</h3>
        <p>[List places visited during investigation]</p>
        <h3>Witnesses Examined</h3>
        <p>[List witnesses examined with statements summary]</p>
        <h3>Evidence Collected</h3>
        <p>[Describe evidence collected]</p>
        <h3>Next Steps</h3>
        <p>[Describe next investigation steps]</p>`;

    case 'gd':
      return `<h2>General Diary (GD)</h2>${header}
        <p><strong>GD Type:</strong> [रवानगी / वापसी / तस्करा / अन्य]</p>
        <p>${ctx.customContext ?? '[Enter GD content here]'}</p>`;

    case 'timeline':
      return `<h2>Investigation Timeline</h2>${header}${firInfo}
        <h3>Chronological Events</h3>
        ${buildKaryvahiList(ctx.karyvahi)}
        <p>${ctx.customContext ?? ''}</p>`;

    case 'evidence-summary':
      return `<h2>Evidence Summary</h2>${header}${firInfo}
        <h3>Investigation Actions (${ctx.karyvahi.length})</h3>
        ${buildKaryvahiList(ctx.karyvahi)}
        <h3>Additional Notes</h3>
        <p>${ctx.customContext ?? '[Add evidence analysis here]'}</p>`;

    case 'pending-work-summary':
      return `<h2>Pending Work Summary</h2>${header}${firInfo}
        <h3>Incomplete Investigation Actions</h3>
        ${buildPendingKaryvahiList(ctx.karyvahi)}
        <p>${ctx.customContext ?? ''}</p>`;

    case 'court-report':
      return `<h2>Court Report</h2>${header}${firInfo}
        <p><strong>Court:</strong> [Court Name]</p>
        <p><strong>Case Number:</strong> [Case Number]</p>
        <p>${ctx.customContext ?? '[Enter court report content]'}</p>`;

    case 'notice':
      return `<h2>Notice</h2>${header}
        <p><strong>To:</strong> [Recipient Name and Address]</p>
        <p><strong>Subject:</strong> [Subject of Notice]</p>
        <p>${ctx.customContext ?? '[Enter notice content here]'}</p>
        <p>You are hereby directed to appear at the police station on [Date] at [Time].</p>
        <p><strong>Issued by:</strong> ${ctx.ws.officer_name || '[Officer Name]'}</p>`;

    default:
      return `<h2>${getDraftTitle(type)}</h2>${header}${firInfo}
        <p>${ctx.customContext ?? '[Draft content will be filled based on case context]'}</p>`;
  }
}

function buildKaryvahiList(karyvahi: unknown[]): string {
  if (!karyvahi.length) return '<p><em>No investigation actions recorded.</em></p>';
  const items = (karyvahi as Array<{ name: string; is_completed: number; precautions?: string }>)
    .map((k) => `<li><strong>${k.name}</strong>${k.precautions ? ` — ${k.precautions}` : ''} [${k.is_completed ? '✓' : 'Pending'}]</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function buildPendingKaryvahiList(karyvahi: unknown[]): string {
  const pending = (karyvahi as Array<{ name: string; is_completed: number; precautions?: string }>)
    .filter((k) => !k.is_completed);
  if (!pending.length) return '<p><em>No pending investigation actions.</em></p>';
  const items = pending
    .map((k) => `<li>${k.name}${k.precautions ? ` — ${k.precautions}` : ''}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

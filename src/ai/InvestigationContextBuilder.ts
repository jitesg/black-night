/**
 * InvestigationContextBuilder.ts
 * Builds a complete InvestigationContext by reading all modules through the
 * existing Repository layer. Never accesses SQLite directly.
 *
 * Called once per AI interaction — result is passed to every tool and engine.
 */

import { getWorkspaceSettings } from '@/lib/db/workspaceRepo';
import { getFIRById } from '@/lib/db/firRepo';
import { getKaryvahiByFIR } from '@/lib/db/firKaryvahiRepo';
import { getCaseDiariesByFIR } from '@/lib/db/caseDiaryRepo';
import { getAllNyayalayDocuments } from '@/lib/db/nyayalayRepo';
import { getAllGdEntries } from '@/lib/db/gdRepo';
import { getAllPrarthnaPatra } from '@/lib/db/prarthnaPatraRepo';
import { getAllNirodhatmakKaryvahi } from '@/lib/db/nirodhatmakRepo';
import { searchKnowledgeAll, type KnowledgeEntry } from '@/lib/db/knowledgeRepo';
import { loadDashboardData } from '@/lib/db/dashboardRepo';
import { generateUUID } from '@/lib/db/database';
import { getPlaybookStepsForPairs, parseCrimeTypePairs, type ChecklistItem } from '@/lib/db/checklistRepo';
import type {
  InvestigationContext,
  OfficerProfile,
  ContextConfidence,
  ContextFieldStatus,
  KaryvahiSummary,
  TimelineEvent,
  CaseHealth,
  CaseHealthGrade,
  NextAction,
  NextActionPriority,
} from './InvestigationContext';
import type { FIRKaryvahi } from '@/lib/db/firKaryvahiRepo';
import type { NyayalayDocument } from '@/lib/db/nyayalayRepo';

// ── Helper: safe repo call ────────────────────────────────────────────────────

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<{ value: T; ok: boolean }> {
  try {
    const value = await fn();
    return { value, ok: true };
  } catch {
    return { value: fallback, ok: false };
  }
}

function fieldStatus(ok: boolean, count: number | boolean): ContextFieldStatus {
  if (!ok) return 'unavailable';
  return count ? 'available' : 'empty';
}

// ── Main builder ──────────────────────────────────────────────────────────────

// ── In-memory deduplication for missing data notes ───────────────────────────
let _activeFirForNotes: string | undefined;
const _shownNotesForFir = new Set<string>();

export function resetMissingNoteMemory(firId?: string): void {
  if (firId !== _activeFirForNotes) {
    _activeFirForNotes = firId;
    _shownNotesForFir.clear();
  }
}

export class InvestigationContextBuilder {
  /**
   * Build a complete InvestigationContext for a given optional FIR.
   * All fields are non-null — missing data is represented as empty arrays
   * and surfaced in `confidence.missingFields`.
   */
  static async build(activeFirId?: string): Promise<InvestigationContext> {
    const sessionId = generateUUID();
    const builtAt = Date.now();

    // ── Load all data in parallel ───────────────────────────────────────────
    const [
      wsResult,
      firResult,
      karyvahiResult,
      diariesResult,
      courtResult,
      gdResult,
      ppResult,
      nirodhatmakResult,
      analyticsResult,
    ] = await Promise.all([
      safe(() => getWorkspaceSettings(),         { police_station: '', district: '', state: '', halka: '', beat: '', officer_name: '' }),
      activeFirId ? safe(() => getFIRById(activeFirId), null) : Promise.resolve({ value: null, ok: true }),
      activeFirId ? safe(() => getKaryvahiByFIR(activeFirId, 'AI-Context'), [] as FIRKaryvahi[]) : Promise.resolve({ value: [] as FIRKaryvahi[], ok: true }),
      activeFirId ? safe(() => getCaseDiariesByFIR(activeFirId), []) : Promise.resolve({ value: [], ok: true }),
      safe(() => getAllNyayalayDocuments(), [] as NyayalayDocument[]),
      safe(() => getAllGdEntries(), []),
      safe(() => getAllPrarthnaPatra(), []),
      safe(() => getAllNirodhatmakKaryvahi(), []),
      safe(() => loadDashboardData(), undefined as any),  // eslint-disable-line @typescript-eslint/no-explicit-any
    ]);

    const ws = wsResult.value;
    const fir = firResult.value ?? undefined;
    const allKaryvahi = karyvahiResult.value;
    const caseDiaries = diariesResult.value;
    const allCourtDocs = courtResult.value;
    const allGD = gdResult.value;
    const allPP = ppResult.value;
    const allNirodhatmak = nirodhatmakResult.value;
    const analytics = analyticsResult.value;

    // Filter court docs by FIR number
    const courtDocs = fir
      ? allCourtDocs.filter((d) => d.fir_number === fir.fir_number)
      : allCourtDocs.slice(0, 10);

    // Knowledge & Playbook: search by crime type if FIR available, else return empty
    const [knowledgeResult, playbookResult] = await Promise.all([
      fir?.crime_type
        ? safe(() => searchKnowledgeAll(fir.crime_type), [])
        : Promise.resolve({ value: [] as KnowledgeEntry[], ok: true }),
      fir?.crime_type
        ? safe(() => getPlaybookStepsForPairs(parseCrimeTypePairs(fir.crime_type ?? '')), [] as ChecklistItem[])
        : Promise.resolve({ value: [] as ChecklistItem[], ok: true }),
    ]);
    const relevantKnowledge = knowledgeResult.value.slice(0, 10);
    const playbookSteps = playbookResult.value;

    // ── Karyvahi summary ────────────────────────────────────────────────────
    const completed = allKaryvahi.filter((k) => k.is_completed === 1);
    const pending = allKaryvahi.filter((k) => k.is_completed !== 1);
    const karyvahi: KaryvahiSummary = {
      all: allKaryvahi,
      completed,
      pending,
      completionPct: allKaryvahi.length
        ? Math.round((completed.length / allKaryvahi.length) * 100)
        : 0,
    };

    // ── Confidence ──────────────────────────────────────────────────────────
    const fields: Record<keyof Omit<ContextConfidence, 'overallScore' | 'missingFields'>, ContextFieldStatus> = {
      fir:           fieldStatus(firResult.ok, !!fir),
      karyvahi:      fieldStatus(karyvahiResult.ok, allKaryvahi.length > 0),
      caseDiary:     fieldStatus(diariesResult.ok, caseDiaries.length > 0),
      courtWork:     fieldStatus(courtResult.ok, courtDocs.length > 0),
      gd:            fieldStatus(gdResult.ok, allGD.length > 0),
      prarthnaPatra: fieldStatus(ppResult.ok, allPP.length > 0),
      nirodhatmak:   fieldStatus(nirodhatmakResult.ok, allNirodhatmak.length > 0),
      knowledge:     fieldStatus(knowledgeResult.ok, relevantKnowledge.length > 0),
      analytics:     fieldStatus(analyticsResult.ok, !!analytics),
      workspace:     fieldStatus(wsResult.ok, !!ws.police_station),
    };

    const available = Object.values(fields).filter((s) => s === 'available').length;
    const overallScore = Math.round((available / Object.keys(fields).length) * 100);

    const FIELD_LABELS: Record<string, string> = {
      fir: 'FIR Details', karyvahi: 'Investigation Actions', caseDiary: 'Case Diary',
      courtWork: 'Court Work', gd: 'General Diary', prarthnaPatra: 'Prarthna Patra',
      nirodhatmak: 'Nirodhatmak Karyvahi', knowledge: 'Legal Knowledge', analytics: 'Analytics',
      workspace: 'Workspace / Officer Profile',
    };
    const missingFields = Object.entries(fields)
      .filter(([, s]) => s !== 'available')
      .map(([k, s]) => `${FIELD_LABELS[k] ?? k} (${s})`);

    const confidence: ContextConfidence = { ...fields, overallScore, missingFields };

    // ── Timeline ────────────────────────────────────────────────────────────
    const timeline = buildTimeline(fir, allKaryvahi, caseDiaries, courtDocs);

    // ── Case Health ─────────────────────────────────────────────────────────
    const caseHealth = computeCaseHealth(karyvahi, courtDocs, fir, analytics?.overdue ?? []);

    // ── Next Actions ────────────────────────────────────────────────────────
    const nextActions = buildNextActions(
      karyvahi,
      courtDocs,
      analytics?.overdue ?? [],
      analytics?.reminders ?? [],
      fir
    );

    // ── Officer profile ─────────────────────────────────────────────────────
    const officer: OfficerProfile = {
      name: ws.officer_name || 'Unknown Officer',
      designation: ws.beat || 'Officer',
      policeStation: ws.police_station || 'Unknown PS',
      district: ws.district || '',
      state: ws.state || '',
      halka: ws.halka || '',
      beat: ws.beat || '',
    };

    return {
      sessionId,
      builtAt,
      activeFirId,
      workspace: ws,
      officer,
      fir,
      karyvahi,
      caseDiaries,
      courtDocs,
      gdEntries: allGD,
      prarthnaPatra: allPP,
      nirodhatmak: allNirodhatmak,
      relevantKnowledge,
      playbookSteps,
      analytics,
      overdueItems: analytics?.overdue ?? [],
      reminders: analytics?.reminders ?? [],
      timeline,
      caseHealth,
      nextActions,
      confidence,
    };
  }

  /** Format a concise system prompt header from an InvestigationContext. */
  static formatHeader(ctx: InvestigationContext): string {
    const parts: string[] = [
      `PS: ${ctx.officer.policeStation}`,
      `Officer: ${ctx.officer.name}`,
    ];
    if (ctx.fir) {
      parts.push(`FIR: ${ctx.fir.fir_number}`);
      parts.push(`Crime: ${ctx.fir.crime_type}`);
      parts.push(`Sections: ${ctx.fir.section}`);
      parts.push(`Status: ${ctx.fir.status}`);
    }
    parts.push(`Context: ${ctx.confidence.overallScore}% complete`);
    return parts.join(' | ');
  }

  /**
   * Deterministic, localized missing-data note for AI Copilot responses.
   *
   * Rules:
   * 1. Returns '' when:
   *    - There is no active FIR (General Mode);
   *    - OR intent is 'law-lookup', 'search-law', 'search', 'general', 'analytics';
   *    - OR answer comes from Law Library / Knowledge;
   *    - OR missingFields is empty.
   * 2. Maps intent -> strictly RELEVANT fields only, and shows only truly empty fields
   *    (underlying data has 0 records; failed/unavailable repos are omitted, never 'Legal Knowledge').
   * 3. Plain text, NO markdown/underscores, max 3 labels, never '(empty)'.
   * 4. Deduplicated per FIR per field set (shows at most once per conversation).
   */
  static getMissingDataNote(
    ctx: InvestigationContext,
    intent?: string,
    lang?: string
  ): string {
    // Rule 1: General Mode (no active FIR) or exempt intents -> no note
    if (!ctx.fir || !ctx.activeFirId) return '';
    if (!intent) return '';

    const exemptIntents = new Set([
      'law-lookup',
      'search-law',
      'search',
      'general',
      'analytics',
    ]);
    if (exemptIntents.has(intent)) return '';

    // If context confidence reports no missing fields at all -> no note
    if (!ctx.confidence?.missingFields || ctx.confidence.missingFields.length === 0) return '';

    // Intent -> relevant field keys
    // Only map: fir, karyvahi, caseDiary, prarthnaPatra
    type RelevantKey = 'fir' | 'karyvahi' | 'caseDiary' | 'prarthnaPatra';
    let relevantKeys: RelevantKey[] = [];

    switch (intent) {
      case 'investigation-summary':
      case 'case-readiness':
      case 'health-score':
        relevantKeys = ['fir', 'karyvahi', 'caseDiary'];
        break;
      case 'draft-case-diary':
      case 'next-step':
      case 'pending-tasks':
      case 'timeline':
      case 'checklist':
        relevantKeys = ['fir', 'caseDiary', 'karyvahi'];
        break;
      case 'draft-notice':
      case 'draft-court-report':
      case 'draft-gd':
        relevantKeys = ['fir', 'prarthnaPatra'];
        break;
      case 'evidence-summary':
      case 'witness-summary':
        relevantKeys = ['fir', 'karyvahi'];
        break;
      default:
        return '';
    }

    // Filter to keys where underlying data TRULY has 0 records for the ACTIVE FIR
    // (status === 'empty' only, do NOT report 'unavailable' or network/repo failures)
    const trulyEmptyKeys = relevantKeys.filter((k) => {
      if (k === 'fir') {
        return !ctx.fir;
      }
      if (k === 'karyvahi') {
        return ctx.confidence.karyvahi === 'empty' || ctx.karyvahi.all.length === 0;
      }
      if (k === 'caseDiary') {
        return ctx.confidence.caseDiary === 'empty' || ctx.caseDiaries.length === 0;
      }
      if (k === 'prarthnaPatra') {
        return ctx.confidence.prarthnaPatra === 'empty' || ctx.prarthnaPatra.length === 0;
      }
      return false;
    });

    if (trulyEmptyKeys.length === 0) return '';

    // Max 3 labels
    const selectedKeys = trulyEmptyKeys.slice(0, 3);

    // Track in-memory deduplication per FIR per field set
    const firId = ctx.activeFirId || ctx.fir.id;
    if (_activeFirForNotes !== firId) {
      _activeFirForNotes = firId;
      _shownNotesForFir.clear();
    }
    const labelSetKey = selectedKeys.join(',');
    if (_shownNotesForFir.has(labelSetKey)) {
      return '';
    }
    _shownNotesForFir.add(labelSetKey);

    const isHindi = (lang || 'hi').toLowerCase().startsWith('hi');

    // Label dictionaries (NEVER include '(empty)')
    const HI_LABELS: Record<RelevantKey, string> = {
      fir: 'FIR विवरण',
      karyvahi: 'कार्यवाही',
      caseDiary: 'केस डायरी',
      prarthnaPatra: 'प्रार्थना पत्र',
    };
    const EN_LABELS: Record<RelevantKey, string> = {
      fir: 'FIR Details',
      karyvahi: 'Investigation Actions',
      caseDiary: 'Case Diary',
      prarthnaPatra: 'Prarthna Patra',
    };

    const labels = selectedKeys.map((k) => (isHindi ? HI_LABELS[k] : EN_LABELS[k]));

    if (isHindi) {
      return `\n\nध्यान दें: इस उत्तर के लिए ये जानकारी उपलब्ध नहीं है — ${labels.join(', ')}।`;
    }
    return `\n\nNote: this answer could not use — ${labels.join(', ')}.`;
  }
}

// ── Timeline builder ──────────────────────────────────────────────────────────

function buildTimeline(
  fir: import('@/lib/db/firRepo').FIR | undefined,
  karyvahi: FIRKaryvahi[],
  diaries: import('@/lib/db/caseDiaryRepo').CaseDiary[],
  courtDocs: NyayalayDocument[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (fir) {
    events.push({
      date: fir.date_of_information ?? new Date(fir.created_at * 1000).toISOString().split('T')[0],
      time: fir.time_of_information,
      type: 'FIR',
      title: `FIR Registered — ${fir.fir_number}`,
      description: `Crime: ${fir.crime_type} | Sections: ${fir.section}`,
      isCompleted: true,
      isCritical: false,
    });
  }

  karyvahi.forEach((k) => {
    events.push({
      date: new Date(k.created_at * 1000).toISOString().split('T')[0],
      type: 'Karyvahi',
      title: k.name,
      description: k.precautions,
      isCompleted: k.is_completed === 1,
      isCritical: false,
    });
  });

  diaries.forEach((d) => {
    events.push({
      date: d.preparation_date,
      type: 'CaseDiary',
      title: `Case Diary — ${d.preparation_date}`,
      isCompleted: true,
      isCritical: false,
    });
  });

  const today = new Date().toISOString().split('T')[0];
  courtDocs.forEach((c) => {
    const overdue = c.deadline_date < today && c.status === 'Pending';
    events.push({
      date: c.deadline_date,
      type: 'Court',
      title: `${c.doc_type} — ${c.registration_number}`,
      description: c.court_name,
      isCompleted: c.status === 'Finished',
      isCritical: overdue,
    });
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Case health ───────────────────────────────────────────────────────────────

function computeCaseHealth(
  karyvahi: KaryvahiSummary,
  courtDocs: NyayalayDocument[],
  fir: import('@/lib/db/firRepo').FIR | undefined,
  overdueItems: import('@/lib/db/dashboardRepo').OverdueItem[]
): CaseHealth {
  const total = karyvahi.all.length;
  const completedCount = karyvahi.completed.length;
  const pendingCount = karyvahi.pending.length;

  const today = new Date().toISOString().split('T')[0];
  const overdueCourtDocs = courtDocs.filter((c) => c.status === 'Pending' && c.deadline_date < today);
  const criticalCount = overdueCourtDocs.length + overdueItems.filter((o) => o.module === 'Nyayalay').length;

  // Score: 50% karyvahi completion + 30% no overdue court + 20% FIR registered
  let score = 0;
  if (total > 0) score += Math.round((completedCount / total) * 50);
  if (overdueCourtDocs.length === 0) score += 30;
  if (fir) score += 20;

  const grade: CaseHealthGrade =
    score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : score >= 35 ? 'D' : 'F';
  const label =
    grade === 'A' ? 'Excellent Progress' :
    grade === 'B' ? 'Good Progress' :
    grade === 'C' ? 'Needs Attention' :
    grade === 'D' ? 'Critical Issues Present' :
    'Investigation Stalled';

  const pendingStatements = karyvahi.pending
    .filter((k) => /bayan|statement|gavah|witness|बयान|गवाह|वादी/i.test(k.name))
    .map((k) => k.name);

  const missingEvidence = karyvahi.pending
    .filter((k) => /evidence|panchnama|seizure|seizure|report|fsl|medical/i.test(k.name))
    .map((k) => k.name);

  const courtActionsRequired = overdueCourtDocs.map((c) => `${c.doc_type} — ${c.registration_number} (OVERDUE)`);

  return {
    score,
    grade,
    label,
    completedItems: completedCount,
    pendingItems: pendingCount,
    criticalItems: criticalCount,
    missingEvidence,
    pendingStatements,
    courtActionsRequired,
    readinessForChargeSheet:
      score >= 70 && pendingStatements.length === 0 && missingEvidence.length === 0,
  };
}

// ── Next action builder ───────────────────────────────────────────────────────

function buildNextActions(
  karyvahi: KaryvahiSummary,
  courtDocs: NyayalayDocument[],
  overdueItems: import('@/lib/db/dashboardRepo').OverdueItem[],
  reminders: import('@/lib/db/dashboardRepo').ReminderItem[],
  fir: import('@/lib/db/firRepo').FIR | undefined
): NextAction[] {
  const actions: NextAction[] = [];
  const today = new Date().toISOString().split('T')[0];
  let seq = 0;

  // Overdue court docs — critical
  courtDocs
    .filter((c) => c.status === 'Pending' && c.deadline_date < today)
    .forEach((c) => {
      actions.push({
        id: `court-${seq++}`,
        category: 'court',
        priority: 'critical',
        title: `Overdue Court Action: ${c.doc_type}`,
        description: `${c.registration_number} at ${c.court_name} — deadline was ${c.deadline_date}`,
        deadline: c.deadline_date,
        daysRemaining: daysDiff(c.deadline_date),
      });
    });

  // Overdue items from dashboard
  overdueItems.slice(0, 5).forEach((item) => {
    actions.push({
      id: `overdue-${seq++}`,
      category: 'deadline',
      priority: 'critical',
      title: `Overdue: ${item.title}`,
      description: `${item.module} — ${item.daysOverdue} day(s) overdue`,
      daysRemaining: -item.daysOverdue,
    });
  });

  // Pending statements
  karyvahi.pending
    .filter((k) => /bayan|statement|gavah|witness|बयान|गवाह|वादी/i.test(k.name))
    .slice(0, 3)
    .forEach((k) => {
      actions.push({
        id: `stmt-${seq++}`,
        category: 'witness',
        priority: 'high',
        title: `Pending Statement: ${k.name}`,
        description: k.precautions ?? 'Record statement as per investigation procedure',
      });
    });

  // Pending evidence / FSL
  karyvahi.pending
    .filter((k) => /evidence|panchnama|seizure|fsl|medical|report/i.test(k.name))
    .slice(0, 3)
    .forEach((k) => {
      actions.push({
        id: `ev-${seq++}`,
        category: 'evidence',
        priority: 'high',
        title: `Missing: ${k.name}`,
        description: k.precautions ?? 'Complete evidence collection step',
      });
    });

  // Remaining pending karyvahi
  karyvahi.pending
    .filter((k) => !/bayan|statement|gavah|witness|evidence|panchnama|seizure|fsl|medical|report|बयान|गवाह|वादी|साक्ष्य|पंचनामा/i.test(k.name))
    .slice(0, 4)
    .forEach((k) => {
      actions.push({
        id: `kary-${seq++}`,
        category: 'investigation',
        priority: 'medium',
        title: k.name,
        description: k.precautions ?? 'Complete investigation action',
      });
    });

  // Upcoming reminders
  reminders.slice(0, 3).forEach((r) => {
    const priority: NextActionPriority = r.daysLeft <= 1 ? 'high' : r.daysLeft <= 3 ? 'medium' : 'low';
    actions.push({
      id: `rem-${seq++}`,
      category: 'deadline',
      priority,
      title: r.title,
      description: `${r.module} — due in ${r.daysLeft} day(s)`,
      daysRemaining: r.daysLeft,
    });
  });

  // If no FIR is open, suggest opening one
  if (!fir) {
    actions.push({
      id: 'open-fir',
      category: 'investigation',
      priority: 'medium',
      title: 'Open a FIR for full context',
      description: 'Navigate to Mukadma and select a FIR to get case-specific insights.',
    });
  }

  // Sort: critical → high → medium → low
  const ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return actions.sort((a, b) => (ORDER[a.priority] ?? 3) - (ORDER[b.priority] ?? 3));
}

function daysDiff(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

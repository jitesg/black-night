/**
 * InvestigationContext.ts
 * Complete investigation context object — the single source of truth for all
 * AI reasoning about a case.
 *
 * Built once per AI interaction by InvestigationContextBuilder.
 * Passed to every tool and engine instead of each component fetching
 * data independently.
 *
 * SAFETY: read-only view of data. Nothing in this file writes to any repo.
 */

import type { FIR } from '@/lib/db/firRepo';
import type { FIRKaryvahi } from '@/lib/db/firKaryvahiRepo';
import type { CaseDiary } from '@/lib/db/caseDiaryRepo';
import type { NyayalayDocument } from '@/lib/db/nyayalayRepo';
import type { GdEntry } from '@/lib/db/gdRepo';
import type { PrarthnaPatra } from '@/lib/db/prarthnaPatraRepo';
import type { NirodhatmakKaryvahi } from '@/lib/db/nirodhatmakRepo';
import type { KnowledgeEntry } from '@/lib/db/knowledgeRepo';
import type { WorkspaceSettings } from '@/lib/db/workspaceRepo';
import type { DashboardData, OverdueItem, ReminderItem } from '@/lib/db/dashboardRepo';
import type { ChecklistItem } from '@/lib/db/checklistRepo';

// ── Officer / Station Profile ─────────────────────────────────────────────────

export interface OfficerProfile {
  name: string;
  designation: string;   // from WorkspaceSettings (rank/beat)
  policeStation: string;
  district: string;
  state: string;
  halka: string;
  beat: string;
}

// ── Context Confidence ────────────────────────────────────────────────────────

/**
 * ContextField represents the availability of one data section.
 * 'available'  — data loaded successfully with ≥1 records / non-empty value
 * 'empty'      — loaded successfully but 0 records / blank
 * 'unavailable'— load failed or not attempted (offline / missing FIR)
 */
export type ContextFieldStatus = 'available' | 'empty' | 'unavailable';

export interface ContextConfidence {
  fir:             ContextFieldStatus;
  karyvahi:        ContextFieldStatus;
  caseDiary:       ContextFieldStatus;
  courtWork:       ContextFieldStatus;
  gd:              ContextFieldStatus;
  prarthnaPatra:   ContextFieldStatus;
  nirodhatmak:     ContextFieldStatus;
  knowledge:       ContextFieldStatus;
  analytics:       ContextFieldStatus;
  workspace:       ContextFieldStatus;
  /** 0–100: fraction of fields that are 'available' */
  overallScore: number;
  /** Human-readable list of missing fields the AI should acknowledge */
  missingFields: string[];
}

// ── Karyvahi summary ──────────────────────────────────────────────────────────

export interface KaryvahiSummary {
  all: FIRKaryvahi[];
  completed: FIRKaryvahi[];
  pending: FIRKaryvahi[];
  completionPct: number;   // 0–100
}

// ── Timeline Event ────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'FIR'
  | 'Karyvahi'
  | 'CaseDiary'
  | 'Court'
  | 'GD'
  | 'Prarthna'
  | 'Nirodhatmak';

export interface TimelineEvent {
  date: string;           // YYYY-MM-DD
  time?: string;          // HH:MM
  type: TimelineEventType;
  title: string;
  description?: string;
  isCompleted: boolean;
  isCritical: boolean;    // e.g. court deadline overdue
}

// ── Case Health ───────────────────────────────────────────────────────────────

export type CaseHealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface CaseHealth {
  score: number;           // 0–100
  grade: CaseHealthGrade;
  label: string;           // e.g. "Good Progress", "Needs Attention"
  completedItems: number;
  pendingItems: number;
  criticalItems: number;
  missingEvidence: string[];
  pendingStatements: string[];
  courtActionsRequired: string[];
  readinessForChargeSheet: boolean;
}

// ── Next Action ───────────────────────────────────────────────────────────────

export type NextActionPriority = 'critical' | 'high' | 'medium' | 'low';
export type NextActionCategory =
  | 'investigation'
  | 'evidence'
  | 'witness'
  | 'court'
  | 'documentation'
  | 'deadline';

export interface NextAction {
  id: string;
  category: NextActionCategory;
  priority: NextActionPriority;
  title: string;
  description: string;
  deadline?: string;        // YYYY-MM-DD
  daysRemaining?: number;   // negative = overdue
}

// ── The complete InvestigationContext ─────────────────────────────────────────

export interface InvestigationContext {
  // ── Identity
  sessionId: string;
  builtAt: number;           // epoch ms
  activeFirId?: string;

  // ── Officer / Station
  workspace: WorkspaceSettings;
  officer: OfficerProfile;

  // ── Case Data
  fir?: FIR;
  karyvahi: KaryvahiSummary;
  caseDiaries: CaseDiary[];
  courtDocs: NyayalayDocument[];
  gdEntries: GdEntry[];
  prarthnaPatra: PrarthnaPatra[];
  nirodhatmak: NirodhatmakKaryvahi[];

  // ── Knowledge
  relevantKnowledge: KnowledgeEntry[];

  // ── Playbook
  playbookSteps: ChecklistItem[];

  // ── Analytics
  analytics?: DashboardData;
  overdueItems: OverdueItem[];
  reminders: ReminderItem[];

  // ── Derived Intelligence (computed by InvestigationContextBuilder)
  timeline: TimelineEvent[];
  caseHealth: CaseHealth;
  nextActions: NextAction[];

  // ── Meta
  confidence: ContextConfidence;
}

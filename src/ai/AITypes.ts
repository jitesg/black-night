/**
 * AITypes.ts
 * Central type definitions for the AI Investigation Copilot.
 * Completely isolated from UI and database layers.
 */

// ── Message types ──────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface AIMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCalls?: AIToolCall[];
  draft?: AIDraft;
  error?: string;
  isOffline?: boolean;
}

// ── Tool types ─────────────────────────────────────────────────────────────

export type AIToolName =
  | 'GetFIRTool'
  | 'GetKaryvahiTool'
  | 'GetCaseDiaryTool'
  | 'GetCourtTool'
  | 'GetGDTool'
  | 'GetKnowledgeTool'
  | 'SearchLawTool'
  | 'LawLookupTool'
  | 'TimelineTool'
  | 'EvidenceTool'
  | 'AnalyticsTool'
  | 'PendingTaskTool'
  | 'GenerateDraftTool';

export type AIToolStatus = 'idle' | 'running' | 'done' | 'error';

export interface AIToolCall {
  toolName: AIToolName;
  status: AIToolStatus;
  input?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export interface AITool<TInput = unknown, TOutput = unknown> {
  name: AIToolName;
  description: string;
  execute(input: TInput): Promise<TOutput>;
}

// ── Context types ──────────────────────────────────────────────────────────

export interface AIWorkspaceContext {
  policeStation: string;
  district: string;
  officerName: string;
  halka: string;
  beat: string;
}

export interface AIContextSnapshot {
  workspace: AIWorkspaceContext;
  activeFirId?: string;
  activeFirNumber?: string;
  sessionId?: string;
  timestamp: number;
}

// ── Quick action chips ─────────────────────────────────────────────────────

export type QuickActionId =
  | 'ask'
  | 'next-step'
  | 'draft-case-diary'
  | 'draft-gd'
  | 'draft-notice'
  | 'draft-court-report'
  | 'checklist'
  | 'timeline'
  | 'evidence-summary'
  | 'witness-comparison'
  | 'smart-search'
  | 'analytics'
  | 'pending-tasks'
  | 'recent-activity'
  | 'find-section'
  // ── Level-5 quick actions ──────────────────────────────────────────────────
  | 'l5-memory'
  | 'l5-predict'
  | 'l5-draft'
  | 'l5-graph'
  | 'l5-search'
  | 'l5-station'
  | 'l5-audit'
  // ── Level-6 quick actions ──────────────────────────────────────────────────
  | 'l6-readiness'
  | 'l6-heatmap'
  | 'l6-timeline'
  | 'l6-reminders'
  | 'l6-dependency'
  | 'l6-decision'
  | 'l6-supervisor'
  | 'l6-multifir'
  // ── Level-7 quick actions ──────────────────────────────────────────────────
  | 'l7-quality'
  | 'l7-evidence'
  | 'l7-chargesheet'
  | 'l7-court'
  | 'l7-scenario'
  | 'l7-rules'
  | 'l7-graph'
  | 'l7-supervisor';

export interface QuickAction {
  id: QuickActionId;
  label: string;
  prompt: string;
  icon: string;
}

// ── Draft types ────────────────────────────────────────────────────────────

export type DraftType =
  | 'case-diary'
  | 'gd'
  | 'prarthna-patra'
  | 'court-report'
  | 'bnss-proceedings'
  | 'investigation-notes'
  | 'charge-sheet-summary'
  | 'timeline'
  | 'evidence-summary'
  | 'witness-summary'
  | 'pending-work-summary'
  | 'notice';

export interface AIDraft {
  id: string;
  type: DraftType;
  title: string;
  content: string;   // HTML content ready for DocumentEditor
  createdAt: number;
  firId?: string;
  firNumber?: string;
  sections?: { title: string; content: string }[];
}

// ── AI Session ─────────────────────────────────────────────────────────────

export interface AICopilotSession {
  id: string;
  messages: AIMessage[];
  context: AIContextSnapshot;
  startedAt: number;
  isOffline: boolean;
}

// ── Response ───────────────────────────────────────────────────────────────

export interface AIResponse {
  messageId: string;
  content: string;
  toolCalls: AIToolCall[];
  draft?: AIDraft;
  suggestedActions?: string[];
  isOffline?: boolean;
  error?: string;
}

// ── Search result ──────────────────────────────────────────────────────────

export interface AISearchResult {
  id: string;
  module: string;
  title: string;
  snippet: string;
  route?: string;
}

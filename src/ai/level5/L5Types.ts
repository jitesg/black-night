/**
 * L5Types.ts
 * Complete type contracts for InvestSuite AI Level-5 — Investigation Memory
 * & Predictive Intelligence.
 *
 * SAFETY: All Level-5 modules are READ-ONLY advisory.
 * The AI never saves, deletes, updates, approves, rejects, signs, files,
 * closes investigations, or modifies databases. Every action requires
 * explicit officer confirmation.
 *
 * Architecture:
 *   Repositories → InvestigationContextBuilder → InvestigationContext
 *   → Intelligence Engine (L4) → Level-5 Modules
 */

import type { IntelSeverity, IntelPriority, IntelGrade } from '../intelligence/IntelligenceTypes';

export type { IntelSeverity, IntelPriority, IntelGrade };

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

export type L5ModuleId =
  | 'investigation-memory'
  | 'conversation-memory'
  | 'multi-fir-intelligence'
  | 'predictive-investigation'
  | 'draft-generation'
  | 'knowledge-graph'
  | 'nlq'
  | 'ai-audit'
  | 'ai-provider'
  | 'learning';

export type OfficerAction = 'accepted' | 'ignored' | 'rejected' | 'deferred';

export type TrendDirection = 'improving' | 'stable' | 'declining' | 'unknown';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Investigation Memory Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoryRecommendation {
  id: string;
  firId: string;
  title: string;
  reason: string;
  supportingContext: string;
  applicableRule: string;
  dependencies: string[];
  confidencePct: number;
  expectedOutcome: string;
  riskIfIgnored: string;
  priority: IntelPriority;
  severity: IntelSeverity;
  recordedAt: string;       // ISO timestamp
  status: OfficerAction | 'pending';
  resolvedAt?: string;
  module: L5ModuleId;
}

export interface MemoryHealthSnapshot {
  snapshotAt: string;       // ISO timestamp
  overallScore: number;     // 0–100
  grade: IntelGrade;
  chargeSheetReadinessPct: number;
  compliancePct: number;
  evidenceScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  criticalIssueCount: number;
}

export interface RecurringIssue {
  title: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  isResolved: boolean;
  resolvedAt?: string;
}

export interface InvestigationMemoryRecord {
  firId: string;
  firNumber?: string;
  createdAt: string;
  lastUpdatedAt: string;
  recommendations: MemoryRecommendation[];
  healthSnapshots: MemoryHealthSnapshot[];
  recurringIssues: RecurringIssue[];
  resolvedIssues: string[];
  longPendingGaps: string[];
  progressSummary: {
    totalRecommendations: number;
    accepted: number;
    resolved: number;
    pending: number;
    ignored: number;
    rejected: number;
    healthTrend: TrendDirection;
    riskTrend: TrendDirection;
  };
}

export interface InvestigationMemoryReport {
  record: InvestigationMemoryRecord;
  hasMemory: boolean;
  daysSinceFirstObservation: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Conversation Memory Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationTurn {
  id: string;
  firId: string;
  sessionId: string;
  role: 'officer' | 'ai';
  content: string;
  timestamp: string;
  relatedRecommendationIds?: string[];
}

export interface FIRConversationMemory {
  firId: string;
  firNumber?: string;
  sessions: Array<{
    sessionId: string;
    startedAt: string;
    turns: ConversationTurn[];
  }>;
  totalTurns: number;
  lastInteractionAt: string;
}

export interface ConversationContext {
  firId: string;
  recentTurns: ConversationTurn[];    // last N turns for prompt context
  summary: string;                    // AI-generated summary of conversation so far
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Multi-FIR Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface FIRSummaryItem {
  firId: string;
  firNumber: string;
  crimeType: string;
  section: string;
  daysSinceRegistration: number;
  status: 'Pending' | 'Finished';
  officerName: string;
  healthScore?: number;
  grade?: IntelGrade;
  criticalAlertCount: number;
  hasDefaultBailRisk: boolean;
  hasChargeSheetRisk: boolean;
  hasPendingMedical: boolean;
  hasPendingFSL: boolean;
  hasPendingCourtAction: boolean;
  lastCaseDiaryDate?: string;
  daysSinceCaseDiary?: number;
}

export interface OfficerWorkloadItem {
  officerName: string;
  totalFIRs: number;
  pendingFIRs: number;
  criticalFIRs: number;
  overdueTaskCount: number;
  avgHealthScore: number;
}

export interface CrimeTrendItem {
  crimeType: string;
  count: number;
  percentage: number;
  trend: TrendDirection;
}

export interface StationMetrics {
  totalFIRs: number;
  pendingFIRs: number;
  finishedFIRs: number;
  avgHealthScore: number;
  criticalFIRCount: number;
  defaultBailRiskCount: number;
  chargeSheetOverdueCount: number;
  pendingMedicalCount: number;
  pendingFSLCount: number;
  overdueCaseDiaryCount: number;
  courtDeadlineCount: number;
}

export interface MultiFIRIntelligenceReport {
  generatedAt: string;
  stationName: string;
  metrics: StationMetrics;
  oldestInvestigations: FIRSummaryItem[];
  pendingChargeSheets: FIRSummaryItem[];
  defaultBailRisks: FIRSummaryItem[];
  pendingMedicalReports: FIRSummaryItem[];
  pendingFSLReports: FIRSummaryItem[];
  officerWorkload: OfficerWorkloadItem[];
  crimeTrends: CrimeTrendItem[];
  highPriorityFIRs: FIRSummaryItem[];
  overdueCaseDiaries: FIRSummaryItem[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Predictive Investigation Engine
// ─────────────────────────────────────────────────────────────────────────────

export type PredictiveRiskType =
  | 'upcoming-court-date'
  | 'charge-sheet-deadline'
  | 'default-bail-risk'
  | 'fsl-delay'
  | 'medical-delay'
  | 'witness-delay'
  | 'custody-deadline'
  | 'prarthna-patra-overdue'
  | 'case-diary-gap'
  | 'documentation-gap';

export interface PredictiveRisk {
  id: string;
  type: PredictiveRiskType;
  title: string;
  description: string;
  likelihood: number;         // 0–100
  impact: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;         // 0–100
  daysToEvent?: number;       // days until risk materialises
  dueDate?: string;           // ISO date
  supportingContext: string;
  preventiveActions: Array<{
    title: string;
    description: string;
    urgency: IntelPriority;
  }>;
  riskIfIgnored: string;
  applicableRule?: string;
}

export interface PredictiveInvestigationReport {
  generatedAt: string;
  firId?: string;
  firNumber?: string;
  overallRiskScore: number;     // 0–100
  risks: PredictiveRisk[];
  criticalCount: number;
  highCount: number;
  topRisk: PredictiveRisk | null;
  nextActionRequired: string;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Draft Generation Engine
// ─────────────────────────────────────────────────────────────────────────────

export type L5DraftType =
  | 'case-diary'
  | 'notice'
  | 'arrest-memo'
  | 'seizure-memo'
  | 'search-memo'
  | 'charge-sheet-summary'
  | 'court-reply'
  | 'prarthna-patra-reply'
  | 'investigation-notes';

export interface DraftSection {
  id: string;
  title: string;
  content: string;
  isPlaceholder: boolean;     // true = officer must fill this section
  legalReference?: string;
}

export interface GeneratedDraft {
  id: string;
  type: L5DraftType;
  title: string;
  firId?: string;
  firNumber?: string;
  generatedAt: string;
  sections: DraftSection[];
  fullText: string;           // combined text ready for preview
  missingDataFields: string[];
  legalReferences: string[];
  requiresOfficerReview: true; // always true — safety invariant
  isApproved: false;           // always false at generation — must be set by officer
  confidencePct: number;
  advisory: string;
}

export interface DraftGenerationReport {
  draft: GeneratedDraft | null;
  success: boolean;
  errorMessage?: string;
  missingDataCount: number;
  advisory: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Investigation Knowledge Graph
// ─────────────────────────────────────────────────────────────────────────────

export type GraphNodeType =
  | 'fir'
  | 'victim'
  | 'accused'
  | 'witness'
  | 'evidence'
  | 'medical'
  | 'fsl'
  | 'court'
  | 'case-diary'
  | 'karyavahi';

export type GraphEdgeType =
  | 'fir-victim'
  | 'fir-accused'
  | 'fir-witness'
  | 'victim-medical'
  | 'victim-witness'
  | 'accused-evidence'
  | 'accused-arrest'
  | 'evidence-seizure'
  | 'evidence-fsl'
  | 'witness-statement'
  | 'all-case-diary'
  | 'all-court';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  isPresent: boolean;
  isOrphan: boolean;
  isCriticalMissing: boolean;
  details: string;
  x?: number;               // layout position
  y?: number;
}

export interface GraphEdge {
  id: string;
  type: GraphEdgeType;
  sourceId: string;
  targetId: string;
  label: string;
  isPresent: boolean;
  isBroken: boolean;
  isRequired: boolean;
}

export interface GraphAnalysis {
  missingLinks: Array<{ from: string; to: string; description: string; severity: IntelSeverity }>;
  weakChains: Array<{ description: string; affectedNodes: string[] }>;
  orphanNodes: Array<{ nodeId: string; label: string; recommendation: string }>;
  dependencyPaths: Array<{ title: string; steps: string[] }>;
}

export interface InvestigationKnowledgeGraphReport {
  generatedAt: string;
  firId?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  analysis: GraphAnalysis;
  strengthScore: number;    // 0–100 overall graph completeness
  presentNodeCount: number;
  totalNodeCount: number;
  missingCriticalCount: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Natural Language Query Engine
// ─────────────────────────────────────────────────────────────────────────────

export type NLQIntent =
  | 'find-firs-with-pending-medical'
  | 'find-firs-nearing-charge-sheet-deadline'
  | 'find-firs-without-case-diary'
  | 'find-firs-by-crime-type'
  | 'find-firs-with-custody'
  | 'find-firs-with-pending-fsl'
  | 'find-firs-by-officer'
  | 'find-recent-firs'
  | 'find-firs-with-default-bail-risk'
  | 'find-firs-with-overdue-court'
  | 'find-all-pending-firs'
  | 'unknown';

export interface NLQResult {
  query: string;
  correctedQuery?: string;
  intent: NLQIntent;
  interpretations: string[];
  matchingFIRs: Array<{
    firId: string;
    firNumber: string;
    crimeType: string;
    relevanceNote: string;
  }>;
  totalMatches: number;
  executionNote: string;
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. AI Audit Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  firId?: string;
  firNumber?: string;
  module: L5ModuleId;
  recommendationTitle: string;
  recommendationReason: string;
  confidence: number;
  timestamp: string;
  officerAction: OfficerAction | 'pending';
  officerActionAt?: string;
  supportingContext: string;
  applicableRule: string;
  sessionId: string;
}

export interface AIAuditReport {
  entries: AuditEntry[];
  totalEntries: number;
  acceptedCount: number;
  ignoredCount: number;
  rejectedCount: number;
  pendingCount: number;
  acceptanceRate: number;   // 0–100
  summary: string;
}

export interface AuditFilter {
  firId?: string;
  module?: L5ModuleId;
  officerAction?: OfficerAction | 'pending';
  fromDate?: string;
  toDate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. AI Provider Manager
// ─────────────────────────────────────────────────────────────────────────────

export type AIProviderType = 'cloud-llm' | 'local-llm' | 'hybrid' | 'offline-rules';

export interface AIProviderConfig {
  type: AIProviderType;
  name: string;
  isAvailable: boolean;
  isDefault: boolean;
  endpoint?: string;        // for cloud LLM
  modelName?: string;       // for local LLM
  maxTokens?: number;
  timeoutMs: number;
  fallbackProvider?: AIProviderType;
}

export interface AIProviderRequest {
  prompt: string;
  context: string;
  maxTokens?: number;
  module: L5ModuleId;
  requiresOnline: boolean;
  /** Recent chat turns (Copilot), oldest first. */
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export interface AIProviderResponse {
  content: string;
  provider: AIProviderType;
  usedFallback: boolean;
  latencyMs: number;
  confidence: number;
  isOffline: boolean;
  /** Why the online answer failed (Hindi), when usedFallback. */
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Learning Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface LearningPattern {
  id: string;
  patternType: 'recommendation' | 'investigation-sequence' | 'crime-type-action';
  description: string;
  crimeType?: string;
  triggerConditions: string[];
  recommendedAction: string;
  confirmationCount: number;
  rejectionCount: number;
  confidenceBoost: number;   // added to base confidence when pattern matches
  lastUpdatedAt: string;
  isActive: boolean;
}

export interface LearningEngineState {
  patterns: LearningPattern[];
  totalAcceptedInteractions: number;
  totalRejectedInteractions: number;
  lastTrainingAt?: string;
  isEnabled: boolean;
  privacyMode: 'local-only' | 'anonymised-sync';
}

// ─────────────────────────────────────────────────────────────────────────────
// Level-5 Master Report
// ─────────────────────────────────────────────────────────────────────────────

export interface Level5IntelligenceReport {
  id: string;
  generatedAt: string;
  sessionId: string;
  firId?: string;
  firNumber?: string;

  memoryReport?: InvestigationMemoryReport;
  predictiveReport: PredictiveInvestigationReport;
  knowledgeGraphReport: InvestigationKnowledgeGraphReport;
  multiFIRReport?: MultiFIRIntelligenceReport;    // present when no active FIR
  auditReport: AIAuditReport;

  providerUsed: AIProviderType;
  contextConfidencePct: number;
  isOfflineMode: boolean;
  advisory: string;
}

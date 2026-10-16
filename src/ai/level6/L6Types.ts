/**
 * L6Types.ts
 * Complete type contracts for InvestSuite AI Level-6 —
 * Production Investigation Intelligence Platform.
 *
 * SAFETY: All Level-6 modules are READ-ONLY advisory.
 * AI never saves, deletes, updates, approves, signs, files, or closes
 * investigations. Every action requires explicit officer confirmation.
 * No auto-save. Officer remains final decision authority.
 *
 * Architecture:
 *   Repositories → InvestigationContextBuilder → InvestigationContext
 *   → L4 Intelligence Engine → L5 Orchestrator → L6 Orchestrator
 */

import type { IntelSeverity, IntelPriority, IntelGrade } from '../intelligence/IntelligenceTypes';
import type { InvestigationContext } from '../InvestigationContext';

export type { IntelSeverity, IntelPriority, IntelGrade };

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

export type L6ModuleId =
  | 'continuous-monitor'
  | 'event-intelligence'
  | 'timeline-replay'
  | 'risk-heatmap'
  | 'smart-reminder'
  | 'dependency-graph'
  | 'decision-assistant'
  | 'explainable-ai'
  | 'readiness-dashboard'
  | 'multifir-linker'
  | 'knowledge-learning'
  | 'predictive-step'
  | 'supervisor-view'
  | 'audit-transparency';

export type L6RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export type L6Grade = 'A' | 'B' | 'C' | 'D' | 'F';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Continuous Investigation Monitor
// ─────────────────────────────────────────────────────────────────────────────

export type MonitoredModule =
  | 'fir'
  | 'case-diary'
  | 'court-work'
  | 'karyvahi'
  | 'evidence'
  | 'analytics'
  | 'deadlines';

export interface MonitorSnapshot {
  firId?: string;
  capturedAt: string;           // ISO timestamp
  modules: MonitoredModule[];
  contextVersion: number;       // increments on rebuild
  changeDetected: boolean;
  changedModules: MonitoredModule[];
  triggerReason: string;
}

export interface ContinuousMonitorReport {
  generatedAt: string;
  firId?: string;
  lastSnapshot: MonitorSnapshot;
  snapshotHistory: MonitorSnapshot[];
  totalRebuildCount: number;
  lastRebuildAt: string;
  intelligenceIsStale: boolean;  // true if data changed since last intelligence run
  staleSince?: string;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Event-Driven Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export type InvestigationEventType =
  | 'fir-created'
  | 'fir-updated'
  | 'arrest-completed'
  | 'evidence-added'
  | 'medical-report-received'
  | 'fsl-received'
  | 'witness-added'
  | 'court-date-changed'
  | 'charge-sheet-updated'
  | 'bail-granted'
  | 'deadline-near'
  | 'investigation-closed';

export interface InvestigationEvent {
  id: string;
  type: InvestigationEventType;
  firId?: string;
  firNumber?: string;
  description: string;
  triggeredAt: string;          // ISO timestamp
  severity: IntelSeverity;
  requiresImmediateAttention: boolean;
  suggestedActions: string[];
}

export interface EventDrivenIntelligenceReport {
  generatedAt: string;
  firId?: string;
  events: InvestigationEvent[];
  criticalEventCount: number;
  highEventCount: number;
  mostRecentEvent: InvestigationEvent | null;
  intelligenceRefreshedAt: string;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Investigation Timeline Replay
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineReplayEntry {
  id: string;
  date: string;                 // YYYY-MM-DD
  time?: string;                // HH:MM
  eventType: string;            // 'FIR' | 'Karyvahi' | 'CaseDiary' | 'Court' | etc.
  title: string;
  description: string;
  isCompleted: boolean;
  isCritical: boolean;
  isMissing: boolean;           // expected but not found
  isGap: boolean;               // unusually long gap before this entry
  gapDays?: number;             // days since previous entry
  module: string;
}

export interface TimelineGap {
  fromDate: string;
  toDate: string;
  gapDays: number;
  description: string;
  severity: IntelSeverity;
  recommendation: string;
}

export interface TimelineReplayReport {
  generatedAt: string;
  firId?: string;
  firNumber?: string;
  entries: TimelineReplayEntry[];
  gaps: TimelineGap[];
  nextExpectedEvent: string;
  delayedInvestigation: boolean;
  criticalGaps: number;
  totalEntries: number;
  totalGaps: number;
  investigationDurationDays: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Risk Heatmap
// ─────────────────────────────────────────────────────────────────────────────

export type HeatmapCategory =
  | 'evidence'
  | 'court'
  | 'witness'
  | 'delay'
  | 'compliance'
  | 'documentation'
  | 'legal'
  | 'investigation';

export interface HeatmapCell {
  category: HeatmapCategory;
  label: string;
  score: number;                // 0–100 (higher = worse risk)
  riskLevel: L6RiskLevel;
  reason: string;
  recommendation: string;
  linkedItems: string[];
}

export interface RiskHeatmapReport {
  generatedAt: string;
  firId?: string;
  cells: HeatmapCell[];
  overallRiskScore: number;     // 0–100
  overallRiskLevel: L6RiskLevel;
  criticalCategoryCount: number;
  highCategoryCount: number;
  topRiskCategory: HeatmapCategory;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Smart Reminder Engine
// ─────────────────────────────────────────────────────────────────────────────

export type ReminderType =
  | 'medical-pending'
  | 'statement-pending'
  | 'seizure-pending'
  | 'court-tomorrow'
  | 'charge-sheet-due'
  | 'bail-response-pending'
  | 'notice-pending'
  | 'fsl-pending'
  | 'case-diary-overdue'
  | 'custody-deadline'
  | 'court-compliance-due';

export interface SmartReminder {
  id: string;
  type: ReminderType;
  title: string;
  description: string;
  dueDate?: string;             // YYYY-MM-DD
  daysRemaining?: number;       // negative = overdue
  priority: IntelPriority;
  severity: IntelSeverity;
  firId?: string;
  firNumber?: string;
  isOverdue: boolean;
  requiresImmediateAction: boolean;
  suggestedAction: string;
  legalReference?: string;
}

export interface SmartReminderReport {
  generatedAt: string;
  firId?: string;
  reminders: SmartReminder[];
  overdueCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
  criticalCount: number;
  topReminder: SmartReminder | null;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Investigation Dependency Graph
// ─────────────────────────────────────────────────────────────────────────────

export type DepNodeType =
  | 'medical-report'
  | 'fsl-report'
  | 'expert-opinion'
  | 'case-diary'
  | 'charge-sheet'
  | 'witness-statement'
  | 'arrest'
  | 'seizure'
  | 'court-filing'
  | 'bail-reply'
  | 'notice'
  | 'prarthna-patra';

export interface DepNode {
  id: string;
  type: DepNodeType;
  label: string;
  isPresent: boolean;
  isMissing: boolean;
  isBlocking: boolean;           // blocks downstream nodes
  isLeaf: boolean;               // no further dependencies
  depth: number;                 // 0 = root
  children: string[];            // child node ids
  parents: string[];             // parent node ids
  details: string;
  legalReference?: string;
}

export interface DependencyGraphReport {
  generatedAt: string;
  firId?: string;
  nodes: DepNode[];
  rootNodeId: string;            // charge-sheet is root
  missingCritical: DepNode[];
  blockingChain: string[];       // ordered path of blocking nodes
  completionPct: number;         // 0–100
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Officer Decision Assistant
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionAlternative {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  confidencePct: number;
}

export interface DecisionAssistance {
  id: string;
  recommendationTitle: string;
  why: string;
  evidenceUsed: string[];
  rulesApplied: string[];
  confidencePct: number;
  alternatives: DecisionAlternative[];
  riskIfIgnored: string;
  expectedOutcome: string;
  legalBasis: string;
  priority: IntelPriority;
  severity: IntelSeverity;
  // Officer always decides — never auto-applied
  requiresOfficerDecision: true;
}

export interface OfficerDecisionAssistantReport {
  generatedAt: string;
  firId?: string;
  decisions: DecisionAssistance[];
  topDecision: DecisionAssistance | null;
  criticalCount: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Explainable AI Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface ExplainableRecommendation {
  id: string;
  title: string;
  reason: string;
  supportingData: string[];
  applicableBNSSRule: string;
  dependencies: string[];
  confidencePct: number;
  expectedOutcome: string;
  riskIfIgnored: string;
  module: L6ModuleId;
  isBlackBox: false;             // always false — explainability invariant
}

export interface ExplainableAIReport {
  generatedAt: string;
  firId?: string;
  recommendations: ExplainableRecommendation[];
  totalRecommendations: number;
  allExplained: boolean;         // true when every recommendation has a reason
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Investigation Readiness Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadinessDimension {
  label: string;
  score: number;                 // 0–100
  grade: L6Grade;
  description: string;
  items: string[];               // supporting bullet points
  criticalIssues: string[];
}

export interface InvestigationReadinessReport {
  generatedAt: string;
  firId?: string;
  firNumber?: string;

  // Dimensions
  investigationScore: ReadinessDimension;
  compliance: ReadinessDimension;
  evidenceStrength: ReadinessDimension;
  documentation: ReadinessDimension;
  courtReadiness: ReadinessDimension;
  chargeSheetReadiness: ReadinessDimension;
  timelineHealth: ReadinessDimension;
  riskScore: ReadinessDimension;

  // Aggregate
  overallScore: number;          // 0–100 weighted
  overallGrade: L6Grade;
  gradeLabel: string;
  criticalIssues: string[];
  topRecommendations: string[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Multi-FIR Intelligence Linker
// ─────────────────────────────────────────────────────────────────────────────

export interface LinkedFIRCluster {
  clusterId: string;
  linkType:
    | 'repeat-accused'
    | 'repeat-witness'
    | 'repeat-location'
    | 'repeat-vehicle'
    | 'repeat-mobile'
    | 'repeat-modus-operandi'
    | 'combined';
  firIds: string[];
  firNumbers: string[];
  matchedValue: string;          // e.g. accused name, vehicle number
  confidence: number;            // 0–100
  description: string;
  recommendation: string;
}

export interface MultiFIRLinkerReport {
  generatedAt: string;
  totalFIRsAnalyzed: number;
  clusters: LinkedFIRCluster[];
  repeatAccusedCount: number;
  repeatWitnessCount: number;
  repeatLocationCount: number;
  repeatVehicleCount: number;
  repeatMobileCount: number;
  suspectedSerialCrimeCount: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Investigation Knowledge Learning Engine (optional / local-only)
// ─────────────────────────────────────────────────────────────────────────────

export interface FrequentLaw {
  section: string;
  title: string;
  openCount: number;
  lastOpenedAt: string;
}

export interface FrequentFormat {
  formatType: string;            // e.g. 'case-diary', 'notice'
  useCount: number;
  lastUsedAt: string;
}

export interface FrequentQuestion {
  question: string;
  askedCount: number;
  lastAskedAt: string;
  category: string;
}

export interface KnowledgeLearningReport {
  generatedAt: string;
  frequentLaws: FrequentLaw[];
  frequentFormats: FrequentFormat[];
  frequentQuestions: FrequentQuestion[];
  recommendationBoosts: Array<{
    title: string;
    acceptanceRate: number;
    boostApplied: number;       // additional confidence %
  }>;
  isEnabled: boolean;
  privacyMode: 'local-only';    // always local-only for safety
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Predictive Step Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface PredictedStep {
  id: string;
  title: string;
  description: string;
  confidence: number;            // 0–100
  expectedByDate?: string;       // YYYY-MM-DD
  daysToExpect?: number;
  category: 'investigation' | 'evidence' | 'court' | 'documentation' | 'witness' | 'deadline';
  isOverdue: boolean;
  legalBasis?: string;
  priority: IntelPriority;
}

export interface PredictiveStepReport {
  generatedAt: string;
  firId?: string;
  likelyNextStep: PredictedStep | null;
  pendingWorkPredictions: PredictedStep[];
  upcomingDeadlines: PredictedStep[];
  courtPreparationItems: PredictedStep[];
  expectedMissingDocuments: string[];
  overallConfidence: number;     // 0–100
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Supervisor View Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface OfficerIntelligenceSummary {
  officerName: string;
  totalFIRs: number;
  pendingFIRs: number;
  criticalFIRs: number;
  avgInvestigationScore: number;
  overdueTaskCount: number;
  pendingChargeSheets: number;
  courtDeadlinesThisWeek: number;
}

export interface CrimeTrendAnalysis {
  crimeType: string;
  count: number;
  percentage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  hotspotArea?: string;
}

export interface SupervisorViewReport {
  generatedAt: string;
  stationName: string;
  // Station metrics
  totalFIRs: number;
  pendingFIRs: number;
  criticalFIRs: number;
  overdueInvestigations: number;
  avgInvestigationScore: number;
  // Distribution
  gradeDistribution: Record<L6Grade, number>;
  // Officer workload
  officerSummaries: OfficerIntelligenceSummary[];
  // Crime trends
  crimeTrends: CrimeTrendAnalysis[];
  // Alerts
  criticalAlerts: string[];
  stationRecommendations: string[];
  // Read-only advisory
  isReadOnly: true;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Audit & Transparency Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface L6AuditEntry {
  id: string;
  firId?: string;
  module: L6ModuleId;
  contextVersion: number;
  reasoningVersion: string;
  rulesExecuted: string[];
  modulesConsulted: L6ModuleId[];
  recommendationIds: string[];
  timestamp: string;
  sessionId: string;
  processingMs: number;
  // never modifies investigation records
  modifiedData: false;
}

export interface L6AuditReport {
  generatedAt: string;
  entries: L6AuditEntry[];
  totalEntries: number;
  moduleCoverage: Partial<Record<L6ModuleId, number>>;
  rulesExecutedTotal: number;
  avgProcessingMs: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Level-6 Master Report
// ─────────────────────────────────────────────────────────────────────────────

export interface Level6IntelligenceReport {
  id: string;
  generatedAt: string;
  sessionId: string;
  firId?: string;
  firNumber?: string;
  contextVersion: number;

  // Module reports
  monitorReport: ContinuousMonitorReport;
  eventReport: EventDrivenIntelligenceReport;
  timelineReplayReport: TimelineReplayReport;
  riskHeatmapReport: RiskHeatmapReport;
  reminderReport: SmartReminderReport;
  dependencyGraphReport: DependencyGraphReport;
  decisionAssistantReport: OfficerDecisionAssistantReport;
  explainableAIReport: ExplainableAIReport;
  readinessReport: InvestigationReadinessReport;
  multiFIRLinkerReport?: MultiFIRLinkerReport;   // present when allContexts provided
  knowledgeLearningReport: KnowledgeLearningReport;
  predictiveStepReport: PredictiveStepReport;
  supervisorViewReport?: SupervisorViewReport;   // present when allContexts provided
  auditReport: L6AuditReport;

  // Meta
  isOfflineMode: boolean;
  contextConfidencePct: number;
  advisory: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: InvestigationContext snapshot used by monitor
// ─────────────────────────────────────────────────────────────────────────────

export type { InvestigationContext };

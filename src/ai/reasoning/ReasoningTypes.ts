/**
 * ReasoningTypes.ts
 * Central type contracts for the Investigation Reasoning & Decision Support Engine.
 *
 * SAFETY: All types are read-only analysis outputs.
 * The AI NEVER modifies data, completes tasks, or makes legal decisions.
 * The Investigation Officer is always the final decision maker.
 */

// ── Severity / Priority ───────────────────────────────────────────────────────

export type Severity  = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RiskLevel = 'critical' | 'high'  | 'medium' | 'low';

// ── Rule ─────────────────────────────────────────────────────────────────────

/**
 * A single investigation rule.
 * Rules are pure configuration — adding new rules requires NO code changes.
 */
export interface InvestigationRule {
  id: string;                         // unique, e.g. 'RULE-001'
  title: string;
  description: string;
  priority: number;                   // 1 = highest
  severity: Severity;
  /** undefined = applies to all crime types */
  applicableCrimeTypes?: string[];
  /** undefined = applies to all sections */
  applicableSections?: string[];
  /** Karyvahi name patterns that must be COMPLETED before this rule is satisfied */
  requiredProceedingsCompleted?: string[];
  /** Karyvahi name patterns that must EXIST (completed or not) */
  requiredProceedingsPresent?: string[];
  /** Case diary presence required */
  requiresCaseDiary?: boolean;
  /** Court doc types required */
  requiredCourtDocTypes?: string[];
  /** Knowledge category tags that should be present */
  requiredKnowledgeTags?: string[];
  /** Whether the rule applies when FIR status is Pending */
  onlyWhenPending?: boolean;
  /** Human-readable output / recommendation when rule fires */
  recommendation: string;
  /** Module tags that were analysed */
  modulesAnalysed: string[];
  /** Reference to BNSS / IPC section or SOP */
  legalReference?: string;
}

// ── Finding ───────────────────────────────────────────────────────────────────

/** A single rule violation or gap discovered during analysis */
export interface Finding {
  id: string;
  ruleId: string;
  ruleTitle: string;
  severity: Severity;
  title: string;
  detail: string;
  recommendation: string;
  modulesAnalysed: string[];
  legalReference?: string;
  /** ISO date string of when this finding was generated */
  generatedAt: string;
}

// ── Risk ──────────────────────────────────────────────────────────────────────

export interface RiskItem {
  id: string;
  level: RiskLevel;
  title: string;
  reason: string;
  impact: string;
  recommendation: string;
  /** 0–100 */
  confidence: number;
  findingIds: string[];   // linked findings
}

// ── Confidence ────────────────────────────────────────────────────────────────

export interface ConfidenceScore {
  /** 0–100 */
  value: number;
  evidenceUsed: string[];
  missingInformation: string[];
  alternativePossibilities: string[];
  explanation: string;
}

// ── Explanation ───────────────────────────────────────────────────────────────

export interface Explanation {
  recommendationId: string;
  whyThisRecommendation: string;
  supportingEvidence: string[];
  triggeredRules: string[];        // rule IDs
  modulesAnalysed: string[];
  legalBasis?: string;
  confidence: ConfidenceScore;
}

// ── Dependency Graph ─────────────────────────────────────────────────────────

export interface DependencyNode {
  id: string;
  label: string;
  /** 'completed' | 'pending' | 'blocked' | 'missing' */
  status: 'completed' | 'pending' | 'blocked' | 'missing';
  /** IDs of nodes that must complete before this one */
  dependsOn: string[];
  /** Human-readable reason for blocked/missing status */
  blockReason?: string;
  severity?: Severity;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  /** IDs of nodes currently blocking further progress */
  blockedNodeIds: string[];
  /** Longest unblocked chain to completion */
  criticalPath: string[];
}

// ── Timeline Gap ─────────────────────────────────────────────────────────────

export interface TimelineGap {
  id: string;
  gapType: 'missing-event' | 'wrong-sequence' | 'long-inactivity' | 'deadline-violation';
  title: string;
  description: string;
  severity: Severity;
  affectedDate?: string;
  expectedDate?: string;
  daysGap?: number;
}

// ── Decision Card ─────────────────────────────────────────────────────────────

export type DecisionCardType =
  | 'next-step'
  | 'critical-evidence'
  | 'pending-statements'
  | 'court-action'
  | 'recommended-documents'
  | 'investigation-risk'
  | 'compliance-gap';

export interface DecisionCard {
  id: string;
  type: DecisionCardType;
  title: string;
  summary: string;
  items: string[];
  severity: Severity;
  explanation: Explanation;
  /** true = officer must take action before investigation can proceed */
  isBlocking: boolean;
}

// ── Investigation Health Report ───────────────────────────────────────────────

export interface InvestigationHealthReport {
  /** 0–100 composite score */
  overallScore: number;
  completionPct: number;
  legalReadiness: number;      // 0–100
  courtReadiness: number;      // 0–100
  evidenceReadiness: number;   // 0–100
  documentationQuality: number;// 0–100
  timelineQuality: number;     // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  /** Items with ✓ status */
  completedItems: string[];
  /** Items with 🟡 status */
  pendingItems: string[];
  /** Items with 🔴 critical status */
  criticalItems: string[];
  /** Items with ⚠ missing status */
  missingItems: string[];
  /** Items with 📅 deadline status */
  deadlineItems: string[];
}

// ── Audit Record ──────────────────────────────────────────────────────────────

/**
 * Immutable record created after every reasoning run.
 * No personal conversation history is stored — only the analysis metadata.
 */
export interface AuditRecord {
  id: string;
  firId?: string;
  firNumber?: string;
  sessionId: string;
  runAt: string;              // ISO timestamp
  triggeredRuleIds: string[];
  findingCount: number;
  riskCount: number;
  overallHealthScore: number;
  contextConfidenceScore: number;
  offlineMode: boolean;
  /** Summary only — NOT a conversation log */
  summary: string;
}

// ── Reasoning Report ──────────────────────────────────────────────────────────

/** The complete output of one ReasoningEngine run */
export interface ReasoningReport {
  id: string;
  generatedAt: string;          // ISO timestamp
  firId?: string;
  firNumber?: string;
  sessionId: string;
  offlineMode: boolean;

  // ── Engine outputs
  findings: Finding[];
  risks: RiskItem[];
  timelineGaps: TimelineGap[];
  dependencyGraph: DependencyGraph;
  decisionCards: DecisionCard[];
  healthReport: InvestigationHealthReport;
  auditRecord: AuditRecord;

  // ── Summary text (displayable)
  executiveSummary: string;
  nextPriorityAction: string;

  // ── Meta
  contextConfidence: number;    // 0–100
  rulesEvaluated: number;
  rulesFired: number;
}

/**
 * IntelligenceTypes.ts
 * Complete type contracts for the Level-4 Investigation Intelligence Engine.
 *
 * All engine outputs are read-only advisory analysis.
 * The AI never saves, deletes, approves, rejects, signs or creates official records.
 * Every action requires explicit officer confirmation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

export type IntelSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IntelPriority = 'urgent' | 'high' | 'medium' | 'low';
export type IntelGrade    = 'A' | 'B' | 'C' | 'D' | 'F';
export type HealthStatus  = 'healthy' | 'pending' | 'critical';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Crime Playbook Engine
// ─────────────────────────────────────────────────────────────────────────────

export type CrimeCategory =
  | 'Murder'
  | 'Attempt to Murder'
  | 'Theft'
  | 'Robbery'
  | 'Dacoity'
  | 'Cyber Crime'
  | 'NDPS'
  | 'Arms Act'
  | 'Road Accident'
  | 'Missing Person'
  | 'Kidnapping'
  | 'POCSO'
  | 'Domestic Violence'
  | 'Economic Offences'
  | 'Property Disputes'
  | 'Custom';

export interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  isMandatory: boolean;
  /** Regex pattern matching karyvahi names that satisfy this step */
  karyvahiPattern?: string;
  /** Document types (court) that satisfy this step */
  courtDocTypes?: string[];
  /** Whether case diary entry is required */
  requiresCaseDiary?: boolean;
  category: 'investigation' | 'evidence' | 'witness' | 'medical' | 'fsl' | 'court' | 'documentation';
  legalReference?: string;
}

export interface CrimePlaybook {
  id: string;
  crimeCategory: CrimeCategory;
  /** Regex patterns on crime_type / sections to auto-match FIR */
  crimeTypePatterns: string[];
  sectionPatterns?: string[];
  steps: PlaybookStep[];
  description: string;
}

export type PlaybookStepStatus = 'completed' | 'pending' | 'critical-missing' | 'optional-missing';

export interface PlaybookStepResult {
  step: PlaybookStep;
  status: PlaybookStepStatus;
  evidence?: string;   // matched karyvahi name or court doc
}

export interface PlaybookValidationReport {
  crimeCategory: CrimeCategory;
  playbookId: string;
  totalSteps: number;
  completedSteps: number;
  pendingMandatory: number;
  criticalMissing: number;
  optionalMissing: number;
  coveragePct: number;       // 0–100
  stepResults: PlaybookStepResult[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Legal Compliance Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplianceRule {
  id: string;
  title: string;
  description: string;
  severity: IntelSeverity;
  legalReference: string;
  /** check returns true = VIOLATION */
  checkKey: string;
  recommendation: string;
  category: 'arrest' | 'notice' | 'search' | 'seizure' | 'custody' | 'chargesheet' | 'medical' | 'fsl' | 'court' | 'bail';
}

export interface ComplianceFinding {
  ruleId: string;
  ruleTitle: string;
  severity: IntelSeverity;
  category: ComplianceRule['category'];
  detail: string;
  recommendation: string;
  legalReference: string;
}

export interface LegalComplianceReport {
  compliancePct: number;     // 0–100
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  legalRisks: ComplianceFinding[];
  missingProcedures: ComplianceFinding[];
  criticalCount: number;
  highCount: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Evidence Graph Engine
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceNodeType =
  | 'victim' | 'medical' | 'witness' | 'scene' | 'weapon'
  | 'fsl' | 'accused' | 'motive' | 'chargesheet';

export interface EvidenceNode {
  id: string;
  type: EvidenceNodeType;
  label: string;
  isPresent: boolean;
  isLinked: boolean;      // has at least one valid edge
  isOrphan: boolean;
  isDuplicate: boolean;
  linkedTo: string[];     // node IDs
}

export interface EvidenceEdge {
  from: string;           // node ID
  to: string;             // node ID
  strength: 'strong' | 'weak' | 'broken';
  reason?: string;
}

export interface EvidenceChainIssue {
  severity: IntelSeverity;
  type: 'weak-chain' | 'broken-link' | 'orphan' | 'duplicate' | 'missing-node';
  description: string;
  affectedNodes: string[];
  recommendation: string;
}

export interface EvidenceGraphReport {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  strengthScore: number;    // 0–100
  issues: EvidenceChainIssue[];
  presentNodeCount: number;
  totalNodeCount: number;
  orphanCount: number;
  brokenLinkCount: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Contradiction Engine
// ─────────────────────────────────────────────────────────────────────────────

export type ContradictionType = 'critical' | 'warning' | 'information';

export interface Contradiction {
  id: string;
  type: ContradictionType;
  title: string;
  description: string;
  modulesInvolved: string[];
  recommendation: string;
  legalImplication?: string;
}

export interface ContradictionReport {
  totalContradictions: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  contradictions: Contradiction[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Timeline Prediction Engine
// ─────────────────────────────────────────────────────────────────────────────

export type TimelineItemStatus = 'completed' | 'pending' | 'overdue' | 'predicted';

export interface IntelTimelineItem {
  id: string;
  date: string;             // YYYY-MM-DD or predicted estimate
  module: string;
  title: string;
  status: TimelineItemStatus;
  isCritical: boolean;
  isPredicted: boolean;
  predictedReason?: string;
}

export interface TimelinePredictionReport {
  completedItems: IntelTimelineItem[];
  pendingItems: IntelTimelineItem[];
  overdueItems: IntelTimelineItem[];
  predictedNextSteps: IntelTimelineItem[];
  nextLogicalStep: string;
  overdueSummary: string;
  predictedWorkflow: string[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Charge Sheet Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface ChargeSheetItem {
  id: string;
  category: 'fir' | 'accused' | 'victim' | 'witness' | 'medical' | 'evidence' | 'fsl' | 'casediary' | 'karyvahi' | 'court' | 'documentation';
  title: string;
  isPresent: boolean;
  isCritical: boolean;
  detail?: string;
}

export interface ChargeSheetReport {
  readinessPct: number;     // 0–100
  totalItems: number;
  presentItems: number;
  criticalBlockers: ChargeSheetItem[];
  missingItems: ChargeSheetItem[];
  completedItems: ChargeSheetItem[];
  nextSteps: string[];
  estimatedReadyDate?: string;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Investigation Score Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreDimension {
  name: string;
  score: number;          // 0–100
  weight: number;         // 0–1, must sum to 1.0
  grade: IntelGrade;
  items: string[];        // bullet points explaining score
}

export interface InvestigationScoreReport {
  overallScore: number;           // weighted average, 0–100
  grade: IntelGrade;
  label: string;
  investigationQuality: ScoreDimension;
  evidenceStrength: ScoreDimension;
  documentation: ScoreDimension;
  legalCompliance: ScoreDimension;
  courtReadiness: ScoreDimension;
  timelineDiscipline: ScoreDimension;
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Risk Prediction Engine
// ─────────────────────────────────────────────────────────────────────────────

export type RiskCategory =
  | 'default-bail'
  | 'weak-evidence'
  | 'witness-risk'
  | 'court-delay'
  | 'missing-medical'
  | 'missing-fsl'
  | 'documentation-gap'
  | 'deadline-risk';

export interface PredictedRisk {
  id: string;
  category: RiskCategory;
  title: string;
  riskLevel: 'high' | 'medium' | 'low';
  likelihood: number;     // 0–100 percentage
  impact: 'critical' | 'moderate' | 'minor';
  priority: IntelPriority;
  reason: string;
  recommendation: string;
  daysToEvent?: number;   // if deadline-related
}

export interface RiskPredictionReport {
  overallRiskLevel: 'high' | 'medium' | 'low';
  risks: PredictedRisk[];
  criticalRiskCount: number;
  highRiskCount: number;
  defaultBailRisk: PredictedRisk | null;
  topPriorityRisk: PredictedRisk | null;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Supervisor Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface FIRHealthSummary {
  firId: string;
  firNumber: string;
  crimeType: string;
  healthScore: number;
  grade: IntelGrade;
  status: 'Pending' | 'Finished';
  pendingTaskCount: number;
  criticalAlertCount: number;
  riskLevel: 'high' | 'medium' | 'low';
  priority: IntelPriority;
  nextCourtDate?: string;
  chargeSheetPct: number;
  daysSinceLastDiary?: number;
}

export interface StationOverview {
  totalActiveCases: number;
  averageHealthScore: number;
  criticalCasesCount: number;
  highRiskCasesCount: number;
  courtDeadlinesThisWeek: number;
  oldDiariesCount: number;        // case diaries not updated in 7+ days
  chargeSheetDueCount: number;
}

export interface SupervisorReport {
  stationOverview: StationOverview;
  firSummaries: FIRHealthSummary[];
  criticalAlerts: string[];
  priorityOrder: string[];        // firIds sorted by priority
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Smart Recommendation Engine
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationAction =
  | 'record-witness-statement'
  | 'obtain-medical-report'
  | 'collect-cctv'
  | 'prepare-seizure-memo'
  | 'update-case-diary'
  | 'apply-nbw'
  | 'file-charge-sheet'
  | 'followup-fsl'
  | 'conduct-scene-exam'
  | 'arrest-accused'
  | 'produce-in-court'
  | 'submit-compliance'
  | 'other';

export interface SmartRecommendation {
  id: string;
  action: RecommendationAction;
  title: string;
  reason: string;
  supportingContext: string;
  applicableRule: string;
  dependencies: string[];       // titles of prerequisite actions
  confidencePct: number;        // 0–100
  expectedOutcome: string;
  priority: IntelPriority;
  severity: IntelSeverity;
  isBlocking: boolean;
  category: 'investigation' | 'evidence' | 'witness' | 'court' | 'documentation' | 'deadline';
  legalReference?: string;
}

export interface IntelligenceRecommendationReport {
  recommendations: SmartRecommendation[];
  topPriority: SmartRecommendation | null;
  blockingCount: number;
  urgentCount: number;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Intelligence Health Report (master report)
// ─────────────────────────────────────────────────────────────────────────────

export interface IntelligenceHealthReport {
  generatedAt: string;          // ISO timestamp
  firId?: string;
  firNumber?: string;
  officerName: string;
  policeStation: string;

  // Executive summary
  executiveSummary: string;
  overallHealthScore: number;   // 0–100
  grade: IntelGrade;
  healthStatus: HealthStatus;

  // Critical issues
  criticalIssues: string[];
  pendingWork: string[];

  // Module statuses
  evidenceStatus: string;
  courtStatus: string;
  chargeSheetReadinessPct: number;
  legalRiskCount: number;

  // Recommended next actions (top 5)
  recommendedNextActions: SmartRecommendation[];

  // Advisory footer — always shown
  advisory: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Intelligence Report (output of InvestigationIntelligenceEngine)
// ─────────────────────────────────────────────────────────────────────────────

export interface InvestigationIntelligenceReport {
  id: string;
  generatedAt: string;
  sessionId: string;
  firId?: string;
  firNumber?: string;
  offlineMode: boolean;

  // Engine reports
  playbookReport: PlaybookValidationReport | null;
  complianceReport: LegalComplianceReport;
  evidenceGraphReport: EvidenceGraphReport;
  contradictionReport: ContradictionReport;
  timelineReport: TimelinePredictionReport;
  chargeSheetReport: ChargeSheetReport;
  scoreReport: InvestigationScoreReport;
  riskReport: RiskPredictionReport;
  supervisorReport: SupervisorReport | null;   // only when multi-FIR context
  recommendationReport: IntelligenceRecommendationReport;

  // Master health report
  healthReport: IntelligenceHealthReport;

  // Context quality
  contextConfidencePct: number;
}

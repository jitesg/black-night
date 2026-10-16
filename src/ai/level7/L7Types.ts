/**
 * L7Types.ts
 * Complete type contracts for all Level-7 modules.
 * Level-7: Explainable Investigation Decision Support System (IDSS)
 *
 * RULES:
 * - All types are read-only advisory — no writes, no auto-save
 * - All engines consume InvestigationContext only
 * - Backward compatible with L1–L6
 */

// ── Module identifiers ────────────────────────────────────────────────────────

export type L7ModuleId =
  | 'rule-engine-studio'
  | 'scenario-simulator'
  | 'evidence-strength'
  | 'charge-sheet-validator'
  | 'court-readiness'
  | 'knowledge-graph'
  | 'policy-version-manager'
  | 'nl-investigation'
  | 'explainable-ai'
  | 'quality-index'
  | 'supervisor-intelligence'
  | 'ai-learning-layer'
  | 'performance-layer'
  | 'security-governance'
  | 'l7-audit';

// ── Severity / grade / status ─────────────────────────────────────────────────

export type L7Severity   = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type L7Grade      = 'A' | 'B' | 'C' | 'D' | 'F';
export type L7ReadyState = 'Ready' | 'Partially Ready' | 'Not Ready';
export type L7RuleCategory =
  | 'BNSS' | 'BNS' | 'Police SOP' | 'Department Order'
  | 'Court Procedure' | 'Local Policy' | 'Custom';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Rule Engine Studio
// ═══════════════════════════════════════════════════════════════════════════════

export interface L7Rule {
  id:             string;
  version:        string;
  category:       L7RuleCategory;
  priority:       number;           // 1 = highest
  title:          string;
  description:    string;
  conditions:     string[];         // human-readable condition strings
  recommendation: string;
  reasoning:      string;
  explanation:    string;
  legalReference?: string;
  enabled:        boolean;
  tags:           string[];
}

export interface RuleEngineReport {
  generatedAt:    string;
  firId?:         string;
  totalRules:     number;
  enabledRules:   number;
  firedRules:     number;
  passedRules:    number;
  rulesByCategory: Record<L7RuleCategory, number>;
  violations:     RuleViolation[];
  passed:         RulePassEntry[];
  overallCompliance: number; // 0–100
}

export interface RuleViolation {
  ruleId:         string;
  ruleTitle:      string;
  category:       L7RuleCategory;
  severity:       L7Severity;
  priority:       number;
  recommendation: string;
  reasoning:      string;
  explanation:    string;
  legalReference?: string;
}

export interface RulePassEntry {
  ruleId:   string;
  ruleTitle:string;
  category: L7RuleCategory;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Scenario Simulator
// ═══════════════════════════════════════════════════════════════════════════════

export type ScenarioType =
  | 'medical-report-delayed'
  | 'arrest-cancelled'
  | 'witness-hostile'
  | 'fsl-contradicts-witness'
  | 'bail-granted'
  | 'new-evidence-received'
  | 'witness-absent'
  | 'charge-sheet-delayed'
  | 'court-date-changed'
  | 'accused-absconding';

export interface SimulationScenario {
  id:          string;
  type:        ScenarioType;
  title:       string;
  description: string;
  trigger:     string;
}

export interface SimulationResult {
  scenarioId:          string;
  scenarioTitle:       string;
  consequences:        string[];
  investigationImpact: ImpactItem[];
  legalImpact:         ImpactItem[];
  risks:               RiskItem[];
  recommendedActions:  string[];
  overallSeverity:     L7Severity;
  confidencePct:       number;
}

export interface ImpactItem {
  area:        string;
  description: string;
  severity:    L7Severity;
}

export interface RiskItem {
  risk:        string;
  probability: 'High' | 'Medium' | 'Low';
  mitigation:  string;
}

export interface ScenarioSimulatorReport {
  generatedAt: string;
  firId?:      string;
  scenarios:   SimulationScenario[];
  results:     SimulationResult[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Evidence Strength Engine
// ═══════════════════════════════════════════════════════════════════════════════

export type EvidenceType =
  | 'Documentary' | 'Oral' | 'Scientific' | 'Medical'
  | 'Digital' | 'Circumstantial';

export interface EvidenceScore {
  type:          EvidenceType;
  score:         number;   // 0–100
  available:     boolean;
  items:         string[];
  weaknesses:    string[];
  missing:       string[];
  contradictions:string[];
}

export interface AllegationEvidence {
  allegation:    string;
  scores:        EvidenceScore[];
  overallScore:  number;
  verdict:       'Strong' | 'Moderate' | 'Weak' | 'Insufficient';
  criticalGaps:  string[];
}

export interface EvidenceStrengthReport {
  generatedAt:     string;
  firId?:          string;
  allegations:     AllegationEvidence[];
  overallScore:    number;
  overallGrade:    L7Grade;
  weakEvidence:    string[];
  missingEvidence: string[];
  contradictions:  string[];
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Charge Sheet Validator
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChargeSheetCheckItem {
  id:          string;
  title:       string;
  mandatory:   boolean;
  present:     boolean;
  status:      'Complete' | 'Incomplete' | 'Missing' | 'Not Required';
  explanation: string;
  legalBasis?: string;
}

export interface ChargeSheetValidatorReport {
  generatedAt:    string;
  firId?:         string;
  readyState:     L7ReadyState;
  overallScore:   number;
  checks:         ChargeSheetCheckItem[];
  missingItems:   string[];
  criticalMissing:string[];
  recommendations:string[];
  estimatedDaysToReady: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Court Readiness Engine
// ═══════════════════════════════════════════════════════════════════════════════

export interface CourtChecklistItem {
  id:          string;
  title:       string;
  done:        boolean;
  priority:    L7Severity;
  daysLeft?:   number;
  legalBasis?: string;
  action?:     string;
}

export interface CourtReadinessReport {
  generatedAt:   string;
  firId?:        string;
  nextHearing?:  string;
  daysToHearing?:number;
  readyState:    L7ReadyState;
  score:         number;
  checklist:     CourtChecklistItem[];
  pendingDocs:   string[];
  warrants:      string[];
  summons:       string[];
  criticalIssues:string[];
  recommendations:string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Investigation Knowledge Graph
// ═══════════════════════════════════════════════════════════════════════════════

export type KGNodeType =
  | 'FIR' | 'Accused' | 'Victim' | 'Witness' | 'Vehicle'
  | 'Mobile' | 'Location' | 'Evidence' | 'Court' | 'CaseDiary'
  | 'PrarthnaPatra' | 'KnowledgeArticle' | 'Officer';

export interface KGNode {
  id:    string;
  type:  KGNodeType;
  label: string;
  data?: Record<string, string | number | boolean>;
}

export interface KGEdge {
  from:        string;
  to:          string;
  relation:    string;
  weight?:     number;
  bidirectional?: boolean;
}

export interface KnowledgeGraphReport {
  generatedAt: string;
  firId?:      string;
  nodes:       KGNode[];
  edges:       KGEdge[];
  clusters:    KGCluster[];
  stats:       { nodeCount: number; edgeCount: number; clusterCount: number };
}

export interface KGCluster {
  id:    string;
  label: string;
  nodes: string[];
  type:  KGNodeType;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Policy Version Manager
// ═══════════════════════════════════════════════════════════════════════════════

export type PolicySource =
  | 'UP Police' | 'State Rules' | 'BNSS Update' | 'Department Circular'
  | 'BNS Update' | 'Court Directive' | 'Custom';

export interface PolicyPack {
  id:          string;
  version:     string;
  source:      PolicySource;
  title:       string;
  description: string;
  effectiveDate: string;
  ruleIds:     string[];
  active:      boolean;
  changelog:   string[];
}

export interface PolicyVersionReport {
  generatedAt:  string;
  activePacks:  PolicyPack[];
  allPacks:     PolicyPack[];
  latestVersion:string;
  totalRules:   number;
  enabledRules: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Natural Language Investigation
// ═══════════════════════════════════════════════════════════════════════════════

export interface NLInvestigationAnswer {
  question:     string;
  answer:       string;
  structured:   NLStructuredData[];
  confidence:   number;
  sources:      string[];
  followUps:    string[];
  relatedRules: string[];
}

export interface NLStructuredData {
  label: string;
  value: string | number;
  unit?: string;
  flag?:  'ok' | 'warning' | 'critical';
}

export interface NLInvestigationReport {
  generatedAt: string;
  firId?:      string;
  answers:     NLInvestigationAnswer[];
  suggestedQuestions: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Explainable AI (L7 enhanced)
// ═══════════════════════════════════════════════════════════════════════════════

export interface L7ExplainableRec {
  id:              string;
  title:           string;
  reason:          string;
  evidenceUsed:    string[];
  rulesApplied:    string[];
  dependencies:    string[];
  confidence:      number;
  alternatives:    L7Alternative[];
  expectedOutcome: string;
  riskIfIgnored:   string;
  legalBasis:      string;
  module:          L7ModuleId;
}

export interface L7Alternative {
  title:       string;
  description: string;
  tradeoff:    string;
  confidence:  number;
}

export interface L7ExplainableReport {
  generatedAt:     string;
  firId?:          string;
  recommendations: L7ExplainableRec[];
  topPriority:     L7ExplainableRec | null;
  blackBoxRisk:    string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Investigation Quality Index
// ═══════════════════════════════════════════════════════════════════════════════

export interface QualityDimension {
  id:          string;
  label:       string;
  score:       number;     // 0–100
  grade:       L7Grade;
  trend:       'up' | 'down' | 'stable';
  issues:      string[];
  suggestions: string[];
}

export interface QualityIndexReport {
  generatedAt:         string;
  firId?:              string;
  investigationScore:  number;
  evidenceScore:       number;
  complianceScore:     number;
  documentationScore:  number;
  timelineScore:       number;
  courtReadinessScore: number;
  chargeSheetScore:    number;
  riskScore:           number;
  overallScore:        number;
  overallGrade:        L7Grade;
  trend:               'improving' | 'declining' | 'stable';
  dimensions:          QualityDimension[];
  criticalIssues:      string[];
  keyStrengths:        string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Supervisor Intelligence
// ═══════════════════════════════════════════════════════════════════════════════

export interface OfficerLoad {
  officerId:     string;
  officerName:   string;
  totalFIRs:     number;
  pendingFIRs:   number;
  criticalFIRs:  number;
  overdueFIRs:   number;
  qualityGrade:  L7Grade;
}

export interface DelayAnalysis {
  category:    string;
  avgDays:     number;
  maxDays:     number;
  affectedFIRs:number;
  root:        string;
}

export interface CrimeTrend {
  crimeType:   string;
  count:       number;
  trend:       'rising' | 'stable' | 'falling';
  pct:         number;
}

export interface SupervisorIntelligenceReport {
  generatedAt:       string;
  stationName?:      string;
  totalFIRs:         number;
  pendingFIRs:       number;
  criticalFIRs:      number;
  overdueCount:      number;
  avgQualityScore:   number;
  officerLoads:      OfficerLoad[];
  delayAnalysis:     DelayAnalysis[];
  crimeTrends:       CrimeTrend[];
  complianceTrend:   'improving' | 'declining' | 'stable';
  alertItems:        string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. AI Learning Layer
// ═══════════════════════════════════════════════════════════════════════════════

export interface LearningInsight {
  type:        'law' | 'format' | 'knowledge' | 'question';
  item:        string;
  openCount:   number;
  relevance:   number; // 0–1
  boostReason: string;
}

export interface AILearningReport {
  generatedAt:     string;
  topLaws:         LearningInsight[];
  topFormats:      LearningInsight[];
  topKnowledge:    LearningInsight[];
  topQuestions:    LearningInsight[];
  improvementHints:string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Master Level-7 Report
// ═══════════════════════════════════════════════════════════════════════════════

export interface Level7IntelligenceReport {
  generatedAt:          string;
  firId?:               string;
  contextVersion:       number;
  processingMs:         number;

  ruleEngineReport:     RuleEngineReport;
  scenarioReport:       ScenarioSimulatorReport;
  evidenceReport:       EvidenceStrengthReport;
  chargeSheetReport:    ChargeSheetValidatorReport;
  courtReadinessReport: CourtReadinessReport;
  knowledgeGraphReport: KnowledgeGraphReport;
  policyReport:         PolicyVersionReport;
  nlReport:             NLInvestigationReport;
  explainableReport:    L7ExplainableReport;
  qualityReport:        QualityIndexReport;
  supervisorReport?:    SupervisorIntelligenceReport;
  learningReport:       AILearningReport;

  engineErrors:         Record<string, string>;
}

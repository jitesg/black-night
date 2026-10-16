/**
 * AICopilotService.ts
 * Main orchestrator for the AI Investigation Copilot.
 *
 * Design principles:
 * - Read-only: NEVER writes to any repository
 * - Context-first: builds complete InvestigationContext before every response
 * - Offline-first: local reasoning when service unavailable
 * - Modular: tools loaded via AIToolRegistry
 * - Safe: all drafts require explicit user confirmation before saving
 */

import { AIContextBuilder } from './AIContextBuilder';
import { InvestigationContextBuilder } from './InvestigationContextBuilder';
import { AIConversationMemory } from './AIConversationMemory';
import { AIToolRegistry } from './AIToolRegistry';
import { AIResponseFormatter } from './AIResponseFormatter';
import { NextActionEngine } from './NextActionEngine';
import { ReasoningEngine } from './reasoning/ReasoningEngine';
import { InvestigationIntelligenceEngine } from './intelligence/InvestigationIntelligenceEngine';
import { AIProviderManager } from './level5/AIProviderManager';
import type { ReasoningReport } from './reasoning/ReasoningTypes';
import type { InvestigationIntelligenceReport } from './intelligence/IntelligenceTypes';
import {
  detectIntent,
  quickActionToIntent,
  buildToolPlan,
  buildOfflineResponse,
  type Intent,
} from './AIPromptEngine';
import type {
  AIMessage,
  AIResponse,
  AIToolCall,
  AIToolName,
  AIDraft,
  QuickActionId,
  QuickAction,
  AIContextSnapshot,
} from './AITypes';
import type { InvestigationContext } from './InvestigationContext';

// ── Level-7 imports ───────────────────────────────────────────────────────────
import { InvestigationIntelligenceOrchestratorV4 } from './level7/InvestigationIntelligenceOrchestratorV4';
import { L7PerformanceLayer }                       from './level7/L7PerformanceLayer';
import type { Level7IntelligenceReport }            from './level7/L7Types';

// ── Level-5 imports ───────────────────────────────────────────────────────────
import { InvestigationIntelligenceOrchestratorV2 } from './level5/InvestigationIntelligenceOrchestratorV2';
import { NaturalLanguageQueryEngine } from './level5/NaturalLanguageQueryEngine';
import { AIAuditEngine } from './level5/AIAuditEngine';
import type { Level5IntelligenceReport, NLQResult } from './level5/L5Types';

// ── Level-6 imports ───────────────────────────────────────────────────────────
import { InvestigationIntelligenceOrchestratorV3 } from './level6/InvestigationIntelligenceOrchestratorV3';
import type { Level6IntelligenceReport } from './level6/L6Types';

// ── Quick action definitions ──────────────────────────────────────────────────

function buildConciseContextSummary(
  ctx: InvestigationContext,
  toolResults: Map<AIToolName, unknown>
): string {
  const lines: string[] = [];
  if (ctx.fir) {
    const f = ctx.fir;
    lines.push(`FIR No: ${f.fir_number ?? 'N/A'}, Section: ${f.section ?? 'N/A'}, Crime: ${f.crime_type ?? 'N/A'}, Status: ${f.status ?? 'Pending'}`);
    if (f.date_of_occurrence) lines.push(`Date of Occurrence: ${f.date_of_occurrence}`);
  } else {
    lines.push('No active FIR selected.');
  }

  if (ctx.caseHealth) {
    lines.push(`Case Health: ${ctx.caseHealth.score}/100 (${ctx.caseHealth.label}), Pending Items: ${ctx.caseHealth.pendingItems}, Critical: ${ctx.caseHealth.criticalItems}`);
  }

  if (ctx.nextActions && ctx.nextActions.length > 0) {
    const topActions = ctx.nextActions.slice(0, 4).map((a) => `[${a.priority.toUpperCase()}] ${a.title}`).join('; ');
    lines.push(`Next Actions: ${topActions}`);
  }

  if (ctx.overdueItems && ctx.overdueItems.length > 0) {
    const overdue = ctx.overdueItems.slice(0, 3).map((o) => o.title).join('; ');
    lines.push(`Overdue: ${overdue}`);
  }

  if (toolResults.size > 0) {
    const executed = Array.from(toolResults.entries()).map(([k, v]) => {
      const summary = typeof v === 'object' && v !== null ? JSON.stringify(v).slice(0, 100) : String(v).slice(0, 100);
      return `${k}: ${summary}`;
    }).join(' | ');
    lines.push(`Tool Results: ${executed}`);
  }

  return lines.join('\n').slice(0, 3000);
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'ask',               label: 'Ask Anything',       prompt: 'How can you help me?',                             icon: 'MessageCircle'  },
  { id: 'next-step',         label: 'Next Step',          prompt: 'What should I do next in this investigation?',     icon: 'ArrowRight'     },
  { id: 'draft-case-diary',  label: 'Draft Case Diary',   prompt: 'Draft a Case Diary for the current FIR.',          icon: 'BookOpen'       },
  { id: 'draft-gd',          label: 'Draft GD',           prompt: 'Draft a General Diary entry.',                     icon: 'FileText'       },
  { id: 'draft-notice',      label: 'Draft Notice',       prompt: 'Draft a notice for the current case.',             icon: 'Bell'           },
  { id: 'draft-court-report',label: 'Court Report',       prompt: 'Draft a court report for this case.',             icon: 'Gavel'          },
  { id: 'checklist',         label: 'Checklist',          prompt: 'Show the investigation checklist.',                icon: 'CheckSquare'    },
  { id: 'timeline',          label: 'Timeline',           prompt: 'Show the investigation timeline.',                 icon: 'Clock'          },
  { id: 'evidence-summary',  label: 'Evidence',           prompt: 'Summarise all evidence collected so far.',         icon: 'Search'         },
  { id: 'witness-comparison',label: 'Witnesses',          prompt: 'Compare witness statements for this case.',        icon: 'Users'          },
  { id: 'smart-search',      label: 'Smart Search',       prompt: 'Search across all modules.',                       icon: 'SearchIcon'     },
  { id: 'analytics',         label: 'Analytics',          prompt: 'Show investigation analytics and workload.',       icon: 'BarChart2'      },
  { id: 'pending-tasks',     label: 'Pending Tasks',      prompt: 'What are my pending investigation tasks?',         icon: 'ListTodo'       },
  { id: 'recent-activity',   label: 'Recent Activity',    prompt: 'Show my recent investigation activity.',          icon: 'Activity'       },
  // ── Level-5 quick actions ──────────────────────────────────────────────────
  { id: 'l5-memory',         label: 'Memory',             prompt: 'Show investigation memory for this FIR.',          icon: 'Clock'          },
  { id: 'l5-predict',        label: 'Predict Risks',      prompt: 'Predict future investigation risks.',              icon: 'AlertTriangle'  },
  { id: 'l5-draft',          label: 'Generate Draft',     prompt: 'Generate an investigation draft document.',        icon: 'FileText'       },
  { id: 'l5-graph',          label: 'Knowledge Graph',    prompt: 'Show investigation knowledge graph.',              icon: 'Network'        },
  { id: 'l5-search',         label: 'NL Search',          prompt: 'Search investigations using natural language.',    icon: 'Search'         },
  { id: 'l5-station',        label: 'Station View',       prompt: 'Show station-wide FIR intelligence.',              icon: 'BarChart2'      },
  { id: 'l5-audit',          label: 'Audit Log',          prompt: 'Show AI activity audit log.',                      icon: 'ClipboardList'  },
  // ── Level-6 quick actions ──────────────────────────────────────────────────
  { id: 'l6-readiness',      label: 'Readiness',          prompt: 'Show investigation readiness dashboard.',          icon: 'LayoutDashboard' },
  { id: 'l6-heatmap',        label: 'Risk Heatmap',       prompt: 'Show risk heatmap for this investigation.',        icon: 'Flame'           },
  { id: 'l6-timeline',       label: 'Timeline Replay',    prompt: 'Replay investigation timeline.',                   icon: 'GitBranch'       },
  { id: 'l6-reminders',      label: 'Reminders',          prompt: 'Show smart investigation reminders.',              icon: 'BellRing'        },
  { id: 'l6-dependency',     label: 'Dependencies',       prompt: 'Show investigation dependency graph.',             icon: 'GitMerge'        },
  { id: 'l6-decision',       label: 'Decision Assist',    prompt: 'Show officer decision assistant.',                 icon: 'ShieldCheck'     },
  { id: 'l6-supervisor',     label: 'Supervisor View',    prompt: 'Show station-level supervisor intelligence.',      icon: 'Building2'       },
  { id: 'l6-multifir',       label: 'Multi-FIR Links',    prompt: 'Show cross-FIR intelligence links.',               icon: 'Link'            },
  // ── Level-7 quick actions ──────────────────────────────────────────────────
  { id: 'l7-quality',        label: 'Quality Index',      prompt: 'Show investigation quality index.',                icon: 'Star'            },
  { id: 'l7-evidence',       label: 'Evidence Strength',  prompt: 'Evaluate evidence strength for each allegation.',  icon: 'Shield'          },
  { id: 'l7-chargesheet',    label: 'Charge Sheet',       prompt: 'Validate charge sheet readiness.',                 icon: 'FileCheck'       },
  { id: 'l7-court',          label: 'Court Readiness',    prompt: 'Check court readiness and next hearing.',          icon: 'Gavel'           },
  { id: 'l7-scenario',       label: 'Scenarios',          prompt: 'Simulate investigation scenarios.',                icon: 'GitBranch'       },
  { id: 'l7-rules',          label: 'Rule Explorer',      prompt: 'Explore applicable legal rules.',                  icon: 'BookOpen'        },
  { id: 'l7-graph',          label: 'Knowledge Graph',    prompt: 'Show investigation knowledge graph.',              icon: 'Network'         },
  { id: 'l7-supervisor',     label: 'Station Intel',      prompt: 'Show station-level supervisor intelligence.',      icon: 'Building2'       },
];

// ── Service ───────────────────────────────────────────────────────────────────

export class AICopilotService {
  private memory: AIConversationMemory;
  /** Cached InvestigationContext — rebuilt when activeFirId changes */
  private cachedCtx?: InvestigationContext;
  private ctxFirId?: string;
  /** Cached ReasoningReport — rebuilt when activeFirId changes */
  private cachedReasoning?: ReasoningReport;
  /** Cached IntelligenceReport — rebuilt when activeFirId changes */
  private cachedIntelligence?: InvestigationIntelligenceReport;

  constructor(memory: AIConversationMemory) {
    this.memory = memory;
  }

  /** Factory: creates a new service with a fresh session. */
  static async create(activeFirId?: string): Promise<AICopilotService> {
    const snapshot = await AIContextBuilder.buildSnapshot(activeFirId);
    const memory = new AIConversationMemory(snapshot);
    return new AICopilotService(memory);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getMemory(): AIConversationMemory { return this.memory; }
  getContext(): AIContextSnapshot   { return this.memory.getContext(); }

  /**
   * Run the full ReasoningEngine pipeline for the given FIR.
   * Returns a ReasoningReport with all findings, risks, decision cards, and health.
   * Caches result — re-runs only when FIR changes.
   */
  async runReasoning(firId?: string): Promise<ReasoningReport> {
    const ctx = await this._getInvestigationContext(firId);
    if (!this.cachedReasoning || this.ctxFirId !== firId) {
      this.cachedReasoning = ReasoningEngine.run(ctx, this.memory.getContext().sessionId ?? 'session');
    }
    return this.cachedReasoning;
  }

  /**
   * Run the full Level-4 InvestigationIntelligenceEngine for the given FIR.
   * Executes all 11 engines in parallel. Caches result per FIR.
   * Advisory only — never writes any data.
   */
  async runIntelligence(firId?: string): Promise<InvestigationIntelligenceReport> {
    const ctx = await this._getInvestigationContext(firId);
    if (!this.cachedIntelligence || this.ctxFirId !== firId) {
      const sessionId = this.memory.getContext().sessionId ?? 'session';
      this.cachedIntelligence = await InvestigationIntelligenceEngine.generate(ctx, sessionId);
    }
    return this.cachedIntelligence;
  }

  /** Cached Level-5 report — rebuilt when activeFirId changes */
  private cachedLevel5?: Level5IntelligenceReport;
  /** Cached Level-6 report — rebuilt when activeFirId changes */
  private cachedLevel6?: Level6IntelligenceReport;
  /** Cached Level-7 report — smart-cached by L7PerformanceLayer */
  private cachedLevel7?: Level7IntelligenceReport;

  /** Invalidate all caches (e.g. after data changes detected by ContinuousMonitor) */
  invalidateCache(): void {
    // Capture firId BEFORE clearing it — L7PerformanceLayer needs it to
    // evict the correct cache entry. Previously ctxFirId was set to undefined
    // on line 172 so the guard on line 174 could never be true (dead branch).
    const prevFirId = this.ctxFirId;
    this.cachedCtx = undefined;
    this.cachedReasoning = undefined;
    this.cachedIntelligence = undefined;
    this.cachedLevel5 = undefined;
    this.cachedLevel6 = undefined;
    this.cachedLevel7 = undefined;
    this.ctxFirId = undefined;
    InvestigationIntelligenceOrchestratorV3.invalidate();
    if (prevFirId) L7PerformanceLayer.invalidate(prevFirId);
  }

  /**
   * Run the Level-5 Orchestrator: memory, predictive, graph, audit, multi-FIR.
   * Results are cached per FIR.
   * allContexts is optional (needed for Multi-FIR station view).
   */
  async runLevel5(
    firId?: string,
    allContexts?: InvestigationContext[],
    stationName?: string
  ): Promise<Level5IntelligenceReport> {
    const ctx = await this._getInvestigationContext(firId);
    if (!this.cachedLevel5 || this.ctxFirId !== firId) {
      this.cachedLevel5 = await InvestigationIntelligenceOrchestratorV2.run(
        ctx, allContexts, stationName
      );
    }
    return this.cachedLevel5;
  }

  /**
   * Natural Language Query across multiple FIR contexts.
   * Contexts are pre-loaded by caller. Engine is pure local — no DB access.
   *
   * Architecture note: This method deliberately uses the Level-5
   * NaturalLanguageQueryEngine for cross-FIR queries (station-wide search).
   * The Level-7 NLInvestigationEngine (NLInvestigationEngine.generateReport)
   * is a single-FIR structured-question-answer engine called by the L7
   * Orchestrator as part of the full Level-7 analysis pipeline (runLevel7).
   * Both are used; they serve different scopes and are not duplicates.
   */
  async runNLQuery(query: string, contexts: InvestigationContext[]): Promise<NLQResult> {
    return NaturalLanguageQueryEngine.query(query, contexts);
  }

  /**
   * Run the Level-6 Orchestrator: 14 engines in parallel.
   * Results are cached per FIR. Advisory only — never writes.
   */
  async runLevel6(
    firId?: string,
    allContexts?: InvestigationContext[],
    stationName?: string
  ): Promise<Level6IntelligenceReport> {
    const ctx = await this._getInvestigationContext(firId);
    if (!this.cachedLevel6 || this.ctxFirId !== firId) {
      const sid = this.memory.getContext().sessionId ?? 'session';
      this.cachedLevel6 = await InvestigationIntelligenceOrchestratorV3.run(
        ctx, allContexts, stationName, sid
      );
    }
    return this.cachedLevel6;
  }

  /**
   * Run the Level-7 Orchestrator: 12 engines in parallel.
   * Smart-cached by L7PerformanceLayer — returns cache hit when context unchanged.
   * Advisory only — never writes any data.
   */
  async runLevel7(
    firId?: string,
    opts?: {
      supervisorContexts?: InvestigationContext[];
      stationName?: string;
      forceRefresh?: boolean;
    },
  ): Promise<Level7IntelligenceReport> {
    const ctx = await this._getInvestigationContext(firId);
    if (!this.cachedLevel7 || this.ctxFirId !== firId || opts?.forceRefresh) {
      this.cachedLevel7 = await InvestigationIntelligenceOrchestratorV4.run(ctx, opts);
    }
    return this.cachedLevel7;
  }

  /** Record an officer action on a Level-5 recommendation (audit trail). */
  recordOfficerAction(entryId: string, action: 'accepted' | 'ignored' | 'rejected'): void {
    AIAuditEngine.updateAction(entryId, action);
  }

  /** Send a free-form user message. Returns an AI response. */
  async sendMessage(userMessage: string): Promise<AIResponse> {
    this.memory.addMessage({ role: 'user', content: userMessage });
    return this._execute(detectIntent(userMessage), userMessage);
  }

  /** Trigger a quick action chip. */
  async triggerQuickAction(actionId: QuickActionId): Promise<AIResponse> {
    const action = QUICK_ACTIONS.find((a) => a.id === actionId);
    const prompt = action?.prompt ?? actionId;
    this.memory.addMessage({ role: 'user', content: prompt });
    return this._execute(quickActionToIntent(actionId), prompt);
  }

  /** Smart search across all modules. */
  async smartSearch(query: string): Promise<AIResponse> {
    this.memory.addMessage({ role: 'user', content: `Search: ${query}` });
    return this._execute('search', query);
  }

  /**
   * Generate an Investigation Summary automatically for a freshly opened FIR.
   * Called by the modal on mount when activeFirId is present.
   * No user message is added — this is a system-initiated summary.
   */
  async generateFIRSummary(firId: string): Promise<AIResponse> {
    const ctx = await this._getInvestigationContext(firId);
    const report = NextActionEngine.analyze(ctx);
    const content = report.investigationSummary;
    const assistantMsg = this.memory.addMessage({ role: 'assistant', content });
    const missingNote = InvestigationContextBuilder.getMissingDataNote(ctx);
    const fullContent = content + missingNote;
    this.memory.updateMessage(assistantMsg.id, { content: fullContent });
    return AIResponseFormatter.format({
      content: fullContent,
      toolCalls: [],
      suggestedActions: ['Next Step', 'View Timeline', 'Check Health Score'],
    });
  }

  // ── Context management ─────────────────────────────────────────────────────

  private async _getInvestigationContext(firId?: string): Promise<InvestigationContext> {
    // Rebuild if firId changed or no cache
    if (!this.cachedCtx || this.ctxFirId !== firId) {
      this.cachedCtx = await InvestigationContextBuilder.build(firId);
      this.ctxFirId = firId;
      // Keep legacy snapshot in sync
      this.memory.updateContext({
        activeFirId: firId,
        activeFirNumber: this.cachedCtx.fir?.fir_number,
        timestamp: this.cachedCtx.builtAt,
      });
    }
    return this.cachedCtx;
  }

  // ── Core execution ─────────────────────────────────────────────────────────

  private async _execute(intent: Intent, message: string): Promise<AIResponse> {
    const assistantMsgId = this.memory.addMessage({
      role: 'assistant',
      content: '…',
      toolCalls: [],
    }).id;

    try {
      // Build complete InvestigationContext FIRST
      const ctx = await this._getInvestigationContext(
        this.memory.getContext().activeFirId
      );

      const plan = buildToolPlan(intent, ctx, message);
      const toolCalls: AIToolCall[] = [];
      const toolResults = new Map<AIToolName, unknown>();

      for (const step of plan.tools) {
        const tc: AIToolCall = { toolName: step.name as AIToolName, status: 'running', input: step.input };
        toolCalls.push(tc);
        this.memory.updateMessage(assistantMsgId, { toolCalls: [...toolCalls] });

        try {
          const result = await AIToolRegistry.execute(step.name as AIToolName, step.input);
          tc.status = 'done';
          tc.result = result;
          toolResults.set(step.name as AIToolName, result);
        } catch (toolErr) {
          tc.status = 'error';
          tc.error = String(toolErr);
        }
        this.memory.updateMessage(assistantMsgId, { toolCalls: [...toolCalls] });
      }

      const offlineResult = await buildOfflineResponse(
        intent, toolResults, ctx, message
      );
      let finalContent = offlineResult.content;
      const draft = offlineResult.draft;
      const suggestedActions = offlineResult.suggestedActions;

      let cloudAnswerUsed = false;
      if (AIProviderManager.hasOnlineProvider()) {
        try {
          const contextSummary = buildConciseContextSummary(ctx, toolResults);
          const cloudResponse = await AIProviderManager.execute({
            prompt: message,
            context: contextSummary,
            maxTokens: 700,
            module: 'nlq',
            requiresOnline: false,
          });
          if (cloudResponse.content && !cloudResponse.usedFallback) {
            finalContent = cloudResponse.content;
            cloudAnswerUsed = true;
          }
        } catch {
          // Silently keep the offline result already computed above.
        }
      }

      // Append missing-data note as before, using `finalContent` from
      // whichever source was used above.
      const missingNote = InvestigationContextBuilder.getMissingDataNote(ctx);
      const withMissingNote = finalContent.includes('Unavailable') ? finalContent : finalContent + missingNote;

      const response = AIResponseFormatter.format({
        content: withMissingNote, toolCalls, draft, suggestedActions,
        isOffline: !cloudAnswerUsed,
      });

      this.memory.updateMessage(assistantMsgId, {
        content: withMissingNote, toolCalls, draft, isOffline: !cloudAnswerUsed,
      });
      return response;
    } catch (err) {
      const errorMsg = String(err);
      const response = AIResponseFormatter.errorResponse(errorMsg, this.memory.isOffline());
      this.memory.updateMessage(assistantMsgId, { content: response.content, error: errorMsg });
      return response;
    }
  }
}

/**
 * AIPromptEngine.ts
 * Translates a user message + InvestigationContext into a tool plan and a
 * final AI response.
 *
 * Key upgrade: every response builder now receives the full InvestigationContext
 * (pre-built by InvestigationContextBuilder) instead of fetching data itself.
 * Context confidence gaps are surfaced in every response.
 */

import type { AIToolName, AIDraft, QuickActionId } from './AITypes';
import type { InvestigationContext, NextAction } from './InvestigationContext';
import { NextActionEngine } from './NextActionEngine';
import type { PendingTaskOutput } from './tools/PendingTaskTool';
import type { AnalyticsOutput } from './tools/AnalyticsTool';
import type { TimelineOutput } from './tools/TimelineTool';
import type { EvidenceSummary } from './tools/EvidenceTool';
import type { SearchLawOutput } from './tools/SearchLawTool';
import type { GetFIROutput } from './tools/GetFIRTool';
import { AIToolRegistry } from './AIToolRegistry';

// ── Intent detection ─────────────────────────────────────────────────────────

export type Intent =
  | 'draft-case-diary'
  | 'draft-gd'
  | 'draft-notice'
  | 'draft-court-report'
  | 'timeline'
  | 'evidence-summary'
  | 'witness-summary'
  | 'pending-tasks'
  | 'analytics'
  | 'next-step'
  | 'health-score'
  | 'case-readiness'
  | 'investigation-summary'
  | 'reasoning-report'
  | 'search-law'
  | 'search'
  | 'checklist'
  | 'recent-activity'
  | 'general';

const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: Intent }> = [
  { pattern: /case\s*diary|roznamcha|daily\s*diary/i,                           intent: 'draft-case-diary'      },
  { pattern: /\bgd\b|general\s*diary/i,                                         intent: 'draft-gd'              },
  { pattern: /notice|summons|NBW/i,                                             intent: 'draft-notice'          },
  { pattern: /court\s*report|nyayalay\s*report/i,                               intent: 'draft-court-report'    },
  { pattern: /timeline|chronolog|sequence|events/i,                             intent: 'timeline'              },
  { pattern: /evidence|proof|seizure|panchnama/i,                               intent: 'evidence-summary'      },
  { pattern: /witness|gavah|comparison/i,                                       intent: 'witness-summary'       },
  { pattern: /pending|incomplete|due|overdue|remaining/i,                       intent: 'pending-tasks'         },
  { pattern: /analytics|workload|statistics|stats|progress/i,                   intent: 'analytics'             },
  { pattern: /health\s*score|health/i,                                          intent: 'health-score'          },
  { pattern: /charge\s*sheet|readiness|ready/i,                                 intent: 'case-readiness'        },
  { pattern: /summary|overview|status\s*report/i,                               intent: 'investigation-summary' },
  { pattern: /reasoning|decision\s*support|analysis|risk|finding|compliance/i,  intent: 'reasoning-report'      },
  { pattern: /next\s*step|what\s*to\s*do|suggest|recommend/i,                   intent: 'next-step'             },
  { pattern: /\bbnss\b|\bipc\b|\bcrpc\b|section|law|legal|offence/i,           intent: 'search-law'            },
  { pattern: /search|find|look\s*for/i,                                         intent: 'search'                },
  { pattern: /checklist/i,                                                       intent: 'checklist'             },
  { pattern: /recent\s*activity|latest|last\s*action/i,                         intent: 'recent-activity'       },
];

export function detectIntent(message: string): Intent {
  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(message)) return intent;
  }
  return 'general';
}

export function quickActionToIntent(actionId: QuickActionId): Intent {
  const map: Record<QuickActionId, Intent> = {
    'ask':               'general',
    'next-step':         'next-step',
    'draft-case-diary':  'draft-case-diary',
    'draft-gd':          'draft-gd',
    'draft-notice':      'draft-notice',
    'draft-court-report':'draft-court-report',
    'checklist':         'checklist',
    'timeline':          'timeline',
    'evidence-summary':  'evidence-summary',
    'witness-comparison':'witness-summary',
    'smart-search':      'search',
    'analytics':         'analytics',
    'pending-tasks':     'pending-tasks',
    'recent-activity':   'recent-activity',
    // ── Level-5 quick actions map to 'general' intent (panels handle display)
    'l5-memory':         'general',
    'l5-predict':        'general',
    'l5-draft':          'general',
    'l5-graph':          'general',
    'l5-search':         'general',
    'l5-station':        'general',
    'l5-audit':          'general',
    // ── Level-6 quick actions map to 'general' intent (panels handle display)
    'l6-readiness':      'general',
    'l6-heatmap':        'general',
    'l6-timeline':       'general',
    'l6-reminders':      'general',
    'l6-dependency':     'general',
    'l6-decision':       'general',
    'l6-supervisor':     'general',
    'l6-multifir':       'general',
    // ── Level-7 quick actions map to 'general' intent (panels handle display)
    'l7-quality':        'general',
    'l7-evidence':       'general',
    'l7-chargesheet':    'general',
    'l7-court':          'general',
    'l7-scenario':       'general',
    'l7-rules':          'general',
    'l7-graph':          'general',
    'l7-supervisor':     'general',
  };
  return map[actionId] ?? 'general';
}

// ── Tool plan ─────────────────────────────────────────────────────────────────

export interface ToolPlan {
  tools: Array<{ name: AIToolName; input: Record<string, unknown> }>;
}

/**
 * Build a tool execution plan from intent + InvestigationContext.
 * Most intents no longer need tools — data already lives in the context.
 * Tools are only called when we need additional data not in ctx (e.g. law search).
 */
export function buildToolPlan(intent: Intent, ctx: InvestigationContext, message: string): ToolPlan {
  const firId = ctx.activeFirId;
  const firNumber = ctx.fir?.fir_number;

  switch (intent) {
    case 'draft-case-diary':
      return { tools: firId
        ? [{ name: 'GenerateDraftTool', input: { type: 'case-diary', firId, customContext: NextActionEngine.buildDraftContext(ctx) } }]
        : [{ name: 'GenerateDraftTool', input: { type: 'case-diary' } }]
      };
    case 'draft-gd':
      return { tools: [{ name: 'GenerateDraftTool', input: { type: 'gd', firId } }] };
    case 'draft-notice':
      return { tools: [{ name: 'GenerateDraftTool', input: { type: 'notice', firId } }] };
    case 'draft-court-report':
      return { tools: [{ name: 'GenerateDraftTool', input: { type: 'court-report', firId, customContext: NextActionEngine.buildDraftContext(ctx) } }] };
    case 'evidence-summary':
      return { tools: [{ name: 'GenerateDraftTool', input: { type: 'evidence-summary', firId } }] };
    case 'witness-summary':
      return { tools: [{ name: 'GenerateDraftTool', input: { type: 'witness-summary', firId } }] };
    case 'search-law':
      return { tools: [{ name: 'SearchLawTool', input: { query: message, limit: 6 } }] };
    case 'search':
      return { tools: [{ name: 'SearchLawTool', input: { query: message, limit: 4 } }, { name: 'GetFIRTool', input: { query: message, limit: 4 } }] };
    // These intents are fully served from InvestigationContext — no tool calls needed
    case 'timeline':
    case 'pending-tasks':
    case 'analytics':
    case 'health-score':
    case 'case-readiness':
    case 'investigation-summary':
    case 'next-step':
    case 'checklist':
    case 'recent-activity':
    case 'general':
    default:
      return { tools: [] };
  }
}

// ── Response builder — uses InvestigationContext as primary source ────────────

export async function buildOfflineResponse(
  intent: Intent,
  toolResults: Map<AIToolName, unknown>,
  ctx: InvestigationContext,
  message: string
): Promise<{ content: string; draft?: AIDraft; suggestedActions: string[] }> {
  const missing = ctx.confidence.missingFields.length > 0
    ? `\n\n_Note: Unavailable data — ${ctx.confidence.missingFields.slice(0, 3).join(', ')}._`
    : '';
  const header = `**${ctx.officer.policeStation}** | Officer: ${ctx.officer.name}${ctx.fir ? ` | FIR: ${ctx.fir.fir_number}` : ''}`;

  switch (intent) {

    // ── Reasoning Report (Decision Support Engine) ──────────────────────────
    case 'reasoning-report': {
      // The actual report is surfaced via ReasoningModal — here we return a
      // text summary so the chat thread also shows the analysis result.
      return {
        content: [
          `${header}`,
          `\n**Decision Support Analysis**`,
          `I have run a full investigation analysis. Tap **Analysis** in the header to view the complete Decision Support dashboard with:`,
          `\n• 🔴 Critical findings & rule violations`,
          `• 🟡 Pending compliance deadlines`,
          `• 📊 Investigation health score`,
          `• 🔗 Workflow dependency graph`,
          `• 💡 Recommended next steps`,
          `\n_All findings are advisory only. You remain the decision maker._`,
          missing,
        ].filter(Boolean).join('\n'),
        suggestedActions: ['Next Step', 'Check Health Score', 'View Timeline'],
      };
    }

    // ── Investigation Summary ───────────────────────────────────────────────
    case 'investigation-summary': {
      const report = NextActionEngine.analyze(ctx);
      return {
        content: report.investigationSummary + missing,
        suggestedActions: ['Next Step', 'View Timeline', 'Check Pending Tasks'],
      };
    }

    // ── Health Score ────────────────────────────────────────────────────────
    case 'health-score': {
      const h = ctx.caseHealth;
      return {
        content: [
          `${header}`,
          `\n**Investigation Health Score: ${h.score}/100 (Grade ${h.grade})**`,
          `_${h.label}_`,
          `\n✓ Completed: ${h.completedItems} | 🟡 Pending: ${h.pendingItems} | 🔴 Critical: ${h.criticalItems}`,
          h.missingEvidence.length > 0 ? `\n**Missing Evidence:** ${h.missingEvidence.join(', ')}` : '',
          h.pendingStatements.length > 0 ? `\n**Pending Statements:** ${h.pendingStatements.join(', ')}` : '',
          h.courtActionsRequired.length > 0 ? `\n**Court Action Required:** ${h.courtActionsRequired[0]}` : '',
          missing,
        ].filter(Boolean).join('\n'),
        suggestedActions: ['Next Step', 'Case Readiness', 'Draft Case Diary'],
      };
    }

    // ── Case Readiness ──────────────────────────────────────────────────────
    case 'case-readiness': {
      const readiness = NextActionEngine.assessReadiness(ctx);
      const lines: string[] = [
        `${header}`,
        `\n**Charge Sheet Readiness: ${readiness.readinessScore}%**`,
        readiness.readyForChargeSheet ? '✓ Investigation is ready for charge sheet.' : '⚠️ Not yet ready.',
        readiness.completedMilestones.length > 0 ? `\n✓ **Done:** ${readiness.completedMilestones.join(', ')}` : '',
        readiness.pendingMilestones.length > 0  ? `🟡 **Pending:** ${readiness.pendingMilestones.join(', ')}` : '',
        readiness.blockers.length > 0 ? `🔴 **Blockers (${readiness.blockers.length}):**\n${readiness.blockers.map((b) => `• ${b}`).join('\n')}` : '',
        missing,
      ];
      return {
        content: lines.filter(Boolean).join('\n'),
        suggestedActions: ['View Health Score', 'Next Step', 'Draft Case Diary'],
      };
    }

    // ── Next Step ───────────────────────────────────────────────────────────
    case 'next-step': {
      const report = NextActionEngine.analyze(ctx);
      if (!report.primaryAction) {
        return {
          content: `${header}\n\nAll investigation actions appear to be complete. Consider drafting the Charge Sheet Summary or Court Report.`,
          suggestedActions: ['Draft Court Report', 'Case Readiness', 'View Analytics'],
        };
      }
      const actLines = report.allActions
        .slice(0, 6)
        .map((a) => `${priorityIcon(a.priority)} **[${a.category.toUpperCase()}]** ${a.title}${a.daysRemaining !== undefined ? ` _(${a.daysRemaining < 0 ? Math.abs(a.daysRemaining) + 'd overdue' : a.daysRemaining + 'd remaining'})_` : ''}`)
        .join('\n');
      return {
        content: `${header}\n\n**Recommended Next Steps:**\n\n${actLines}${missing}`,
        suggestedActions: ['Draft Case Diary', 'View Timeline', 'Check Health Score'],
      };
    }

    // ── Pending Tasks ───────────────────────────────────────────────────────
    case 'pending-tasks': {
      const toolResult = toolResults.get('PendingTaskTool') as PendingTaskOutput | undefined;
      // Prefer live tool data; fall back to nextActions from context
      if (toolResult && toolResult.tasks.length > 0) {
        const lines = toolResult.tasks.slice(0, 8).map((t) =>
          `• **${t.module}**: ${t.title}${t.daysOverdue ? ` _(${t.daysOverdue}d overdue)_` : ''}`
        ).join('\n');
        return { content: `${header}\n\nFound **${toolResult.totalCount} pending task(s)**:\n\n${lines}${missing}`, suggestedActions: ['Draft Case Diary', 'View Timeline', 'Check Analytics'] };
      }
      const actions = ctx.nextActions.filter((a) => a.priority !== 'low').slice(0, 8);
      if (actions.length === 0) {
        return { content: 'No pending tasks found across all modules.', suggestedActions: ['Draft Case Diary', 'View Analytics', 'Check Timeline'] };
      }
      const lines = actions.map((a) => `${priorityIcon(a.priority)} **${a.title}**\n  ${a.description}`).join('\n\n');
      return { content: `${header}\n\n**${actions.length} Pending Task(s):**\n\n${lines}${missing}`, suggestedActions: ['Draft Case Diary', 'View Timeline', 'Check Analytics'] };
    }

    // ── Analytics ───────────────────────────────────────────────────────────
    case 'analytics': {
      const result = toolResults.get('AnalyticsTool') as AnalyticsOutput | undefined;
      const dash = ctx.analytics;
      const content = result
        ? `${header}\n\n**Investigation Overview**\n\n${result.summary}`
        : dash
          ? `${header}\n\n**Overview:** ${dash.mukadma?.total ?? 0} FIRs (${dash.mukadma?.pending ?? 0} pending), ${dash.gd?.total ?? 0} GD entries, ${dash.nyayalay?.overall?.pending ?? 0} court docs pending.`
          : `${header}\n\nAnalytics data not available offline.`;
      return { content: content + missing, suggestedActions: ['Check Pending Tasks', 'View Timeline', 'Smart Search'] };
    }

    // ── Timeline ────────────────────────────────────────────────────────────
    case 'timeline': {
      const events = ctx.timeline;
      if (events.length === 0) {
        return { content: ctx.fir ? `No timeline events found for FIR ${ctx.fir.fir_number}.` : 'Please open a FIR to view its timeline.', suggestedActions: ['Draft Case Diary', 'Check Pending Tasks'] };
      }
      const lines = events.slice(0, 12).map((e) =>
        `${e.isCritical ? '🔴' : e.isCompleted ? '✓' : '🟡'} **${e.date}**${e.time ? ` ${e.time}` : ''} — [${e.type}] ${e.title}`
      ).join('\n');
      return { content: `**Investigation Timeline — ${ctx.fir?.fir_number ?? 'All Cases'}**\n\n${lines}${missing}`, suggestedActions: ['Draft Case Diary', 'Evidence Summary', 'Next Step'] };
    }

    // ── Evidence Summary ────────────────────────────────────────────────────
    case 'evidence-summary': {
      const evResult = toolResults.get('EvidenceTool') as EvidenceSummary | undefined;
      const draft = toolResults.get('GenerateDraftTool') as AIDraft | undefined;
      const k = ctx.karyvahi;
      const summary = [
        `${header}`,
        evResult
          ? `\n**Evidence Summary — ${evResult.firNumber}**\nKaryvahi: ${evResult.karyvahiCount} total (${evResult.completedCount} done, ${evResult.pendingCount} pending)\nCase Diaries: ${evResult.caseDiaryCount}`
          : `\n**Evidence Status:** ${k.completed.length} actions done, ${k.pending.length} pending.`,
        ctx.caseHealth.missingEvidence.length > 0
          ? `\n🔴 **Missing Evidence:**\n${ctx.caseHealth.missingEvidence.map((e) => `• ${e}`).join('\n')}`
          : '',
        missing,
      ].filter(Boolean).join('\n');
      return { content: summary, draft, suggestedActions: ['View Timeline', 'Draft Court Report', 'Pending Tasks'] };
    }

    // ── Law Search ──────────────────────────────────────────────────────────
    case 'search-law': {
      const result = toolResults.get('SearchLawTool') as SearchLawOutput | undefined;
      if (!result || result.results.length === 0) {
        const knowledge = ctx.relevantKnowledge.slice(0, 4);
        if (knowledge.length > 0) {
          const lines = knowledge.map((k) => `• **${k.title}** _(${k.category})_\n  ${k.description.substring(0, 120)}`).join('\n\n');
          return { content: `**Knowledge Base Results for "${message}":**\n\n${lines}${missing}`, suggestedActions: ['Draft Notice', 'Draft Court Report', 'Ask Anything'] };
        }
        return { content: `No legal references found for "${message}".`, suggestedActions: ['Browse Knowledge', 'Draft Notice', 'Ask Anything'] };
      }
      const lines = result.results.map((r) => `• **${r.title}** _(${r.category})_\n  ${r.snippet}`).join('\n\n');
      return { content: `**Legal References (${result.count})**\n\n${lines}${missing}`, suggestedActions: ['Draft Notice', 'Draft Court Report', 'View Checklist'] };
    }

    // ── Checklist ───────────────────────────────────────────────────────────
    case 'checklist': {
      const k = ctx.karyvahi;
      if (k.all.length === 0) {
        return { content: 'Please open a FIR to view the investigation checklist.', suggestedActions: ['View Mukadma'] };
      }
      const lines = k.all.map((item) =>
        `${item.is_completed === 1 ? '✓' : '○'} ${item.name}`
      ).join('\n');
      return {
        content: `**Investigation Checklist** (${k.completed.length}/${k.all.length} done — ${k.completionPct}%)\n\n${lines}${missing}`,
        suggestedActions: ['Next Step', 'Draft Case Diary', 'View Timeline'],
      };
    }

    // ── Draft responses ─────────────────────────────────────────────────────
    case 'draft-case-diary':
    case 'draft-gd':
    case 'draft-notice':
    case 'draft-court-report':
    case 'witness-summary': {
      const draft = toolResults.get('GenerateDraftTool') as AIDraft | undefined;
      if (draft) {
        return { content: `Draft **${draft.title}** is ready for your review. Tap "Open in Editor" to edit and save.`, draft, suggestedActions: ['Open in Editor', 'View Timeline', 'Check Pending Tasks'] };
      }
      return { content: 'Draft generation requires case context. Please open a FIR first.', suggestedActions: ['View Mukadma', 'Ask Anything'] };
    }

    // ── Recent activity ─────────────────────────────────────────────────────
    case 'recent-activity': {
      const recentTimeline = ctx.timeline.slice(-6).reverse();
      if (recentTimeline.length === 0) {
        return { content: 'No recent activity recorded.', suggestedActions: ['View Analytics'] };
      }
      const lines = recentTimeline.map((e) => `• **${e.date}** [${e.type}] ${e.title}`).join('\n');
      return { content: `**Recent Investigation Activity:**\n\n${lines}${missing}`, suggestedActions: ['Draft Case Diary', 'Pending Tasks', 'View Timeline'] };
    }

    // ── Search ──────────────────────────────────────────────────────────────
    case 'search': {
      const lawResult = toolResults.get('SearchLawTool') as SearchLawOutput | undefined;
      const firResult = toolResults.get('GetFIRTool') as GetFIROutput | undefined;
      const parts: string[] = [`**Search results for "${message}":**\n`];
      if (firResult && firResult.count > 0) parts.push(`📁 **FIRs (${firResult.count}):** Found ${firResult.count} matching case(s).`);
      if (lawResult && lawResult.count > 0) parts.push(`📖 **Legal (${lawResult.count}):** ${lawResult.results[0]?.title}`);
      if (parts.length === 1) parts.push('No results found. Try a different keyword.');
      return { content: parts.join('\n') + missing, suggestedActions: ['Draft Notice', 'Ask Anything'] };
    }

    // ── General / catch-all ─────────────────────────────────────────────────
    default: {
      const firResult = toolResults.get('GetFIRTool') as GetFIROutput | undefined;
      const firSummary = firResult && firResult.count > 0 ? `I can see ${firResult.count} FIR(s) in the system.` : '';
      return {
        content: `${header}\n\nI am your AI Investigation Copilot. ${firSummary}\n\nI can help you with:\n• Drafting documents (Case Diary, GD, Notice, Court Reports)\n• Investigation timeline and evidence summary\n• Pending tasks and analytics\n• Legal knowledge search\n• Case health score and readiness\n\nWhat would you like to do?${missing}`,
        suggestedActions: ['Draft Case Diary', 'Check Pending Tasks', 'View Analytics'],
      };
    }
  }
}

// ── Priority icon helper ──────────────────────────────────────────────────────
function priorityIcon(priority: NextAction['priority']): string {
  return priority === 'critical' ? '🔴' : priority === 'high' ? '🟠' : priority === 'medium' ? '🟡' : '⚪';
}



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
import type { LawLookupOutput } from './tools/LawLookupTool';
import type { GetFIROutput } from './tools/GetFIRTool';
import { AIToolRegistry } from './AIToolRegistry';
import { detectFardType, checkFard } from './fard/fardChecker';
import { getFardEntry, getCommon } from '@/knowledge/fard/fardKb';
import {
  parseSectionRef,
  extractRefs,
  getSection,
  getOffenceClassification,
  getLinks,
} from '@/lib/law/lawLibrary';
import { getSimple } from '@/lib/law/simpleExplain';
import {
  getDetailedExplain,
  getAllDetailedExplainData,
  suggestSections,
  rankSectionSuggestions,
  type DetailedExplainEntry,
  type RankedSuggestionsResult,
} from '@/lib/law/detailedAnalysis';
import { getCasesForSection, type CaseLawItem } from '@/lib/law/casesData';
import { buildFIRLawSummary } from '@/lib/law/firLawSummary';
import {
  getOldLawForNew,
  getNewSectionsForOld,
  parseOldLawQuery,
  getLawMapData,
  type OldActId,
} from '@/lib/law/lawMapping';
import type { ActId } from '@/lib/law/lawLibrary';

import {
  isCircularLookupQuery,
  lookupCirculars,
} from './circularLookup';
import {
  isSopLookupQuery,
  lookupSop,
} from './sopLookup';

// ── Intent detection ─────────────────────────────────────────────────────────

export type Intent =
  | 'CIRCULAR_LOOKUP'
  | 'SOP_LOOKUP'
  | 'OLD_TO_NEW'
  | 'NEW_TO_OLD'
  | 'fard-advice'
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
  | 'suggest-sections'
  | 'law-lookup'
  | 'search-law'
  | 'search'
  | 'checklist'
  | 'recent-activity'
  | 'general';

const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: Intent }> = [
  { pattern: /फर्द|बरामदगी|जब्ती|तलाशी|पंचनामा|शनाख्त|सुपुर्दगी|\bfard\b/i,       intent: 'fard-advice'           },
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

export function detectOldLawFromQuery(query: string): { oldAct: OldActId; oldSec: string } | null {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim();

  // 1. Explicit mention of old act (IPC, CrPC, IEA)
  // e.g. "IPC 302 ab kya hai", "CrPC 154", "498a ipc", "section 420 ipc", "302 ipc", "crpc 41", "iea 65b"
  const explicit = /(?:section|sec|dhara|dhra|धारा)?\s*(?:(?:(IPC|CrPC|IEA)\s*[-.]?\s*(\d+[a-zA-Z]?))|(?:(\d+[a-zA-Z]?)\s*[-.]?\s*(IPC|CrPC|IEA)))/i.exec(q);
  if (explicit) {
    const rawAct = (explicit[1] || explicit[4]).toUpperCase();
    const rawSec = (explicit[2] || explicit[3]).toUpperCase();
    const oldAct: OldActId = rawAct === 'CRPC' ? 'CrPC' : (rawAct as OldActId);
    return { oldAct, oldSec: rawSec };
  }

  // 2. 65B certificate / 65b
  const ieaMatch = /\b65\s*[-.]?\s*b\b/i.exec(q);
  if (ieaMatch) {
    return { oldAct: 'IEA', oldSec: '65B' };
  }

  // 3. Question asking about new section / replacement / where is now for a number
  // e.g. "420 ka naya section", "420 ka naya section kya hai", "498A ki jagah kya", "498-a ki jagah", "41 ab kaun si dhara"
  const transitionKeywords = /(naya|naye|nayi|new|ab\s*kya|ab\s*kaun|ki\s*jagah|ab\s*kahan|kaun\s*si\s*dh[a|r]*a|konsi\s*dh[a|r]*a|badal|replace|equivalent)/i;
  if (transitionKeywords.test(q)) {
    const secMatch = q.match(/\b(\d+)\s*[-.]?\s*([a-zA-Z])?\b/);
    if (secMatch) {
      const num = `${secMatch[1]}${secMatch[2] ? secMatch[2].toUpperCase() : ''}`;
      const map = getLawMapData();
      if (map?.rev?.IPC?.[num]) return { oldAct: 'IPC', oldSec: num };
      if (map?.rev?.CrPC?.[num]) return { oldAct: 'CrPC', oldSec: num };
      if (map?.rev?.IEA?.[num]) return { oldAct: 'IEA', oldSec: num };
    }
  }

  return null;
}

export function detectNewToOldFromQuery(query: string): { act: ActId; n: number } | null {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim();

  const isOldQuestion = /(puran[a|i]|pehle|former|old|previous|earlier|kya\s*th[a|i]|kaun\s*si\s*th[a|i])/i.test(q);
  if (!isOldQuestion) return null;

  const m = q.match(/\b(BNS|BNSS|BSA)\s*[-.]?\s*(\d+[a-zA-Z]?)\b/i);
  const mReverse = q.match(/\b(\d+[a-zA-Z]?)\b\s*[-.]?\s*(BNS|BNSS|BSA)\b/i);

  const actStr = m ? m[1].toUpperCase() : (mReverse ? mReverse[2].toUpperCase() : null);
  const secStr = m ? m[2] : (mReverse ? mReverse[1] : null);

  if (actStr && secStr && (actStr === 'BNS' || actStr === 'BNSS' || actStr === 'BSA')) {
    const n = parseInt(secStr, 10);
    if (!isNaN(n)) {
      return { act: actStr as ActId, n };
    }
  }

  return null;
}

export function detectIntent(message: string): Intent {
  // 0. Check for DGP Circular lookup
  if (isCircularLookupQuery(message)) {
    return 'CIRCULAR_LOOKUP';
  }

  // 0b. Check for SOP lookup (Task L29)
  if (isSopLookupQuery(message)) {
    return 'SOP_LOOKUP';
  }

  // Check for NEW_TO_OLD intent (e.g. "BNS 103 ka purana number", "BNSS 173 pehle kya thi")
  if (detectNewToOldFromQuery(message)) {
    return 'NEW_TO_OLD';
  }

  // Check for OLD_TO_NEW intent (e.g. "IPC 302 ab kya hai", "420 ka naya section kya hai", "498A ki jagah kya", "CrPC 41 ab kaun si dhara", "65B certificate ab kahan")
  if (detectOldLawFromQuery(message)) {
    return 'OLD_TO_NEW';
  }

  const normMsg = message.toLowerCase().trim();

  // 1. Action chips & clarifying questions
  const isActionChip =
    /तत्व\s*जाँच|check\s*element|fir\s*में\s*क्या\s*लिखें|fir\s*me\s*kya\s*likh|साक्ष्य|evidence|मिलते[- ]जुलते\s*अपराध|similar\s*offence|निर्णय|case\s*law|और\s*सुझाव|more\s*suggestion|show\s*more|अगले\s*सुझाव/i.test(
      normMsg
    );
  if (isActionChip) {
    return 'suggest-sections';
  }

  // 2. Section suggestion explicit queries (including typos like 'dhra batao')
  const isSuggestPhrase =
    /kaun\s*si\s*dh[a|r]*a|konsi\s*dh[a|r]*a|dh[a|r]*a\s*suggest|section\s*suggest|fir\s*m[e|n]\s*kya\s*likh|dh[a|r]+a\s*batao|dhra\s*batao|section\s*batao|dhara\s*sujhav|dhra\s*sujhav|suggest\s*section/i.test(
      normMsg
    );

  // 3. Evidence-oriented queries for BSA provisions (e.g. 'whatsapp chat saboot', 'certificate 63', 'dying declaration')
  const isEvidenceQuery =
    /whatsapp.*(chat|saboot|evidence|certificate)|mobile.*(data|chat|saboot|evidence|certificate)|cctv.*(video|footage|saboot|evidence|certificate)|certificate\s*63|63\s*certificate|dying\s*declaration|mrityukalin\s*kathan|confession|iqbal|iqbalia|expert\s*opinion|visheshagya|hash\s*value|electronic\s*(record|evidence|saakshya)|digital\s*(record|evidence|saakshya)|section\s*63|saboot\s*ka\s*bojh|sabut\s*ka\s*bhar|burden\s*of\s*proof|gawah\s*ki\s*yogyata|competenc.*witness/i.test(
      normMsg
    );

  // 4. BNSS Procedural queries (e.g. 'zero FIR', 'arrest ke baad medical', 'tallashi me videography', 'chargesheet kab tak', 'remand', 'anticipatory bail')
  const isBnssProcedureQuery =
    /zero\s*fir|fir\s*kaise|fir.*mana|arrest.*medical|medical.*arrest|medical.*kab|aropi.*medical|tal+ash[ie].*search|search.*kaise|tal+ash[ie].*kaise|seizure|jabti|mahazar|videography|tal+ash[ie].*video|video.*tal+ash[ie]|remand|police\s*custody|14\s*din|15\s*din|60\s*din|90\s*din|charge\s*sheet|chargesheet|bail|jamanat|zamanat|anticipatory\s*bail|agrim\s*zamanat|pre\s*arrest\s*bail|gawah.*bayan|magistrate.*bayan|postmortem|mrityu\s*ki\s*jaanch|inquest|forensic|\b(farar|bhag\s*gaya)\b/i.test(
      normMsg
    );

  // 5. BNS Penal phrase hints (e.g. 'rape / balatkar', 'mahila ko chhedna', 'stalking / peecha', 'bachche ko bhagana / kidnap', 'chori ka maal kharidna', 'dhokhadhadi / cheating', 'jaali dastavez / forgery', 'jhoothi gawahi', 'milawat / adulteration', 'lapravahi se maut', 'gair-iradatan hatya', 'ghar me ghusna / trespass', 'trafficking', 'acid', 'gayab karke bech diya')
  const isBnsPhraseQuery =
    /rape|balatkar|chhedna|chhedchhad|molestation|stalking|peecha|kidnap|apaharan|vyapaharan|bachch.*(bhagana|kidnap|gayab)|chori\s*ka\s*maal|stolen\s*property|dhokhadhadi|cheating|dhokha|fraud|jaali\s*dastavez|forgery|farzi\s*dastavez|fake\s*document|jhoothi\s*gawahi|false\s*evidence|perjury|jhootha\s*saakshya|milawat|adulteration|lapravahi\s*se\s*maut|negligent\s*death|gair[- ]iradatan\s*hatya|culpable\s*homicide|ghar\s*me\s*ghusna|trespass|house[- ]breaking|sendhmari|trafficking|taskari|acid|tezaab|gayab\s*karke|bech\s*diya/i.test(
      normMsg
    );

  // 6. Incident crime descriptions (e.g. 'ek aadmi ne chaku se hamla kiya', 'mobile chheen liya', 'pati dahej ke liye marta hai', etc.)
  const isIncidentDescription =
    /hamla|attack|chaku|knife|chheen|snatch|loot|robbery|chori|theft|chura|dahej|dowry|marta|marpeet|pitai|hatya|murder|dhamki|threat|apaharan|kidnap|goli|firing|talwar|danda|dhokhadhadi|dhoka|fraud|cheating|rape|balatkar|chhedchhad|molestation|accident|zehar|poison|jalaya|burn|marne|maara|jhagda|vivad|lafda|kalesh|ladai|kuch\s*hua|incident|ghatna/i.test(
      normMsg
    );

  const parsedRef = parseSectionRef(message);
  const extracted = extractRefs(message);

  // If BNSS procedure, BNS penal phrase, BSA evidence, section suggestion phrase, or incident description (without explicit single section query like 'BNS 103')
  if (isBnssProcedureQuery || isBnsPhraseQuery || isEvidenceQuery || isSuggestPhrase || (isIncidentDescription && !parsedRef)) {
    return 'suggest-sections';
  }

  // 4. Check for explicit legal section references (e.g. BNS 103, धारा 35 BNSS, BSA 63)
  const hasLawLookupKeywords =
    /धारा|section|क्या\s*कहती\s*है|सज़ा|सजा|punishment|जमानती|bailable|गैर-जमानती|non-bailable|संज्ञेय|cognizable|असंज्ञेय|non-cognizable/i.test(
      message
    );

  if (parsedRef || extracted.length > 0 || hasLawLookupKeywords) {
    return 'law-lookup';
  }

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
    'find-section':      'law-lookup',
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
    case 'law-lookup': {
      const refs = extractRefs(message);
      const parsed = parseSectionRef(message);
      if (parsed && !refs.some((r) => r.act === parsed.act && r.n === parsed.n)) {
        refs.unshift(parsed);
      }
      if (refs.length > 0) {
        return {
          tools: [
            {
              name: 'LawLookupTool',
              input: {
                refs: refs.map((r) => `${r.act} ${r.n}${r.sub || ''}`),
                text: message,
              },
            },
          ],
        };
      }
      return {
        tools: [
          { name: 'LawLookupTool', input: { text: message } },
          { name: 'SearchLawTool', input: { query: message, limit: 5 } },
        ],
      };
    }
    case 'search-law':
      return { tools: [{ name: 'SearchLawTool', input: { query: message, limit: 6 } }] };
    case 'search':
      return { tools: [{ name: 'SearchLawTool', input: { query: message, limit: 4 } }, { name: 'GetFIRTool', input: { query: message, limit: 4 } }] };
    // These intents are fully served from InvestigationContext — no tool calls needed
    case 'OLD_TO_NEW':
    case 'NEW_TO_OLD':
    case 'suggest-sections':
    case 'fard-advice':
    case 'timeline':
    case 'pending-tasks':
    case 'analytics':
    case 'health-score':
    case 'case-readiness':
    case 'investigation-summary':
    case 'next-step':
    case 'checklist':
    case 'recent-activity':
      return { tools: [] };
    case 'general':
    default:
      return { tools: [{ name: 'SearchLawTool', input: { query: message, limit: 4 } }] };
  }
}

// ── Response builder — uses InvestigationContext as primary source ────────────

let lastSuggesterState: { query: string; result: RankedSuggestionsResult } | null = null;

export async function buildOfflineResponse(
  intent: Intent,
  toolResults: Map<AIToolName, unknown>,
  ctx: InvestigationContext,
  message: string
): Promise<{ content: string; draft?: AIDraft; suggestedActions: string[] }> {
  // Note is handled exclusively by InvestigationContextBuilder.getMissingDataNote
  // at the AICopilotService level to ensure strict single-note deduplication & filtering.
  const missing = '';
  const header = `**${ctx.officer.policeStation}** | Officer: ${ctx.officer.name}${ctx.fir ? ` | FIR: ${ctx.fir.fir_number}` : ''}`;

  switch (intent) {

    // ── DGP Circulars Lookup ─────────────────────────────────────────────────
    case 'CIRCULAR_LOOKUP': {
      const result = await lookupCirculars(message);
      return {
        content: result.content,
        suggestedActions: result.suggestedActions,
      };
    }

    // ── SOP Lookup (Task L29) ────────────────────────────────────────────────
    case 'SOP_LOOKUP': {
      const result = await lookupSop(message);
      return {
        content: result.content,
        suggestedActions: result.suggestedActions,
      };
    }

    // ── Old Law to New Law Mapping ──────────────────────────────────────────
    case 'OLD_TO_NEW': {
      const match = detectOldLawFromQuery(message);
      if (!match) {
        return {
          content:
            'पुराने कानून (IPC/CrPC/IEA) की धारा स्पष्ट नहीं हो सकी। कृपया धारा नंबर या अधिनियम स्पष्ट करें (उदा. IPC 302, 420 ka naya section, 65B certificate)।',
          suggestedActions: ['धारा खोलें', 'तत्व जाँचें', 'FIR में क्या लिखें'],
        };
      }

      const { oldAct, oldSec } = match;
      const targets = getNewSectionsForOld(oldAct, oldSec);

      if (targets.length === 0) {
        return {
          content: [
            `**धारा रूपांतरण: ${oldAct} ${oldSec}**\n`,
            `पुराने कानून **${oldAct} ${oldSec}** का नए आपराधिक कानूनों (BNS / BNSS / BSA) में कोई सीधा समकक्ष नहीं मिला। कृपया धारा संख्या की जाँच करें।\n`,
            `_सहायक सूचना — मिलान आधिकारिक तुलना-तालिकाओं से; वास्तविक पाठ अवश्य देखें।_`,
          ].join('\n'),
          suggestedActions: ['धारा खोलें', 'तत्व जाँचें', 'FIR में क्या लिखें'],
        };
      }

      const lines: string[] = [];
      const newSecNames = targets.map((t) => `${t.act} ${t.n}`).join(', ');

      lines.push(`**धारा रूपांतरण: ${oldAct} ${oldSec} → ${newSecNames}**\n`);

      if (targets.length > 1) {
        lines.push(
          `पुरानी धारा **${oldAct} ${oldSec}** नए कानून में **${targets.length} अलग-अलग धाराओं** में विभाजित/प्रावधानित है:\n`
        );
      }

      for (const t of targets) {
        const sec = getSection(t.act, t.n);
        const simple = getSimple(t.act, t.n);
        const summary = simple?.s ? `  _${simple.s}_\n` : '';
        lines.push(`• **${t.act} ${t.n}**: ${sec?.title || ''}\n${summary}👉 [धारा खोलें: ${t.act} ${t.n}]\n`);
      }

      if (targets.length > 1) {
        lines.push(`📌 **पहलू स्पष्ट करें**: आप मामले के किस पहलू के संबंध में प्रावधान देखना चाहते हैं?\n`);
      }

      lines.push(`_सहायक सूचना — मिलान आधिकारिक तुलना-तालिकाओं से; वास्तविक पाठ अवश्य देखें।_`);

      return {
        content: lines.join('\n'),
        suggestedActions: ['धारा खोलें', 'तत्व जाँचें', 'FIR में क्या लिखें'],
      };
    }

    // ── New Law to Old Law Mapping ──────────────────────────────────────────
    case 'NEW_TO_OLD': {
      const match = detectNewToOldFromQuery(message);
      if (!match) {
        return {
          content:
            'नए कानून (BNS/BNSS/BSA) की धारा स्पष्ट नहीं हो सकी। कृपया धारा नंबर या अधिनियम स्पष्ट करें (उदा. BNS 103 ka purana number, BNSS 173 pehle kya thi)।',
          suggestedActions: ['धारा खोलें', 'तत्व जाँचें', 'FIR में क्या लिखें'],
        };
      }

      const { act, n } = match;
      const sec = getSection(act, n);
      const simple = getSimple(act, n);
      const oldRef = getOldLawForNew(act, n);

      const lines: string[] = [];
      const summary = simple?.s ? `  _${simple.s}_\n` : '';

      if (oldRef.isNewProvision) {
        lines.push(`**धारा रूपांतरण: ${act} ${n} (नया प्रावधान)**\n`);
        lines.push(`• **${act} ${n}**: ${sec?.title || ''}\n${summary}`);
        lines.push(
          `यह धारा नए आपराधिक कानून का **नया प्रावधान** है। पुराने कानून (${oldRef.oldAct}) में इसका कोई सीधा पूर्ववर्ती प्रावधान नहीं था।\n`
        );
      } else {
        const oldList = oldRef.oldSections.map((s) => `${oldRef.oldAct} ${s}`).join(', ');
        lines.push(`**धारा रूपांतरण: ${act} ${n} → ${oldList}**\n`);
        lines.push(`• **${act} ${n}**: ${sec?.title || ''}\n${summary}`);
        lines.push(`**${act} ${n}** का पुराना समकक्ष प्रावधान **${oldList}** था।\n`);
      }

      lines.push(`👉 [धारा खोलें: ${act} ${n}]\n`);
      lines.push(`_सहायक सूचना — मिलान आधिकारिक तुलना-तालिकाओं से; वास्तविक पाठ अवश्य देखें।_`);

      return {
        content: lines.join('\n'),
        suggestedActions: ['धारा खोलें', 'तत्व जाँचें', 'FIR में क्या लिखें'],
      };
    }

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
      const firLawSummary = buildFIRLawSummary(ctx.fir);
      return {
        content: report.investigationSummary + firLawSummary + missing,
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

    // ── Fard Advice (Knowledge Base) ─────────────────────────────────────────
    case 'fard-advice': {
      const code = detectFardType(message) || 'BARAMADGI';
      const entry = getFardEntry(code);
      const common = getCommon();

      // If user provided a draft or memo text to check
      const checkResult = checkFard({ text: message, typeCode: code, fir: ctx.fir });
      const hasSampleText = message.length > 40 && (checkResult.found.length > 0 || /दिनांक|थाना|मु\.अ\.सं|अभियुक्त|बरामद|चाकू/i.test(message));

      const sections: string[] = [];

      if (entry) {
        sections.push(`### 📋 ${entry.name} (${entry.code})`);
        sections.push(`**कानूनी आधार:** ${entry.legal}`);
        sections.push(`**उद्देश्य:** ${entry.purpose}`);

        sections.push(`\n**ज़रूरी तत्व (क्या लिखें):**`);
        entry.essentials.forEach((item, idx) => {
          sections.push(`${idx + 1}. ${item}`);
        });

        if (common && common.essentials.length > 0) {
          sections.push(`\n**हर फर्द के अनिवार्य सामान्य तत्व:**`);
          common.essentials.slice(0, 5).forEach((item) => {
            sections.push(`• ${item}`);
          });
        }

        sections.push(`\n**बचने योग्य गलतियाँ:**`);
        entry.mistakes.slice(0, 3).forEach((m) => {
          sections.push(`⚠️ ${m}`);
        });

        if (entry.court && entry.court.length > 0) {
          sections.push(`\n**कोर्ट में बचाव पक्ष के सवाल:**`);
          entry.court.slice(0, 3).forEach((c) => {
            sections.push(`• ${c}`);
          });
        }
      }

      // If text has content being checked, return missing elements list
      if (hasSampleText && checkResult.type) {
        sections.push(`\n---\n**फर्द जाँच परिणाम (स्कोर: ${checkResult.score.found}/${checkResult.score.total}):**`);
        if (checkResult.missing.length > 0) {
          sections.push(`\n**छूटे हुए तत्व:**`);
          checkResult.missing.forEach((m) => {
            sections.push(`- ❌ **${m.label}**: ${m.tip || m.label}`);
          });
        } else {
          sections.push(`✓ सभी प्रमुख आवश्यक तत्व मौजूद हैं।`);
        }

        if (checkResult.warnings.length > 0) {
          sections.push(`\n**चेतावनी व सुझाव:**`);
          checkResult.warnings.forEach((w) => {
            sections.push(`- ⚠️ ${w.message}`);
          });
        }
      }

      return {
        content: sections.join('\n'),
        suggestedActions: [
          'फर्द ज्ञान पढ़ें',
          'Draft Case Diary',
          'Next Step',
        ],
      };
    }

    // ── Case Readiness ──────────────────────────────────────────────────────
    case 'case-readiness': {
      const readiness = NextActionEngine.assessReadiness(ctx);
      const firLawSummary = buildFIRLawSummary(ctx.fir);
      const lines: string[] = [
        `${header}`,
        `\n**Charge Sheet Readiness: ${readiness.readinessScore}%**`,
        readiness.readyForChargeSheet ? '✓ Investigation is ready for charge sheet.' : '⚠️ Not yet ready.',
        readiness.completedMilestones.length > 0 ? `\n✓ **Done:** ${readiness.completedMilestones.join(', ')}` : '',
        readiness.pendingMilestones.length > 0  ? `🟡 **Pending:** ${readiness.pendingMilestones.join(', ')}` : '',
        readiness.blockers.length > 0 ? `🔴 **Blockers (${readiness.blockers.length}):**\n${readiness.blockers.map((b) => `• ${b}`).join('\n')}` : '',
        firLawSummary,
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
      const firLawSummary = buildFIRLawSummary(ctx.fir);
      if (!report.primaryAction) {
        return {
          content: `${header}\n\nAll investigation actions appear to be complete. Consider drafting the Charge Sheet Summary or Court Report.${firLawSummary}`,
          suggestedActions: ['Draft Court Report', 'Case Readiness', 'View Analytics'],
        };
      }
      const actLines = report.allActions
        .slice(0, 6)
        .map((a) => `${priorityIcon(a.priority)} **[${a.category.toUpperCase()}]** ${a.title}${a.daysRemaining !== undefined ? ` _(${a.daysRemaining < 0 ? Math.abs(a.daysRemaining) + 'd overdue' : a.daysRemaining + 'd remaining'})_` : ''}`)
        .join('\n');
      return {
        content: `${header}\n\n**Recommended Next Steps:**\n\n${actLines}${firLawSummary}${missing}`,
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

    // ── Suggest Sections (FIR Section Suggester) ───────────────────────────
    case 'suggest-sections': {
      // 1. Check if user tapped a clarifying question chip from q[]
      const allDetailed = getAllDetailedExplainData();
      let matchedQuestion: { q: string; y: string; n: string; act: string; sec: number } | null = null;

      if (allDetailed) {
        for (const act of Object.keys(allDetailed)) {
          for (const [secStr, ent] of Object.entries(allDetailed[act] as Record<string, DetailedExplainEntry>)) {
            if (Array.isArray(ent.q)) {
              for (const qItem of ent.q) {
                if (
                  message.includes(qItem.q) ||
                  qItem.q.includes(message.trim()) ||
                  (message.length > 8 && qItem.q.slice(0, 15).includes(message.slice(0, 15)))
                ) {
                  matchedQuestion = { ...qItem, act, sec: parseInt(secStr, 10) };
                  break;
                }
              }
            }
            if (matchedQuestion) break;
          }
          if (matchedQuestion) break;
        }
      }

      if (matchedQuestion) {
        return {
          content: [
            `**स्पष्टीकरण सवाल:**`,
            `❓ ${matchedQuestion.q}`,
            '',
            `• **हाँ →** ${matchedQuestion.y}`,
            `• **नहीं →** ${matchedQuestion.n}`,
            '',
            `👉 [धारा खोलें: ${matchedQuestion.act} ${matchedQuestion.sec}]`,
            '',
            `_सहायक सामग्री — अंतिम निर्णय जाँच अधिकारी/न्यायालय का_`,
          ].join('\n'),
          suggestedActions: [
            `तत्व जाँचें (${matchedQuestion.act} ${matchedQuestion.sec})`,
            `FIR में क्या लिखें (${matchedQuestion.act} ${matchedQuestion.sec})`,
            `साक्ष्य (${matchedQuestion.act} ${matchedQuestion.sec})`,
            `मिलते-जुलते अपराध (${matchedQuestion.act} ${matchedQuestion.sec})`,
            `निर्णय (${matchedQuestion.act} ${matchedQuestion.sec})`,
            'Next Step',
          ],
        };
      }

      // 2. Check for action chips: तत्व जाँचें, FIR में क्या लिखें, साक्ष्य, मिलते-जुलते अपराध, निर्णय
      const parsedRef = parseSectionRef(message) || (extractRefs(message)[0]);
      let targetAct = parsedRef?.act || 'BNS';
      let targetNum = parsedRef?.n || 0;

      // If no explicit ref in message, attempt fallback from active FIR or search context
      if (!targetNum && ctx.fir?.section) {
        const firRef = parseSectionRef(ctx.fir.section) || extractRefs(ctx.fir.section)[0];
        if (firRef) {
          targetAct = firRef.act;
          targetNum = firRef.n;
        }
      }
      if (!targetNum) targetNum = 103; // fallback to BNS 103 if none found

      const targetEntry = getDetailedExplain(targetAct, targetNum);

      // (a) तत्व जाँचें (Check elements checklist)
      if (/तत्व\s*जाँच|check\s*element/i.test(message)) {
        if (targetEntry && targetEntry.el && targetEntry.el.length > 0) {
          const lines = [
            `### 📋 आवश्यक तत्व (Ingredients Checklist) — ${targetAct} ${targetNum}`,
            `**जाँच अधिकारी के लिए आवश्यक तत्व:**`,
            ...targetEntry.el.map((e, idx) => `[ ] ${idx + 1}. ${e}`),
            '',
            `👉 [धारा खोलें: ${targetAct} ${targetNum}]`,
            '',
            `_सहायक सामग्री — अंतिम निर्णय जाँच अधिकारी/न्यायालय का_`,
          ];
          return {
            content: lines.join('\n'),
            suggestedActions: [
              `FIR में क्या लिखें (${targetAct} ${targetNum})`,
              `साक्ष्य (${targetAct} ${targetNum})`,
              `मिलते-जुलते अपराध (${targetAct} ${targetNum})`,
              `निर्णय (${targetAct} ${targetNum})`,
              'Next Step',
            ],
          };
        }
      }

      // (b) FIR में क्या लिखें
      if (/fir\s*में\s*क्या\s*लिखें|fir\s*me\s*kya\s*likh/i.test(message)) {
        if (targetEntry && targetEntry.fir && targetEntry.fir.length > 0) {
          const lines = [
            `### 📝 FIR में क्या लिखें — ${targetAct} ${targetNum}`,
            `**प्राथमिकी दर्ज करते समय मुख्य बिंदु:**`,
            ...targetEntry.fir.map((f) => `• ${f}`),
            '',
            `👉 [धारा खोलें: ${targetAct} ${targetNum}]`,
            '',
            `_सहायक सामग्री — अंतिम निर्णय जाँच अधिकारी/न्यायालय का_`,
          ];
          return {
            content: lines.join('\n'),
            suggestedActions: [
              `तत्व जाँचें (${targetAct} ${targetNum})`,
              `साक्ष्य (${targetAct} ${targetNum})`,
              `मिलते-जुलते अपराध (${targetAct} ${targetNum})`,
              `निर्णय (${targetAct} ${targetNum})`,
              'Next Step',
            ],
          };
        }
      }

      // (c) साक्ष्य संकलन (Evidence)
      if (/साक्ष्य|evidence/i.test(message)) {
        if (targetEntry && targetEntry.ev && targetEntry.ev.length > 0) {
          const lines = [
            `### 🔍 साक्ष्य संकलन सूची — ${targetAct} ${targetNum}`,
            `**जाँच के दौरान एकत्र किए जाने वाले साक्ष्य:**`,
            ...targetEntry.ev.map((ev) => `• ${ev}`),
            '',
            `👉 [धारा खोलें: ${targetAct} ${targetNum}]`,
            '',
            `_सहायक सामग्री — अंतिम निर्णय जाँच अधिकारी/न्यायालय का_`,
          ];
          return {
            content: lines.join('\n'),
            suggestedActions: [
              `तत्व जाँचें (${targetAct} ${targetNum})`,
              `FIR में क्या लिखें (${targetAct} ${targetNum})`,
              `मिलते-जुलते अपराध (${targetAct} ${targetNum})`,
              `निर्णय (${targetAct} ${targetNum})`,
              'Next Step',
            ],
          };
        }
      }

      // (d) मिलते-जुलते अपराधों से फ़र्क़ (Differences)
      if (/मिलते[- ]जुलते\s*अपराध|similar\s*offence|फ़र्क़|difference/i.test(message)) {
        if (targetEntry && targetEntry.df && targetEntry.df.length > 0) {
          const lines = [
            `### ⚖️ मिलते-जुलते अपराधों से फ़र्क़ — ${targetAct} ${targetNum}`,
            ...targetEntry.df.map((d) => `• ${d}`),
            '',
            `👉 [धारा खोलें: ${targetAct} ${targetNum}]`,
            '',
            `_सहायक सामग्री — अंतिम निर्णय जाँच अधिकारी/न्यायालय का_`,
          ];
          return {
            content: lines.join('\n'),
            suggestedActions: [
              `तत्व जाँचें (${targetAct} ${targetNum})`,
              `FIR में क्या लिखें (${targetAct} ${targetNum})`,
              `साक्ष्य (${targetAct} ${targetNum})`,
              `निर्णय (${targetAct} ${targetNum})`,
              'Next Step',
            ],
          };
        }
      }

      // (e) निर्णय (Case Law)
      if (/निर्णय|case\s*law|फैसले/i.test(message)) {
        const caseList = getCasesForSection(targetAct, targetNum);
        if (caseList.length > 0) {
          const hasUnverified = caseList.some((c) => c.status === 'unverified');
          const lines = [
            `### ⚖️ महत्वपूर्ण निर्णय${hasUnverified ? '' : ' (Verified Case Law)'} — ${targetAct} ${targetNum}`,
            ...caseList.map((c) => {
              const isUnverified = c.status === 'unverified';
              const prefix = isUnverified ? '⚠ पूर्ण सत्यापित नहीं: ' : '';
              const citeLine = `• ${prefix}**${c.name}** (${c.court}, ${c.year}) · _${c.cite}_`;
              const warnLine = isUnverified && c.warn_hi ? `  ⚠️ _${c.warn_hi}_` : '';
              const heldLine = c.held_hi ? `  **निर्णय**: ${c.held_hi}` : '';
              const useLine = c.use_hi ? `  **जाँच में उपयोग**: ${c.use_hi}` : '';
              const quoteLine = c.quote ? `  _"${c.quote}"_` : '';
              const urlLine = c.url ? `  [स्रोत खोलें: ${c.url}]` : '';
              return [citeLine, warnLine, heldLine, useLine, quoteLine, urlLine].filter(Boolean).join('\n');
            }),
            '',
            `निर्णय का पूरा पाठ स्रोत पर देखें; यहाँ सार सहायक है।`,
            `_सहायक सामग्री — अंतिम निर्णय जाँच अधिकारी/न्यायालय का_`,
          ];
          return {
            content: lines.join('\n'),
            suggestedActions: [
              `तत्व जाँचें (${targetAct} ${targetNum})`,
              `FIR में क्या लिखें (${targetAct} ${targetNum})`,
              `साक्ष्य (${targetAct} ${targetNum})`,
              `मिलते-जुलते अपराध (${targetAct} ${targetNum})`,
              'Next Step',
            ],
          };
        }
      }

      // 3. Handle 'और सुझाव देखें' / 'more suggestions'
      if (/और\s*सुझाव|more\s*suggestion|अगले\s*सुझाव/i.test(message)) {
        if (lastSuggesterState && lastSuggesterState.result.secondary.length > 0) {
          const secondary = lastSuggesterState.result.secondary;
          const lines: string[] = [
            `**अतिरिक्त संभावित धाराएँ (${secondary.length} और सुझाव, अंतिम निर्णय IO का):**\n`,
          ];
          for (const s of secondary) {
            const ent = getDetailedExplain(s.act, s.n);
            const oneLineSummary = s.summary || ent?.s || s.title;
            lines.push(`• **${s.act} ${s.n}** — **${s.title}**`);
            if (s.relatedSection) {
              lines.push(`  _संबंधित: ${s.relatedSection}_`);
            }
            lines.push(`  **सार**: ${oneLineSummary}`);
            if (s.matchedKeywords.length > 0) {
              lines.push(`  मिलान: ${s.matchedKeywords.slice(0, 3).join(', ')}`);
            }
            lines.push(`  👉 [धारा खोलें: ${s.act} ${s.n}]`);
            lines.push('');
          }
          lines.push('_सहायक सामग्री — अंतिम निर्णय जाँच अधिकारी/न्यायालय का_');

          const topSec = secondary[0];
          return {
            content: lines.join('\n'),
            suggestedActions: [
              `तत्व जाँचें (${topSec.act} ${topSec.n})`,
              `FIR में क्या लिखें (${topSec.act} ${topSec.n})`,
              `साक्ष्य (${topSec.act} ${topSec.n})`,
              `निर्णय (${topSec.act} ${topSec.n})`,
              'Next Step',
            ],
          };
        }
      }

      // 4. Main Suggest Sections algorithm for incident / query
      const rankedResult = rankSectionSuggestions(message, (act, n) => getSection(act, n));
      lastSuggesterState = { query: message, result: rankedResult };

      if (rankedResult.isWeakQuery || rankedResult.primary.length === 0) {
        return {
          content:
            'कोई स्पष्ट धारा मेल नहीं खा सकी। कृपया घटना का और विवरण दें (जैसे: किसने किया, क्या हुआ, कहाँ हुआ, चोट/हथियार क्या था, संपत्ति क्या थी आदि)।',
          suggestedActions: rankedResult.weakDetailChips.length > 0
            ? rankedResult.weakDetailChips
            : ['किसने/किसके साथ', 'किस चीज़ से/हथियार', 'चोट/नुकसान/संपत्ति?'],
        };
      }

      const suggestions = rankedResult.primary;
      const top = suggestions[0];
      const topEntry = getDetailedExplain(top.act, top.n);

      const lines: string[] = [
        `**संभावित धाराएँ (सहायक सुझाव, अंतिम निर्णय IO का)**\n`,
      ];

      for (const s of suggestions) {
        const ent = getDetailedExplain(s.act, s.n);
        const oneLineSummary = s.summary || ent?.s || s.title;

        lines.push(`• **${s.act} ${s.n}** — **${s.title}**`);
        if (s.relatedSection) {
          lines.push(`  _संबंधित: ${s.relatedSection}_`);
        }
        lines.push(`  **सार**: ${oneLineSummary}`);
        if (s.matchedKeywords.length > 0) {
          lines.push(`  मिलान: ${s.matchedKeywords.slice(0, 3).join(', ')}`);
        }
        lines.push(`  👉 [धारा खोलें: ${s.act} ${s.n}]`);
        lines.push('');
      }

      lines.push('_सहायक सामग्री — अंतिम निर्णय जाँच अधिकारी/न्यायालय का_');

      // Quick-reply clarifying questions from top section's q[]
      const clarifyingChips: string[] = [];
      if (topEntry && Array.isArray(topEntry.q)) {
        for (const item of topEntry.q.slice(0, 3)) {
          clarifyingChips.push(item.q);
        }
      }

      if (/478|436|bailable.*(release|rihai|chhod|arrest)|(arrest|release|rihai).*(bailable|jamanat)/i.test(message)) {
        lines.push('\n💡 **परिपत्र संदर्भ**: जमानतीय अपराध में युवा/बिना इतिहास वाले अभियुक्त की बंधपत्र पर तत्काल रिहाई हेतु देखें **डीजी परिपत्र संख्या-11/2012** (BNSS धारा 478 / BNSS 192)।');
      }

      const actionChips: string[] = [];
      if (rankedResult.secondary.length > 0) {
        actionChips.push('और सुझाव देखें');
      }
      actionChips.push(
        ...clarifyingChips,
        `तत्व जाँचें (${top.act} ${top.n})`,
        `FIR में क्या लिखें (${top.act} ${top.n})`,
        `साक्ष्य (${top.act} ${top.n})`,
        `मिलते-जुलते अपराध (${top.act} ${top.n})`,
        `निर्णय (${top.act} ${top.n})`,
      );

      return {
        content: lines.join('\n'),
        suggestedActions: actionChips,
      };
    }

    // ── Law Lookup ──────────────────────────────────────────────────────────
    case 'law-lookup': {
      const lookupResult = toolResults.get('LawLookupTool') as LawLookupOutput | undefined;
      const searchResult = toolResults.get('SearchLawTool') as SearchLawOutput | undefined;

      const sections: Array<{
        label: string;
        act: 'BNS' | 'BNSS' | 'BSA';
        n: number;
        title: string;
        text: string;
        classification?: ReturnType<typeof getOffenceClassification>;
        links?: ReturnType<typeof getLinks>;
        simple_explanation?: ReturnType<typeof getSimple>;
        detailed_explanation?: ReturnType<typeof getDetailedExplain>;
        cases?: ReturnType<typeof getCasesForSection>;
      }> = lookupResult?.sections ? [...lookupResult.sections] : [];

      // If LawLookupTool had no direct matches, check if SearchLawTool retrieved legal hits
      if (sections.length === 0 && searchResult?.results) {
        for (const hit of searchResult.results) {
          if (hit.id.startsWith('law:')) {
            const parts = hit.id.split(':');
            const act = parts[1] as 'BNS' | 'BNSS' | 'BSA';
            const n = parseInt(parts[2], 10);
            if (act && !isNaN(n)) {
              const sec = getSection(act, n);
              if (sec) {
                sections.push({
                  label: `${act} ${n}`,
                  act,
                  n,
                  title: sec.title,
                  text: sec.text.slice(0, 1500),
                  classification: act === 'BNS' ? getOffenceClassification(n) : undefined,
                  links: hit.links ?? getLinks(act, n),
                  simple_explanation: hit.simple_explanation ?? getSimple(act, n),
                  detailed_explanation: getDetailedExplain(act, n),
                  cases: getCasesForSection(act, n),
                });
              }
            }
          }
        }
      }

      if (sections.length === 0) {
        return {
          content:
            'कोई धारा या कानूनी प्रावधान नहीं मिला। कृपया धारा संख्या या अधिनियम का नाम (उदा. BNS 103, धारा 35 BNSS, BSA 63) स्पष्ट करें।',
          suggestedActions: ['धारा खोजें / Find section', 'Ask Anything', 'Next Step'],
        };
      }

      const blocks: string[] = [];
      const followUpActions: string[] = [];

      for (const s of sections) {
        blocks.push(`### 📖 ${s.label} — ${s.title}`);
        const trimmed =
          s.text.length > 900
            ? `${s.text.slice(0, 900).trim()}\n…पूरा पाठ विधि पुस्तकालय में`
            : s.text.trim();
        blocks.push(trimmed);

        // 1. Classification (BNS)
        if (s.act === 'BNS' && s.classification && s.classification.length > 0) {
          const isMulti = s.classification.length > 1;
          const note = isMulti ? ' (कई उप-धाराएँ — सही उप-धारा चुनें)' : '';
          const clsLines: string[] = [`**प्रथम अनुसूची — अपराध वर्गीकरण${note}:**`];
          for (const c of s.classification) {
            clsLines.push(`• **धारा / उप-धारा**: ${c.sec}`);
            if (c.offence) clsLines.push(`  **अपराध**: ${c.offence}`);
            clsLines.push(`  **दंड**: ${c.punishment}`);
            clsLines.push(`  **संज्ञेय**: ${c.cognizable}`);
            clsLines.push(`  **जमानती**: ${c.bailable}`);
            clsLines.push(`  **विचारण न्यायालय**: ${c.court}`);
          }
          blocks.push(clsLines.join('\n'));
        }

        // 2. विस्तृत विश्लेषण (Quoting s, k, el strictly from library data without hallucination)
        const det = s.detailed_explanation ?? getDetailedExplain(s.act, s.n);
        if (det) {
          const detLines: string[] = [
            `**विस्तृत व्याख्या (सहायक — आधिकारिक नहीं):**`,
            `**सार**: ${det.s}`,
          ];
          if (Array.isArray(det.k) && det.k.length > 0) {
            detLines.push(`**मुख्य बिंदु:**`);
            for (const pt of det.k) {
              detLines.push(`• ${pt}`);
            }
          }
          if (Array.isArray(det.el) && det.el.length > 0) {
            detLines.push(`**आवश्यक तत्व (Checklist):**`);
            for (const elItem of det.el) {
              detLines.push(`[ ] ${elItem}`);
            }
          }
          blocks.push(detLines.join('\n'));

          // Add action chips for this section
          followUpActions.push(`तत्व जाँचें (${s.act} ${s.n})`);
          followUpActions.push(`FIR में क्या लिखें (${s.act} ${s.n})`);
          followUpActions.push(`साक्ष्य (${s.act} ${s.n})`);
          followUpActions.push(`मिलते-जुलते अपराध (${s.act} ${s.n})`);
          followUpActions.push(`निर्णय (${s.act} ${s.n})`);

          // Clarifying questions if present
          if (Array.isArray(det.q) && det.q.length > 0) {
            followUpActions.unshift(det.q[0].q);
          }
        } else {
          // Fallback to सरल व्याख्या if no detailed entry
          const sim = s.simple_explanation ?? getSimple(s.act, s.n);
          if (sim) {
            const simLines: string[] = ['**सरल व्याख्या (सहायक — आधिकारिक नहीं):**', `**सार**: ${sim.s}`];
            if (Array.isArray(sim.k) && sim.k.length > 0) {
              for (const pt of sim.k) {
                simLines.push(`• ${pt}`);
              }
            }
            blocks.push(simLines.join('\n'));
          }
        }

        // 3. संबंधित धाराएँ line (max 6, refs first then citedBy, cross-act first)
        const linksData = s.links ?? getLinks(s.act, s.n);
        const allItems: Array<{ act: string; n: number; title: string; isRef: boolean }> = [
          ...linksData.refs.map((r) => ({ ...r, isRef: true })),
          ...linksData.citedBy.map((c) => ({ ...c, isRef: false })),
        ];

        if (allItems.length > 0) {
          allItems.sort((a, b) => {
            // refs first, then citedBy
            if (a.isRef !== b.isRef) return a.isRef ? -1 : 1;
            // cross-act first
            const aCross = a.act !== s.act;
            const bCross = b.act !== s.act;
            if (aCross !== bCross) return aCross ? -1 : 1;
            return a.n - b.n;
          });

          const top6 = allItems.slice(0, 6);
          const formatted = top6.map((item) => {
            const cleanTitle = (item.title || '').trim();
            const short = cleanTitle.length > 0 && cleanTitle.length <= 25 ? ` (${cleanTitle})` : '';
            return `${item.act} ${item.n}${short}`;
          });

          blocks.push(`**संबंधित धाराएँ:** ${formatted.join(', ')}`);
        }

        blocks.push(`👉 [धारा खोलें: ${s.act} ${s.n}]`);
      }

      if (/478|436|bailable.*(release|rihai|chhod|arrest)|(arrest|release|rihai).*(bailable|jamanat)/i.test(message)) {
        blocks.push('💡 **परिपत्र संदर्भ**: जमानतीय अपराध में युवा/बिना इतिहास वाले अभियुक्त की बंधपत्र पर तत्काल रिहाई हेतु देखें **डीजी परिपत्र संख्या-11/2012** (BNSS धारा 478 / BNSS 192)।');
      }

      blocks.push('स्रोत: आधिकारिक गजट (अंग्रेज़ी पाठ). निर्णय से पहले मूल पाठ और सक्षम अधिकारी से सत्यापित करें।');
      blocks.push('_सहायक सामग्री — अंतिम निर्णय जाँच अधिकारी/न्यायालय का_');

      return {
        content: blocks.join('\n\n'),
        suggestedActions:
          followUpActions.length > 0
            ? followUpActions.slice(0, 6)
            : ['धारा खोजें / Find section', 'Draft Case Diary', 'Next Step'],
      };
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



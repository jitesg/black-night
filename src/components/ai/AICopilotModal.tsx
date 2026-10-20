/**
 * AICopilotModal.tsx
 * Full-screen AI Investigation Copilot modal.
 *
 * Safety: never saves data automatically. All drafts open in editor for review.
 * Memory: session-scoped only — clears when modal closes.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Send, Bot, Brain, Cpu } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { THEME } from '@/lib/theme';
import { generateUUID } from '@/lib/db/database';
import { openSection } from '@/lib/law/openLaw';
import type { ActId } from '@/lib/law/lawLibrary';

import { AICopilotService, QUICK_ACTIONS } from '@/ai/AICopilotService';
import { AIContextBuilder } from '@/ai/AIContextBuilder';
import { InvestigationContextBuilder } from '@/ai/InvestigationContextBuilder';
import { NextActionEngine } from '@/ai/NextActionEngine';
import { DraftGenerationEngine } from '@/ai/level5/DraftGenerationEngine';
import type { AIMessage, AIDraft, QuickActionId } from '@/ai/AITypes';
import type { InvestigationContext } from '@/ai/InvestigationContext';
import type { NextActionReport } from '@/ai/NextActionEngine';
import type { ReasoningReport } from '@/ai/reasoning/ReasoningTypes';
import type { InvestigationIntelligenceReport } from '@/ai/intelligence/IntelligenceTypes';
import type {
  Level5IntelligenceReport,
  NLQResult,
  GeneratedDraft,
  L5DraftType,
} from '@/ai/level5/L5Types';

import { AIMessageBubble } from './AIMessageBubble';
import { AIQuickChips } from './AIQuickChips';
import { AIContextBar } from './AIContextBar';
import { AISuggestedActions } from './AISuggestedActions';
import { AISuggestedPrompts } from './AISuggestedPrompts';
import { InvestigationSummaryCard } from './InvestigationSummaryCard';
import { InvestigationDashboard } from './InvestigationDashboard';
import { ReasoningModal } from './reasoning/ReasoningModal';
import { IntelligenceModal } from './intelligence/IntelligenceModal';

// ── Level-5 panel imports ─────────────────────────────────────────────────────
import { MemoryPanel }          from '../ai/level5/MemoryPanel';
import { PredictiveAlertsPanel } from '../ai/level5/PredictiveAlertsPanel';
import { MultiFIRPanel }         from '../ai/level5/MultiFIRPanel';
import { KnowledgeGraphView }    from '../ai/level5/KnowledgeGraphView';
import { NLSearchPanel }         from '../ai/level5/NLSearchPanel';
import { AuditLogPanel }         from '../ai/level5/AuditLogPanel';
import { DraftPreviewPanel }     from '../ai/level5/DraftPreviewPanel';

// ── Level-6 panel imports ─────────────────────────────────────────────────────
import { ReadinessDashboardPanel } from '../ai/level6/ReadinessDashboardPanel';
import { RiskHeatmapPanel }        from '../ai/level6/RiskHeatmapPanel';
import { TimelineReplayPanel }     from '../ai/level6/TimelineReplayPanel';
import { SmartReminderPanel }      from '../ai/level6/SmartReminderPanel';
import { DependencyGraphPanel }    from '../ai/level6/DependencyGraphPanel';
import { DecisionAssistantPanel }  from '../ai/level6/DecisionAssistantPanel';
import { SupervisorViewPanel }     from '../ai/level6/SupervisorViewPanel';
import { MultiFIRLinkerPanel }     from '../ai/level6/MultiFIRLinkerPanel';
import type { Level6IntelligenceReport } from '@/ai/level6/L6Types';

// ── Shared L6 panel shell ────────────────────────────────────────────────────
import { L6PanelShell } from '../ai/level6/L6PanelShell';

// ── Level-7 panel imports ─────────────────────────────────────────────────────
import { QualityIndexPanel }       from '../ai/level7/QualityIndexPanel';
import { EvidenceStrengthPanel }   from '../ai/level7/EvidenceStrengthPanel';
import { ChargeSheetPanel }        from '../ai/level7/ChargeSheetPanel';
import { CourtReadinessPanel }     from '../ai/level7/CourtReadinessPanel';
import { ScenarioPanel }           from '../ai/level7/ScenarioPanel';
import { RuleExplorerPanel }       from '../ai/level7/RuleExplorerPanel';
import { KnowledgeGraphPanel }     from '../ai/level7/KnowledgeGraphPanel';
import { SupervisorDashboardPanel }from '../ai/level7/SupervisorDashboardPanel';
import type { Level7IntelligenceReport } from '@/ai/level7/L7Types';

// Store draft for navigation hand-off
import { aiDraftStore } from '@/lib/ai/aiDraftStore';
import { useSettingsStore } from '@/hooks/useSettingsStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  activeFirId?: string;
  /** Sent automatically once when the modal opens (e.g. "पैरा 97 …"). */
  initialQuery?: string;
}

export function AICopilotModal({ visible, onClose, activeFirId, initialQuery }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  const router = useRouter();
  const listRef = useRef<FlatList<AIMessage>>(null);
  const { settings } = useSettingsStore();

  const [service, setService] = useState<AICopilotService | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [investigationCtx, setInvestigationCtx] = useState<InvestigationContext | null>(null);
  const [nextActionReport, setNextActionReport] = useState<NextActionReport | null>(null);
  const [reasoningReport, setReasoningReport] = useState<ReasoningReport | null>(null);
  const [reasoningModalVisible, setReasoningModalVisible] = useState(false);
  const [isLoadingReasoning, setIsLoadingReasoning] = useState(false);
  const [intelligenceReport, setIntelligenceReport] = useState<InvestigationIntelligenceReport | null>(null);
  const [intelligenceModalVisible, setIntelligenceModalVisible] = useState(false);
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false);

  // ── Level-5 state ───────────────────────────────────────────────────────────
  const [level5Report, setLevel5Report] = useState<Level5IntelligenceReport | null>(null);
  const [isLoadingLevel5, setIsLoadingLevel5] = useState(false);
  const [memoryPanelVisible, setMemoryPanelVisible] = useState(false);
  const [predictivePanelVisible, setPredictivePanelVisible] = useState(false);
  const [multiFIRPanelVisible, setMultiFIRPanelVisible] = useState(false);
  const [graphViewVisible, setGraphViewVisible] = useState(false);
  const [nlSearchVisible, setNLSearchVisible] = useState(false);
  const [auditLogVisible, setAuditLogVisible] = useState(false);
  const [draftPanelVisible, setDraftPanelVisible] = useState(false);
  const [nlqResult, setNLQResult] = useState<NLQResult | null>(null);
  const [isQueryingNL, setIsQueryingNL] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<GeneratedDraft | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | undefined>();

  // ── Level-6 state ───────────────────────────────────────────────────────────
  const [level6Report, setLevel6Report] = useState<Level6IntelligenceReport | null>(null);
  const [isLoadingLevel6, setIsLoadingLevel6] = useState(false);
  const [l6ReadinessVisible, setL6ReadinessVisible]   = useState(false);
  const [l6HeatmapVisible, setL6HeatmapVisible]       = useState(false);
  const [l6TimelineVisible, setL6TimelineVisible]     = useState(false);
  const [l6RemindersVisible, setL6RemindersVisible]   = useState(false);
  const [l6DependencyVisible, setL6DependencyVisible] = useState(false);
  const [l6DecisionVisible, setL6DecisionVisible]     = useState(false);
  const [l6SupervisorVisible, setL6SupervisorVisible] = useState(false);
  const [l6MultiFIRVisible, setL6MultiFIRVisible]     = useState(false);

  // ── Level-7 state ───────────────────────────────────────────────────────────
  const [level7Report, setLevel7Report] = useState<Level7IntelligenceReport | null>(null);
  const [isLoadingLevel7, setIsLoadingLevel7] = useState(false);
  const [l7QualityVisible,    setL7QualityVisible]    = useState(false);
  const [l7EvidenceVisible,   setL7EvidenceVisible]   = useState(false);
  const [l7ChargeVisible,     setL7ChargeVisible]     = useState(false);
  const [l7CourtVisible,      setL7CourtVisible]      = useState(false);
  const [l7ScenarioVisible,   setL7ScenarioVisible]   = useState(false);
  const [l7RulesVisible,      setL7RulesVisible]      = useState(false);
  const [l7GraphVisible,      setL7GraphVisible]      = useState(false);
  const [l7SupervisorVisible, setL7SupervisorVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    (async () => {
      const svc = await AICopilotService.create(activeFirId);
      if (cancelled) return;
      svc.setAIPreferences({
        reportGeneration: settings.aiReportGeneration,
        restrictCaseData: settings.aiRestrictCaseData,
      });
      setService(svc);
      setMessages([]);
      setSuggestedActions([]);
      setIsOffline(false);
      setInvestigationCtx(null);
      setNextActionReport(null);
      setReasoningReport(null);
      setReasoningModalVisible(false);
      setIntelligenceReport(null);
      setIntelligenceModalVisible(false);
      // Reset Level-5 state
      setLevel5Report(null);
      setNLQResult(null);
      setGeneratedDraft(null);
      setDraftError(undefined);
      // Reset Level-6 state
      setLevel6Report(null);

      // Reset Level-7 state
      setLevel7Report(null);

      // Build InvestigationContext for summary card
      if (activeFirId) {
        try {
          const ctx = await InvestigationContextBuilder.build(activeFirId);
          if (!cancelled) {
            setInvestigationCtx(ctx);
            setNextActionReport(NextActionEngine.analyze(ctx));
          }
        } catch {
          // non-fatal — card simply won't show
        }
      }

      const mem = svc.getMemory();
      const snapshot = svc.getContext();

      // If FIR is open, auto-generate investigation summary as first message
      if (activeFirId) {
        const summary = await svc.generateFIRSummary(activeFirId);
        if (!cancelled) {
          setMessages([...mem.getMessages()]);
          setSuggestedActions(summary.suggestedActions ?? ['Next Step', 'View Timeline', 'Check Health Score']);
        }
      } else {
        const welcome = mem.addMessage({
          role: 'assistant',
          content: `${t('ai.welcomeGreeting')}\n\n${AIContextBuilder.formatContextHeader(snapshot)}\n\n${t('ai.welcomeHelp')}`,
        });
        if (!cancelled) {
          setMessages([welcome]);
          setSuggestedActions(['Draft Case Diary', 'Pending Tasks', 'View Analytics', 'पैरा खोजें', 'रेगुलेशन में पूछें']);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [visible, activeFirId]);

  useEffect(() => {
    if (service) {
      service.setAIPreferences({
        reportGeneration: settings.aiReportGeneration,
        restrictCaseData: settings.aiRestrictCaseData,
      });
    }
  }, [service, settings.aiReportGeneration, settings.aiRestrictCaseData]);

  // ── Open draft in editor ──────────────────────────────────────────────────────
  const handleOpenDraft = useCallback(
    (draft: AIDraft) => {
      aiDraftStore.setDraft(draft);
      onClose();
      const route = getDraftRoute(draft);
      if (route) {
        setTimeout(() => router.push(route as RelativePathString), 300);
      }
    },
    [onClose, router]
  );

  // ── Save message to Case Diary ───────────────────────────────────────────────
  const handleSaveMessageToDiary = useCallback(
    (msg: AIMessage) => {
      if (!activeFirId) return;
      const draft: AIDraft = {
        id: generateUUID(),
        type: 'case-diary',
        title: 'From AI Copilot',
        content: msg.content,
        createdAt: Date.now(),
        firId: activeFirId,
        sections: [],
      };
      aiDraftStore.setDraft(draft);
      onClose();
      setTimeout(() => {
        router.push(`/(app)/mukadma/${activeFirId}/add-case-diary` as RelativePathString);
      }, 300);
    },
    [activeFirId, onClose, router]
  );

  // ── Level-5: load report (shared by multiple panels) ─────────────────────────
  const ensureLevel5 = useCallback(async () => {
    if (!service) return;
    if (level5Report) return;
    setIsLoadingLevel5(true);
    try {
      const report = await service.runLevel5(activeFirId);
      setLevel5Report(report);
    } catch {
      // panels handle null gracefully
    } finally {
      setIsLoadingLevel5(false);
    }
  }, [service, activeFirId, level5Report]);

  // ── Level-6: load report (shared by all 8 L6 panels) ─────────────────────────
  const ensureLevel6 = useCallback(async () => {
    if (!service) return;
    if (level6Report) return;
    setIsLoadingLevel6(true);
    try {
      const ctx = investigationCtx ? [investigationCtx] : undefined;
      const report = await service.runLevel6(activeFirId, ctx);
      setLevel6Report(report);
    } catch {
      // panels handle null gracefully
    } finally {
      setIsLoadingLevel6(false);
    }
  }, [service, activeFirId, level6Report, investigationCtx]);

  // ── Level-7: load report (shared by all 8 L7 panels) ─────────────────────────
  const ensureLevel7 = useCallback(async () => {
    if (!service) return;
    if (level7Report) return;
    setIsLoadingLevel7(true);
    try {
      const report = await service.runLevel7(activeFirId, {
        supervisorContexts: investigationCtx ? [investigationCtx] : undefined,
      });
      setLevel7Report(report);
    } catch {
      // panels handle null gracefully
    } finally {
      setIsLoadingLevel7(false);
    }
  }, [service, activeFirId, level7Report, investigationCtx]);

  const handleOpenMemory = useCallback(async () => {
    setMemoryPanelVisible(true);
    await ensureLevel5();
  }, [ensureLevel5]);

  const handleOpenPredictive = useCallback(async () => {
    setPredictivePanelVisible(true);
    await ensureLevel5();
  }, [ensureLevel5]);

  const handleOpenMultiFIR = useCallback(async () => {
    setMultiFIRPanelVisible(true);
    await ensureLevel5();
  }, [ensureLevel5]);

  const handleOpenGraph = useCallback(async () => {
    setGraphViewVisible(true);
    await ensureLevel5();
  }, [ensureLevel5]);

  const handleOpenNLSearch = useCallback(() => {
    setNLSearchVisible(true);
    setNLQResult(null);
  }, []);

  const handleNLQuery = useCallback(async (query: string) => {
    if (!service || !investigationCtx) return;
    setIsQueryingNL(true);
    try {
      // Pass single-FIR context array (station-wide requires allContexts from repo)
      const result = await service.runNLQuery(query, investigationCtx ? [investigationCtx] : []);
      setNLQResult(result);
    } catch {
      // result stays null
    } finally {
      setIsQueryingNL(false);
    }
  }, [service, investigationCtx]);

  const handleOpenAudit = useCallback(() => {
    setAuditLogVisible(true);
  }, []);

  const handleOpenDraftPanel = useCallback(() => {
    setGeneratedDraft(null);
    setDraftError(undefined);
    setDraftPanelVisible(true);
  }, []);

  // ── Level-6 panel handlers ────────────────────────────────────────────────
  const handleOpenL6Readiness = useCallback(async () => {
    setL6ReadinessVisible(true);
    await ensureLevel6();
  }, [ensureLevel6]);

  const handleOpenL6Heatmap = useCallback(async () => {
    setL6HeatmapVisible(true);
    await ensureLevel6();
  }, [ensureLevel6]);

  const handleOpenL6Timeline = useCallback(async () => {
    setL6TimelineVisible(true);
    await ensureLevel6();
  }, [ensureLevel6]);

  const handleOpenL6Reminders = useCallback(async () => {
    setL6RemindersVisible(true);
    await ensureLevel6();
  }, [ensureLevel6]);

  const handleOpenL6Dependency = useCallback(async () => {
    setL6DependencyVisible(true);
    await ensureLevel6();
  }, [ensureLevel6]);

  const handleOpenL6Decision = useCallback(async () => {
    setL6DecisionVisible(true);
    await ensureLevel6();
  }, [ensureLevel6]);

  const handleOpenL6Supervisor = useCallback(async () => {
    setL6SupervisorVisible(true);
    await ensureLevel6();
  }, [ensureLevel6]);

  const handleOpenL6MultiFIR = useCallback(async () => {
    setL6MultiFIRVisible(true);
    await ensureLevel6();
  }, [ensureLevel6]);

  // ── Level-7 panel handlers ────────────────────────────────────────────────
  const handleOpenL7Quality = useCallback(async () => {
    setL7QualityVisible(true);
    await ensureLevel7();
  }, [ensureLevel7]);

  const handleOpenL7Evidence = useCallback(async () => {
    setL7EvidenceVisible(true);
    await ensureLevel7();
  }, [ensureLevel7]);

  const handleOpenL7Charge = useCallback(async () => {
    setL7ChargeVisible(true);
    await ensureLevel7();
  }, [ensureLevel7]);

  const handleOpenL7Court = useCallback(async () => {
    setL7CourtVisible(true);
    await ensureLevel7();
  }, [ensureLevel7]);

  const handleOpenL7Scenario = useCallback(async () => {
    setL7ScenarioVisible(true);
    await ensureLevel7();
  }, [ensureLevel7]);

  const handleOpenL7Rules = useCallback(async () => {
    setL7RulesVisible(true);
    await ensureLevel7();
  }, [ensureLevel7]);

  const handleOpenL7Graph = useCallback(async () => {
    setL7GraphVisible(true);
    await ensureLevel7();
  }, [ensureLevel7]);

  const handleOpenL7Supervisor = useCallback(async () => {
    setL7SupervisorVisible(true);
    await ensureLevel7();
  }, [ensureLevel7]);

  const handleGenerateDraft = useCallback(async (type: L5DraftType) => {
    if (!investigationCtx) return;
    setIsGeneratingDraft(true);
    setDraftError(undefined);
    try {
      const result = DraftGenerationEngine.generate(investigationCtx, type);
      if (result.success && result.draft) {
        setGeneratedDraft(result.draft);
      } else {
        setDraftError(result.errorMessage ?? 'Draft generation failed.');
        setGeneratedDraft(null);
      }
    } catch (e) {
      setDraftError(String(e));
    } finally {
      setIsGeneratingDraft(false);
    }
  }, [investigationCtx]);

  const handleApproveDraft = useCallback((draft: GeneratedDraft) => {
    // Convert Level-5 draft to AIDraft for existing routing
    const aiDraft: AIDraft = {
      id:        draft.id,
      type:      draft.type as AIDraft['type'],
      title:     draft.title,
      content:   draft.fullText,
      createdAt: Date.now(),
      firId:     draft.firId,
      firNumber: draft.firNumber,
      sections:  draft.sections.map((s) => ({ title: s.title, content: s.content })),
    };
    setDraftPanelVisible(false);
    handleOpenDraft(aiDraft);
  }, [handleOpenDraft]);

  // ── Open Decision Support (ReasoningEngine) ──────────────────────────────────
  const handleOpenReasoning = useCallback(async () => {
    if (!service) return;
    setReasoningModalVisible(true);
    if (reasoningReport) return; // already cached
    setIsLoadingReasoning(true);
    try {
      const report = await service.runReasoning(activeFirId);
      setReasoningReport(report);
    } catch {
      // show modal with empty state
    } finally {
      setIsLoadingReasoning(false);
    }
  }, [service, activeFirId, reasoningReport]);

  // ── Open Level-4 Intelligence Engine ─────────────────────────────────────────
  const handleOpenIntelligence = useCallback(async () => {
    if (!service) return;
    setIntelligenceModalVisible(true);
    if (intelligenceReport) return; // already cached
    setIsLoadingIntelligence(true);
    try {
      const report = await service.runIntelligence(activeFirId);
      setIntelligenceReport(report);
    } catch {
      // show modal with empty state
    } finally {
      setIsLoadingIntelligence(false);
    }
  }, [service, activeFirId, intelligenceReport]);

  // ── Sync messages from memory ────────────────────────────────────────────────
  const syncMessages = useCallback(() => {
    if (!service) return;
    const all = service.getMemory().getMessages();
    setMessages([...all]);
  }, [service]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      if (!service || !text.trim() || isProcessing) return;
      const msg = text.trim();
      setInput('');
      setIsProcessing(true);
      setSuggestedActions([]);
      syncMessages();

      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

      const response = await service.sendMessage(msg);
      setIsOffline(response.isOffline ?? false);
      setSuggestedActions(response.suggestedActions ?? []);
      syncMessages();
      setIsProcessing(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [service, isProcessing, syncMessages]
  );

  // ── Initial question (opened from a screen with context) ────────────────────
  const initialSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) {
      initialSentRef.current = null;
      return;
    }
    if (!service || !initialQuery || initialSentRef.current === initialQuery || isProcessing) return;
    const id = setTimeout(() => {
      initialSentRef.current = initialQuery;
      handleSend(initialQuery);
    }, 400);
    return () => clearTimeout(id);
  }, [visible, service, initialQuery, isProcessing, handleSend]);

  // ── Quick action ──────────────────────────────────────────────────────────────
  const handleQuickAction = useCallback(
    async (actionId: QuickActionId) => {
      // Find section opens Law Library directly
      if (actionId === 'find-section') {
        onClose();
        setTimeout(() => {
          router.push('/(app)/knowledge/law' as RelativePathString);
        }, 150);
        return;
      }

      // Intercept Level-5 quick actions — open panels directly
      switch (actionId) {
        case 'l5-memory':  handleOpenMemory();   return;
        case 'l5-predict': handleOpenPredictive(); return;
        case 'l5-station': handleOpenMultiFIR(); return;
        case 'l5-graph':   handleOpenGraph();    return;
        case 'l5-search':  handleOpenNLSearch(); return;
        case 'l5-audit':   handleOpenAudit();    return;
        case 'l5-draft':   handleOpenDraftPanel(); return;
        // Level-6 quick actions
        case 'l6-readiness':  handleOpenL6Readiness();  return;
        case 'l6-heatmap':    handleOpenL6Heatmap();    return;
        case 'l6-timeline':   handleOpenL6Timeline();   return;
        case 'l6-reminders':  handleOpenL6Reminders();  return;
        case 'l6-dependency': handleOpenL6Dependency(); return;
        case 'l6-decision':   handleOpenL6Decision();   return;
        case 'l6-supervisor': handleOpenL6Supervisor(); return;
        case 'l6-multifir':   handleOpenL6MultiFIR();   return;
        // Level-7 quick actions
        case 'l7-quality':    handleOpenL7Quality();    return;
        case 'l7-evidence':   handleOpenL7Evidence();   return;
        case 'l7-chargesheet':handleOpenL7Charge();     return;
        case 'l7-court':      handleOpenL7Court();      return;
        case 'l7-scenario':   handleOpenL7Scenario();   return;
        case 'l7-rules':      handleOpenL7Rules();      return;
        case 'l7-graph':      handleOpenL7Graph();      return;
        case 'l7-supervisor': handleOpenL7Supervisor(); return;
        default: break;
      }

      if (!service || isProcessing) return;
      setIsProcessing(true);
      setSuggestedActions([]);
      syncMessages();

      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

      const response = await service.triggerQuickAction(actionId);
      setIsOffline(response.isOffline ?? false);
      setSuggestedActions(response.suggestedActions ?? []);
      syncMessages();
      setIsProcessing(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [service, isProcessing, syncMessages,
     handleOpenMemory, handleOpenPredictive, handleOpenMultiFIR,
     handleOpenGraph, handleOpenNLSearch, handleOpenAudit, handleOpenDraftPanel,
     handleOpenL6Readiness, handleOpenL6Heatmap, handleOpenL6Timeline,
     handleOpenL6Reminders, handleOpenL6Dependency, handleOpenL6Decision,
     handleOpenL6Supervisor, handleOpenL6MultiFIR,
     // Level-7
     handleOpenL7Quality, handleOpenL7Evidence, handleOpenL7Charge,
     handleOpenL7Court, handleOpenL7Scenario, handleOpenL7Rules,
     handleOpenL7Graph, handleOpenL7Supervisor]
  );

  // ── Suggested follow-up ───────────────────────────────────────────────────────
  const handleSuggestedAction = useCallback(
    (action: string) => {
      // UP Police Regulations (L35): "पैरा खोजें" opens the hub,
      // "पैरा 97 खोलें" opens that paragraph.
      if (action.trim() === 'पैरा खोजें') {
        onClose();
        setTimeout(() => { router.push('/(app)/knowledge/regulations' as any); }, 150);
        return;
      }
      const paraOpen = action.trim().match(/^(POCSO\s*)?(पैरा|धारा)\s*([0-9]{1,3}(?:-?[A-Za-z])?)\s*खोलें$/i);
      if (paraOpen) {
        const isPocso = !!paraOpen[1] || paraOpen[2] === 'धारा';
        const no = paraOpen[3].toLowerCase();
        const id = isPocso ? `sys-reg-pocso-${no.replace('-', '')}` : `sys-reg-up-${no}`;
        onClose();
        setTimeout(() => { router.push(`/(app)/knowledge/${id}` as any); }, 150);
        return;
      }
      // "समझें खोलें" → SOP explainer tab (L32)
      if (action.includes('समझें खोलें')) {
        const m = action.match(/sys-sop-[a-z0-9-]+/i) || action.match(/sop-[a-z0-9-]+/i);
        let sopId: string | null = m ? m[0] : null;
        if (!sopId) {
          const lastAssistantMsg = [...messages].reverse().find((msg) => msg.role === 'assistant');
          const found = lastAssistantMsg?.content.match(/sys-sop-[a-z0-9-]+/i);
          if (found) sopId = found[0];
        }
        if (sopId) {
          onClose();
          setTimeout(() => { router.push(`/(app)/knowledge/${sopId}?tab=samjhe` as any); }, 150);
          return;
        }
      }

      // Suggested action chips handling: open SOP in Knowledge detail or Checklist tab
      if (action.includes('चेकलिस्ट खोलें') || action.startsWith('चेकलिस्ट खोलें')) {
        let sopId: string | null = null;
        const m = action.match(/sys-sop-[a-z0-9-]+/i) || action.match(/sop-[a-z0-9-]+/i);
        if (m) {
          sopId = m[0];
        } else {
          // Inspect last assistant message for a SOP ID
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === 'assistant') {
              const found = msg.content.match(/sys-sop-[a-z0-9-]+/i) || msg.content.match(/sop-[a-z0-9-]+/i);
              if (found) {
                sopId = found[0];
                break;
              }
            }
          }
        }

        if (sopId) {
          onClose();
          setTimeout(() => {
            router.push(`/(app)/knowledge/${sopId}?tab=checklist` as any);
          }, 150);
          return;
        }
      }

      if (action.includes('पूरा SOP खोलें') || action.startsWith('पूरा SOP खोलें') || action.includes('SOP खोलें')) {
        let sopId: string | null = null;
        const m = action.match(/sys-sop-[a-z0-9-]+/i) || action.match(/sop-[a-z0-9-]+/i);
        if (m) {
          sopId = m[0];
        } else {
          // Inspect last assistant message for a SOP ID
          const lastAssistantMsg = [...messages].reverse().find((msg) => msg.role === 'assistant');
          if (lastAssistantMsg) {
            const idMatch = lastAssistantMsg.content.match(/\b(sys-sop-[a-z0-9-]+)\b/i);
            if (idMatch) {
              sopId = idMatch[1];
            }
          }
        }
        if (sopId) {
          onClose();
          setTimeout(() => {
            router.push(`/(app)/knowledge/${sopId}` as RelativePathString);
          }, 150);
          return;
        }
      }

      // Suggested action chips handling: open circular in Knowledge detail
      if (action === 'परिपत्र खोलें' || action.startsWith('परिपत्र खोलें') || action.includes('परिपत्र खोलें')) {
        let circId: string | null = null;
        const m = action.match(/sys-circ-[a-z0-9-]+/i);
        if (m) {
          circId = m[0];
        } else {
          // Inspect last assistant message for a circular ID or number
          const lastAssistantMsg = [...messages].reverse().find((msg) => msg.role === 'assistant');
          if (lastAssistantMsg) {
            const idMatch = lastAssistantMsg.content.match(/\b(sys-circ-[a-z0-9-]+)\b/i);
            if (idMatch) {
              circId = idMatch[1];
            } else if (lastAssistantMsg.content.includes('12/2012')) {
              circId = 'sys-circ-dg-12-2012';
            } else if (lastAssistantMsg.content.includes('14/2012')) {
              circId = 'sys-circ-ardh-14-2012';
            } else if (lastAssistantMsg.content.includes('15/2012')) {
              circId = 'sys-circ-ardh-dg-15-2012';
            }
          }
        }
        if (circId) {
          onClose();
          setTimeout(() => {
            router.push(`/(app)/knowledge/${circId}` as RelativePathString);
          }, 150);
          return;
        }
      }

      if (action === 'धारा खोलें' || action.startsWith('धारा खोलें')) {
        const m = action.match(/\b(BNS|BNSS|BSA)\s+(\d+)\b/i);
        if (m) {
          onClose();
          openSection(router, m[1].toUpperCase() as ActId, parseInt(m[2], 10));
          return;
        }
        // If bare 'धारा खोलें', inspect the last assistant message for a section to open
        const lastAssistantMsg = [...messages].reverse().find((msg) => msg.role === 'assistant');
        if (lastAssistantMsg) {
          const secMatch = lastAssistantMsg.content.match(/\b(BNS|BNSS|BSA)\s+(\d+)\b/i);
          if (secMatch) {
            onClose();
            openSection(router, secMatch[1].toUpperCase() as ActId, parseInt(secMatch[2], 10));
            return;
          }
        }
      }

      if (action === 'तत्व जाँचें' || action === 'FIR में क्या लिखें') {
        const lastAssistantMsg = [...messages].reverse().find((msg) => msg.role === 'assistant');
        if (lastAssistantMsg) {
          const secMatch = lastAssistantMsg.content.match(/\b(BNS|BNSS|BSA)\s+(\d+)\b/i);
          if (secMatch) {
            handleSend(`${action} (${secMatch[1]} ${secMatch[2]})`);
            return;
          }
        }
      }

      if (action.includes('धारा खोजें') || action.toLowerCase().includes('find section')) {
        handleQuickAction('find-section');
        return;
      }
      // Map suggestion text to quick action id if possible
      const match = QUICK_ACTIONS.find((a) =>
        a.label.toLowerCase() === action.toLowerCase()
      );
      if (match) {
        handleQuickAction(match.id);
      } else {
        handleSend(action);
      }
    },
    [handleQuickAction, handleSend]
  );

  // ── Open Decision Support (ReasoningEngine) ──────────────────────────────────

  // ── Derived values ────────────────────────────────────────────────────────────
  const context              = service?.getContext();
  const criticalReasoning    = reasoningReport?.findings.filter(f => f.severity === 'critical').length ?? 0;
  const criticalIntelligence = intelligenceReport?.healthReport.criticalIssues.length ?? 0;
  const hasMessages          = messages.length > 0;

  // KAV offset = visual header height ONLY (insets.top already consumed inside
  // the header View via paddingTop).  Never include insets.top twice.
  const headerHeight = 56 + insets.top;

  // KAV behavior:
  //   iOS  → 'padding': KAV grows padding at bottom, FlatList scrolls up
  //   Web  → undefined: KAV is effectively a no-op; keyboard overlaps (browser handles it)
  //   Android → 'height': system already resizes the window; KAV adjusts remaining space
  const kavBehavior =
    process.env.EXPO_OS === 'ios' ? 'padding' :
    process.env.EXPO_OS === 'web' ? undefined  :
    'height' as const;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/*
        Root: fills the entire sheet with an absolute fill so the Modal has a
        concrete, bounded size on all platforms (Web, iOS, Android).
        flex:1 alone is unreliable inside a Modal on Web — absoluteFillObject
        guarantees the sheet gets top:0 / bottom:0 / left:0 / right:0.
      */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.card, flexDirection: 'column' }]}>

        {/* ── HEADER ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          height: headerHeight,
          paddingTop: insets.top,
          paddingHorizontal: 12,
          gap: 8,
          backgroundColor: colors.card,
          borderBottomWidth: 1, borderBottomColor: colors.border,
          flexShrink: 0,
        }}>
          {/* Minimal avatar: 28dp circle */}
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Bot size={13} color="#FFFFFF" strokeWidth={2.5} />
          </View>

          {/* Title block */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 15, fontWeight: '700', color: colors.foreground, letterSpacing: -0.3 }}
            >
              {t('ai.title')}
            </Text>
            <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 1 }}>
              {t('ai.subtitle')}
            </Text>
          </View>

          {/* Analysis / Intel buttons — only when FIR is active */}
          {activeFirId && (
            <View style={{ flexDirection: 'row', gap: 5 }}>
              <HeaderActionBtn icon={Brain} label={t('ai.analysis')} badge={criticalReasoning}    onPress={handleOpenReasoning}    colors={colors} />
              <HeaderActionBtn icon={Cpu}   label={t('ai.intel')}    badge={criticalIntelligence} onPress={handleOpenIntelligence} colors={colors} />
            </View>
          )}

          {/* Close — minimal icon button */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('ai.closeCopilot')}
            className="active:opacity-50"
            style={{
              width: 30, height: 30, borderRadius: 15,
              backgroundColor: colors.muted,
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={15} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* ── CONTEXT BAR — fixed-height scrollable pill row below header ──────
            flexShrink:0 → never compressed when keyboard appears.
        */}
        {context && (
          <View style={{ flexShrink: 0 }}>
            <AIContextBar context={context} isOffline={isOffline} />
          </View>
        )}

        {/* ── BODY: KAV wraps [FlatList + bottom chrome] ────────────────────────
            flex:1 → takes ALL remaining height between context bar and screen bottom.
            KAV then manages the keyboard intrusion within that bounded space.
        */}
        <KeyboardAvoidingView
          behavior={kavBehavior}
          style={{ flex: 1 }}
          keyboardVerticalOffset={headerHeight}
        >
          {/*
            Inner column: FlatList(flex:1) + bottom chrome(flexShrink:0).
            This is the canonical chat layout pattern — list expands,
            chrome stays fixed at bottom.
          */}
          <View style={{ flex: 1, flexDirection: 'column' }}>

            {/* ── MESSAGE LIST — flex:1 fills all space above bottom chrome ── */}
            <FlatList
              removeClippedSubviews={true}
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <AIMessageBubble
                  message={item}
                  onOpenDraft={handleOpenDraft}
                  onSaveToDiary={activeFirId ? () => handleSaveMessageToDiary(item) : undefined}
                />
              )}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingTop: 8,
                paddingBottom: 8,
                // flexGrow:1 makes ListEmptyComponent fill the list height
                // so the empty-state centres properly
                flexGrow: 1,
              }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                // No nested ScrollView here — InvestigationDashboard and
                // AISuggestedPrompts render plain Views only.
                <View style={{ flex: 1 }}>
                  {investigationCtx && nextActionReport && (
                    <InvestigationDashboard ctx={investigationCtx} report={nextActionReport} />
                  )}
                  {settings.aiSuggestions && (
                    <AISuggestedPrompts hasFir={!!activeFirId} onSend={handleSend} />
                  )}
                </View>
              }
            />

            {/* ── BOTTOM CHROME — never grows, stays pinned at list bottom ── */}
            <View style={{ flexShrink: 0, backgroundColor: colors.card }}>

              {/* Suggested follow-up actions — only after first AI reply */}
              {settings.aiSuggestions && hasMessages && suggestedActions.length > 0 && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                  <AISuggestedActions
                    actions={suggestedActions}
                    onAction={handleSuggestedAction}
                    disabled={isProcessing}
                  />
                </View>
              )}

              {/* Quick action chips — single horizontal row above composer */}
              <AIQuickChips
                onAction={handleQuickAction}
                disabled={isProcessing}
                hideDraftActions={!settings.aiDraftAssistance}
              />

              {/* Composer */}
              <StickyComposer
                value={input}
                onChangeText={setInput}
                onSend={() => handleSend(input)}
                isProcessing={isProcessing}
                bottomInset={insets.bottom}
                colors={colors}
              />
            </View>

          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Decision Support / Reasoning Modal — stacked above Copilot modal */}
      <ReasoningModal
        visible={reasoningModalVisible}
        onClose={() => setReasoningModalVisible(false)}
        report={reasoningReport}
        isLoading={isLoadingReasoning}
      />

      {/* Level-4 Intelligence Modal — stacked above Copilot modal */}
      <IntelligenceModal
        visible={intelligenceModalVisible}
        onClose={() => setIntelligenceModalVisible(false)}
        onRefresh={() => {
          setIntelligenceReport(null);
          handleOpenIntelligence();
        }}
        report={intelligenceReport}
        isLoading={isLoadingIntelligence}
      />

      {/* ── Level-5 panels ─────────────────────────────────────────────────── */}
      <MemoryPanel
        visible={memoryPanelVisible}
        onClose={() => setMemoryPanelVisible(false)}
        onRefresh={() => { setLevel5Report(null); ensureLevel5(); }}
        report={level5Report?.memoryReport ?? null}
        isLoading={isLoadingLevel5}
      />
      <PredictiveAlertsPanel
        visible={predictivePanelVisible}
        onClose={() => setPredictivePanelVisible(false)}
        onRefresh={() => { setLevel5Report(null); ensureLevel5(); }}
        report={level5Report?.predictiveReport ?? null}
        isLoading={isLoadingLevel5}
      />
      <MultiFIRPanel
        visible={multiFIRPanelVisible}
        onClose={() => setMultiFIRPanelVisible(false)}
        onRefresh={() => { setLevel5Report(null); ensureLevel5(); }}
        report={level5Report?.multiFIRReport ?? null}
        isLoading={isLoadingLevel5}
      />
      <KnowledgeGraphView
        visible={graphViewVisible}
        onClose={() => setGraphViewVisible(false)}
        onRefresh={() => { setLevel5Report(null); ensureLevel5(); }}
        report={level5Report?.knowledgeGraphReport ?? null}
        isLoading={isLoadingLevel5}
      />
      <NLSearchPanel
        visible={nlSearchVisible}
        onClose={() => setNLSearchVisible(false)}
        onQuery={handleNLQuery}
        result={nlqResult}
        isLoading={isQueryingNL}
      />
      <AuditLogPanel
        visible={auditLogVisible}
        onClose={() => setAuditLogVisible(false)}
        onRefresh={() => {}}
        report={level5Report?.auditReport ?? null}
        isLoading={false}
      />
      <DraftPreviewPanel
        visible={draftPanelVisible}
        onClose={() => setDraftPanelVisible(false)}
        onGenerate={handleGenerateDraft}
        onApprove={handleApproveDraft}
        draft={generatedDraft}
        isLoading={isGeneratingDraft}
        errorMessage={draftError}
      />

      {/* ── Level-6 panels ─────────────────────────────────────────────────── */}
      <L6PanelShell
        title={t('ai.panel.readiness')}
        visible={l6ReadinessVisible}
        onClose={() => setL6ReadinessVisible(false)}
        onRefresh={() => { setLevel6Report(null); ensureLevel6(); }}
        isLoading={isLoadingLevel6}
      >
        {level6Report && <ReadinessDashboardPanel report={level6Report.readinessReport} />}
      </L6PanelShell>

      <L6PanelShell
        title={t('ai.panel.heatmap')}
        visible={l6HeatmapVisible}
        onClose={() => setL6HeatmapVisible(false)}
        onRefresh={() => { setLevel6Report(null); ensureLevel6(); }}
        isLoading={isLoadingLevel6}
      >
        {level6Report && <RiskHeatmapPanel report={level6Report.riskHeatmapReport} />}
      </L6PanelShell>

      <L6PanelShell
        title={t('ai.panel.timelineReplay')}
        visible={l6TimelineVisible}
        onClose={() => setL6TimelineVisible(false)}
        onRefresh={() => { setLevel6Report(null); ensureLevel6(); }}
        isLoading={isLoadingLevel6}
      >
        {level6Report && <TimelineReplayPanel report={level6Report.timelineReplayReport} />}
      </L6PanelShell>

      <L6PanelShell
        title={t('ai.panel.smartReminders')}
        visible={l6RemindersVisible}
        onClose={() => setL6RemindersVisible(false)}
        onRefresh={() => { setLevel6Report(null); ensureLevel6(); }}
        isLoading={isLoadingLevel6}
      >
        {level6Report && <SmartReminderPanel report={level6Report.reminderReport} />}
      </L6PanelShell>

      <L6PanelShell
        title={t('ai.panel.dependencyGraph')}
        visible={l6DependencyVisible}
        onClose={() => setL6DependencyVisible(false)}
        onRefresh={() => { setLevel6Report(null); ensureLevel6(); }}
        isLoading={isLoadingLevel6}
      >
        {level6Report && <DependencyGraphPanel report={level6Report.dependencyGraphReport} />}
      </L6PanelShell>

      <L6PanelShell
        title={t('ai.panel.decisionAssistant')}
        visible={l6DecisionVisible}
        onClose={() => setL6DecisionVisible(false)}
        onRefresh={() => { setLevel6Report(null); ensureLevel6(); }}
        isLoading={isLoadingLevel6}
      >
        {level6Report && <DecisionAssistantPanel report={level6Report.decisionAssistantReport} />}
      </L6PanelShell>

      <L6PanelShell
        title={t('ai.panel.supervisorView')}
        visible={l6SupervisorVisible}
        onClose={() => setL6SupervisorVisible(false)}
        onRefresh={() => { setLevel6Report(null); ensureLevel6(); }}
        isLoading={isLoadingLevel6}
      >
        {level6Report?.supervisorViewReport && (
          <SupervisorViewPanel report={level6Report.supervisorViewReport} />
        )}
      </L6PanelShell>

      <L6PanelShell
        title={t('ai.panel.multiFirLinks')}
        visible={l6MultiFIRVisible}
        onClose={() => setL6MultiFIRVisible(false)}
        onRefresh={() => { setLevel6Report(null); ensureLevel6(); }}
        isLoading={isLoadingLevel6}
      >
        {level6Report?.multiFIRLinkerReport && (
          <MultiFIRLinkerPanel report={level6Report.multiFIRLinkerReport} />
        )}
      </L6PanelShell>

      {/* ── Level-7 panels ─────────────────────────────────────────────────── */}
      <QualityIndexPanel
        visible={l7QualityVisible}
        onClose={() => setL7QualityVisible(false)}
        onRefresh={() => { setLevel7Report(null); ensureLevel7(); }}
        loading={isLoadingLevel7}
        report={level7Report?.qualityReport}
      />
      <EvidenceStrengthPanel
        visible={l7EvidenceVisible}
        onClose={() => setL7EvidenceVisible(false)}
        onRefresh={() => { setLevel7Report(null); ensureLevel7(); }}
        loading={isLoadingLevel7}
        report={level7Report?.evidenceReport}
      />
      <ChargeSheetPanel
        visible={l7ChargeVisible}
        onClose={() => setL7ChargeVisible(false)}
        onRefresh={() => { setLevel7Report(null); ensureLevel7(); }}
        loading={isLoadingLevel7}
        report={level7Report?.chargeSheetReport}
      />
      <CourtReadinessPanel
        visible={l7CourtVisible}
        onClose={() => setL7CourtVisible(false)}
        onRefresh={() => { setLevel7Report(null); ensureLevel7(); }}
        loading={isLoadingLevel7}
        report={level7Report?.courtReadinessReport}
      />
      <ScenarioPanel
        visible={l7ScenarioVisible}
        onClose={() => setL7ScenarioVisible(false)}
        onRefresh={() => { setLevel7Report(null); ensureLevel7(); }}
        loading={isLoadingLevel7}
        report={level7Report?.scenarioReport}
      />
      <RuleExplorerPanel
        visible={l7RulesVisible}
        onClose={() => setL7RulesVisible(false)}
        onRefresh={() => { setLevel7Report(null); ensureLevel7(); }}
        loading={isLoadingLevel7}
        report={level7Report?.ruleEngineReport}
      />
      <KnowledgeGraphPanel
        visible={l7GraphVisible}
        onClose={() => setL7GraphVisible(false)}
        onRefresh={() => { setLevel7Report(null); ensureLevel7(); }}
        loading={isLoadingLevel7}
        report={level7Report?.knowledgeGraphReport}
      />
      <SupervisorDashboardPanel
        visible={l7SupervisorVisible}
        onClose={() => setL7SupervisorVisible(false)}
        onRefresh={() => { setLevel7Report(null); ensureLevel7(); }}
        loading={isLoadingLevel7}
        report={level7Report?.supervisorReport}
      />
    </Modal>
  );
}

// ── Header action button helper ───────────────────────────────────────────────

// ── HeaderActionBtn — minimal chip, badge on critical count ──────────────────
// HeaderActionBtn — receives colors as prop (standalone fn, no hook access)
function HeaderActionBtn({
  icon: Icon, label, badge, onPress, colors,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  badge: number;
  onPress: () => void;
  colors: typeof THEME['light'];
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-55"
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 9, height: 30, borderRadius: 15,
        backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
      }}
    >
      <Icon size={11} color={colors.foreground} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.foreground }}>{label}</Text>
      {badge > 0 && (
        <View style={{
          minWidth: 14, height: 14, borderRadius: 7,
          backgroundColor: colors.destructive,
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 3,
        }}>
          <Text style={{ fontSize: 8, color: '#FFFFFF', fontWeight: '700' }}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

// StickyComposer — receives colors as prop (standalone fn, no hook access)
function StickyComposer({
  value,
  onChangeText,
  onSend,
  isProcessing,
  bottomInset,
  colors,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  isProcessing: boolean;
  bottomInset: number;
  colors: typeof THEME['light'];
}) {
  const { t } = useTranslation();
  const sendScale = React.useRef(new Animated.Value(1)).current;

  const animateSend = () => {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.82, duration: 60, useNativeDriver: true }),
      Animated.timing(sendScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const canSend = value.trim().length > 0 && !isProcessing;

  return (
    <View style={{
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: Math.max(bottomInset, 12),
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        backgroundColor: colors.muted,
        borderRadius: 20,
        borderWidth: 1, borderColor: colors.border,
        paddingLeft: 12, paddingRight: 4, paddingVertical: 4,
        minHeight: 44,
      }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={t('ai.composerPlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          multiline textAlignVertical="top"
          maxLength={1000}
          returnKeyType="default"
          editable={!isProcessing}
          accessibilityLabel={t('ai.messageInput')}
          style={{
            flex: 1,
            fontSize: 14,
            color: colors.foreground,
            lineHeight: 20,
            paddingVertical: 6,
            paddingHorizontal: 4,
            backgroundColor: 'transparent',
            maxHeight: 100,
          } as object}
        />

        <Animated.View style={{ transform: [{ scale: sendScale }], flexShrink: 0 }}>
          <Pressable
            onPress={() => { animateSend(); onSend(); }}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('ai.sendMessage')}
            style={{
              width: 36, height: 36, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: canSend ? colors.primary : colors.muted,
            }}
          >
            {isProcessing
              ? <ActivityIndicator size="small" color={colors.mutedForeground} />
              : <Send size={15} color={canSend ? '#FFFFFF' : colors.mutedForeground} strokeWidth={2} />
            }
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

// ── Draft routing ─────────────────────────────────────────────────────────────

function getDraftRoute(draft: AIDraft): string | null {
  switch (draft.type) {
    case 'case-diary':
      return draft.firId ? `/(app)/mukadma/${draft.firId}/add-case-diary` : '/(app)/mukadma';
    case 'gd':
      return '/(app)/gd/add-gd';
    case 'prarthna-patra':
      return '/(app)/prarthna-patra';
    case 'court-report':
      return '/(app)/nyayalay';
    case 'notice':
    case 'bnss-proceedings':
    case 'investigation-notes':
    case 'charge-sheet-summary':
    case 'timeline':
    case 'evidence-summary':
    case 'witness-summary':
    case 'pending-work-summary':
      return '/(app)/ai-draft-preview';
    default:
      return null;
  }
}

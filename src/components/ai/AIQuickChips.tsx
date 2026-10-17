/**
 * AIQuickChips — compact horizontally scrollable action chip row.
 * Minimal: 36dp chips, text + icon, level-coloured, no shadow, 1px border.
 * Lives just above the composer. Single source of all quick actions.
 */

import React, { memo, useState } from 'react';
import { ScrollView, Text, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MessageCircle, ArrowRight, BookOpen, FileText, Bell, Scale,
  CheckSquare, Clock, Search, Users, BarChart2, ListTodo, Activity,
  Brain, Network, Layers, Gavel, TriangleAlert, MoreHorizontal, ChevronsLeft,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { QUICK_ACTIONS } from '@/ai/AICopilotService';
import type { QuickActionId } from '@/ai/AITypes';

export const QUICK_ACTION_MAP: Record<string, string> = {
  // Core actions
  'ask': 'ai.quickAction.ask',
  'next-step': 'ai.quickAction.nextStep',
  'draft-case-diary': 'ai.quickAction.draftCaseDiary',
  'draft-gd': 'ai.quickAction.draftGd',
  'draft-notice': 'ai.quickAction.draftNotice',
  'draft-court-report': 'ai.quickAction.courtReport',
  'checklist': 'ai.quickAction.checklist',
  'timeline': 'ai.quickAction.timeline',
  'evidence-summary': 'ai.quickAction.evidence',
  'witness-comparison': 'ai.quickAction.witnesses',
  'smart-search': 'ai.quickAction.smartSearch',
  'analytics': 'ai.quickAction.analytics',
  'pending-tasks': 'ai.quickAction.pendingTasks',
  'recent-activity': 'ai.quickAction.recentActivity',
  'find-section': 'ai.quickAction.findSection',
  // Level-5 quick actions
  'l5-memory': 'ai.quickAction.memory',
  'l5-predict': 'ai.quickAction.predictRisks',
  'l5-draft': 'ai.quickAction.generateDraft',
  'l5-graph': 'ai.quickAction.knowledgeGraph',
  'l5-search': 'ai.quickAction.nlSearch',
  'l5-station': 'ai.quickAction.stationView',
  'l5-audit': 'ai.quickAction.auditLog',
  // Level-6 quick actions
  'l6-readiness': 'ai.panel.readiness',
  'l6-heatmap': 'ai.panel.heatmap',
  'l6-timeline': 'ai.panel.timelineReplay',
  'l6-reminders': 'ai.panel.smartReminders',
  'l6-dependency': 'ai.panel.dependencyGraph',
  'l6-decision': 'ai.panel.decisionAssistant',
  'l6-supervisor': 'ai.panel.supervisorView',
  'l6-multifir': 'ai.panel.multiFirLinks',
};

const ICON_MAP: Record<string, React.ElementType> = {
  MessageCircle, ArrowRight, BookOpen, FileText, Bell,
  Gavel, CheckSquare, Clock, Search,
  SearchIcon: Search, Users, BarChart2, ListTodo, Activity,
  Brain, Network, Layers, TriangleAlert,
};

// Level colour coding — semantic status chips with dark-mode variants
// Default fallback uses THEME tokens resolved at render via useColorScheme
function chipStyle(id: string, isDark: boolean) {
  if (id.startsWith('l7-')) return isDark ? {
    bg: 'rgba(234, 88, 12, 0.15)', border: 'rgba(234, 88, 12, 0.3)', text: '#FDBA74', icon: '#FB923C',
  } : {
    bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', icon: '#EA580C',
  };
  if (id.startsWith('l6-')) return isDark ? {
    bg: 'rgba(147, 51, 234, 0.15)', border: 'rgba(147, 51, 234, 0.3)', text: '#D8B4FE', icon: '#C084FC',
  } : {
    bg: '#FAF5FF', border: '#E9D5FF', text: '#6B21A8', icon: '#9333EA',
  };
  if (id.startsWith('l5-')) return isDark ? {
    bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', text: '#93C5FD', icon: '#60A5FA',
  } : {
    bg: '#EFF6FF', border: '#DBEAFE', text: '#1E40AF', icon: '#3B82F6',
  };
  return null; // resolved to theme tokens in render
}

interface Props {
  onAction: (id: QuickActionId) => void;
  disabled?: boolean;
  hideDraftActions?: boolean;
}

export const AIQuickChips = memo(function AIQuickChips({ onAction, disabled, hideDraftActions }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';
  const [expanded, setExpanded] = useState(false);

  const actions = hideDraftActions
    ? QUICK_ACTIONS.filter((a) => !a.id.startsWith('draft-') && a.id !== 'l5-draft')
    : QUICK_ACTIONS;

  const coreActions = actions.filter((a) => !/^l[567]-/.test(a.id));
  const advancedActions = actions.filter((a) => /^l[567]-/.test(a.id));

  const defaultCs = {
    bg: C.muted, border: C.border,
    text: C.foreground, icon: C.mutedForeground,
  };

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card }}>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 7, gap: 6 }}
      >
        {coreActions.map((action) => {
          const Icon = ICON_MAP[action.icon] ?? MessageCircle;
          const cs   = chipStyle(action.id, isDark) ?? defaultCs;
          const label = QUICK_ACTION_MAP[action.id] ? t(QUICK_ACTION_MAP[action.id]) : action.label;
          return (
            <Pressable
              key={action.id}
              onPress={() => !disabled && onAction(action.id)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={label}
              android_ripple={{ color: cs.border, borderless: false, radius: 18 }}
              className="active:opacity-55"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                height: 36, paddingHorizontal: 12,
                borderRadius: 18, borderWidth: 1,
                borderColor: cs.border, backgroundColor: cs.bg,
                opacity: disabled ? 0.4 : 1,
              }}
            >
              <Icon size={13} color={cs.icon} strokeWidth={2} />
              <Text style={{ fontSize: 12, fontWeight: '500', color: cs.text }}>
                {label}
              </Text>
            </Pressable>
          );
        })}

        {advancedActions.length > 0 && !expanded && (
          <Pressable
            onPress={() => setExpanded(true)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('ai.more')}
            android_ripple={{ color: defaultCs.border, borderless: false, radius: 18 }}
            className="active:opacity-55"
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              height: 36, paddingHorizontal: 12,
              borderRadius: 18, borderWidth: 1,
              borderColor: defaultCs.border, backgroundColor: defaultCs.bg,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <MoreHorizontal size={13} color={defaultCs.icon} strokeWidth={2} />
            <Text style={{ fontSize: 12, fontWeight: '500', color: defaultCs.text }}>
              {t('ai.more')}
            </Text>
          </Pressable>
        )}

        {expanded && advancedActions.map((action) => {
          const Icon = ICON_MAP[action.icon] ?? MessageCircle;
          const cs   = chipStyle(action.id, isDark) ?? defaultCs;
          const label = QUICK_ACTION_MAP[action.id] ? t(QUICK_ACTION_MAP[action.id]) : action.label;
          return (
            <Pressable
              key={action.id}
              onPress={() => !disabled && onAction(action.id)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={label}
              android_ripple={{ color: cs.border, borderless: false, radius: 18 }}
              className="active:opacity-55"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                height: 36, paddingHorizontal: 12,
                borderRadius: 18, borderWidth: 1,
                borderColor: cs.border, backgroundColor: cs.bg,
                opacity: disabled ? 0.4 : 1,
              }}
            >
              <Icon size={13} color={cs.icon} strokeWidth={2} />
              <Text style={{ fontSize: 12, fontWeight: '500', color: cs.text }}>
                {label}
              </Text>
            </Pressable>
          );
        })}

        {expanded && (
          <Pressable
            onPress={() => setExpanded(false)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('ai.less')}
            android_ripple={{ color: defaultCs.border, borderless: false, radius: 18 }}
            className="active:opacity-55"
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              height: 36, paddingHorizontal: 12,
              borderRadius: 18, borderWidth: 1,
              borderColor: defaultCs.border, backgroundColor: defaultCs.bg,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <ChevronsLeft size={13} color={defaultCs.icon} strokeWidth={2} />
            <Text style={{ fontSize: 12, fontWeight: '500', color: defaultCs.text }}>
              {t('ai.less')}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
});

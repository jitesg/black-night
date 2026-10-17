/**
 * AISuggestedPrompts — Empty-state component shown when no messages exist.
 *
 * Replaces the large blank space below quick chips.
 * Shows context-aware prompt cards when a FIR is active,
 * or generic investigation prompts otherwise.
 *
 * UI-ONLY. Calls onSend with the selected prompt text.
 */

import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  FileSearch, BookOpen, CheckSquare, Clock,
  Users, Scale, Brain, MessageCircle, Sparkles,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

interface PromptCard {
  id: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  title: string;
  prompt: string;
  color: string;
  darkColor: string;
  iconBg: string;
  darkIconBg: string;
  border: string;
  darkBorder: string;
}

const GENERAL_PROMPTS: PromptCard[] = [
  {
    id: 'firSummary',
    icon: FileSearch,
    title: 'FIR Summary',
    prompt: 'Give me a full summary of this FIR including all key facts and current status.',
    color: '#1D4ED8', darkColor: '#60A5FA', iconBg: '#DBEAFE', darkIconBg: 'rgba(59, 130, 246, 0.15)', border: '#BFDBFE', darkBorder: 'rgba(59, 130, 246, 0.3)',
  },
  {
    id: 'nextSteps',
    icon: CheckSquare,
    title: 'Next Steps',
    prompt: 'What are the most critical next steps I need to take in this investigation?',
    color: '#15803D', darkColor: '#4ADE80', iconBg: '#DCFCE7', darkIconBg: 'rgba(34, 197, 94, 0.15)', border: '#BBF7D0', darkBorder: 'rgba(34, 197, 94, 0.3)',
  },
  {
    id: 'pendingTasks',
    icon: Clock,
    title: 'Pending Tasks',
    prompt: 'List all pending tasks and overdue items for this case, sorted by priority.',
    color: '#B45309', darkColor: '#FBBF24', iconBg: '#FEF3C7', darkIconBg: 'rgba(245, 158, 11, 0.15)', border: '#FDE68A', darkBorder: 'rgba(245, 158, 11, 0.3)',
  },
  {
    id: 'accusedProfile',
    icon: Users,
    title: 'Accused Profile',
    prompt: 'Provide a detailed profile of all accused persons and their roles in the incident.',
    color: '#7C3AED', darkColor: '#C084FC', iconBg: '#EDE9FE', darkIconBg: 'rgba(147, 51, 234, 0.15)', border: '#DDD6FE', darkBorder: 'rgba(147, 51, 234, 0.3)',
  },
  {
    id: 'legalSections',
    icon: Scale,
    title: 'Legal Sections',
    prompt: 'Explain the legal sections applied in this FIR and what each one means.',
    color: '#0F766E', darkColor: '#2DD4BF', iconBg: '#CCFBF1', darkIconBg: 'rgba(20, 184, 166, 0.15)', border: '#99F6E4', darkBorder: 'rgba(20, 184, 166, 0.3)',
  },
  {
    id: 'investigationHealth',
    icon: Brain,
    title: 'Investigation Health',
    prompt: 'Assess the overall health of this investigation and identify any weaknesses.',
    color: '#DC2626', darkColor: '#F87171', iconBg: '#FEE2E2', darkIconBg: 'rgba(239, 68, 68, 0.15)', border: '#FECACA', darkBorder: 'rgba(239, 68, 68, 0.3)',
  },
  {
    id: 'evidenceChecklist',
    icon: BookOpen,
    title: 'Evidence Checklist',
    prompt: 'What evidence is still missing? Give me a checklist of items to collect.',
    color: '#1D4ED8', darkColor: '#60A5FA', iconBg: '#DBEAFE', darkIconBg: 'rgba(59, 130, 246, 0.15)', border: '#BFDBFE', darkBorder: 'rgba(59, 130, 246, 0.3)',
  },
  {
    id: 'draftDiary',
    icon: MessageCircle,
    title: 'Draft Diary',
    prompt: 'Draft a case diary entry for today summarising the latest investigation activities.',
    color: '#374151', darkColor: '#9CA3AF', iconBg: '#F3F4F6', darkIconBg: 'rgba(156, 163, 175, 0.15)', border: '#E5E7EB', darkBorder: 'rgba(156, 163, 175, 0.3)',
  },
];

const NO_FIR_PROMPTS: PromptCard[] = [
  {
    id: 'myFirs',
    icon: FileSearch,
    title: 'My FIRs',
    prompt: 'Show me all active FIRs in my station.',
    color: '#1D4ED8', darkColor: '#60A5FA', iconBg: '#DBEAFE', darkIconBg: 'rgba(59, 130, 246, 0.15)', border: '#BFDBFE', darkBorder: 'rgba(59, 130, 246, 0.3)',
  },
  {
    id: 'bnsSections',
    icon: Scale,
    title: 'BNS Sections',
    prompt: 'Explain the key sections of the Bharatiya Nyaya Sanhita for a robbery case.',
    color: '#0F766E', darkColor: '#2DD4BF', iconBg: '#CCFBF1', darkIconBg: 'rgba(20, 184, 166, 0.15)', border: '#99F6E4', darkBorder: 'rgba(20, 184, 166, 0.3)',
  },
  {
    id: 'knowledgeBase',
    icon: BookOpen,
    title: 'Knowledge Base',
    prompt: 'What investigation checklists do we have for murder cases?',
    color: '#7C3AED', darkColor: '#C084FC', iconBg: '#EDE9FE', darkIconBg: 'rgba(147, 51, 234, 0.15)', border: '#DDD6FE', darkBorder: 'rgba(147, 51, 234, 0.3)',
  },
  {
    id: 'help',
    icon: Brain,
    title: 'Help',
    prompt: 'What can you help me with as an AI Investigation Copilot?',
    color: '#374151', darkColor: '#9CA3AF', iconBg: '#F3F4F6', darkIconBg: 'rgba(156, 163, 175, 0.15)', border: '#E5E7EB', darkBorder: 'rgba(156, 163, 175, 0.3)',
  },
];

interface Props {
  hasFir: boolean;
  onSend: (prompt: string) => void;
}

export const AISuggestedPrompts = memo(function AISuggestedPrompts({ hasFir, onSend }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';
  const prompts = hasFir ? GENERAL_PROMPTS : NO_FIR_PROMPTS;

  return (
    <View>
      {/* Welcome header */}
      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 16, paddingHorizontal: 24 }}>
        <View style={{
          width: 48, height: 48, borderRadius: 24,
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE',
          alignItems: 'center', justifyContent: 'center', marginBottom: 12,
        }}>
          <Sparkles size={22} color={isDark ? '#60A5FA' : '#2563EB'} strokeWidth={1.8} />
        </View>
        <Text style={{
          fontSize: 16, fontWeight: '700', color: C.foreground,
          textAlign: 'center', letterSpacing: -0.3,
        }}>
          {hasFir ? t('ai.whatWouldYouLikeToKnow') : t('ai.howCanIHelp')}
        </Text>
        <Text style={{
          fontSize: 12, color: C.mutedForeground, textAlign: 'center',
          lineHeight: 18, marginTop: 4,
        }}>
          {hasFir
            ? t('ai.tapPromptHint')
            : t('ai.openFirHint')}
        </Text>
      </View>

      <View style={{
        flexDirection: 'row', flexWrap: 'wrap', gap: 10,
        paddingHorizontal: 16, paddingBottom: 16,
      }}>
        {prompts.map((card, i) => (
          <PromptCardItem key={card.id} card={card} onPress={onSend} index={i} />
        ))}
      </View>
    </View>
  );
});

const PromptCardItem = memo(function PromptCardItem({
  card, onPress, index,
}: {
  card: PromptCard;
  onPress: (prompt: string) => void;
  index: number;
}) {
  const { t } = useTranslation();
  const Icon = card.icon;
  const opacity   = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(10)).current;
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';

  const localizedTitle = t(`ai.prompt.${card.id}.title`);
  const localizedPrompt = t(`ai.prompt.${card.id}.prompt`);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 220, delay: index * 40, useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 220, delay: index * 40, useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardColor  = isDark ? card.darkColor : card.color;
  const cardIconBg = isDark ? card.darkIconBg : card.iconBg;
  const cardBorder = isDark ? card.darkBorder : card.border;

  return (
    <Animated.View style={{
      width: '47.5%', opacity, transform: [{ translateY }],
    }}>
      <Pressable
        onPress={() => onPress(card.prompt)}
        accessibilityRole="button"
        accessibilityLabel={`Ask: ${localizedTitle}`}
        className="active:opacity-70"
        style={{
          borderRadius: 14, borderWidth: 1,
          borderColor: C.border,
          backgroundColor: C.card,
          padding: 12, gap: 8,
          minHeight: 88, justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: cardIconBg,
            borderWidth: 1, borderColor: cardBorder,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} color={cardColor} strokeWidth={2} />
          </View>
        </View>

        <View>
          <Text style={{
            fontSize: 12, fontWeight: '700', color: C.foreground,
            letterSpacing: -0.2,
          }} numberOfLines={1}>
            {localizedTitle}
          </Text>
          <Text style={{
            fontSize: 10, color: C.mutedForeground,
            lineHeight: 14, marginTop: 2,
          }} numberOfLines={2}>
            {localizedPrompt}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

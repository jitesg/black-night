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
import {
  FileSearch, BookOpen, CheckSquare, Clock,
  Users, Scale, Brain, MessageCircle, Sparkles,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

interface PromptCard {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  title: string;
  prompt: string;
  color: string;
  iconBg: string;
  border: string;
}

const GENERAL_PROMPTS: PromptCard[] = [
  {
    icon: FileSearch,
    title: 'FIR Summary',
    prompt: 'Give me a full summary of this FIR including all key facts and current status.',
    color: '#1D4ED8', iconBg: '#DBEAFE', border: '#BFDBFE',
  },
  {
    icon: CheckSquare,
    title: 'Next Steps',
    prompt: 'What are the most critical next steps I need to take in this investigation?',
    color: '#15803D', iconBg: '#DCFCE7', border: '#BBF7D0',
  },
  {
    icon: Clock,
    title: 'Pending Tasks',
    prompt: 'List all pending tasks and overdue items for this case, sorted by priority.',
    color: '#B45309', iconBg: '#FEF3C7', border: '#FDE68A',
  },
  {
    icon: Users,
    title: 'Accused Profile',
    prompt: 'Provide a detailed profile of all accused persons and their roles in the incident.',
    color: '#7C3AED', iconBg: '#EDE9FE', border: '#DDD6FE',
  },
  {
    icon: Scale,
    title: 'Legal Sections',
    prompt: 'Explain the legal sections applied in this FIR and what each one means.',
    color: '#0F766E', iconBg: '#CCFBF1', border: '#99F6E4',
  },
  {
    icon: Brain,
    title: 'Investigation Health',
    prompt: 'Assess the overall health of this investigation and identify any weaknesses.',
    color: '#DC2626', iconBg: '#FEE2E2', border: '#FECACA',
  },
  {
    icon: BookOpen,
    title: 'Evidence Checklist',
    prompt: 'What evidence is still missing? Give me a checklist of items to collect.',
    color: '#1D4ED8', iconBg: '#DBEAFE', border: '#BFDBFE',
  },
  {
    icon: MessageCircle,
    title: 'Draft Diary',
    prompt: 'Draft a case diary entry for today summarising the latest investigation activities.',
    color: '#374151', iconBg: '#F3F4F6', border: '#E5E7EB',
  },
];

const NO_FIR_PROMPTS: PromptCard[] = [
  {
    icon: FileSearch,
    title: 'My FIRs',
    prompt: 'Show me all active FIRs in my station.',
    color: '#1D4ED8', iconBg: '#DBEAFE', border: '#BFDBFE',
  },
  {
    icon: Scale,
    title: 'BNS Sections',
    prompt: 'Explain the key sections of the Bharatiya Nyaya Sanhita for a robbery case.',
    color: '#0F766E', iconBg: '#CCFBF1', border: '#99F6E4',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    prompt: 'What investigation checklists do we have for murder cases?',
    color: '#7C3AED', iconBg: '#EDE9FE', border: '#DDD6FE',
  },
  {
    icon: Brain,
    title: 'Help',
    prompt: 'What can you help me with as an AI Investigation Copilot?',
    color: '#374151', iconBg: '#F3F4F6', border: '#E5E7EB',
  },
];

interface Props {
  hasFir: boolean;
  onSend: (prompt: string) => void;
}

export const AISuggestedPrompts = memo(function AISuggestedPrompts({ hasFir, onSend }: Props) {
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  const prompts = hasFir ? GENERAL_PROMPTS : NO_FIR_PROMPTS;

  return (
    <View>
      {/* Welcome header */}
      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 16, paddingHorizontal: 24 }}>
        <View style={{
          width: 48, height: 48, borderRadius: 24,
          backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
          alignItems: 'center', justifyContent: 'center', marginBottom: 12,
        }}>
          <Sparkles size={22} color="#2563EB" strokeWidth={1.8} />
        </View>
        <Text style={{
          fontSize: 16, fontWeight: '700', color: colors.foreground,
          textAlign: 'center', letterSpacing: -0.3,
        }}>
          {hasFir ? 'What would you like to know?' : 'How can I help you?'}
        </Text>
        <Text style={{
          fontSize: 12, color: colors.mutedForeground, textAlign: 'center',
          lineHeight: 18, marginTop: 4,
        }}>
          {hasFir
            ? 'Tap a prompt or type your own question below'
            : 'Open a FIR for case-specific AI assistance'}
        </Text>
      </View>

      <View style={{
        flexDirection: 'row', flexWrap: 'wrap', gap: 10,
        paddingHorizontal: 16, paddingBottom: 16,
      }}>
        {prompts.map((card, i) => (
          <PromptCardItem key={i} card={card} onPress={onSend} index={i} />
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
  const Icon = card.icon;
  const opacity   = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(10)).current;
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];

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

  return (
    <Animated.View style={{
      width: '47%', opacity, transform: [{ translateY }],
    }}>
      <Pressable
        onPress={() => onPress(card.prompt)}
        accessibilityRole="button"
        accessibilityLabel={`Prompt: ${card.title}`}
        className="active:opacity-65"
        style={{
          borderRadius: 16, borderWidth: 1,
          borderColor: card.border,
          backgroundColor: colors.card,
          padding: 14, gap: 10,
        }}
      >
        <View style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: card.iconBg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={card.color} strokeWidth={2} />
        </View>
        <View style={{ gap: 3 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.foreground }}>
            {card.title}
          </Text>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, lineHeight: 16 }} numberOfLines={2}>
            {card.prompt}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

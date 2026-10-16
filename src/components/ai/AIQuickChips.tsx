/**
 * AIQuickChips — compact horizontally scrollable action chip row.
 * Minimal: 36dp chips, text + icon, level-coloured, no shadow, 1px border.
 * Lives just above the composer. Single source of all quick actions.
 */

import React, { memo } from 'react';
import { ScrollView, Text, Pressable, View } from 'react-native';
import {
  MessageCircle, ArrowRight, BookOpen, FileText, Bell, Scale,
  CheckSquare, Clock, Search, Users, BarChart2, ListTodo, Activity,
  Brain, Network, Layers, Gavel, TriangleAlert,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { QUICK_ACTIONS } from '@/ai/AICopilotService';
import type { QuickActionId } from '@/ai/AITypes';

const ICON_MAP: Record<string, React.ElementType> = {
  MessageCircle, ArrowRight, BookOpen, FileText, Bell,
  Gavel, CheckSquare, Clock, Search,
  SearchIcon: Search, Users, BarChart2, ListTodo, Activity,
  Brain, Network, Layers, TriangleAlert,
};

// Level colour coding — semantic status chips (intentionally fixed)
// Default fallback uses THEME tokens resolved at render via useColorScheme
function chipStyle(id: string) {
  if (id.startsWith('l7-')) return {
    bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', icon: '#EA580C',
  };
  if (id.startsWith('l6-')) return {
    bg: '#FAF5FF', border: '#E9D5FF', text: '#6B21A8', icon: '#9333EA',
  };
  if (id.startsWith('l5-')) return {
    bg: '#EFF6FF', border: '#DBEAFE', text: '#1E40AF', icon: '#3B82F6',
  };
  return null; // resolved to theme tokens in render
}

interface Props {
  onAction: (id: QuickActionId) => void;
  disabled?: boolean;
}

export const AIQuickChips = memo(function AIQuickChips({ onAction, disabled }: Props) {
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card }}>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 7, gap: 6 }}
      >
        {QUICK_ACTIONS.map((action) => {
          const Icon = ICON_MAP[action.icon] ?? MessageCircle;
          const cs   = chipStyle(action.id) ?? {
            bg: colors.muted, border: colors.border,
            text: colors.foreground, icon: colors.mutedForeground,
          };
          return (
            <Pressable
              key={action.id}
              onPress={() => !disabled && onAction(action.id)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={action.label}
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
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

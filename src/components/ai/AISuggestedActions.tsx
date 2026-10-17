/**
 * AISuggestedActions — follow-up suggestion chips.
 * Minimal: small text-only pills, #EFF6FF tint, shown inline above composer.
 */

import React, { memo } from 'react';
import { ScrollView, Text, Pressable } from 'react-native';
import { CornerDownRight } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { THEME } from '@/lib/theme';
import { QUICK_ACTIONS } from '@/ai/AICopilotService';
import { QUICK_ACTION_MAP } from './AIQuickChips';

const FALLBACK_LABEL_MAP: Record<string, string> = {
  'check health score': 'ai.quickAction.checkHealthScore',
  'view timeline': 'ai.quickAction.viewTimeline',
  'view analytics': 'ai.quickAction.viewAnalytics',
};

interface Props {
  actions: string[];
  onAction: (action: string) => void;
  disabled?: boolean;
}

export const AISuggestedActions = memo(function AISuggestedActions({ actions, onAction, disabled }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const isDark = colorScheme === 'dark';
  if (actions.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6, gap: 6 }}
      style={{ backgroundColor: C.card }}
    >
      {actions.map((action, i) => {
        const found = QUICK_ACTIONS.find(
          (a) => a.label.toLowerCase() === action.toLowerCase()
        );
        const mappedKey = found ? QUICK_ACTION_MAP[found.id] : FALLBACK_LABEL_MAP[action.toLowerCase()];
        const displayLabel = mappedKey ? t(mappedKey) : action;

        return (
          <Pressable
            key={i}
            onPress={() => !disabled && onAction(action)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('ai.suggested', { action: displayLabel })}
            className="active:opacity-55"
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              height: 30, paddingHorizontal: 11,
              borderRadius: 15, borderWidth: 1,
              borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#DBEAFE',
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <CornerDownRight size={10} color={isDark ? '#60A5FA' : '#3B82F6'} strokeWidth={2.5} />
            <Text style={{ fontSize: 11, fontWeight: '500', color: isDark ? '#93C5FD' : '#1E40AF' }}>
              {displayLabel}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

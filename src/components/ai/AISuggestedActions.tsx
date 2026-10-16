/**
 * AISuggestedActions — follow-up suggestion chips.
 * Minimal: small text-only pills, #EFF6FF tint, shown inline above composer.
 */

import React, { memo } from 'react';
import { ScrollView, Text, Pressable } from 'react-native';
import { CornerDownRight } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

interface Props {
  actions: string[];
  onAction: (action: string) => void;
  disabled?: boolean;
}

export const AISuggestedActions = memo(function AISuggestedActions({ actions, onAction, disabled }: Props) {
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  if (actions.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6, gap: 6 }}
      style={{ backgroundColor: colors.card }}
    >
      {actions.map((action, i) => (
        <Pressable
          key={i}
          onPress={() => !disabled && onAction(action)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Suggested: ${action}`}
          className="active:opacity-55"
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            height: 30, paddingHorizontal: 11,
            borderRadius: 15, borderWidth: 1,
            borderColor: '#DBEAFE',
            backgroundColor: colorScheme === 'dark' ? colors.muted : '#EFF6FF',
            opacity: disabled ? 0.4 : 1,
          }}
        >
          <CornerDownRight size={10} color="#3B82F6" strokeWidth={2.5} />
          <Text style={{ fontSize: 11, fontWeight: '500', color: '#1E40AF' }}>
            {action}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
});

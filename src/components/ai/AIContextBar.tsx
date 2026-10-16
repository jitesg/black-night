/**
 * AIContextBar — single-line scrollable context pill row.
 * Minimal: no border radius card, 28dp pills, #F3F4F6 bg, 1px #E5E7EB border.
 * One hairline bottom divider. Zero vertical padding waste.
 */

import React, { memo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  Building2, User, Zap, FileSearch, Wifi, WifiOff, Shield,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import type { AIContextSnapshot } from '@/ai/AITypes';

interface Props {
  context: AIContextSnapshot;
  isOffline: boolean;
}

type ChipVariant = 'default' | 'success' | 'warning' | 'primary';

// Minimal palette: near-zero saturation for default (resolved at render via theme),
// gentle fixed signal colours for success/warning/primary variants.
const CHIP_FIXED: Record<Exclude<ChipVariant, 'default'>, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: '#F0FDF4', border: '#D1FAE5', text: '#166534', icon: '#22C55E' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: '#F59E0B' },
  primary: { bg: '#EFF6FF', border: '#DBEAFE', text: '#1E40AF', icon: '#3B82F6' },
};

function ContextPill({
  icon: Icon, label, variant = 'default',
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  label: string;
  variant?: ChipVariant;
}) {
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  const s = variant === 'default'
    ? { bg: colors.muted, border: colors.border, text: colors.foreground, icon: colors.mutedForeground }
    : CHIP_FIXED[variant];
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      height: 28, paddingHorizontal: 10,
      borderRadius: 14, borderWidth: 1,
      backgroundColor: s.bg, borderColor: s.border,
    }}>
      <Icon size={11} color={s.icon} strokeWidth={2} />
      <Text style={{ fontSize: 11, fontWeight: '500', color: s.text, letterSpacing: 0.05 }}>
        {label}
      </Text>
    </View>
  );
}

export const AIContextBar = memo(function AIContextBar({ context, isOffline }: Props) {
  const { colorScheme } = useColorScheme();
  const colors = THEME[colorScheme ?? 'light'];
  const { workspace, activeFirNumber } = context;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 7, gap: 6 }}
      style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}
    >
      {workspace.policeStation ? (
        <ContextPill icon={Building2} label={workspace.policeStation} />
      ) : null}
      {workspace.officerName ? (
        <ContextPill icon={User} label={workspace.officerName} />
      ) : null}
      <ContextPill
        icon={isOffline ? WifiOff : Wifi}
        label={isOffline ? 'Offline' : 'AI Online'}
        variant={isOffline ? 'warning' : 'success'}
      />
      {activeFirNumber ? (
        <ContextPill icon={FileSearch} label={`FIR ${activeFirNumber}`} variant="primary" />
      ) : null}
      <ContextPill
        icon={activeFirNumber ? Shield : Zap}
        label={activeFirNumber ? 'Investigation Mode' : 'General Mode'}
        variant={activeFirNumber ? 'primary' : 'default'}
      />
    </ScrollView>
  );
});

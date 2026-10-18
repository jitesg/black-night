/**
 * IntelligenceModal.tsx
 * Full-screen Investigation Intelligence modal — Level-4 AI Engine.
 * Opened from the "Intelligence" button in AICopilotModal header.
 *
 * SAFETY: Read-only. Advisory only. All actions require officer confirmation.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Cpu, RefreshCw } from 'lucide-react-native';
import type { InvestigationIntelligenceReport } from '@/ai/intelligence/IntelligenceTypes';
import { IntelligenceDashboard } from './IntelligenceDashboard';

interface Props {
  visible: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  report: InvestigationIntelligenceReport | null;
  isLoading: boolean;
}

export function IntelligenceModal({ visible, onClose, onRefresh, report, isLoading }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
              <Cpu size={15} className="text-primary-foreground" />
            </View>
            <View>
              <Text className="text-base font-semibold text-foreground">
                Investigation Intelligence
              </Text>
              <Text className="text-xs text-muted-foreground">
                Level-4 · Advisory Only
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {/* Context confidence badge */}
            {report && (
              <View className="rounded-full bg-muted px-2.5 py-1">
                <Text textBreakStrategy="simple" className="text-xs text-muted-foreground font-medium">
                  {report.contextConfidencePct}% context
                </Text>
              </View>
            )}
            {/* Refresh button */}
            {onRefresh && !isLoading && (
              <Pressable
                onPress={onRefresh}
                className="w-8 h-8 rounded-full bg-muted items-center justify-center active:opacity-60"
              >
                <RefreshCw size={14} className="text-muted-foreground" />
              </Pressable>
            )}
            {/* Close button */}
            <Pressable
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-muted items-center justify-center active:opacity-60"
            >
              <X size={16} className="text-muted-foreground" />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center gap-4">
            <ActivityIndicator size="large" />
            <Text className="text-sm text-muted-foreground text-center px-8">
              Running 11 intelligence engines in parallel…
            </Text>
            <Text className="text-xs text-muted-foreground text-center px-12">
              Analysing crime playbook · Legal compliance · Evidence graph ·
              Contradictions · Timeline · Charge sheet · Risk prediction…
            </Text>
          </View>
        ) : report ? (
          <IntelligenceDashboard report={report} />
        ) : (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Cpu size={40} className="text-muted-foreground" />
            <Text className="text-base font-semibold text-foreground text-center">
              Intelligence Report
            </Text>
            <Text className="text-sm text-muted-foreground text-center">
              Open a FIR and tap Intelligence to generate a full investigation analysis.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

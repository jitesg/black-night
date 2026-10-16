/**
 * L7PanelShell.tsx
 * Reusable full-screen modal shell for all Level-7 panels.
 * Minimal design: ample whitespace, clear typography hierarchy, no decorative colors.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, RefreshCw } from 'lucide-react-native';

interface L7PanelShellProps {
  visible:     boolean;
  title:       string;
  subtitle?:   string;
  onClose:     () => void;
  onRefresh?:  () => void;
  loading?:    boolean;
  children:    React.ReactNode;
}

export function L7PanelShell({
  visible, title, subtitle, onClose, onRefresh, loading, children,
}: L7PanelShellProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-start justify-between px-5 pt-4 pb-4 border-b border-border">
          <View className="flex-1 mr-4">
            <Text className="text-xl font-semibold text-foreground" numberOfLines={1}>{title}</Text>
            {subtitle ? (
              <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>
          <View className="flex-row gap-3 items-center">
            {onRefresh ? (
              <Pressable
                onPress={onRefresh}
                className="w-8 h-8 items-center justify-center active:opacity-50"
                accessibilityLabel="Refresh"
              >
                <RefreshCw size={18} className="text-muted-foreground" />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              className="w-8 h-8 items-center justify-center active:opacity-50"
              accessibilityLabel="Close"
            >
              <X size={20} className="text-muted-foreground" />
            </Pressable>
          </View>
        </View>

        {/* Body */}
        {loading ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="small" className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">Analyzing investigation…</Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 py-5 gap-5"
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
          >
            {children}

            {/* Advisory footer */}
            <View className="mt-2 pt-4 border-t border-border">
              <Text className="text-xs text-muted-foreground text-center leading-5">
                AI advisory only · Read-only · Officer makes all decisions
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

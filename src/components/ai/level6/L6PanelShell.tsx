/**
 * L6PanelShell.tsx
 * Reusable full-screen modal shell for all Level-6 panels.
 * Provides consistent header, refresh button, loading state, and advisory footer.
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
import { X, RefreshCw, Layers } from 'lucide-react-native';

interface Props {
  title:     string;
  visible:   boolean;
  onClose:   () => void;
  onRefresh: () => void;
  isLoading: boolean;
  children?: React.ReactNode;
}

export function L6PanelShell({ title, visible, onClose, onRefresh, isLoading, children }: Props) {
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
            <View className="w-7 h-7 rounded-full bg-primary items-center justify-center">
              <Layers size={13} className="text-primary-foreground" />
            </View>
            <View>
              <Text className="text-base font-semibold text-foreground">{title}</Text>
              <Text className="text-xs text-muted-foreground">Level-6 · Read-only advisory</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={onRefresh}
              disabled={isLoading}
              className="w-8 h-8 rounded-full bg-muted items-center justify-center active:opacity-60"
            >
              {isLoading
                ? <ActivityIndicator size="small" color="#6B7280" />
                : <RefreshCw size={14} className="text-muted-foreground" />}
            </Pressable>
            <Pressable
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-muted items-center justify-center active:opacity-60"
            >
              <X size={16} className="text-muted-foreground" />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <View className="flex-1">
          {isLoading ? (
            <View className="flex-1 items-center justify-center gap-3">
              <ActivityIndicator size="large" color="#6B7280" />
              <Text className="text-sm text-muted-foreground">Generating intelligence…</Text>
            </View>
          ) : (
            children ?? (
              <View className="flex-1 items-center justify-center px-8">
                <Text className="text-2xl mb-3">🔍</Text>
                <Text className="text-sm font-medium text-foreground text-center">
                  No data available
                </Text>
                <Text className="text-xs text-muted-foreground text-center mt-1">
                  Open a FIR first, then tap refresh to generate intelligence.
                </Text>
              </View>
            )
          )}
        </View>
      </View>
    </Modal>
  );
}

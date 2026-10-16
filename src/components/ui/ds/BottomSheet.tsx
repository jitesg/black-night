/**
 * BottomSheet — MD3 modal bottom sheet with spring animation.
 * Replaces all inline Modal-based action menus across the app.
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, Text, View,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Snap height — 'auto' uses content height, number is dp */
  snapHeight?: 'auto' | number;
  children: React.ReactNode;
}

export const BottomSheet = memo(function BottomSheet({
  visible, onClose, title, children, snapHeight = 'auto',
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(400)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  // Controls whether the Modal is mounted — stays true until exit animation finishes
  const [renderModal, setRenderModal] = useState(visible);

  useEffect(() => {
    if (visible) {
      // Mount first, then animate in
      setRenderModal(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0, damping: 20, stiffness: 260,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1, duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out, then unmount
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 400, duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0, duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setRenderModal(false);
      });
    }
  }, [visible, translateY, opacity]);

  const maxH = typeof snapHeight === 'number' ? snapHeight : screenH * 0.85;

  return (
    <Modal
      transparent
      visible={renderModal}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', opacity }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        className="shadow-xl shadow-black/20"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          backgroundColor: c.card,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight: maxH,
          paddingBottom: insets.bottom + 8,
          transform: [{ translateY }],
        }}
      >
        {/* Handle bar */}
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.border }} />
        </View>

        {/* Title */}
        {title ? (
          <View style={{
            paddingHorizontal: 20, paddingBottom: 12,
            borderBottomWidth: 0.5, borderBottomColor: c.border,
            marginBottom: 4,
          }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: c.foreground }}>{title}</Text>
          </View>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
});

/** Convenience row item for BottomSheet action menus */
export const BottomSheetItem = memo(function BottomSheetItem({
  icon: Icon, label, onPress, destructive = false, disabled = false,
}: {
  icon?: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const color = disabled ? c.mutedForeground : destructive ? c.destructive : c.foreground;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row', alignItems: 'center',
        gap: 14, paddingHorizontal: 20, paddingVertical: 14,
        opacity: disabled ? 0.5 : 1,
      }}
      className="active:opacity-60"
    >
      {Icon ? <Icon size={20} color={color} /> : null}
      <Text style={{ fontSize: 15, fontWeight: '500', color }}>{label}</Text>
    </Pressable>
  );
});

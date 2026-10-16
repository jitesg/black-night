/**
 * FloatingAIButton — MD3 Minimal FAB that opens AI Copilot.
 * 56dp · theme-aware primary color · bottom-left above tab-bar · spring scale animation
 */

import React, { memo, useState, useRef } from 'react';
import { Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { useSegments } from 'expo-router';
import { Bot } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import { AICopilotModal } from './AICopilotModal';

interface Props {
  activeFirId?: string;
}

export const FloatingAIButton = memo(function FloatingAIButton({ activeFirId }: Props) {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];
  const [open, setOpen] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const segs = segments as readonly string[];
  const hasTabBar = segs.includes('mukadma') && segs.includes('(tabs)');
  const bottomOffset = hasTabBar
    ? Math.max(insets.bottom + 76, 88)
    : Math.max(insets.bottom + 20, 32);

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true, damping: 15 }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 15 }).start();

  return (
    <>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: bottomOffset,
          left: 20,
          transform: [{ scale: scaleAnim }],
          zIndex: 999,
        }}
      >
        <Pressable
          onPress={() => setOpen(true)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityLabel="Open AI Copilot"
          accessibilityRole="button"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Bot size={22} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      <AICopilotModal
        visible={open}
        onClose={() => setOpen(false)}
        activeFirId={activeFirId}
      />
    </>
  );
});

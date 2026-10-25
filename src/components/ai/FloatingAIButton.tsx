/**
 * FloatingAIButton — MD3 Minimal FAB that opens AI Copilot.
 * 56dp · theme-aware primary color · bottom-left above tab-bar · spring scale animation
 */

import React, { memo, useEffect, useState, useRef } from 'react';
import { Pressable, Animated, Keyboard } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react-native';
import { THEME } from '@/lib/theme';
import { AICopilotModal } from './AICopilotModal';

interface Props {
  activeFirId?: string;
}

export const FloatingAIButton = memo(function FloatingAIButton({ activeFirId }: Props) {
  const { t } = useTranslation();
  const segments = useSegments();
  const { colorScheme } = useColorScheme();
  const C = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const [open, setOpen] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const segs = segments as readonly string[];
  const hasTabBar = segs.includes('mukadma') && segs.includes('(tabs)');
  const isKaryvahiOrAddScreen = segs.some(
    (s) =>
      s.includes('karyvahi') ||
      s.includes('add-') ||
      s.includes('proceeding') ||
      s.includes('nirodhatmak') ||
      s.includes('case-diary')
  );

  const isLawDetailScreen =
    segs.includes('knowledge') &&
    segs.includes('law') &&
    (segs.includes('[n]') || segs.some((s) => /^\d+$/.test(s)));
  const isLawScreen = segs.includes('knowledge') && segs.includes('law');

  // Add extra bottom padding / raise it on karyvahi, form, and law screens to prevent any overlap
  // On law detail screen: position it ABOVE the bar (bottom offset = barHeight (~64) + safe-area + 12, right 16)
  // The root view already sits above the navigation bar (KeyboardInsetView).
  const bottomOffset = isLawDetailScreen
    ? 64 + 12
    : hasTabBar
    ? 88
    : isKaryvahiOrAddScreen
    ? 104
    : 32;

  // Form screens (add/edit/fill) are full of inputs the button would sit on
  // top of, e.g. the FIR number field — keep it off those screens.
  const isFormScreen = segs.some((s) =>
    s.startsWith('add') || s.startsWith('edit') || s.startsWith('fill') ||
    s === 'take-action' || s === 'editor',
  );

  // While typing, the keyboard lifts the screen and the button would cover
  // the field being edited, so hide it until the keyboard closes.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const hideButton = isFormScreen || keyboardOpen;

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true, damping: 15 }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 15 }).start();

  return (
    <>
      {!hideButton && (
      <Animated.View
        style={{
          position: 'absolute',
          bottom: bottomOffset,
          left: isLawScreen ? undefined : 20,
          right: isLawScreen ? 16 : undefined,
          transform: [{ scale: scaleAnim }],
          zIndex: 999,
        }}
      >
        <Pressable
          onPress={() => setOpen(true)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityLabel={t('ai.openCopilot')}
          accessibilityRole="button"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: C.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Bot size={22} color={C.primaryForeground} />
        </Pressable>
      </Animated.View>
      )}

      <AICopilotModal
        visible={open}
        onClose={() => setOpen(false)}
        activeFirId={activeFirId}
      />
    </>
  );
});

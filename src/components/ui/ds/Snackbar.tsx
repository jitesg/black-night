/**
 * Snackbar — MD3 toast notification system.
 * Usage:
 *   const { show } = useSnackbar();
 *   show({ message: 'Saved!', variant: 'success' });
 */
import React, { createContext, memo, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

type SnackbarVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface SnackbarOptions {
  message: string;
  variant?: SnackbarVariant;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

interface SnackbarContextValue {
  show: (opts: SnackbarOptions) => void;
}

const SnackbarContext = createContext<SnackbarContextValue>({ show: () => {} });

export interface SnackbarProps {
  children: React.ReactNode;
}

export function Snackbar({ children }: SnackbarProps) {
  const { colorScheme } = useColorScheme();
  const c = THEME[colorScheme ?? 'light'];

  const variantConfig: Record<SnackbarVariant, {
    bg: string; text: string; icon?: React.ComponentType<{ size: number; color: string }>;
  }> = {
    default: {
      bg: colorScheme === 'dark' ? c.card : '#1F2937',
      text: colorScheme === 'dark' ? c.foreground : '#F9FAFB',
    },
    success: {
      bg: colorScheme === 'dark' ? '#064E3B' : '#065F46',
      text: colorScheme === 'dark' ? '#A7F3D0' : '#D1FAE5',
      icon: CheckCircle,
    },
    error: {
      bg: colorScheme === 'dark' ? '#7F1D1D' : '#991B1B',
      text: colorScheme === 'dark' ? '#FECACA' : '#FEE2E2',
      icon: AlertCircle,
    },
    warning: {
      bg: colorScheme === 'dark' ? '#78350F' : '#92400E',
      text: colorScheme === 'dark' ? '#FDE68A' : '#FEF3C7',
      icon: AlertCircle,
    },
    info: {
      bg: colorScheme === 'dark' ? '#1E3A5F' : '#1E40AF',
      text: colorScheme === 'dark' ? '#BFDBFE' : '#DBEAFE',
      icon: Info,
    },
  };

  const [opts, setOpts] = useState<SnackbarOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [opacity, translateY]);

  const show = useCallback((o: SnackbarOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpts(o);
    setVisible(true);
    opacity.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 260, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(hide, o.duration ?? 3000);
  }, [opacity, translateY, hide]);

  const cfg = opts ? variantConfig[opts.variant ?? 'default'] : variantConfig.default;
  const Icon = cfg.icon;

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      {visible && opts ? (
        <Animated.View
          style={{
            position: 'absolute', left: 16, right: 16,
            bottom: insets.bottom + 16,
            opacity, transform: [{ translateY }],
            zIndex: 9999,
          }}
        >
          <View
            className="shadow-lg shadow-black/25"
            style={{
              backgroundColor: cfg.bg,
              borderRadius: 12,
              paddingHorizontal: 16, paddingVertical: 12,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}
          >
            {Icon ? <Icon size={18} color={cfg.text} /> : null}
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: cfg.text, lineHeight: 20 }}>
              {opts.message}
            </Text>
            {opts.action ? (
              <Pressable onPress={opts.action.onPress}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: cfg.text, opacity: 0.9 }}>
                  {opts.action.label}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={hide} hitSlop={8}>
                <X size={16} color={cfg.text} />
              </Pressable>
            )}
          </View>
        </Animated.View>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  return useContext(SnackbarContext);
}

/**
 * App Lock — PIN Entry (Unlock screen)
 *
 * Prompts numeric PIN or biometric authentication to unlock the app.
 * On success: touches session and navigates to `returnTo` param (default: '/(app)/home').
 * Shows lockout countdown after 5 failed attempts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Vibration, ActivityIndicator,
} from 'react-native';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useTranslation } from 'react-i18next';
import { T } from '@/lib/typography';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Lock, ChevronLeft, Delete, Fingerprint } from 'lucide-react-native';
import {
  verifyAppLockPin,
  isAppLockLockedOut,
  appLockLockoutSecondsRemaining,
  appLockAttemptsRemaining,
  isBiometricAvailable,
  authenticateWithBiometric,
} from '@/lib/appLockAuth';
import { useSettingsStore } from '@/hooks/useSettingsStore';
import { useAppLock } from '@/context/AppLockContext';

const NAVY = '#1E3A5F';
const SAFFRON = '#2563EB';
const RED     = '#DC2626';
const PIN_LEN = 6;

// ── Shared sub-components ─────────────────────────────────────────────────────
function PinDots({ value, total, color }: { value: string; total: number; color: string }) {
  return (
    <View className="flex-row items-center justify-center gap-4 my-8">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: i < value.length ? color : 'transparent',
            borderWidth: 2, borderColor: i < value.length ? color : '#D1D5DB',
          }}
        />
      ))}
    </View>
  );
}

function NumPad({ onPress, disabled }: { onPress: (k: string) => void; disabled?: boolean }) {
  return (
    <View style={{ width: 280, alignSelf: 'center', opacity: disabled ? 0.4 : 1 }}>
      {[
        ['1','2','3'],
        ['4','5','6'],
        ['7','8','9'],
        ['','0','⌫'],
      ].map((row, ri) => (
        <View key={ri} className="flex-row justify-between mb-3">
          {row.map((k, ki) => (
            <Pressable
              key={ki}
              onPress={() => k && !disabled && onPress(k)}
              disabled={!k || disabled}
              className="items-center justify-center active:opacity-50"
              style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: k ? '#F9FAFB' : 'transparent',
              }}
            >
              {k === '⌫'
                ? <Delete size={22} color="#374151" />
                : <Text style={{ ...T.title3, fontWeight: T.weight.semibold, color: '#111827' }}>{k}</Text>}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function useShake() {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const shake = useCallback(() => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);
  return { shakeAnim, shake };
}

export default function PinEntryScreen() {
  const { t } = useTranslation();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { settings } = useSettingsStore();
  const { unlock } = useAppLock();

  usePreventScreenCapture();

  const [pin, setPin]                         = useState('');
  const [error, setError]                     = useState('');
  const [locked, setLocked]                   = useState(false);
  const [countdown, setCountdown]             = useState(0);
  const [checking, setChecking]               = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricChecking, setBiometricChecking]   = useState(false);
  const { shakeAnim, shake }                  = useShake();
  const timerRef                              = useRef<ReturnType<typeof setInterval> | null>(null);

  const targetPath = returnTo ? decodeURIComponent(returnTo) : '/(app)/home';

  const unlockAndNavigate = useCallback(() => {
    unlock();
    router.replace(targetPath as never);
  }, [targetPath, unlock]);

  // Lockout countdown tick
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startLockoutTimer = useCallback(() => {
    setLocked(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = appLockLockoutSecondsRemaining();
      setCountdown(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setLocked(false);
        setError('');
        setCountdown(0);
      }
    }, 500);
  }, []);

  // Check lockout on mount
  useEffect(() => {
    if (isAppLockLockedOut()) {
      startLockoutTimer();
    }
  }, [startLockoutTimer]);

  // Biometric auto-trigger on mount if enabled and available
  const triggerBiometricAuth = useCallback(async () => {
    try {
      setBiometricChecking(true);
      const success = await authenticateWithBiometric();
      setBiometricChecking(false);
      if (success) {
        unlockAndNavigate();
      }
    } catch {
      setBiometricChecking(false);
    }
  }, [unlockAndNavigate]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (settings.biometric) {
        const available = await isBiometricAvailable();
        if (mounted) {
          setBiometricSupported(available);
          if (available) {
            triggerBiometricAuth();
          }
        }
      }
    })();
    return () => { mounted = false; };
  }, [settings.biometric, triggerBiometricAuth]);

  const handleKey = useCallback((k: string) => {
    if (locked || checking) return;
    setError('');
    if (k === '⌫') { setPin((p) => p.slice(0, -1)); return; }
    if (pin.length >= PIN_LEN) return;
    const next = pin + k;
    setPin(next);

    if (next.length === PIN_LEN) {
      setChecking(true);
      setTimeout(async () => {
        if (isAppLockLockedOut()) {
          startLockoutTimer();
          setPin('');
          setChecking(false);
          return;
        }
        const ok = await verifyAppLockPin(next);
        if (ok) {
          unlockAndNavigate();
        } else {
          shake();
          setPin('');
          setChecking(false);
          if (isAppLockLockedOut()) {
            startLockoutTimer();
            setError(t('appLock.tooManyAttempts'));
          } else {
            const rem = appLockAttemptsRemaining();
            setError(`${t('appLock.incorrectPin')}${rem > 0 ? ` ${t('appLock.attemptsRemaining', { count: rem })}` : ''}`);
          }
        }
      }, 300);
    }
  }, [pin, locked, checking, shake, startLockoutTimer, unlockAndNavigate, t]);

  const dotColor = error ? RED : SAFFRON;

  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      <StatusBar style="dark" />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        className="absolute top-14 left-6 w-10 h-10 rounded-full items-center justify-center active:opacity-60"
        style={{ backgroundColor: '#F3F4F6' }}
      >
        <ChevronLeft size={20} color="#374151" />
      </Pressable>

      {/* Icon */}
      <View
        className="w-16 h-16 rounded-2xl items-center justify-center mb-6"
        style={{ backgroundColor: `${NAVY}10` }}
      >
        <Lock size={28} color={NAVY} />
      </View>

      {/* Title */}
      <Text style={{ ...T.title2, fontWeight: T.weight.bold, color: '#111827', textAlign: 'center' }}>
        {t('appLock.enterPin')}
      </Text>
      <Text className="text-sm text-muted-foreground text-center mt-2">
        {t('appLock.enterPinDesc')}
      </Text>

      {/* Dots */}
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <PinDots value={pin} total={PIN_LEN} color={dotColor} />
      </Animated.View>

      {/* Error / lockout / biometric checking */}
      {locked ? (
        <Text className="text-sm text-center mb-4" style={{ color: RED }}>
          {t('appLock.tryAgainIn', { count: countdown })}
        </Text>
      ) : !!error ? (
        <Text className="text-sm text-center mb-4" style={{ color: RED }}>{error}</Text>
      ) : checking ? (
        <Text className="text-sm text-center mb-4 text-muted-foreground">{t('appLock.verifying')}</Text>
      ) : biometricChecking ? (
        <View className="flex-row items-center justify-center gap-2 mb-4">
          <ActivityIndicator size="small" color={SAFFRON} />
          <Text className="text-sm text-muted-foreground">{t('appLock.verifyingBiometric')}</Text>
        </View>
      ) : (
        <View style={{ height: 28 }} />
      )}

      {/* Number pad */}
      <NumPad onPress={handleKey} disabled={locked || checking} />

      {/* Biometric fallback button if biometric supported & enabled */}
      {settings.biometric && biometricSupported && (
        <Pressable
          onPress={triggerBiometricAuth}
          disabled={locked || biometricChecking}
          className="flex-row items-center gap-2 mt-4 px-4 py-2 rounded-xl active:opacity-60"
          style={{ backgroundColor: `${SAFFRON}10` }}
        >
          <Fingerprint size={18} color={SAFFRON} />
          <Text className="text-xs font-semibold" style={{ color: SAFFRON }}>
            {t('appLock.useBiometric')}
          </Text>
        </Pressable>
      )}

      <Text className="text-xs text-muted-foreground text-center mt-3">
        {t('appLock.protectedBy')}
      </Text>
    </View>
  );
}

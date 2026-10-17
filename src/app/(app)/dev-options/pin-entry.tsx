/**
 * Developer Options — PIN Entry (subsequent launches)
 *
 * Shown when a Developer Options PIN already exists but no active session.
 * On success: navigates to the Dev Options index.
 * Shows lockout countdown after 5 failed attempts.
 *
 * __DEV__ gate — renders nothing in production builds.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Vibration,
} from 'react-native';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { T } from '@/lib/typography';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Terminal, ChevronLeft, Delete } from 'lucide-react-native';
import {
  verifyPin, isLockedOut, lockoutSecondsRemaining, attemptsRemaining,
} from '@/lib/devOptionsAuth';
import { _addAudit } from '@/lib/devOptionsStore';

const NAVY = '#1E3A5F';
const SAFFRON = '#2563EB';
const RED     = '#DC2626';
const PIN_LEN = 6;

// ── Shared sub-components (same as pin-setup) ─────────────────────────────────
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

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PinEntryScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  // No __DEV__ gate — the PIN is the security boundary, not the build type.

  // Prevent screenshots while the PIN screen is visible — this screen shows
  // the 6-dot entry which reveals PIN length; protect it on physical devices.
  usePreventScreenCapture();

  const [pin, setPin]             = useState('');
  const [error, setError]         = useState('');
  const [locked, setLocked]       = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [checking, setChecking]   = useState(false);
  const { shakeAnim, shake }      = useShake();
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lockout countdown tick
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startLockoutTimer = useCallback(() => {
    setLocked(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = lockoutSecondsRemaining();
      setCountdown(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setLocked(false);
        setError('');
        setCountdown(0);
      }
    }, 500);
  }, []);

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
        // Check lockout first
        if (isLockedOut()) {
          startLockoutTimer();
          setPin('');
          setChecking(false);
          return;
        }
        const ok = await verifyPin(next);
        if (ok) {
          _addAudit({ action: 'Developer PIN Verified', section: 'PIN Entry', outcome: 'success' });
          router.replace((returnTo ? decodeURIComponent(returnTo) : '/(app)/dev-options') as never);
        } else {
          shake();
          setPin('');
          setChecking(false);
          if (isLockedOut()) {
            startLockoutTimer();
            setError('Too many attempts. Locked for 30 seconds.');
          } else {
            const rem = attemptsRemaining();
            setError(`Incorrect PIN.${rem > 0 ? ` ${rem} attempt${rem !== 1 ? 's' : ''} remaining.` : ''}`);
          }
        }
      }, 300);
    }
  }, [pin, locked, checking, shake, startLockoutTimer]);

  const dotColor = error ? RED : SAFFRON;

  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      <StatusBar style="dark" />

      {/* Back */}
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
        <Terminal size={28} color={NAVY} />
      </View>

      {/* Title */}
      <Text style={{ ...T.title2, fontWeight: T.weight.bold, color: '#111827', textAlign: 'center' }}>
        Developer Options
      </Text>
      <Text className="text-sm text-muted-foreground text-center mt-2">
        Enter your 6-digit Developer PIN to continue.
      </Text>

      {/* Dots */}
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <PinDots value={pin} total={PIN_LEN} color={dotColor} />
      </Animated.View>

      {/* Error / lockout */}
      {locked ? (
        <Text className="text-sm text-center mb-4" style={{ color: RED }}>
          Too many attempts. Try again in {countdown}s.
        </Text>
      ) : !!error ? (
        <Text className="text-sm text-center mb-4" style={{ color: RED }}>{error}</Text>
      ) : checking ? (
        <Text className="text-sm text-center mb-4 text-muted-foreground">Verifying…</Text>
      ) : (
        <View style={{ height: 28 }} />
      )}

      {/* Number pad */}
      <NumPad onPress={handleKey} disabled={locked || checking} />

      <Text className="text-xs text-muted-foreground text-center mt-4">
        Hidden developer area — not for regular users.
      </Text>
    </View>
  );
}

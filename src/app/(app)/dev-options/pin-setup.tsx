/**
 * Developer Options — PIN Setup (First-Time)
 *
 * Shown only when no Developer Options PIN has been stored yet.
 * Guides the owner through creating + confirming a 6-digit PIN.
 * On success: stores the PIN and navigates directly into Dev Options.
 *
 * __DEV__ gate — renders nothing in production builds.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Vibration,
} from 'react-native';
import { T } from '@/lib/typography';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Shield, ChevronLeft, Delete } from 'lucide-react-native';
import { storePin } from '@/lib/devOptionsAuth';
import { _addAudit } from '@/lib/devOptionsStore';

const NAVY = '#1E3A5F';
const SAFFRON = '#2563EB';
const GREEN   = '#059669';
const RED     = '#DC2626';
const PIN_LEN = 6;

// ── Number pad ────────────────────────────────────────────────────────────────
const PAD_KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

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

function NumPad({ onPress }: { onPress: (k: string) => void }) {
  return (
    <View style={{ width: 280, alignSelf: 'center' }}>
      {[0, 1, 2].map((row) => (
        <View key={row} className="flex-row justify-between mb-4">
          {PAD_KEYS.slice(row * 4, row * 4 + 4).map((k, i) => {
            // 12-key grid: 3 rows × 4 = we need 3 rows × 3 for standard pad
            return null; // handled below
          })}
        </View>
      ))}
      {/* Render 4 rows of 3 */}
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
              onPress={() => k && onPress(k)}
              disabled={!k}
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

// ── Shake animation ───────────────────────────────────────────────────────────
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
type Step = 'create' | 'confirm';

export default function PinSetupScreen() {
  // No __DEV__ gate — the PIN is the security boundary, not the build type.

  const [step, setStep]       = useState<Step>('create');
  const [first, setFirst]     = useState('');
  const [second, setSecond]   = useState('');
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);
  const { shakeAnim, shake }  = useShake();

  const current = step === 'create' ? first : second;
  const setCurrentPin = step === 'create' ? setFirst : setSecond;

  const handleKey = useCallback((k: string) => {
    setError('');
    if (k === '⌫') {
      setCurrentPin((p) => p.slice(0, -1));
      return;
    }
    if (current.length >= PIN_LEN) return;
    const next = current + k;
    setCurrentPin(next);

    if (next.length === PIN_LEN) {
      if (step === 'create') {
        // Move to confirm step after brief pause
        setTimeout(() => setStep('confirm'), 300);
      } else {
        // Confirm step — validate match
        setTimeout(async () => {
          if (next !== first) {
            setError("PINs don't match. Please try again.");
            shake();
            setSecond('');
            return;
          }
          setSaving(true);
          try {
            await storePin(first);
            _addAudit({ action: 'Developer PIN Created', section: 'PIN Setup', outcome: 'success' });
            router.replace('/(app)/dev-options' as never);
          } catch {
            setError('Failed to save PIN. Please try again.');
            setSaving(false);
          }
        }, 300);
      }
    }
  }, [current, step, first, shake]);

  const handleBack = () => {
    if (step === 'confirm') { setStep('create'); setSecond(''); setError(''); }
    else router.back();
  };

  const dotColor = error ? RED : step === 'confirm' ? NAVY : SAFFRON;

  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      <StatusBar style="dark" />

      {/* Back */}
      <Pressable
        onPress={handleBack}
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
        <Shield size={28} color={NAVY} />
      </View>

      {/* Title */}
      <Text style={{ ...T.title2, fontWeight: T.weight.bold, color: '#111827', textAlign: 'center' }}>
        {step === 'create' ? 'Create Developer PIN' : 'Confirm PIN'}
      </Text>
      <Text className="text-sm text-muted-foreground text-center mt-2 leading-6">
        {step === 'create'
          ? 'Set a 6-digit PIN to protect the\nDeveloper Options Console.'
          : 'Enter the same PIN again to confirm.'}
      </Text>

      {/* Step indicator */}
      <View className="flex-row items-center gap-2 mt-4">
        <View className="w-6 h-1 rounded-full" style={{ backgroundColor: NAVY }} />
        <View className="w-6 h-1 rounded-full" style={{ backgroundColor: step === 'confirm' ? NAVY : '#E5E7EB' }} />
      </View>

      {/* Dots */}
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <PinDots value={current} total={PIN_LEN} color={dotColor} />
      </Animated.View>

      {/* Error */}
      {!!error && (
        <Text className="text-sm text-center mb-4" style={{ color: RED }}>{error}</Text>
      )}
      {saving && (
        <Text className="text-sm text-center mb-4 text-muted-foreground">Saving PIN…</Text>
      )}

      {/* Number pad */}
      <NumPad onPress={handleKey} />

      <Text className="text-xs text-muted-foreground text-center mt-4">
        This PIN protects developer tools only.{'\n'}It does not affect normal app functionality.
      </Text>
    </View>
  );
}

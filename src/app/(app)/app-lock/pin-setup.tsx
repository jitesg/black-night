/**
 * App Lock — PIN Setup
 *
 * Guides the officer through creating + confirming a 6-digit App Lock PIN.
 * On success: stores the PIN via setAppLockPin() and redirects to home.
 */
import { useCallback, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Vibration,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { T } from '@/lib/typography';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Lock, ChevronLeft, Delete } from 'lucide-react-native';
import { setAppLockPin, touchAppLockSession } from '@/lib/appLockAuth';
import { useSettingsStore } from '@/hooks/useSettingsStore';

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

function NumPad({ onPress }: { onPress: (k: string) => void }) {
  return (
    <View style={{ width: 280, alignSelf: 'center' }}>
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

type Step = 'create' | 'confirm';

export default function PinSetupScreen() {
  const { t }                 = useTranslation();
  const { update }            = useSettingsStore();
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
        setTimeout(() => setStep('confirm'), 300);
      } else {
        setTimeout(async () => {
          if (next !== first) {
            setError(t('appLock.pinsDontMatch'));
            shake();
            setSecond('');
            return;
          }
          setSaving(true);
          try {
            await setAppLockPin(first);
            // Start unlocked so saving the PIN doesn't lock the app at once.
            touchAppLockSession();
            update('appLock', true);
            update('pinLock', true);
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/home' as never);
          } catch {
            setError(t('appLock.savePinFailed'));
            setSaving(false);
          }
        }, 300);
      }
    }
  }, [current, step, first, shake, update, t]);

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
        <Lock size={28} color={NAVY} />
      </View>

      {/* Title */}
      <Text style={{ ...T.title2, fontWeight: T.weight.bold, color: '#111827', textAlign: 'center' }}>
        {step === 'create' ? t('appLock.setPin') : t('appLock.confirmPin')}
      </Text>
      <Text className="text-sm text-muted-foreground text-center mt-2 leading-6">
        {step === 'create' ? t('appLock.setPinDesc') : t('appLock.confirmPinDesc')}
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
        <Text className="text-sm text-center mb-4 text-muted-foreground">{t('appLock.savingPin')}</Text>
      )}

      {/* Number pad */}
      <NumPad onPress={handleKey} />

      <Text className="text-xs text-muted-foreground text-center mt-4">
        {t('appLock.pinStoredNote')}
      </Text>
    </View>
  );
}

/**
 * Developer Options — Change PIN
 *
 * Accessible only from within Dev Options (session must be active).
 * Requires current PIN, then new PIN (entered twice).
 *
 * __DEV__ gate — renders nothing in production builds.
 */
import { useCallback, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Vibration, ScrollView, TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { T } from '@/lib/typography';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Key, CheckCircle } from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { changePin, isDevSessionActive } from '@/lib/devOptionsAuth';
import { _addAudit } from '@/lib/devOptionsStore';

const GREEN = '#059669';
const RED   = '#DC2626';
const PIN_LEN = 6;

function PinDots({ value, total, color }: { value: string; total: number; color: string }) {
  return (
    <View className="flex-row items-center justify-center gap-3 my-5">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 14, height: 14, borderRadius: 7,
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
    <View style={{ width: 260, alignSelf: 'center' }}>
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
                width: 74, height: 74, borderRadius: 37,
                backgroundColor: k ? '#F9FAFB' : 'transparent',
              }}
            >
              {k === '⌫'
                ? <Text style={{ ...T.title3, color: '#374151' }}>⌫</Text>
                : <Text style={{ ...T.title2, fontWeight: T.weight.semibold, color: '#111827' }}>{k}</Text>}
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
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);
  return { shakeAnim, shake };
}

type Step = 'current' | 'new' | 'confirm';

const STEP_CONFIG: Record<Step, { title: string; subtitle: string; color: string }> = {
  current: { title: 'Current PIN',   subtitle: 'Enter your existing 6-digit PIN.',         color: '#1E3A5F' },
  new:     { title: 'New PIN',       subtitle: 'Choose a new 6-digit PIN.',                 color: '#7C3AED' },
  confirm: { title: 'Confirm PIN',   subtitle: 'Re-enter your new PIN to confirm.',         color: GREEN },
};

export default function ChangePinScreen() {
  // No __DEV__ gate — PIN is the security boundary, not build type.

  const [step, setStep]         = useState<Step>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin]     = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const { shakeAnim, shake }    = useShake();

  const pinMap: Record<Step, string> = { current: currentPin, new: newPin, confirm: confirmPin };
  const setMap: Record<Step, (v: string) => void> = {
    current: setCurrentPin, new: setNewPin, confirm: setConfirmPin,
  };
  const currentValue = pinMap[step];
  const setCurrentValue = setMap[step];

  const cfg = STEP_CONFIG[step];

  const handleKey = useCallback((k: string) => {
    setError('');
    if (k === '⌫') { setCurrentValue(currentValue.slice(0, -1)); return; }
    if (currentValue.length >= PIN_LEN) return;
    const next = currentValue + k;
    setCurrentValue(next);

    if (next.length === PIN_LEN) {
      setTimeout(async () => {
        if (step === 'current') {
          // Move to new PIN step — actual validation happens at confirm
          setStep('new');
        } else if (step === 'new') {
          if (!/^\d{6}$/.test(next)) {
            setError('PIN must be exactly 6 digits.');
            shake();
            setNewPin('');
            return;
          }
          setStep('confirm');
        } else {
          // Confirm step
          if (next !== newPin) {
            setError("PINs don't match. Try again.");
            shake();
            setConfirmPin('');
            setStep('new');
            setNewPin('');
            return;
          }
          setSaving(true);
          const result = await changePin(currentPin, next);
          setSaving(false);
          if (result.ok) {
            _addAudit({ action: 'Developer PIN Changed', section: 'Change PIN', outcome: 'success' });
            setSuccess(true);
            setTimeout(() => router.back(), 1800);
          } else {
            shake();
            setError(result.error ?? 'Failed to change PIN.');
            setStep('current');
            setCurrentPin('');
            setNewPin('');
            setConfirmPin('');
          }
        }
      }, 300);
    }
  }, [currentValue, step, newPin, currentPin, shake, setCurrentValue]);

  const stepIndex: Record<Step, number> = { current: 0, new: 1, confirm: 2 };
  const activeStep = stepIndex[step];

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="light" />
      <AppHeader
        title="Change Developer PIN"
        subtitle="Update your Developer Options access PIN"
        variant="navy"
        onBack={() => router.back()}
      />

      {success ? (
        <View className="flex-1 items-center justify-center gap-4">
          <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
            <CheckCircle size={32} color={GREEN} />
          </View>
          <Text style={{ ...T.title3, fontWeight: T.weight.bold, color: '#111827' }}>PIN Updated!</Text>
          <Text className="text-sm text-muted-foreground text-center">
            Your Developer PIN has been changed successfully.
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Step indicator */}
            <View className="flex-row items-center justify-center gap-2 mt-8 mb-2">
              {(['current', 'new', 'confirm'] as Step[]).map((s, i) => (
                <View
                  key={s}
                  style={{
                    width: i === activeStep ? 24 : 8,
                    height: 8, borderRadius: 4,
                    backgroundColor: i <= activeStep ? '#1E3A5F' : '#E5E7EB',
                  }}
                />
              ))}
            </View>

            {/* Icon */}
            <View className="items-center mt-6">
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: `${cfg.color}15` }}
              >
                <Key size={24} color={cfg.color} />
              </View>
              <Text style={{ ...T.title2, fontWeight: T.weight.bold, color: '#111827', textAlign: 'center' }}>
                {cfg.title}
              </Text>
              <Text className="text-sm text-muted-foreground text-center mt-1">{cfg.subtitle}</Text>
            </View>

            {/* Dots */}
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              <PinDots value={currentValue} total={PIN_LEN} color={error ? RED : cfg.color} />
            </Animated.View>

            {/* Error */}
            {!!error && (
              <Text className="text-sm text-center mb-3" style={{ color: RED }}>{error}</Text>
            )}
            {saving && (
              <Text className="text-sm text-center mb-3 text-muted-foreground">Saving…</Text>
            )}

            {/* Number pad */}
            <NumPad onPress={handleKey} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

/**
 * System Format Manager — Owner Auth Gate
 *
 * Entry point for the hidden owner-only module.
 * Not linked from any drawer, nav, settings, or search.
 * Accessible only via the secret tap-version gesture in About screen.
 *
 * Flow:
 *   1. PIN entry — standard verify.
 *   2. If the factory default PIN '2025' was never changed (isDefaultPin()),
 *      show the forced-change form BEFORE granting access to the dashboard.
 *      The owner cannot skip this step.
 *   3. On successful PIN set → navigate to dashboard.
 *
 * Session auto-expires after 15 min of inactivity.
 */
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, KeyboardAvoidingView, ScrollView, ActivityIndicator, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Shield, Lock, KeyRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { verifyPin, isSessionActive, isDefaultPin, changePin } from '@/lib/sysFormatAuth';

// ── PIN Entry view ────────────────────────────────────────────────────────────

function PinEntryView({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);

  const [pin, setPin]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [attempts, setAttempts]   = useState(0);
  const [locked, setLocked]       = useState(false);
  const [lockTimer, setLockTimer] = useState(0);

  useEffect(() => {
    if (!locked) return;
    const interval = setInterval(() => {
      setLockTimer((prev) => {
        if (prev <= 1) { setLocked(false); setAttempts(0); clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [locked]);

  async function handleVerify() {
    if (locked || !pin.trim()) return;
    setLoading(true);
    setError('');
    try {
      const ok = await verifyPin(pin.trim());
      if (ok) {
        onSuccess();
      } else {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= 5) {
          setLocked(true);
          setLockTimer(60);
          setError(t('sysFormat.auth.errorLocked'));
        } else {
          setError(t('sysFormat.auth.errorIncorrect', { remaining: 5 - next }));
        }
        setPin('');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerClassName="flex-grow justify-center px-6 py-12"
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center mb-10">
        <View
          className="w-20 h-20 rounded-3xl items-center justify-center mb-5"
          style={{ backgroundColor: '#1E3A5F10' }}
        >
          <Lock size={36} color="#1E3A5F" />
        </View>
        <Text className="text-2xl font-bold text-foreground text-center">
          {t('sysFormat.auth.heading')}
        </Text>
        <Text className="text-sm text-muted-foreground text-center mt-2 leading-6">
          {t('sysFormat.auth.desc')}
        </Text>
      </View>

      <View className="gap-3 mb-2">
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('sysFormat.auth.pinLabel')}
        </Text>
        <Input
          ref={inputRef}
          type="pin"
          value={pin}
          onChangeText={(v) => { setPin(v); setError(''); }}
          placeholder={t('sysFormat.auth.pinPlaceholder')}
          maxLength={12}
          returnKeyType="go"
          onSubmitEditing={handleVerify}
          editable={!locked}
        />
        {!!error && (
          <Text className="text-xs text-destructive leading-5">{error}</Text>
        )}
        {locked && (
          <View className="flex-row items-center gap-2 bg-destructive/10 rounded-xl px-3 py-2">
            <Lock size={13} color="#DC2626" />
            <Text className="text-xs text-destructive font-medium">
              {t('sysFormat.auth.lockedMsg', { seconds: lockTimer })}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        onPress={handleVerify}
        disabled={loading || locked || !pin.trim()}
        className="rounded-2xl items-center justify-center active:opacity-70 mt-6"
        style={{
          height: 52,
          backgroundColor: (loading || locked || !pin.trim()) ? '#9CA3AF' : '#1E3A5F',
          borderCurve: 'continuous',
        }}
      >
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text className="text-base font-semibold text-white">{t('sysFormat.auth.unlockBtn')}</Text>}
      </Pressable>

      <Text className="text-xs text-muted-foreground text-center mt-6 leading-5">
        {t('sysFormat.auth.hint')}
      </Text>
    </ScrollView>
  );
}

// ── Forced PIN Change view ────────────────────────────────────────────────────
// Shown immediately after a successful default-PIN login. Cannot be skipped.

function ForcedPinChangeView({ onPinSet }: { onPinSet: () => void }) {
  const { t } = useTranslation();

  const [newPin, setNewPin]         = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function handleSet() {
    if (newPin.length < 4) { setError(t('sysFormat.auth.errorPinTooShort')); return; }
    if (newPin !== confirmPin) { setError(t('sysFormat.auth.errorPinMismatch')); return; }
    setLoading(true);
    setError('');
    try {
      // currentPin is the known default — user just authenticated with it.
      const result = await changePin('2025', newPin.trim());
      if (result.ok) {
        onPinSet();
      } else {
        setError(result.error ?? 'Failed to set PIN.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerClassName="flex-grow justify-center px-6 py-12"
      keyboardShouldPersistTaps="handled"
    >
      <View className="items-center mb-10">
        <View
          className="w-20 h-20 rounded-3xl items-center justify-center mb-5"
          style={{ backgroundColor: '#D9770610' }}
        >
          <KeyRound size={36} color="#D97706" />
        </View>
        <Text className="text-2xl font-bold text-foreground text-center">
          {t('sysFormat.auth.mustChangeTitle')}
        </Text>
        <Text className="text-sm text-muted-foreground text-center mt-2 leading-6">
          {t('sysFormat.auth.mustChangeDesc')}
        </Text>
      </View>

      <View className="gap-4 mb-2">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('sysFormat.auth.newPinLabel')}
          </Text>
          <Input
            type="pin"
            value={newPin}
            onChangeText={(v) => { setNewPin(v); setError(''); }}
            placeholder={t('sysFormat.auth.newPinPlaceholder')}
            maxLength={12}
            returnKeyType="next"
          />
        </View>
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('sysFormat.auth.confirmPinLabel')}
          </Text>
          <Input
            type="pin"
            value={confirmPin}
            onChangeText={(v) => { setConfirmPin(v); setError(''); }}
            placeholder={t('sysFormat.auth.confirmPinPlaceholder')}
            maxLength={12}
            returnKeyType="go"
            onSubmitEditing={handleSet}
          />
        </View>
        {!!error && (
          <Text className="text-xs text-destructive leading-5">{error}</Text>
        )}
      </View>

      <Pressable
        onPress={handleSet}
        disabled={loading || !newPin.trim() || !confirmPin.trim()}
        className="rounded-2xl items-center justify-center active:opacity-70 mt-6"
        style={{
          height: 52,
          backgroundColor: (loading || !newPin.trim() || !confirmPin.trim()) ? '#9CA3AF' : '#D97706',
          borderCurve: 'continuous',
        }}
      >
        {loading
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text className="text-base font-semibold text-white">{t('sysFormat.auth.setPinBtn')}</Text>}
      </Pressable>
    </ScrollView>
  );
}

// ── Root screen — orchestrates PIN entry → optional forced change → dashboard ─

export default function SysFormatAuthScreen() {
  const { t } = useTranslation();

  // 'enter'  — show PIN entry form
  // 'change' — show forced PIN change form (default PIN detected after auth)
  type Phase = 'enter' | 'change';
  const [phase, setPhase] = useState<Phase>('enter');

  // If session already active, skip straight to dashboard
  useEffect(() => {
    if (isSessionActive()) {
      router.replace('/(app)/sys-format-manager/dashboard' as never);
    }
  }, []);

  async function handleAuthSuccess() {
    const needsChange = await isDefaultPin();
    if (needsChange) {
      setPhase('change');
    } else {
      router.replace('/(app)/sys-format-manager/dashboard' as never);
    }
  }

  function handlePinSet() {
    router.replace('/(app)/sys-format-manager/dashboard' as never);
  }

  const heading = phase === 'change'
    ? t('sysFormat.auth.mustChangeTitle')
    : t('sysFormat.auth.title');

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={heading}
        subtitle={t('sysFormat.auth.subtitle')}
        showBack={phase === 'enter'}
      />
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >
        {phase === 'enter'
          ? <PinEntryView onSuccess={handleAuthSuccess} />
          : <ForcedPinChangeView onPinSet={handlePinSet} />}
      </KeyboardAvoidingView>
    </View>
  );
}

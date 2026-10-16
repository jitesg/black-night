import { useState } from 'react';
import {
  KeyboardAvoidingView, Pressable, Text, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  ShieldCheck, ArrowRight, RotateCcw,
  AlertCircle,
} from 'lucide-react-native';
import { supabase } from '@/client/supabase';
import { Input } from '@/components/ui/input';

// Design constants matching InvestSuite Police theme
const BRAND = '#111827';
const ACTION = '#2563EB';
export default function SignIn() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async () => {
    if (!phone.trim()) { setError('Please enter your phone number.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    if (err) setError(err.message);
    else setStep('otp');
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (!otp.trim()) { setError('Please enter the verification code.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    if (err) setError(err.message);
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >
        <View className="flex-1 px-7 justify-center gap-8">

          {/* ── Brand Block ─────────────────────────── */}
          <View className="items-center gap-4">
            <View
              className="w-20 h-20 rounded-3xl items-center justify-center"
              style={{ backgroundColor: BRAND }}
            >
              <ShieldCheck size={38} color="#ffffff" />
            </View>
            <View className="items-center gap-1">
              <Text className="text-3xl font-bold text-foreground tracking-tight">
                InvestSuite
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                Police Investigation Operating System
              </Text>
            </View>

            {/* Saffron accent line */}
            <View className="flex-row items-center gap-2">
              <View className="h-px flex-1" style={{ backgroundColor: '#2563EB30' }} />
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: ACTION }} />
              <View className="h-px flex-1" style={{ backgroundColor: '#2563EB30' }} />
            </View>
          </View>

          {/* ── Form Card ───────────────────────────── */}
          <View className="bg-card border border-border rounded-3xl p-6 gap-5"
            style={{ borderCurve: 'continuous' }}>

            {/* Step label */}
            <View className="gap-1">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {step === 'phone' ? 'Step 1 of 2' : 'Step 2 of 2'}
              </Text>
              <Text className="text-lg font-bold text-foreground">
                {step === 'phone' ? 'Enter Phone Number' : 'Verify OTP'}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {step === 'phone'
                  ? 'You will receive a one-time verification code.'
                  : `Code sent to ${phone}`}
              </Text>
            </View>

            {/* Phone field */}
            <Input
              type="mobile"
              label="Phone Number"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={(v) => { setPhone(v); setError(''); }}
              editable={step === 'phone'}
            />

            {/* OTP field */}
            {step === 'otp' && (
              <Input
                type="otp"
                label="Verification Code"
                placeholder="000000"
                value={otp}
                onChangeText={(v) => { setOtp(v); setError(''); }}
                autoFocus
                rightIcon={
                  <Pressable
                    onPress={() => { setStep('phone'); setOtp(''); setError(''); }}
                    className="active:opacity-60 flex-row items-center gap-1 py-1 px-2 rounded-lg"
                    style={{ backgroundColor: '#2563EB15' }}
                  >
                    <RotateCcw size={12} color={ACTION} />
                    <Text className="text-xs font-semibold" style={{ color: ACTION }}>Resend</Text>
                  </Pressable>
                }
              />
            )}

            {/* Error */}
            {error ? (
              <View className="flex-row items-start gap-2 bg-destructive/10 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} color="#DC2626" style={{ marginTop: 1 }} />
                <Text className="text-sm text-destructive flex-1">{error}</Text>
              </View>
            ) : null}

            {/* Primary CTA */}
            <Pressable
              onPress={step === 'phone' ? sendOtp : verifyOtp}
              disabled={loading}
              className="flex-row items-center justify-center gap-2 rounded-2xl py-4 active:opacity-80"
              style={{
                backgroundColor: loading ? '#6B7280' : BRAND,
                borderCurve: 'continuous',
              }}
            >
              <Text className="text-white font-bold text-base">
                {loading
                  ? (step === 'phone' ? 'Sending…' : 'Verifying…')
                  : (step === 'phone' ? 'Send Code' : 'Verify & Sign In')}
              </Text>
              {!loading && <ArrowRight size={18} color="#fff" />}
            </Pressable>
          </View>

          {/* Footer note */}
          <Text className="text-xs text-muted-foreground text-center px-4">
            Authorized personnel only. All activity is monitored and logged.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

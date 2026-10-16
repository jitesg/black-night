/**
 * About InvestSuite Screen
 *
 * Secret access gestures on the Build number badge:
 *   ≥ 7 taps in 4 s  → System Format Manager (owner-only)
 *   ≥ 5 taps in 4 s  → Developer Options Console (PIN-protected; available in all builds)
 *
 * NOTE: The Developer Options tap-gesture intentionally has NO __DEV__ guard.
 * Gating it on __DEV__ means the route is unreachable on a production APK build
 * because __DEV__ is always false in release mode. Access is instead secured by
 * the 6-digit PIN flow in devOptionsAuth.ts, which is the correct security boundary.
 */
import { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Info, FileText, Shield, Scale, BookOpen, ChevronRight } from 'lucide-react-native';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { hasPinSet, isDevSessionActive } from '@/lib/devOptionsAuth';

const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '106';

const LEGAL_ITEMS = [
  { icon: FileText, color: '#6B7280', label: 'Release Notes',       desc: 'What\'s new in this version' },
  { icon: FileText, color: '#1D4ED8', label: 'Terms & Conditions',  desc: 'Usage terms and legal agreement' },
  { icon: Shield,   color: '#10B981', label: 'Privacy Policy',      desc: 'How we handle your data' },
  { icon: Scale,    color: '#7C3AED', label: 'Open Source Licenses', desc: 'Third-party library licenses' },
];

export default function AboutScreen() {
  const tapCount   = useRef(0);
  const tapTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hint, setHint] = useState('');

  // BUG-H2 FIX: clear the reset-timer on unmount to prevent a setState call
  // on an unmounted component (fires 4 s after last tap if user navigates away).
  useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  function handleBuildTap() {
    tapCount.current += 1;

    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
      setHint('');
    }, 4000);

    // 7 taps → System Format Manager (owner-only)
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      setHint('');
      if (tapTimer.current) clearTimeout(tapTimer.current);
      router.push('/(app)/sys-format-manager' as never);
      return;
    }

    // 5 taps → Developer Options Console (PIN-protected; available in all builds)
    // No __DEV__ guard here — the guard was the bug. On a release APK __DEV__ is
    // always false, so the 5-tap gesture silently fell through to the 7-tap path
    // and opened the System Format Manager login instead of Dev Options.
    // Security is enforced by the PIN flow in devOptionsAuth.ts, not by __DEV__.
    if (tapCount.current === 5) {
      tapCount.current = 0;
      setHint('');
      if (tapTimer.current) clearTimeout(tapTimer.current);
      // Route to PIN gate: setup (first time) → entry (has PIN, no session) → index (active session)
      (async () => {
        const pinExists = await hasPinSet();
        if (!pinExists) {
          router.push('/(app)/dev-options/pin-setup' as never);
        } else if (isDevSessionActive()) {
          router.push('/(app)/dev-options' as never);
        } else {
          router.push('/(app)/dev-options/pin-entry' as never);
        }
      })();
      return;
    }

    const remaining = 7 - tapCount.current;
    if (tapCount.current >= 3) {
      setHint(remaining > 0 ? `${remaining} more tap${remaining !== 1 ? 's' : ''} for owner access` : '');
    }
  }
  return (
    <View className="flex-1 bg-background">
      <AppHeader title="About" subtitle="InvestSuite v1.0" showBack />

      <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
        {/* Logo & App identity */}
        <View className="items-center py-8 mb-2">
          <View
            className="w-24 h-24 rounded-3xl items-center justify-center mb-4"
            style={{ backgroundColor: '#1E3A5F' }}
          >
            <Text className="text-4xl font-black" style={{ color: '#2563EB' }}>IS</Text>
          </View>
          <Text className="text-xl font-bold text-foreground text-center">InvestSuite</Text>
          <Text className="text-sm text-muted-foreground text-center mt-1">Investigation Operating System</Text>
          <View className="flex-row items-center gap-4 mt-3">
            <View className="items-center">
              <Text className="text-base font-bold text-foreground">v{APP_VERSION}</Text>
              <Text className="text-xs text-muted-foreground">Version</Text>
            </View>
            <View className="w-px h-8 bg-border" />
            {/* Secret tap zone — 7 taps within 4 s opens owner panel */}
            <Pressable onPress={handleBuildTap} className="items-center active:opacity-70">
              <Text className="text-base font-bold text-foreground">{BUILD_NUMBER}</Text>
              <Text className="text-xs text-muted-foreground">Build</Text>
            </Pressable>
            <View className="w-px h-8 bg-border" />
            <View className="items-center">
              <Text className="text-base font-bold text-foreground">Stable</Text>
              <Text className="text-xs text-muted-foreground">Channel</Text>
            </View>
          </View>
          {!!hint && (
            <Text className="text-xs text-muted-foreground mt-2 text-center">{hint}</Text>
          )}
        </View>

        {/* Description */}
        <View className="bg-card border border-border rounded-2xl p-4 mb-5" style={{ borderCurve: 'continuous' }}>
          <View className="flex-row items-center gap-2 mb-2">
            <BookOpen size={14} color='#1E3A5F' />
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">About</Text>
          </View>
          <Text className="text-sm text-foreground leading-6">
            InvestSuite is a purpose-built Investigation Operating System for law enforcement officers. It provides a unified platform to manage FIRs, general diaries, court work, beat intelligence, and investigations — all offline-first with enterprise-grade security.
          </Text>
        </View>

        {/* Legal & docs */}
        <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Legal & Documentation</Text>
        <View className="bg-card border border-border rounded-2xl overflow-hidden mb-5" style={{ borderCurve: 'continuous' }}>
          {LEGAL_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                onPress={() => {}}
                className={`flex-row items-center gap-3 px-4 py-4 active:opacity-70 ${idx < LEGAL_ITEMS.length - 1 ? 'border-b border-border' : ''}`}
              >
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                  <Icon size={16} color={item.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{item.label}</Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">{item.desc}</Text>
                </View>
                <ChevronRight size={15} color="#D1D5DB" />
              </Pressable>
            );
          })}
        </View>

        <Text className="text-xs text-muted-foreground text-center pb-2">
          © 2026 InvestSuite. All rights reserved.{'\n'}Built for Indian Law Enforcement.
        </Text>
      </ScrollView>
    </View>
  );
}

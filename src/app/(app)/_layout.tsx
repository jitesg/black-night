import { Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { preventScreenCaptureAsync, allowScreenCaptureAsync } from 'expo-screen-capture';
import { FloatingAIButton } from '@/components/ai/FloatingAIButton';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// ── Web-safe screen-capture guard ────────────────────────────────────────────
// expo-screen-capture's web stub (ExpoScreenCapture.web.js) exports an empty
// object — `ExpoScreenCapture.preventScreenCapture` is `undefined` on Web.
// Calling `usePreventScreenCapture()` (or `preventScreenCaptureAsync()`)
// directly causes it to throw `UnavailabilityError` on Web, which crashes the
// entire (app) layout and produces a blank white screen on ALL drawer tabs.
//
// Fix: call the async functions directly inside a `useEffect` guarded by
// `process.env.EXPO_OS !== 'web'`, so the native path is fully preserved
// while the web platform safely skips it.
function useScreenCaptureProtection() {
  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return; // no-op on Web — stub throws
    preventScreenCaptureAsync();
    return () => {
      allowScreenCaptureAsync();
    };
  }, []);
}

export default function AppLayout() {
  // Prevent screenshots / screen recordings across ALL authenticated screens.
  // This is the correct place: every screen inside (app)/ — FIR details,
  // case diaries, GD entries, Prarthna Patra, Nyayalay — carries sensitive
  // police case data. One call here covers all of them.
  // Uses the web-safe wrapper above instead of usePreventScreenCapture()
  // directly, which throws UnavailabilityError on Web.
  useScreenCaptureProtection();
  const segments = useSegments() as readonly string[];
  const insideFIR =
    segments.includes('mukadma') &&
    (segments.includes('[firId]') || (segments.length > 2 && segments[2] !== 'add-fir'));

  return (
    // ErrorBoundary wraps the entire (app) stack so any screen-level runtime
    // error shows a themed fallback (with full error details in __DEV__) instead
    // of a blank white screen.
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            // Fix white flash: pre-fill the inter-screen background with the
            // app's off-white theme colour so no bare white shows during
            // screen transitions on Web and native.
            contentStyle: { backgroundColor: '#F4F7FE' },
          }}
        >
          <Stack.Screen name="home" />
          <Stack.Screen name="workspace-setup" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="halka" />
          <Stack.Screen name="map" />
          <Stack.Screen name="mukadma" />
          <Stack.Screen name="formats" />
          <Stack.Screen name="gd" />
          <Stack.Screen name="knowledge" />
          <Stack.Screen name="nirodhatmak" />
          <Stack.Screen name="prarthna-patra" />
          <Stack.Screen name="nyayalay" />
          {/* DEV-ONLY: hidden from normal users, __DEV__ gate inside the screen */}
          {__DEV__ && <Stack.Screen name="dev-seed-manager" />}
          {/* DEV-ONLY: Developer Options Console — accessed via secret tap on Build Number in About */}
          {__DEV__ && <Stack.Screen name="dev-options" />}
          {/* OWNER-ONLY: System Format Manager — no nav link, accessed via secret tap in About */}
          <Stack.Screen name="sys-format-manager" />
          <Stack.Screen name="sys-knowledge-manager" />
        </Stack>

        {/* Global floating AI button — hidden when inside a FIR detail (which renders its own FIR-aware button) */}
        {!insideFIR && <FloatingAIButton />}
      </View>
    </ErrorBoundary>
  );
}

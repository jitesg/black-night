import { Stack, useSegments } from 'expo-router';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';
import { CopilotHost } from '@/components/ai/CopilotHost';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function AppLayout() {
  // Screenshots are allowed (screen-capture blocking removed on request).
  const { colorScheme } = useColorScheme();
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
            contentStyle: { backgroundColor: THEME[colorScheme ?? 'light'].background },
          }}
        >
          <Stack.Screen name="home" />
          <Stack.Screen name="workspace-setup" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="reminders" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="halka" />
          <Stack.Screen name="map" />
          <Stack.Screen name="mukadma" />
          <Stack.Screen name="formats" />
          <Stack.Screen name="gd" />
          <Stack.Screen name="knowledge" />
          <Stack.Screen name="nirodhatmak" />
          <Stack.Screen name="prarthna-patra" />
          <Stack.Screen name="nyayalay" />
          <Stack.Screen name="ai-draft-preview" />
          <Stack.Screen name="app-lock" />
          {/* DEV-ONLY: hidden from normal users, __DEV__ gate inside the screen */}
          {__DEV__ && <Stack.Screen name="dev-seed-manager" />}
          {/* DEV-ONLY: Developer Options Console — accessed via secret tap on Build Number in About */}
          {__DEV__ && <Stack.Screen name="dev-options" />}
          {/* OWNER-ONLY: System Format Manager — no nav link, accessed via secret tap in About */}
          <Stack.Screen name="sys-format-manager" />
          <Stack.Screen name="sys-knowledge-manager" />
        </Stack>

        {/* AI Copilot sheet (opened from the header 🤖 button) — inside a FIR the FIR layout mounts its own, FIR-aware one */}
        {!insideFIR && <CopilotHost />}
      </View>
    </ErrorBoundary>
  );
}

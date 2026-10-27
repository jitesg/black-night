import { Stack, useLocalSearchParams } from 'expo-router';
import { FIRProvider } from '@/context/FIRContext';
import { CopilotHost } from '@/components/ai/CopilotHost';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

export default function FIRDetailLayout() {
  // This layout is the FIRST component expo-router mounts after resolving the
  // [firId] dynamic segment.  It receives the real firId before any tab screen
  // is rendered, so it is the authoritative owner of the active FIR ID.
  //
  // We pass it to FIRProvider so that child tabs can fall back to it when
  // their own useLocalSearchParams() transiently returns undefined during
  // navigation transitions.
  const { firId } = useLocalSearchParams<{ firId: string }>();

  useEffect(() => {
    logger.warn(
      `[FIR_LAYOUT] firId="${firId ?? 'undefined'}" t=${Date.now()}`
    );
  }, [firId]);

  return (
    <FIRProvider firId={firId}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-karyvahi" />
        <Stack.Screen name="add-karyvahi-checklist" />
        <Stack.Screen name="karyvahi-detail" />
        <Stack.Screen name="add-case-diary" />
        <Stack.Screen name="add-case-diary-karyvahi" />
        <Stack.Screen name="view-case-diary" />
        <Stack.Screen name="edit-case-diary-entry" />
        <Stack.Screen name="pending-actions" />
      </Stack>
      <CopilotHost activeFirId={firId} />
    </FIRProvider>
  );
}

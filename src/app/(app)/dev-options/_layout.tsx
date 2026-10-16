import { Stack } from 'expo-router';

export default function DevOptionsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* PIN gate screens — always registered so navigation works */}
      <Stack.Screen name="pin-setup"  />
      <Stack.Screen name="pin-entry"  />
      {/* Main console — only reachable after PIN auth */}
      <Stack.Screen name="index"      />
      {/* Settings */}
      <Stack.Screen name="change-pin" />
      {/* Sub-screens */}
      <Stack.Screen name="diagnostics" />
      <Stack.Screen name="log-viewer"  />
      <Stack.Screen name="performance" />
      <Stack.Screen name="test-utils"  />
      <Stack.Screen name="migration"   />
      <Stack.Screen name="dangerous"   />
    </Stack>
  );
}

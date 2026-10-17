import { Stack } from 'expo-router';

export default function AppLockLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="pin-setup" />
      <Stack.Screen name="pin-entry" />
    </Stack>
  );
}

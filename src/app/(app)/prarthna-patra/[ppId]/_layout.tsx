import { Stack } from 'expo-router';

export default function PPDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="report" />
      <Stack.Screen name="take-action" />
    </Stack>
  );
}

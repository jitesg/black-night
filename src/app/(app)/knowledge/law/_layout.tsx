import { Stack } from 'expo-router';

export default function LawRootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[act]" />
    </Stack>
  );
}

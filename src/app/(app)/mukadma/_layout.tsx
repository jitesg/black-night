import { Stack } from 'expo-router';

export default function MukadmaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-fir" />
      <Stack.Screen name="[firId]" />
    </Stack>
  );
}

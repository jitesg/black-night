import { Stack } from 'expo-router';

export default function GdLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-gd" />
      <Stack.Screen name="select-format" />
      <Stack.Screen name="[gdId]" />
    </Stack>
  );
}

import { Stack } from 'expo-router';

export default function DevSeedManagerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit-format" />
      <Stack.Screen name="edit-knowledge" />
      <Stack.Screen name="preview" />
      <Stack.Screen name="import" />
    </Stack>
  );
}

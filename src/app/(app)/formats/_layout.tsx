import { Stack } from 'expo-router';

export default function FormatsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-format" />
      <Stack.Screen name="fill" />
      <Stack.Screen name="preview" />
    </Stack>
  );
}

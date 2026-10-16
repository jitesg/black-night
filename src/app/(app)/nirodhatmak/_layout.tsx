import { Stack } from 'expo-router';

export default function NirodhatmakLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-proceeding" />
      <Stack.Screen name="select-format" />
    </Stack>
  );
}

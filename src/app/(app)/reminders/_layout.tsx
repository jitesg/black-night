import { Stack } from 'expo-router';

export default function RemindersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" />
      <Stack.Screen name="health" />
    </Stack>
  );
}

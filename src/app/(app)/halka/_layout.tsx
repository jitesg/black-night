import { Stack } from 'expo-router';

export default function HalkaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-gp" />
      <Stack.Screen name="search" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="surveillance" />
      <Stack.Screen name="[gpId]" />
    </Stack>
  );
}

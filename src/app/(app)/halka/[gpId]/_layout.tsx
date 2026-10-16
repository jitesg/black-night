import { Stack } from 'expo-router';

export default function GpDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-hamlet" />
      <Stack.Screen name="add-person" />
      <Stack.Screen name="add-religious" />
      <Stack.Screen name="add-institution" />
      <Stack.Screen name="add-shop" />
    </Stack>
  );
}

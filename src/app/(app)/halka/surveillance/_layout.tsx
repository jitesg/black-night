import { Stack } from 'expo-router';

export default function SurveillanceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" />
    </Stack>
  );
}

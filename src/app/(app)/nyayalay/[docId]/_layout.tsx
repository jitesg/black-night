import { Stack } from 'expo-router';

export default function NyayalayDocLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="report" />
    </Stack>
  );
}

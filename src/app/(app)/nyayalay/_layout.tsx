import { Stack } from 'expo-router';

export default function NyayalayLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" />
      <Stack.Screen name="select-format" />
      <Stack.Screen name="fill-format" />
      <Stack.Screen name="[docId]" />
    </Stack>
  );
}

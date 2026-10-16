import { Stack } from 'expo-router';

export default function SysFormatManagerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="list" />
      <Stack.Screen name="editor" />
      <Stack.Screen name="preview" />
      <Stack.Screen name="[formatId]" />
    </Stack>
  );
}

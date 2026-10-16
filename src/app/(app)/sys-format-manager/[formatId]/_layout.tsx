import { Stack } from 'expo-router';

export default function SysFormatDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="versions" />
      <Stack.Screen name="audit" />
    </Stack>
  );
}

import { Stack } from 'expo-router';

export default function InvestigationGuidesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="guide-list" />
      <Stack.Screen name="add-guide" />
      <Stack.Screen name="[guideId]" />
    </Stack>
  );
}

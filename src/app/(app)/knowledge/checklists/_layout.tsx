import { Stack } from 'expo-router';

export default function ChecklistsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-checklist" />
      <Stack.Screen name="[checklistId]" />
    </Stack>
  );
}

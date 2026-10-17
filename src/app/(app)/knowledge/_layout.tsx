import { Stack } from 'expo-router';

export default function KnowledgeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="list" />
      <Stack.Screen name="add-knowledge" />
      <Stack.Screen name="[knowledgeId]" />
      <Stack.Screen name="checklists" />
      <Stack.Screen name="investigation-guides" />
      <Stack.Screen name="fard" />
      <Stack.Screen name="law" />
    </Stack>
  );
}

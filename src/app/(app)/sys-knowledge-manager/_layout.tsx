import { Stack } from 'expo-router';

export default function SysKnowledgeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index"      />
      <Stack.Screen name="list"       />
      <Stack.Screen name="editor"     />
      <Stack.Screen name="categories" />
      <Stack.Screen name="[articleId]" />
    </Stack>
  );
}

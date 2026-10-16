import { Stack } from 'expo-router';

export default function ArticleDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="versions" />
      <Stack.Screen name="audit"    />
    </Stack>
  );
}

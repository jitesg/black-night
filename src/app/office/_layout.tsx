import { Stack } from 'expo-router';
import { useOfficeColors } from '@/office/ui';

/** InvestSuite कार्यालय — screens (only reached in the कार्यालय build). */
export default function OfficeLayout() {
  const C = useOfficeColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />;
}

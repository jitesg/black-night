/**
 * Root of the "InvestSuite कार्यालय" build (EXPO_PUBLIC_APP_VARIANT=office): no SQLite / seed / reminders of
 * InvestSuite — only the office screens under src/app/office.
 */
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardInsetView } from '@/components/common/KeyboardInsetView';
import { useOfficeColors } from './ui';

export function OfficeRoot() {
  const C = useOfficeColors();
  const fontAsset = (require as any)('../../assets/fonts/NotoSansDevanagari-Regular.ttf') as number;
  const [fontsLoaded, fontError] = useFonts({ NotoSansDevanagari: fontAsset });
  if (!(Platform.OS === 'web' || fontsLoaded || fontError)) return null;
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={C.head} translucent={false} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardInsetView>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />
        </KeyboardInsetView>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

import { Tabs } from 'expo-router';
import { FileText, CheckSquare, BookOpen } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { T } from '@/lib/typography';
import { NAV_THEME } from '@/lib/theme';

export default function FIRTabsLayout() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'dark' ? NAV_THEME.dark.colors : NAV_THEME.light.colors;
  return (
    <Tabs
      initialRouteName="karyvahi"
      backBehavior="none"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#64748B' : '#9CA3AF',
        tabBarStyle: { borderTopColor: palette.border, backgroundColor: palette.card },
        tabBarLabelStyle: { ...T.caption2, fontWeight: T.weight.semibold } as object,
      }}
    >
      <Tabs.Screen
        name="details"
        options={{
          title: t('tabs.firDetails'),
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="karyvahi"
        options={{
          title: t('tabs.karyvahi'),
          tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="case-diary"
        options={{
          title: t('tabs.caseDiary'),
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

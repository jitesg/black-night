/** Bottom bar of the कार्यालय app: डैशबोर्ड · कागज़ · सदस्य · सेटिंग. */
import { Tabs } from 'expo-router';
import { FileText, LayoutDashboard, Settings, Users } from 'lucide-react-native';
import { useOfficeColors } from '@/office/ui';

export default function OfficeTabs() {
  const C = useOfficeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.navy,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '600' },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'डैशबोर्ड', tabBarIcon: ({ color }) => <LayoutDashboard size={21} color={color} /> }} />
      <Tabs.Screen name="kagaz" options={{ title: 'कागज़', tabBarIcon: ({ color }) => <FileText size={21} color={color} /> }} />
      <Tabs.Screen name="members" options={{ title: 'सदस्य', tabBarIcon: ({ color }) => <Users size={21} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'सेटिंग', tabBarIcon: ({ color }) => <Settings size={21} color={color} /> }} />
    </Tabs>
  );
}

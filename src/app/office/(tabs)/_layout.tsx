/** Bottom bar of the कार्यालय app: डैशबोर्ड · कागज़ · सदस्य · सेटिंग. */
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { FileText, LayoutDashboard, Settings, Users } from 'lucide-react-native';
import { useOfficeColors } from '@/office/ui';

/** Own label: the default one cut the lower half of Devanagari matras (ु ृ). */
function TabLabel({ text, color, focused }: { text: string; color: string; focused: boolean }) {
  return <Text style={{ fontSize: 12, lineHeight: 20, color, fontWeight: focused ? '700' : '500' }}>{text}</Text>;
}

export default function OfficeTabs() {
  const C = useOfficeColors();
  return (
    <Tabs
      // the root KeyboardInsetView already keeps screens above the nav bar (CLAUDE.md) — no 2nd bottom inset here
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.navy,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border, height: 68, paddingTop: 6, paddingBottom: 10 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'डैशबोर्ड', tabBarLabel: ({ color, focused }) => <TabLabel text="डैशबोर्ड" color={color} focused={focused} />, tabBarIcon: ({ color }) => <LayoutDashboard size={21} color={color} /> }} />
      <Tabs.Screen name="kagaz" options={{ title: 'कागज़', tabBarLabel: ({ color, focused }) => <TabLabel text="कागज़" color={color} focused={focused} />, tabBarIcon: ({ color }) => <FileText size={21} color={color} /> }} />
      <Tabs.Screen name="members" options={{ title: 'सदस्य', tabBarLabel: ({ color, focused }) => <TabLabel text="सदस्य" color={color} focused={focused} />, tabBarIcon: ({ color }) => <Users size={21} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'सेटिंग', tabBarLabel: ({ color, focused }) => <TabLabel text="सेटिंग" color={color} focused={focused} />, tabBarIcon: ({ color }) => <Settings size={21} color={color} /> }} />
    </Tabs>
  );
}

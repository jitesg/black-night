/** ① first open: नया थाना बनाएँ / कोड से जुड़ें (owner-approved sample). */
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, ChevronRight, KeyRound } from 'lucide-react-native';
import { OfficeCard, useOfficeColors } from '@/office/ui';

export default function OfficeWelcome() {
  const C = useOfficeColors();
  const insets = useSafeAreaInsets();
  const Option = ({ icon, bg, title, sub, to }: { icon: React.ReactNode; bg: string; title: string; sub: string; to: string }) => (
    <Pressable onPress={() => router.push(to as never)} accessibilityLabel={title}>
      <OfficeCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{title}</Text>
          <Text style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{sub}</Text>
        </View>
        <ChevronRight size={20} color={C.muted} />
      </OfficeCard>
    </Pressable>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 40, gap: 12 }}>
      <View style={{ alignItems: 'center', gap: 6, marginBottom: 18 }}>
        {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
        <Image source={require('../../../assets/office/icon.png')} style={{ width: 84, height: 84, borderRadius: 22 }} />
        <Text style={{ fontSize: 22, fontWeight: '700', color: C.text }}>InvestSuite कार्यालय</Text>
        <Text style={{ fontSize: 13.5, color: C.muted }}>थाना कार्यालय — कागज़ भेजें, स्थिति देखें</Text>
      </View>
      <Option icon={<Building2 size={24} color="#1D4ED8" />} bg={C.dark ? '#1E3A5F' : '#DBEAFE'} title="नया थाना बनाएँ"
        sub="आपका थाना अभी app में नहीं है — आप पहले CM / HM हैं" to="/office/new-thana" />
      <Option icon={<KeyRound size={24} color="#15803D" />} bg={C.dark ? '#14532D' : '#DCFCE7'} title="कोड से जुड़ें"
        sub="थाना पहले से बना है — कार्यालय से मिला 6 अंक का कोड डालें" to="/office/join" />
      <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 19 }}>
        ईमेल / पासवर्ड नहीं चाहिए। यह फ़ोन एक बार जुड़ने के बाद हमेशा जुड़ा रहेगा।
      </Text>
    </ScrollView>
  );
}

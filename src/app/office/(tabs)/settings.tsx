/** सेटिंग — थाना / आप / app की जानकारी. */
import { ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { ROLE_LABEL } from '@/office/officeCore';
import { useMe } from '@/office/useMe';
import { OfficeCard, OfficeHeader, useOfficeColors } from '@/office/ui';

export default function OfficeSettings() {
  const C = useOfficeColors();
  const { me } = useMe();
  const Row = ({ k, v }: { k: string; v?: string | null }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 }}>
      <Text style={{ color: C.muted, fontSize: 14 }}>{k}</Text>
      <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{v || '—'}</Text>
    </View>
  );
  return (
    <>
      <OfficeHeader title="सेटिंग" />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <OfficeCard>
          <Text style={{ fontWeight: '700', color: C.text, marginBottom: 4 }}>थाना</Text>
          <Row k="थाना" v={me?.thana.name} />
          <Row k="जनपद" v={me?.thana.district} />
        </OfficeCard>
        <OfficeCard>
          <Text style={{ fontWeight: '700', color: C.text, marginBottom: 4 }}>आप</Text>
          <Row k="नाम" v={me?.member.name} />
          <Row k="पद" v={me ? ROLE_LABEL[me.member.role] : ''} />
          <Row k="मोबाइल" v={me?.member.mobile} />
        </OfficeCard>
        <OfficeCard>
          <Row k="App" v="InvestSuite कार्यालय" />
          <Row k="संस्करण" v={Constants.expoConfig?.version} />
        </OfficeCard>
        <Text style={{ fontSize: 12.5, color: C.muted, lineHeight: 19 }}>
          यह फ़ोन इस थाने से जुड़ा है। फ़ोन बदलना हो तो दूसरा CM / HM “सदस्य” में आपका नया कोड बनाए।
        </Text>
      </ScrollView>
    </>
  );
}

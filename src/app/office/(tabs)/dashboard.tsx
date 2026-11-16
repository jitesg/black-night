/** डैशबोर्ड (चरण 1: थाना + सदस्यों की गिनती; कागज़ की गिनती अगले चरण में). */
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { listMembers, type MemberRow } from '@/office/officeApi';
import { friendlyError, isOfficeRole, memberState, ROLE_LABEL } from '@/office/officeCore';
import { useMe } from '@/office/useMe';
import { ErrorText, OfficeCard, OfficeHeader, useOfficeColors } from '@/office/ui';

export default function OfficeDashboard() {
  const C = useOfficeColors();
  const { me } = useMe();
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await listMembers()); setErr(''); } catch (e) { setErr(friendlyError(e)); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const officers = rows.filter((r) => !isOfficeRole(r.role));
  const joined = officers.filter((r) => memberState(r, r.code) === 'joined').length;
  const Tile = ({ n, label, color }: { n: number | string; label: string; color: string }) => (
    <OfficeCard style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color }}>{n}</Text>
      <Text style={{ fontSize: 12.5, color: C.muted, textAlign: 'center' }}>{label}</Text>
    </OfficeCard>
  );

  return (
    <>
      <OfficeHeader title="डैशबोर्ड" subtitle={me ? `थाना ${me.thana.name} · जनपद ${me.thana.district}` : undefined} />
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {me ? (
          <OfficeCard>
            <Text style={{ fontSize: 13, color: C.muted }}>आप</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>{me.member.name}</Text>
            <Text style={{ fontSize: 13.5, color: C.muted }}>{ROLE_LABEL[me.member.role]}</Text>
          </OfficeCard>
        ) : null}
        <ErrorText text={err} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tile n={officers.length} label="अधिकारी" color={C.navy} />
          <Tile n={joined} label="app से जुड़े" color={C.dark ? '#4ADE80' : '#16A34A'} />
          <Tile n={officers.length - joined} label="कोड बाकी" color={C.dark ? '#FCD34D' : '#D97706'} />
        </View>
        <Pressable onPress={() => router.push('/office/members' as never)}>
          <OfficeCard style={{ borderStyle: 'dashed', borderColor: C.navy }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.navy }}>👥 सदस्य जोड़ें / कोड भेजें →</Text>
          </OfficeCard>
        </Pressable>
        <OfficeCard style={{ backgroundColor: C.soft }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>अगला चरण</Text>
          <Text style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 20 }}>
            न्यायालय के कागज़ / प्रार्थना पत्र अधिकारी को भेजना, “इस हफ़्ते आए”, लंबित / निस्तारित और अधिकारी-वार गिनती यहीं दिखेगी।
          </Text>
        </OfficeCard>
      </ScrollView>
    </>
  );
}

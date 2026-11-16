/** Start: signs in (anonymous) → joined phone goes to the tabs, a new phone to "welcome". */
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '@/office/useMe';
import { OfficeButton, useOfficeColors } from '@/office/ui';

export default function OfficeStart() {
  const C = useOfficeColors();
  const { me, loading, error, reload } = useMe();

  useEffect(() => {
    if (loading || error) return;
    router.replace((me ? '/office/dashboard' : '/office/welcome') as never);
  }, [me, loading, error]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      {error ? (
        <>
          <Text style={{ color: C.text, fontSize: 16, textAlign: 'center' }}>{error}</Text>
          <View style={{ alignSelf: 'stretch' }}><OfficeButton label="फिर कोशिश करें" onPress={() => void reload()} /></View>
        </>
      ) : (
        <>
          <ActivityIndicator color={C.navy} size="large" />
          <Text style={{ color: C.muted }}>InvestSuite कार्यालय खुल रहा है…</Text>
        </>
      )}
    </View>
  );
}

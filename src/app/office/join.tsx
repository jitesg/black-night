/** कोड से जुड़ें — a second CM / HM joins an existing थाना (officer codes belong in InvestSuite and are not used up). */
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { claimCode, getMe } from '@/office/officeApi';
import { cleanCode, friendlyError } from '@/office/officeCore';
import { setCachedMe } from '@/office/useMe';
import { ErrorText, Field, OfficeButton, OfficeHeader, useOfficeColors } from '@/office/ui';

export default function JoinWithCode() {
  const C = useOfficeColors();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const join = async () => {
    if (code.length !== 6) { setErr('पूरे 6 अंक डालें'); return; }
    setBusy(true); setErr('');
    try {
      const r = await claimCode(code, 'office');
      if (r.status === 'wrong') { setErr('कोड सही नहीं है या उसकी अवधि खत्म हो गयी — कार्यालय से नया कोड लें'); return; }
      if (r.status === 'other_app') {
        setErr('यह कोड अधिकारी / सिपाही का है — इसे InvestSuite app में (सेटिंग → कार्यालय से जुड़ें) डालें। कोड अभी भी चलेगा।');
        return;
      }
      setCachedMe(await getMe());
      router.replace('/office/dashboard' as never);
    } catch (x) {
      setErr(friendlyError(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <OfficeHeader title="कोड से जुड़ें" subtitle="कार्यालय (CM / HM) का कोड" back />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Field label="6 अंक का कोड" value={code} onChange={(v) => setCode(cleanCode(v))} placeholder="______" keyboardType="number-pad" maxLength={7} big />
        <ErrorText text={err} />
        <OfficeButton label="जुड़ें" onPress={() => void join()} busy={busy} disabled={code.length !== 6} />
        <Text style={{ fontSize: 12.5, color: C.muted, lineHeight: 19 }}>
          कोड थाने के CM / HM ने “सदस्य → सदस्य जोड़ें” से बनाया होगा। एक कोड एक ही फ़ोन पर, 7 दिन तक चलता है।
        </Text>
      </ScrollView>
    </>
  );
}

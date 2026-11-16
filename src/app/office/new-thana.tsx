/** ② नया थाना बनाएँ — creates the थाना and makes this phone its first CM / HM. */
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { createThana, getMe } from '@/office/officeApi';
import { friendlyError, newThanaError } from '@/office/officeCore';
import { setCachedMe } from '@/office/useMe';
import { Chips, ErrorText, Field, OfficeButton, OfficeHeader, useOfficeColors } from '@/office/ui';

export default function NewThana() {
  const C = useOfficeColors();
  const [thana, setThana] = useState('');
  const [district, setDistrict] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'cm' | 'hm' | ''>('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    const e = newThanaError({ thana, district, name, role, mobile });
    if (e) { setErr(e); return; }
    setBusy(true); setErr('');
    try {
      await createThana({ thana, district, name, role: role as 'cm' | 'hm', mobile });
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
      <OfficeHeader title="नया थाना बनाएँ" subtitle="एक बार — फिर सदस्य जोड़ें" back />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Field label="थाना" value={thana} onChange={setThana} placeholder="जैसे: बछरावां" />
        <Field label="जनपद" value={district} onChange={setDistrict} placeholder="जैसे: रायबरेली" />
        <Field label="आपका नाम" value={name} onChange={setName} placeholder="जैसे: राम कुमार" />
        <Chips label="आपका पद" value={role} onChange={setRole}
          options={[{ value: 'cm', label: 'कार्यालय मुंशी (CM)' }, { value: 'hm', label: 'हेड मोहर्रिर (HM)' }]} />
        <Field label="मोबाइल (वैकल्पिक)" value={mobile} onChange={setMobile} placeholder="10 अंक" keyboardType="phone-pad" maxLength={13} />
        <ErrorText text={err} />
        <OfficeButton label="थाना बनाएँ" onPress={() => void save()} busy={busy} />
        <Text style={{ fontSize: 12.5, color: C.muted, lineHeight: 19 }}>
          दूसरा CM / HM बाद में “सदस्य” में जोड़ें — उसे अपना कोड मिलेगा।
        </Text>
      </ScrollView>
    </>
  );
}

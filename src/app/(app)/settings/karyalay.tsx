/**
 * InvestSuite → सेटिंग → कार्यालय से जुड़ें (owner, चरण 2 क): officer types the 6-digit code from the थाना कार्यालय
 * (003 claim_member_for 'officer'); joined → थाना / आप / कार्यालय + "इस फ़ोन को कार्यालय से अलग करें" (004 leave_thana).
 * Only the link goes to the server — never case diary / मुकदमा data.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '@/components/ui/ds/AppHeader';
import { router } from 'expo-router';
import { claimCode, getMe, leaveThana, officeNames } from '@/office/officeApi';
import { cleanCode, friendlyError, memberTitle } from '@/office/officeCore';
import { getOfficerLink, setOfficerLink, type OfficerLink } from '@/office/officerLink';
import { useOfficeColors } from '@/office/ui';

export default function KaryalayJoinScreen() {
  const C = useOfficeColors();
  const [link, setLink] = useState<OfficerLink | null>(getOfficerLink());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [justJoined, setJustJoined] = useState(false);

  // Joined phone: refresh from the server (the office may have removed / re-coded this member).
  useFocusEffect(useCallback(() => {
    if (!getOfficerLink()) return;
    let alive = true;
    (async () => {
      try {
        const me = await getMe();
        if (!alive) return;
        if (!me) { setOfficerLink(null); setLink(null); return; }
        const office = await officeNames().catch(() => getOfficerLink()?.office ?? []);
        const next: OfficerLink = {
          thana: me.thana.name, district: me.thana.district, name: me.member.name, rank: me.member.rank,
          office, joinedAt: getOfficerLink()?.joinedAt ?? new Date().toISOString(),
        };
        setOfficerLink(next); setLink(next);
      } catch { /* offline — keep showing the saved link */ }
    })();
    return () => { alive = false; };
  }, []));

  const join = async () => {
    if (code.length !== 6) { setErr('पूरे 6 अंक डालें'); return; }
    setBusy(true); setErr('');
    try {
      const r = await claimCode(code, 'officer');
      if (r.status === 'wrong') { setErr('कोड सही नहीं है या उसकी अवधि खत्म हो गयी — कार्यालय से नया कोड लें'); return; }
      if (r.status === 'other_app') { setErr('यह कोड कार्यालय (CM / HM) का है — इसे “InvestSuite कार्यालय” app में डालें। कोड अभी भी चलेगा।'); return; }
      const me = await getMe();
      if (!me) { setErr('जुड़ नहीं पाये — फिर कोशिश करें'); return; }
      const office = await officeNames().catch(() => []);
      const next: OfficerLink = {
        thana: me.thana.name, district: me.thana.district, name: me.member.name, rank: me.member.rank,
        office, joinedAt: new Date().toISOString(),
      };
      setOfficerLink(next); setLink(next); setCode(''); setJustJoined(true);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true); setErr('');
    try {
      await leaveThana();
      setOfficerLink(null); setLink(null); setConfirmLeave(false); setJustJoined(false);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const Btn = ({ label, onPress, kind = 'navy' }: { label: string; onPress: () => void; kind?: 'navy' | 'outline' | 'danger' }) => (
    <Pressable onPress={onPress} disabled={busy} accessibilityLabel={label}>
      <View style={{
        backgroundColor: kind === 'navy' ? C.navy : kind === 'danger' ? '#DC2626' : 'transparent',
        borderWidth: kind === 'outline' ? 1.5 : 0, borderColor: C.navy, borderRadius: 14, paddingVertical: 13, alignItems: 'center', minHeight: 50, justifyContent: 'center',
      }}>
        {busy ? <ActivityIndicator color={kind === 'outline' ? C.navy : '#fff'} /> : (
          <Text style={{ color: kind === 'outline' ? C.navy : kind === 'navy' ? C.onNavy : '#fff', fontWeight: '700', fontSize: 15.5 }}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
  const Row = ({ k, v }: { k: string; v: string }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 }}>
      <Text style={{ color: C.muted, fontSize: 14 }}>{k}</Text>
      <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
  const card = { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader title={link ? 'कार्यालय' : 'कार्यालय से जुड़ें'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        {link ? (
          <>
            <View style={{ backgroundColor: C.greenBg, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 28 }}>✅</Text>
              <Text style={{ fontWeight: '700', fontSize: 17, color: C.green }}>{justJoined ? 'कार्यालय से जुड़ गये' : 'कार्यालय से जुड़े हैं'}</Text>
            </View>
            <View style={card}>
              <Row k="थाना" v={link.thana} />
              <Row k="जनपद" v={link.district} />
              <Row k="आप" v={memberTitle({ name: link.name, rank: link.rank })} />
              <Row k="कार्यालय" v={link.office.join(', ') || '—'} />
            </View>
            <Text style={{ fontSize: 12.5, color: C.muted, lineHeight: 19 }}>
              अब कार्यालय जो न्यायालय के कागज़ / प्रार्थना पत्र आपको भेजेगा, वे अपने आप आपके प्रार्थना पत्र / न्यायालय module में आएँगे (अगला चरण)।
            </Text>
            {err ? <Text style={{ color: C.red, fontSize: 13.5, fontWeight: '600' }}>{err}</Text> : null}
            {confirmLeave ? (
              <>
                <View style={{ backgroundColor: C.amberBg, borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: C.amber, fontSize: 14 }}>⚠️ इस फ़ोन को थाना {link.thana} के कार्यालय से अलग करें? फिर जुड़ने के लिए कार्यालय से नया कोड लेना होगा।</Text>
                </View>
                <Btn label="हाँ, अलग करें" kind="danger" onPress={() => void leave()} />
                <Btn label="रद्द करें" kind="outline" onPress={() => setConfirmLeave(false)} />
              </>
            ) : (
              <Btn label="इस फ़ोन को कार्यालय से अलग करें" kind="outline" onPress={() => setConfirmLeave(true)} />
            )}
          </>
        ) : (
          <>
            <View style={card}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted, marginBottom: 6 }}>6 अंक का कोड</Text>
              <TextInput
                value={code}
                onChangeText={(v) => { setCode(cleanCode(v)); setErr(''); }}
                placeholder="______"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                maxLength={7}
                style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 14, backgroundColor: C.input, color: C.text, fontSize: 28, fontWeight: '700', letterSpacing: 10, textAlign: 'center', paddingVertical: 10 }}
              />
              <Text style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>कोड आपके थाने के कार्यालय (CM / HM) ने WhatsApp पर भेजा होगा।</Text>
            </View>
            {err ? (
              <View style={{ backgroundColor: C.dark ? '#3B1F22' : '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, padding: 10 }}>
                <Text style={{ color: C.red, fontSize: 13.5 }}>✕ {err}</Text>
              </View>
            ) : null}
            <Btn label="जुड़ें" onPress={() => void join()} />
            <Text style={{ fontSize: 12.5, color: C.muted, lineHeight: 19 }}>
              इंटरनेट चाहिए। आपका केस डायरी / मुकदमों का डेटा कार्यालय को नहीं जाता — सिर्फ़ भेजे गए कागज़ की स्थिति जाती है।
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

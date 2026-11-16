/** ③ सदस्य — list (सभी / अधिकारी / कार्यालय), ④ सदस्य जोड़ें → 6-digit code + WhatsApp; tap a member → actions. */
import { useCallback, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { addMember, listMembers, removeMember, resetCode, type MemberRow } from '@/office/officeApi';
import {
  daysLeft, friendlyError, initials, inviteText, isOfficeRole, memberState, memberTitle, newMemberError, OFFICER_RANKS,
  ROLE_LABEL, sortMembers, spacedCode, STATE_LABEL, whatsappUrl, type MemberRole,
} from '@/office/officeCore';
import { useMe } from '@/office/useMe';
import { Chips, ErrorText, Field, OfficeButton, OfficeCard, OfficeHeader, useOfficeColors, type OfficeColors } from '@/office/ui';

type Filter = 'all' | 'officer' | 'office';

function Sheet({ visible, onClose, children, C }: { visible: boolean; onClose: () => void; children: React.ReactNode; C: OfficeColors }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={onClose} />
      <View style={{ backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%', paddingBottom: NAV_BAR_INSET }}>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginTop: 10 }} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

export default function OfficeMembers() {
  const C = useOfficeColors();
  const { me } = useMe();
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // add sheet
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState<MemberRole>('officer');
  const [rank, setRank] = useState('उ0नि0');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [made, setMade] = useState<{ code: string; role: MemberRole; mobile: string; name: string } | null>(null);

  // actions sheet
  const [sel, setSel] = useState<MemberRow | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [newCode, setNewCode] = useState('');

  const load = useCallback(async () => {
    try { setRows(await listMembers()); setErr(''); } catch (e) { setErr(friendlyError(e)); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const list = useMemo(() => sortMembers(rows), [rows]);
  const counts = { all: list.length, officer: list.filter((m) => !isOfficeRole(m.role)).length, office: list.filter((m) => isOfficeRole(m.role)).length };
  const shown = list.filter((m) => filter === 'all' || (filter === 'office') === isOfficeRole(m.role));

  const share = (r: MemberRole, code: string, mob: string | null | undefined) => {
    if (!me) return;
    void Linking.openURL(whatsappUrl(mob, inviteText(r, code, me.thana.name, me.thana.district))).catch(() => setErr('WhatsApp नहीं खुला'));
  };

  const openAdd = () => {
    setRole('officer'); setRank('उ0नि0'); setName(''); setMobile(''); setFormErr(''); setMade(null); setAdding(true);
  };

  const save = async () => {
    const e = newMemberError({ role, name, mobile });
    if (e) { setFormErr(e); return; }
    setBusy(true); setFormErr('');
    try {
      const r = await addMember({ role, name, rank: role === 'officer' ? rank : undefined, mobile });
      setMade({ code: r.code, role, mobile, name });
      void load();
    } catch (x) { setFormErr(friendlyError(x)); } finally { setBusy(false); }
  };

  const doReset = async (m: MemberRow) => {
    setBusy(true);
    try { setNewCode(await resetCode(m.id)); void load(); } catch (x) { setErr(friendlyError(x)); setSel(null); } finally { setBusy(false); }
  };

  const doRemove = async (m: MemberRow) => {
    setBusy(true);
    try { await removeMember(m.id); setSel(null); void load(); } catch (x) { setErr(friendlyError(x)); } finally { setBusy(false); setConfirmRemove(false); }
  };

  const pillColors = (s: ReturnType<typeof memberState>) => s === 'joined'
    ? { bg: C.greenBg, fg: C.green } : { bg: C.amberBg, fg: C.amber };

  const isMe = (m: MemberRow) => m.id === me?.member.id;

  return (
    <>
      <OfficeHeader title="सदस्य" subtitle={me ? `थाना ${me.thana.name} · जनपद ${me.thana.district}` : undefined} />
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {([['all', 'सभी'], ['officer', 'अधिकारी'], ['office', 'कार्यालय']] as [Filter, string][]).map(([k, l]) => {
            const on = filter === k;
            return (
              <Pressable key={k} style={{ flex: 1 }} onPress={() => setFilter(k)}>
                <View style={{ backgroundColor: on ? C.navy : C.border, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13.5, color: on ? C.onNavy : C.text, fontWeight: on ? '700' : '400' }}>{l} ({counts[k]})</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <ErrorText text={err} />
        {shown.map((m) => {
          const s = memberState(m, m.code);
          const pc = pillColors(s);
          const sub = s === 'joined' || !m.code
            ? [isMe(m) ? `${ROLE_LABEL[m.role]} · आप` : ROLE_LABEL[m.role], m.mobile].filter(Boolean).join(' · ')
            : s === 'code' ? `कोड ${spacedCode(m.code.code)} · ${daysLeft(m.code.expires_at)} दिन बाकी` : 'कोड की अवधि खत्म — नया कोड बनाएँ';
          return (
            <Pressable key={m.id} onPress={() => { if (!isMe(m)) { setNewCode(''); setConfirmRemove(false); setSel(m); } }}>
              <OfficeCard style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.navy, fontWeight: '700', fontSize: 14 }}>{initials(m.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '700', color: C.text }} numberOfLines={1}>{memberTitle(m)}</Text>
                  <Text style={{ fontSize: 12.5, color: C.muted }} numberOfLines={1}>{sub}</Text>
                </View>
                <View style={{ backgroundColor: pc.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: pc.fg }}>{STATE_LABEL[s]}</Text>
                </View>
              </OfficeCard>
            </Pressable>
          );
        })}
        {!shown.length && !err ? <Text style={{ color: C.muted, textAlign: 'center', marginTop: 24 }}>अभी कोई सदस्य नहीं — नीचे “सदस्य जोड़ें” दबाएँ</Text> : null}
        <Text style={{ fontSize: 12, color: C.muted, lineHeight: 18 }}>सदस्य पर दबाएँ → कोड फिर से WhatsApp करें / नया कोड बनाएँ (फ़ोन खो गया) / हटाएँ</Text>
      </ScrollView>

      <Pressable onPress={openAdd} style={{ position: 'absolute', right: 16, bottom: 16 }} accessibilityLabel="सदस्य जोड़ें">
        <View style={{ backgroundColor: '#16A34A', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 4 }}>
          <UserPlus size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>सदस्य जोड़ें</Text>
        </View>
      </Pressable>

      {/* ④ सदस्य जोड़ें */}
      <Sheet visible={adding} onClose={() => setAdding(false)} C={C}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>सदस्य जोड़ें</Text>
        {made ? (
          <>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>✓ {made.name} — सदस्य बन गया। इनका कोड:</Text>
            <View style={{ backgroundColor: C.soft, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 40, fontWeight: '700', letterSpacing: 8, color: C.navy }}>{made.code}</Text>
              <Text style={{ fontSize: 12.5, color: C.muted }}>7 दिन तक · एक ही बार चलेगा</Text>
            </View>
            <OfficeButton label="WhatsApp पर भेजें" kind="whatsapp" onPress={() => share(made.role, made.code, made.mobile)} />
            <Text style={{ fontSize: 12.5, color: C.muted, lineHeight: 19 }}>
              {me ? inviteText(made.role, made.code, me.thana.name, me.thana.district) : ''}
            </Text>
            <OfficeButton label="हो गया" kind="outline" onPress={() => setAdding(false)} />
          </>
        ) : (
          <>
            <Chips label="भूमिका" value={role} onChange={setRole}
              options={[{ value: 'officer', label: 'अधिकारी' }, { value: 'cm', label: 'CM' }, { value: 'hm', label: 'HM' }]} />
            {role === 'officer' ? (
              <Chips label="पद" value={OFFICER_RANKS.includes(rank) ? rank : 'अन्य'} onChange={(v) => setRank(v === 'अन्य' ? '' : v)}
                options={[...OFFICER_RANKS.map((r) => ({ value: r, label: r })), { value: 'अन्य', label: 'अन्य' }]} />
            ) : null}
            {role === 'officer' && !OFFICER_RANKS.includes(rank) ? <Field label="पद लिखें" value={rank} onChange={setRank} placeholder="जैसे: अपर उ0नि0" /> : null}
            <Field label="नाम" value={name} onChange={setName} placeholder="जैसे: श्याम सिंह" />
            <Field label="मोबाइल (WhatsApp के लिए)" value={mobile} onChange={setMobile} placeholder="10 अंक" keyboardType="phone-pad" maxLength={13} />
            <ErrorText text={formErr} />
            <OfficeButton label="जोड़ें और कोड बनाएँ" onPress={() => void save()} busy={busy} />
          </>
        )}
      </Sheet>

      {/* actions on a member */}
      <Sheet visible={!!sel} onClose={() => setSel(null)} C={C}>
        {sel ? (
          <>
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>{memberTitle(sel)}</Text>
            <Text style={{ fontSize: 13.5, color: C.muted }}>{ROLE_LABEL[sel.role]}{sel.mobile ? ` · ${sel.mobile}` : ''} · {STATE_LABEL[memberState(sel, sel.code)]}</Text>
            {newCode ? (
              <>
                <View style={{ backgroundColor: C.soft, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 40, fontWeight: '700', letterSpacing: 8, color: C.navy }}>{newCode}</Text>
                  <Text style={{ fontSize: 12.5, color: C.muted }}>नया कोड · 7 दिन तक</Text>
                </View>
                <OfficeButton label="WhatsApp पर भेजें" kind="whatsapp" onPress={() => share(sel.role, newCode, sel.mobile)} />
              </>
            ) : confirmRemove ? (
              <>
                <View style={{ backgroundColor: C.amberBg, borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: C.amber, fontSize: 14 }}>⚠️ {memberTitle(sel)} को थाने से हटाएँ? उनका फ़ोन app से अलग हो जाएगा।</Text>
                </View>
                <OfficeButton label="हाँ, हटाएँ" kind="danger" busy={busy} onPress={() => void doRemove(sel)} />
                <OfficeButton label="रद्द करें" kind="outline" onPress={() => setConfirmRemove(false)} />
              </>
            ) : (
              <>
                {memberState(sel, sel.code) === 'code' && sel.code ? (
                  <OfficeButton label={`कोड ${spacedCode(sel.code.code)} फिर से WhatsApp करें`} kind="whatsapp" onPress={() => share(sel.role, sel.code!.code, sel.mobile)} />
                ) : null}
                <OfficeButton label={sel.user_id ? 'नया कोड बनाएँ (फ़ोन बदला / खो गया)' : 'नया कोड बनाएँ'} busy={busy} onPress={() => void doReset(sel)} />
                {sel.user_id ? <Text style={{ fontSize: 12.5, color: C.muted }}>नया कोड बनते ही पुराना फ़ोन इस थाने से अलग हो जाएगा।</Text> : null}
                <OfficeButton label="थाने से हटाएँ" kind="outline" onPress={() => setConfirmRemove(true)} />
              </>
            )}
            <OfficeButton label="बंद करें" kind="outline" onPress={() => setSel(null)} />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

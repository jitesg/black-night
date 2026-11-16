/** ④ डैशबोर्ड — इस हफ़्ते आए · लंबित · समय निकला · निस्तारित, प्रकार अनुसार, अधिकारी-वार table, समय निकले कागज़. */
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, FilePlus2, UserPlus } from 'lucide-react-native';
import { ROLE_LABEL } from '@/office/officeCore';
import { dashboard, daysLabel, daysUntil, subtypeLabel } from '@/office/taskCore';
import { useMe } from '@/office/useMe';
import { useOfficeData } from '@/office/useOfficeData';
import { ErrorText, OfficeCard, OfficeHeader, useOfficeColors } from '@/office/ui';
import { Section } from '@/office/ui2';

export default function OfficeDashboard() {
  const C = useOfficeColors();
  const { me } = useMe();
  const { tasks, officers, nameOf, error, reload } = useOfficeData();
  const [refreshing, setRefreshing] = useState(false);
  const d = useMemo(() => dashboard(tasks), [tasks]);
  const amber = C.dark ? '#FCD34D' : '#D97706';
  const green = C.dark ? '#4ADE80' : '#16A34A';

  const Tile = ({ n, label, color, state }: { n: number; label: string; color: string; state?: string }) => (
    <Pressable style={{ flex: 1 }} onPress={() => router.push(`/office/kagaz${state ? `?state=${state}` : ''}` as never)} accessibilityLabel={`${label} ${n}`}>
      <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center', gap: 2 }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color }}>{n}</Text>
        <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center' }} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <OfficeHeader title="डैशबोर्ड" subtitle={me ? `थाना ${me.thana.name} · जनपद ${me.thana.district}` : undefined} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />}>
        {me ? <Text style={{ fontSize: 13.5, color: C.muted }}>नमस्ते, {me.member.name} · {ROLE_LABEL[me.member.role]}</Text> : null}
        <ErrorText text={error} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Tile n={d.thisWeek} label="इस हफ़्ते आए" color={C.navy} />
          <Tile n={d.pending} label="लंबित" color={amber} state="pending" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Tile n={d.overdue} label="समय निकला" color={C.red} state="overdue" />
          <Tile n={d.done} label="निस्तारित" color={green} state="done" />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/office/send' as never)} accessibilityLabel="कागज़ भेजें">
            <View style={{ backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <FilePlus2 size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>कागज़ भेजें</Text>
            </View>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/office/members' as never)} accessibilityLabel="सदस्य">
            <View style={{ borderWidth: 1.5, borderColor: C.navy, borderRadius: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <UserPlus size={18} color={C.navy} /><Text style={{ color: C.navy, fontWeight: '700', fontSize: 15 }}>सदस्य ({officers.length})</Text>
            </View>
          </Pressable>
        </View>

        <Section title="इस हफ़्ते — प्रकार अनुसार">
          {d.weekBySubtype.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {d.weekBySubtype.map((x) => (
                <View key={`${x.kind}${x.subtype}`} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: C.card }}>
                  <Text style={{ fontSize: 13, color: C.text }}>{x.label} <Text style={{ fontWeight: '700' }}>{x.n}</Text></Text>
                </View>
              ))}
            </View>
          ) : <Text style={{ fontSize: 13.5, color: C.muted }}>इस हफ़्ते अभी कोई कागज़ नहीं भेजा।</Text>}
        </Section>

        <Section title="अधिकारी-वार">
          <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: C.muted }}>अधिकारी</Text>
            {['लंबित', 'समय निकला', 'निस्तारित'].map((h) => <Text key={h} style={{ width: 62, fontSize: 12, fontWeight: '700', color: C.muted, textAlign: 'center' }}>{h}</Text>)}
          </View>
          {officers.length ? officers.map((m) => {
            const r = d.byOfficer.find((o) => o.memberId === m.id) ?? { pending: 0, overdue: 0, done: 0 };
            return (
              <Pressable key={m.id} onPress={() => router.push(`/office/kagaz?member=${m.id}` as never)} accessibilityLabel={nameOf(m.id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: '600' }} numberOfLines={1}>{nameOf(m.id)}</Text>
                  <Text style={{ width: 62, textAlign: 'center', fontSize: 14.5, fontWeight: '700', color: r.pending ? amber : C.muted }}>{r.pending}</Text>
                  <Text style={{ width: 62, textAlign: 'center', fontSize: 14.5, fontWeight: '700', color: r.overdue ? C.red : C.muted }}>{r.overdue}</Text>
                  <Text style={{ width: 62, textAlign: 'center', fontSize: 14.5, fontWeight: '700', color: r.done ? green : C.muted }}>{r.done}</Text>
                </View>
              </Pressable>
            );
          }) : <Text style={{ fontSize: 13.5, color: C.muted }}>अभी कोई अधिकारी नहीं।</Text>}
          {officers.length ? <Text style={{ fontSize: 12, color: C.muted }}>पंक्ति दबाएँ → उस अधिकारी के कागज़</Text> : null}
        </Section>

        {d.overdueList.length ? (
          <Section title={`समय निकल गया (${d.overdueList.length})`}>
            {d.overdueList.slice(0, 8).map((t) => (
              <Pressable key={t.id} onPress={() => router.push(`/office/task/${t.id}` as never)} accessibilityLabel={t.title}>
                <OfficeCard style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }} numberOfLines={1}>{t.title}</Text>
                    <Text style={{ fontSize: 12.5, color: C.muted }} numberOfLines={1}>
                      {subtypeLabel(t.kind, t.subtype)} · {t.assignee ? nameOf(t.assignee.member_id) : '—'} · <Text style={{ color: C.red, fontWeight: '700' }}>{daysLabel(daysUntil(t.due_on))}</Text>
                    </Text>
                  </View>
                  <ChevronRight size={18} color={C.muted} />
                </OfficeCard>
              </Pressable>
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}

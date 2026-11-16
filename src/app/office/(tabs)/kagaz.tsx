/** ① कागज़ — every कागज़ sent by this थाना: न्यायालय / प्रार्थना पत्र, लंबित / निस्तारित / समय निकला, ⚙︎ प्रकार / अधिकारी / तारीख. */
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FilePlus2, FileText, Paperclip, SlidersHorizontal } from 'lucide-react-native';
import { useMe } from '@/office/useMe';
import { useOfficeData } from '@/office/useOfficeData';
import {
  COURT_SUBTYPES, KIND_LABEL, NO_FILTER, PETITION_SUBTYPES, daysLabel, daysUntil, isOverdue, isPending, isThisWeek, matchesFilter,
  showDate, sortTasks, subtypeLabel, taskState, type TaskFilter, type TaskListRow,
} from '@/office/taskCore';
import { ErrorText, OfficeButton, OfficeHeader, useOfficeColors } from '@/office/ui';
import { BottomSheet, Segmented, StatusPill } from '@/office/ui2';

export default function OfficeKagaz() {
  const C = useOfficeColors();
  const { me } = useMe();
  const params = useLocalSearchParams<{ member?: string; state?: string }>();
  const { tasks, officers, nameOf, loading, error, reload } = useOfficeData();
  const [filter, setFilter] = useState<TaskFilter>({
    ...NO_FILTER, memberId: params.member ?? '', state: (params.state as TaskFilter['state']) ?? 'all',
  });
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<TaskFilter>(filter);
  const [refreshing, setRefreshing] = useState(false);

  const kindCount = (k: 'all' | 'petition' | 'court') => tasks.filter((t) => k === 'all' || t.kind === k).length;
  const base = tasks.filter((t) => matchesFilter(t, { ...filter, state: 'all' }));
  const shown = useMemo(() => sortTasks(tasks.filter((t) => matchesFilter(t, filter))), [tasks, filter]);
  const weekCount = tasks.filter((t) => !t.closed && isThisWeek(t)).length;
  const extraCount = Number(!!filter.subtype) + Number(!!filter.memberId) + Number(filter.range !== 'all');

  const stateChip = (k: TaskFilter['state'], label: string, n: number) => {
    const on = filter.state === k;
    return (
      <Pressable key={k} onPress={() => setFilter({ ...filter, state: on ? 'all' : k })} accessibilityLabel={label}>
        <View style={{ borderWidth: 1, borderColor: on ? C.navy : C.border, backgroundColor: on ? C.navy : C.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: on ? '700' : '500', color: on ? C.onNavy : C.text }}>{label} {n}</Text>
        </View>
      </Pressable>
    );
  };

  const renderItem = ({ item: t }: { item: TaskListRow }) => {
    const st = taskState(t);
    const d = daysUntil(t.due_on);
    const late = isOverdue(t);
    return (
      <Pressable onPress={() => router.push(`/office/task/${t.id}` as never)} accessibilityLabel={t.title}>
        <View style={{
          backgroundColor: C.card, borderWidth: late ? 1.5 : 1, borderColor: late ? C.red : C.border, borderRadius: 16, padding: 13, gap: 6,
          opacity: st === 'cancelled' ? 0.6 : 1,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 15.5, fontWeight: '700', color: C.text }} numberOfLines={2}>{t.title}</Text>
            <StatusPill state={st} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <View style={{ backgroundColor: t.kind === 'court' ? (C.dark ? '#1E3A5F' : '#DBEAFE') : (C.dark ? '#2E1065' : '#EDE9FE'), borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: t.kind === 'court' ? (C.dark ? '#93C5FD' : '#1D4ED8') : (C.dark ? '#C4B5FD' : '#5B21B6') }}>
                {KIND_LABEL[t.kind]} · {subtypeLabel(t.kind, t.subtype)}
              </Text>
            </View>
            <Text style={{ fontSize: 12.5, color: C.muted }} numberOfLines={1}>→ {t.assignee ? nameOf(t.assignee.member_id) : 'किसी को नहीं'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12.5, color: C.muted }}>{t.kind === 'court' ? 'नियत' : 'अंतिम'} {showDate(t.due_on) || '—'}</Text>
              {t.fileCount ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Paperclip size={12} color={C.muted} /><Text style={{ fontSize: 12.5, color: C.muted }}>{t.fileCount}</Text>
                </View>
              ) : null}
            </View>
            {isPending(t) && d !== null ? (
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: late ? C.red : d <= 2 ? (C.dark ? '#FCD34D' : '#D97706') : C.navy }}>{daysLabel(d)}</Text>
            ) : null}
          </View>
          {st === 'removed' ? <Text style={{ fontSize: 12.5, color: C.red }}>अधिकारी ने अपने फ़ोन से हटाया — खोलकर दोबारा भेजें</Text> : null}
        </View>
      </Pressable>
    );
  };

  const subtypeOptions = filter.kind === 'court' ? COURT_SUBTYPES.map((s) => s.value) : filter.kind === 'petition' ? [...PETITION_SUBTYPES] : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <OfficeHeader title="कागज़" subtitle={me ? `थाना ${me.thana.name} · इस हफ़्ते ${weekCount} भेजे` : undefined}
        right={
          <Pressable onPress={() => { setDraft(filter); setSheet(true); }} hitSlop={8} accessibilityLabel="फ़िल्टर">
            <View>
              <SlidersHorizontal size={22} color="#fff" />
              {extraCount ? (
                <View style={{ position: 'absolute', right: -8, top: -6, backgroundColor: '#F59E0B', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#111' }}>{extraCount}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        } />
      <FlatList
        data={shown}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 2 }}>
            <Segmented value={filter.kind} onChange={(k) => setFilter({ ...filter, kind: k, subtype: '' })}
              options={[{ value: 'all', label: `सभी (${kindCount('all')})` }, { value: 'court', label: `न्यायालय (${kindCount('court')})` }, { value: 'petition', label: `प्रार्थना पत्र (${kindCount('petition')})` }]} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {stateChip('pending', 'लंबित', base.filter(isPending).length)}
              {stateChip('overdue', 'समय निकला', base.filter((t) => isOverdue(t)).length)}
              {stateChip('done', 'निस्तारित', base.filter((t) => taskState(t) === 'done').length)}
              {stateChip('cancelled', 'रद्द', base.filter((t) => t.closed).length)}
            </View>
            {extraCount ? (
              <Pressable onPress={() => setFilter({ ...filter, subtype: '', memberId: '', range: 'all' })}>
                <Text style={{ fontSize: 13, color: C.navy, fontWeight: '700' }}>
                  {[filter.subtype && subtypeLabel(filter.kind === 'court' ? 'court' : 'petition', filter.subtype), filter.memberId && nameOf(filter.memberId),
                    filter.range === 'week' ? 'इस हफ़्ते' : filter.range === 'month' ? 'इस महीने' : ''].filter(Boolean).join(' · ')}  ✕ हटाएँ
                </Text>
              </Pressable>
            ) : null}
            <ErrorText text={error} />
          </View>
        }
        ListEmptyComponent={loading ? <ActivityIndicator color={C.navy} style={{ marginTop: 40 }} /> : (
          <View style={{ alignItems: 'center', gap: 10, marginTop: 50, paddingHorizontal: 20 }}>
            <FileText size={44} color={C.muted} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{tasks.length ? 'इस फ़िल्टर में कोई कागज़ नहीं' : 'अभी कोई कागज़ नहीं भेजा'}</Text>
            <Text style={{ fontSize: 13.5, color: C.muted, textAlign: 'center' }}>नीचे “कागज़ भेजें” दबाकर न्यायालय का कागज़ या प्रार्थना पत्र अधिकारी को भेजें।</Text>
          </View>
        )}
      />
      <Pressable onPress={() => router.push('/office/send' as never)} style={{ position: 'absolute', right: 16, bottom: 16 }} accessibilityLabel="कागज़ भेजें">
        <View style={{ backgroundColor: '#16A34A', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 5 }}>
          <FilePlus2 size={19} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>कागज़ भेजें</Text>
        </View>
      </Pressable>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="फ़िल्टर"
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><OfficeButton label="सब हटाएँ" kind="outline" onPress={() => setDraft({ ...draft, subtype: '', memberId: '', range: 'all' })} /></View>
            <View style={{ flex: 1 }}><OfficeButton label="लागू करें" onPress={() => { setFilter(draft); setSheet(false); }} /></View>
          </View>
        }>
        {(() => {
          const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
            <Pressable onPress={onPress} accessibilityLabel={label}>
              <View style={{ borderWidth: 1, borderColor: on ? C.navy : C.border, backgroundColor: on ? C.navy : C.card, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
                <Text style={{ fontSize: 13.5, color: on ? C.onNavy : C.text, fontWeight: on ? '700' : '400' }}>{label}</Text>
              </View>
            </Pressable>
          );
          const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>{title}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
            </View>
          );
          const opts = draft.kind === 'court' ? COURT_SUBTYPES.map((s) => s.value) : draft.kind === 'petition' ? [...PETITION_SUBTYPES] : subtypeOptions;
          return (
            <>
              <Group title="प्रकार">
                {draft.kind === 'all' ? <Text style={{ fontSize: 13, color: C.muted }}>पहले ऊपर “न्यायालय” या “प्रार्थना पत्र” चुनें</Text> : (
                  <>
                    <Chip on={!draft.subtype} label="सभी" onPress={() => setDraft({ ...draft, subtype: '' })} />
                    {opts.map((s) => (
                      <Chip key={s} on={draft.subtype === s} label={`${subtypeLabel(draft.kind as 'court' | 'petition', s)} (${tasks.filter((t) => t.kind === draft.kind && t.subtype === s).length})`}
                        onPress={() => setDraft({ ...draft, subtype: s })} />
                    ))}
                  </>
                )}
              </Group>
              <Group title="अधिकारी">
                <Chip on={!draft.memberId} label="सभी" onPress={() => setDraft({ ...draft, memberId: '' })} />
                {officers.map((m) => (
                  <Chip key={m.id} on={draft.memberId === m.id} label={nameOf(m.id)} onPress={() => setDraft({ ...draft, memberId: m.id })} />
                ))}
              </Group>
              <Group title="भेजने की तारीख">
                <Chip on={draft.range === 'all'} label="सभी" onPress={() => setDraft({ ...draft, range: 'all' })} />
                <Chip on={draft.range === 'week'} label="इस हफ़्ते" onPress={() => setDraft({ ...draft, range: 'week' })} />
                <Chip on={draft.range === 'month'} label="इस महीने" onPress={() => setDraft({ ...draft, range: 'month' })} />
              </Group>
            </>
          );
        })()}
      </BottomSheet>
    </View>
  );
}

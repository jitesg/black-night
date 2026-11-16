/** एक कागज़ — status, जानकारी, फ़ाइलें; बदलें / रद्द करें / दोबारा भेजें (owner: office can edit and cancel). */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { FileText, Pencil } from 'lucide-react-native';
import { friendlyError } from '@/office/officeCore';
import { fileUrl, getTask, listTaskFiles, removeTaskFile, resend, setCancelled, type TaskFile } from '@/office/taskApi';
import {
  KIND_LABEL, STATUS_LABEL, daysLabel, daysUntil, isOverdue, isPending, showDate, subtypeLabel, taskState, type TaskListRow, type TaskPerson,
} from '@/office/taskCore';
import { invalidateOfficeData, useOfficeData } from '@/office/useOfficeData';
import { ErrorText, OfficeButton, OfficeHeader, useOfficeColors } from '@/office/ui';
import { BottomSheet, Section, StatusPill } from '@/office/ui2';

const STEPS = ['sent', 'received', 'seen', 'done'] as const;

export default function TaskDetail() {
  const C = useOfficeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { nameOf } = useOfficeData();
  const [t, setT] = useState<TaskListRow | null>(null);
  const [files, setFiles] = useState<(TaskFile & { url?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'file' | null>(null);
  const [fileSel, setFileSel] = useState<TaskFile | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [task, fl] = await Promise.all([getTask(id), listTaskFiles(id)]);
      setT(task);
      const withUrls = await Promise.all(fl.map(async (f) => ({ ...f, url: await fileUrl(f.path).catch(() => undefined) })));
      setFiles(withUrls); setErr('');
    } catch (e) { setErr(friendlyError(e)); } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); invalidateOfficeData(); await load(); } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); setConfirm(null); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.navy} size="large" /></View>;
  if (!t) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <OfficeHeader title="कागज़" back />
        <View style={{ padding: 20, gap: 12 }}><ErrorText text={err || 'यह कागज़ नहीं मिला'} /></View>
      </View>
    );
  }

  const st = taskState(t);
  const f = (t.fields ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof f[k] === 'string' ? (f[k] as string) : '');
  const people = (k: string) => (Array.isArray(f[k]) ? (f[k] as TaskPerson[]) : []);
  const d = daysUntil(t.due_on);
  const Row = ({ k, v }: { k: string; v?: string | null }) => (v ? (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 3 }}>
      <Text style={{ width: 96, fontSize: 13.5, color: C.muted }}>{k}</Text>
      <Text style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: '600' }}>{v}</Text>
    </View>
  ) : null);
  const personLine = (p: TaskPerson) => [p.name, p.father ? `${p.relation || 'पुत्र'} ${p.father}` : '', p.address ? `नि0 ${p.address}` : '', p.mobile ? `मो0 ${p.mobile}` : ''].filter(Boolean).join(' ');
  const stepIdx = STEPS.indexOf(st as typeof STEPS[number]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <OfficeHeader title={subtypeLabel(t.kind, t.subtype)} subtitle={KIND_LABEL[t.kind]} back
        right={st !== 'cancelled' ? (
          <Pressable onPress={() => router.push(`/office/send?id=${t.id}` as never)} hitSlop={8} accessibilityLabel="बदलें">
            <Pencil size={20} color="#fff" />
          </Pressable>
        ) : undefined} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}>
        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: isOverdue(t) ? C.red : C.border, borderRadius: 16, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: C.text }}>{t.title}</Text>
            <StatusPill state={st} />
          </View>
          <Text style={{ fontSize: 13.5, color: C.muted }}>→ {t.assignee ? nameOf(t.assignee.member_id) : 'किसी को नहीं'}</Text>
          {st !== 'cancelled' && st !== 'removed' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {STEPS.map((k, i) => {
                const reached = i <= stepIdx;
                return (
                  <View key={k} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
                      <View style={{ flex: 1, height: 3, backgroundColor: i === 0 ? 'transparent' : reached ? C.navy : C.border }} />
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: reached ? (k === 'done' ? '#16A34A' : C.navy) : C.border }} />
                      <View style={{ flex: 1, height: 3, backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < stepIdx ? C.navy : C.border }} />
                    </View>
                    <Text style={{ fontSize: 11.5, color: reached ? C.text : C.muted, fontWeight: reached ? '700' : '400' }}>{STATUS_LABEL[k].replace(' ✓', '')}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {isPending(t) && d !== null ? (
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: isOverdue(t) ? C.red : C.navy }}>
              {t.kind === 'court' ? 'नियत' : 'अंतिम'} तिथि {showDate(t.due_on)} · {daysLabel(d)}
            </Text>
          ) : null}
          {st === 'removed' ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13.5, color: C.red }}>अधिकारी ने यह कागज़ अपने फ़ोन से हटा दिया है।</Text>
              <OfficeButton label="दोबारा भेजें" busy={busy} onPress={() => void act(() => resend(t.id, t.assignee!.member_id))} />
            </View>
          ) : null}
        </View>

        <Section title="जानकारी">
          <View>
            <Row k="प्रकार" v={subtypeLabel(t.kind, t.subtype)} />
            <Row k="प्राप्ति तिथि" v={showDate(t.received_on)} />
            <Row k={t.kind === 'court' ? 'नियत तिथि' : 'अंतिम तिथि'} v={showDate(t.due_on)} />
            <Row k="कागज़ का नाम" v={s('document_title')} />
            <Row k="न्यायालय" v={s('court_name')} />
            <Row k="वाद सं0" v={s('vad_sankhya')} />
            <Row k="मु0अ0सं0" v={s('apradh_sankhya')} />
            <Row k="धारा" v={s('applicable_sections')} />
            <Row k="विषय" v={s('matter')} />
            <Row k="टिप्पणी" v={s('note')} />
          </View>
        </Section>
        {[['applicants', 'आवेदक'], ['opponents', 'विपक्षी / आरोपी'], ['accused', 'अभियुक्त / व्यक्ति']].map(([k, label]) => people(k).length ? (
          <Section key={k} title={label}>
            {people(k).map((p, i) => <Text key={i} style={{ fontSize: 14, color: C.text }}>{i + 1}. {personLine(p)}</Text>)}
          </Section>
        ) : null)}
        <Section title={`📎 फ़ाइलें (${files.length})`}>
          {files.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {files.map((fl) => (
                <Pressable key={fl.id} onPress={() => fl.url && void WebBrowser.openBrowserAsync(fl.url)} onLongPress={() => { setFileSel(fl); setConfirm('file'); }} accessibilityLabel={fl.name ?? 'फ़ाइल'}>
                  <View style={{ width: 92, height: 92, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }}>
                    {fl.mime?.startsWith('image/') && fl.url ? <Image source={{ uri: fl.url }} style={{ width: '100%', height: '100%' }} /> : (
                      <View style={{ alignItems: 'center', gap: 2 }}><FileText size={28} color={C.navy} /><Text style={{ fontSize: 11, color: C.muted }}>PDF</Text></View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : <Text style={{ fontSize: 13.5, color: C.muted }}>कोई फ़ाइल नहीं — “बदलें” से जोड़ें।</Text>}
          {files.length ? <Text style={{ fontSize: 12, color: C.muted }}>दबाएँ = खोलें · दबाकर रखें = हटाएँ</Text> : null}
        </Section>
        <ErrorText text={err} />
        {st === 'cancelled'
          ? <OfficeButton label="फिर से चालू करें" kind="outline" busy={busy} onPress={() => void act(() => setCancelled(t.id, false))} />
          : <OfficeButton label="कागज़ रद्द करें" kind="outline" onPress={() => setConfirm('cancel')} />}
      </ScrollView>

      <BottomSheet visible={confirm === 'cancel'} onClose={() => setConfirm(null)} title="कागज़ रद्द करें?">
        <Text style={{ fontSize: 14.5, color: C.text, lineHeight: 22 }}>“{t.title}” रद्द हो जाएगा। गिनती में नहीं जुड़ेगा। बाद में “फिर से चालू करें” से वापस ला सकते हैं।</Text>
        <OfficeButton label="हाँ, रद्द करें" kind="danger" busy={busy} onPress={() => void act(() => setCancelled(t.id, true))} />
        <OfficeButton label="नहीं" kind="outline" onPress={() => setConfirm(null)} />
      </BottomSheet>
      <BottomSheet visible={confirm === 'file'} onClose={() => setConfirm(null)} title="फ़ाइल हटाएँ?">
        <Text style={{ fontSize: 14.5, color: C.text }}>{fileSel?.name ?? 'यह फ़ाइल'} इस कागज़ से हट जाएगी।</Text>
        <OfficeButton label="हाँ, हटाएँ" kind="danger" busy={busy} onPress={() => fileSel && void act(() => removeTaskFile(fileSel))} />
        <OfficeButton label="नहीं" kind="outline" onPress={() => setConfirm(null)} />
      </BottomSheet>
    </View>
  );
}

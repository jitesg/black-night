/**
 * ②③ कागज़ भेजें — step 1 कागज़ की जानकारी, step 2 अधिकारी चुनें → भेजें. `?id=` = edit a sent कागज़ (owner: office can change it).
 * One कागज़ = one अधिकारी (owner).
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Camera, CheckCircle2, FileText, ImagePlus, Scale, X } from 'lucide-react-native';
import { friendlyError, memberState } from '@/office/officeCore';
import { getTask, sendTask, updateTask, type PickedFile } from '@/office/taskApi';
import {
  COURT_SUBTYPES, KIND_LABEL, PETITION_SUBTYPES, addDaysIso, newTaskForm, pendingByOfficer, showDate, subtypeLabel, taskFormError,
  taskRowToForm, taskTitle, type TaskForm, type TaskKind,
} from '@/office/taskCore';
import { useMe } from '@/office/useMe';
import { invalidateOfficeData, useOfficeData } from '@/office/useOfficeData';
import { Chips, ErrorText, Field, OfficeButton, OfficeHeader, useOfficeColors } from '@/office/ui';
import { BottomSheet, DateField, NoteField, PersonCards, Section, Segmented, fillPersonDefaults } from '@/office/ui2';

export default function SendKagaz() {
  const C = useOfficeColors();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const { me } = useMe();
  const { tasks, officers, nameOf } = useOfficeData();
  const [form, setForm] = useState<TaskForm>(newTaskForm('petition'));
  const [step, setStep] = useState<1 | 2>(1);
  const [memberId, setMemberId] = useState('');
  const [oldMemberId, setOldMemberId] = useState<string | null>(null);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [pickSheet, setPickSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ failed: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const t = await getTask(id);
        if (t) {
          setForm(taskRowToForm(t));
          setMemberId(t.assignee?.member_id ?? '');
          setOldMemberId(t.assignee?.member_id ?? null);
        }
      } catch (e) { setErr(friendlyError(e)); } finally { setLoading(false); }
    })();
  }, [id]);

  // नये card: थाना / जनपद कार्यालय वाले थाने से (owner)
  const defaults = useMemo(() => ({ thana: me?.thana.name ?? '', district: me?.thana.district ?? '' }), [me]);
  useEffect(() => {
    if (!defaults.thana && !defaults.district) return;
    setForm((f) => ({ ...f, applicants: fillPersonDefaults(f.applicants, defaults) }));
  }, [defaults]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 2 && !done) { setStep(1); return true; }
      return false;
    });
    return () => sub.remove();
  }, [step, done]);

  const pending = useMemo(() => pendingByOfficer(tasks), [tasks]);
  const set = (patch: Partial<TaskForm>) => { setForm((f) => ({ ...f, ...patch })); setErr(''); };

  const switchKind = (k: TaskKind) => {
    if (k === form.kind) return;
    const fresh = newTaskForm(k);
    setForm({ ...fresh, applicants: fillPersonDefaults(fresh.applicants, defaults), received_on: form.received_on, note: form.note, matter: form.matter, due_on: k === 'petition' && form.received_on ? addDaysIso(form.received_on, 10) : '' });
  };

  const next = () => {
    const e = taskFormError(form);
    if (e) { setErr(e); return; }
    setErr(''); setStep(2);
  };

  const pickCamera = async () => {
    setPickSheet(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setErr('कैमरा की अनुमति नहीं मिली'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled && r.assets?.[0]) {
      const a = r.assets[0];
      setFiles((f) => [...f, { uri: a.uri, name: a.fileName ?? `photo_${Date.now()}.jpg`, mime: a.mimeType ?? 'image/jpeg' }]);
    }
  };
  const pickGallery = async () => {
    setPickSheet(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setErr('गैलरी की अनुमति नहीं मिली'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: true, selectionLimit: 10 });
    if (!r.canceled) setFiles((f) => [...f, ...r.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? `photo_${Date.now()}.jpg`, mime: a.mimeType ?? 'image/jpeg' }))]);
  };
  const pickDoc = async () => {
    setPickSheet(false);
    const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: ['application/pdf', 'image/*'] });
    if (!r.canceled) setFiles((f) => [...f, ...r.assets.map((a) => ({ uri: a.uri, name: a.name, mime: a.mimeType ?? 'application/pdf' }))]);
  };

  const submit = async () => {
    if (!me) return;
    if (!memberId) { setErr('अधिकारी चुनें'); return; }
    setBusy(true); setErr('');
    try {
      const r = editing && id
        ? await updateTask({ id, thanaId: me.thana.id, me: me.member.id, form, memberId, oldMemberId, files })
        : await sendTask({ thanaId: me.thana.id, me: me.member.id, form, memberId, files });
      invalidateOfficeData();
      setDone({ failed: r.failedFiles });
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.navy} size="large" /></View>;
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <OfficeHeader title={editing ? 'बदलाव सहेजे' : 'कागज़ भेजा गया'} />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, alignItems: 'stretch' }}>
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}>
            <CheckCircle2 size={64} color="#16A34A" />
            <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, textAlign: 'center' }}>{editing ? 'कागज़ बदल दिया गया' : 'कागज़ भेज दिया गया'}</Text>
            <Text style={{ fontSize: 14.5, color: C.muted, textAlign: 'center' }}>{taskTitle(form)}{'\n'}→ {nameOf(memberId)}</Text>
          </View>
          {done.failed ? <ErrorText text={`${done.failed} फ़ाइल नहीं जा सकी — कागज़ खोलकर फिर से जोड़ें`} /> : null}
          <Text style={{ fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 }}>
            अधिकारी के InvestSuite में अपने आप पहुँचने वाला हिस्सा अगले चरण में जुड़ेगा — तब तक स्थिति “भेजा” रहेगी।
          </Text>
          {!editing ? <OfficeButton label="एक और कागज़ भेजें" onPress={() => { const f0 = newTaskForm(form.kind); setForm({ ...f0, applicants: fillPersonDefaults(f0.applicants, defaults) }); setFiles([]); setMemberId(''); setStep(1); setDone(null); }} /> : null}
          <OfficeButton label="कागज़ सूची पर जाएँ" kind="outline" onPress={() => router.back()} />
        </ScrollView>
      </View>
    );
  }

  const subtypeChips = form.kind === 'court'
    ? COURT_SUBTYPES.map((s) => ({ value: s.value, label: s.label }))
    : PETITION_SUBTYPES.map((s) => ({ value: s, label: s }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <OfficeHeader title={editing ? 'कागज़ बदलें' : 'कागज़ भेजें'} subtitle={step === 1 ? '1/2 · कागज़ की जानकारी' : '2/2 · किसे भेजना है'} back />
      {/* step bar */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 10 }}>
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: C.navy }} />
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: step === 2 ? C.navy : C.border }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            <Segmented<TaskKind> value={form.kind} onChange={switchKind}
              options={[{ value: 'court', label: '⚖️ न्यायालय' }, { value: 'petition', label: '📄 प्रार्थना पत्र' }]} />
            <Section title="प्रकार">
              <Chips value={form.subtype} onChange={(v) => set({ subtype: v })} options={subtypeChips} />
            </Section>
            <Section title="तिथियाँ">
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <DateField label="प्राप्ति तिथि" value={form.received_on}
                  onChange={(d) => set({ received_on: d, ...(form.kind === 'petition' && !editing ? { due_on: addDaysIso(d, 10) } : {}) })} />
                <DateField label={form.kind === 'court' ? 'नियत तिथि' : 'अंतिम तिथि'} value={form.due_on} onChange={(d) => set({ due_on: d })}
                  hint={form.kind === 'petition' ? 'अपने आप +10 दिन' : undefined} error={!form.due_on && !!err} />
              </View>
            </Section>
            {form.kind === 'petition' ? (
              <>
                <Section title="आवेदक / आवेदिका">
                  <PersonCards people={form.applicants} onChange={(p) => set({ applicants: p })} addLabel="आवेदक जोड़ें" cardLabel="आवेदक" min={1} avedak defaults={defaults} />
                </Section>
                <Section title="विपक्षी / आरोपी (वैकल्पिक)">
                  <PersonCards people={form.opponents} onChange={(p) => set({ opponents: p })} addLabel="विपक्षी जोड़ें" cardLabel="विपक्षी" defaults={defaults} />
                </Section>
              </>
            ) : (
              <>
                <Section title="न्यायालय / वाद">
                  {form.subtype === 'Anya' ? <Field label="कागज़ का नाम" value={form.document_title} onChange={(v) => set({ document_title: v })} placeholder="जैसे: गवाह सम्मन तामील आख्या" /> : null}
                  <Field label="न्यायालय का नाम" value={form.court_name} onChange={(v) => set({ court_name: v })} placeholder="जैसे: CJM रायबरेली" />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}><Field label="वाद सं0" value={form.vad_sankhya} onChange={(v) => set({ vad_sankhya: v })} placeholder="जैसे: 412/2026" /></View>
                    <View style={{ flex: 1 }}><Field label="मु0अ0सं0" value={form.apradh_sankhya} onChange={(v) => set({ apradh_sankhya: v })} placeholder="जैसे: 88/2025" /></View>
                  </View>
                  <Field label="धारा" value={form.applicable_sections} onChange={(v) => set({ applicable_sections: v })} placeholder="जैसे: 115(2), 352 BNS" />
                </Section>
                <Section title="अभियुक्त / व्यक्ति (वैकल्पिक)">
                  <PersonCards people={form.accused} onChange={(p) => set({ accused: p })} addLabel="व्यक्ति जोड़ें" cardLabel="व्यक्ति" withRelation={false} defaults={defaults} />
                </Section>
              </>
            )}
            <Section title="विषय">
              <NoteField label="छोटा विवरण (वैकल्पिक)" value={form.matter} onChange={(v) => set({ matter: v })} placeholder="जैसे: ज़मीन पर कब्ज़े की शिकायत" />
            </Section>
            <Section title={`📎 कागज़ की फ़ोटो / PDF${files.length ? ` (${files.length} नई)` : ''}`}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {files.map((f, i) => (
                  <View key={`${f.uri}${i}`} style={{ width: 76, height: 76, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }}>
                    {f.mime.startsWith('image/') ? <Image source={{ uri: f.uri }} style={{ width: '100%', height: '100%' }} /> : <FileText size={28} color={C.navy} />}
                    <Pressable onPress={() => setFiles(files.filter((_, j) => j !== i))} hitSlop={6} accessibilityLabel="फ़ाइल हटाएँ"
                      style={{ position: 'absolute', right: 3, top: 3, backgroundColor: '#000A', borderRadius: 10, padding: 2 }}>
                      <X size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={() => setPickSheet(true)} accessibilityLabel="फ़ोटो या PDF जोड़ें">
                  <View style={{ width: 76, height: 76, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: C.navy, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <ImagePlus size={22} color={C.navy} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.navy }}>जोड़ें</Text>
                  </View>
                </Pressable>
              </View>
              {editing ? <Text style={{ fontSize: 12, color: C.muted }}>पहले से लगी फ़ाइलें कागज़ खोलकर देखें / हटाएँ।</Text> : null}
            </Section>
          </>
        ) : (
          <>
            <View style={{ backgroundColor: C.soft, borderRadius: 16, padding: 14, gap: 4 }}>
              <Text style={{ fontSize: 15.5, fontWeight: '700', color: C.text }}>{taskTitle(form)}</Text>
              <Text style={{ fontSize: 13, color: C.muted }}>
                {KIND_LABEL[form.kind]} · {subtypeLabel(form.kind, form.subtype)} · {form.kind === 'court' ? 'नियत' : 'अंतिम'} {showDate(form.due_on)}{files.length ? ` · 📎 ${files.length}` : ''}
              </Text>
            </View>
            <Section title="अधिकारी चुनें (लंबित कागज़ साथ में)">
              {officers.length ? officers.map((m) => {
                const on = memberId === m.id;
                const joined = memberState(m, m.code) === 'joined';
                return (
                  <Pressable key={m.id} onPress={() => { setMemberId(m.id); setErr(''); }} accessibilityLabel={nameOf(m.id)} accessibilityState={{ selected: on }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: on ? 2 : 1, borderColor: on ? C.navy : C.border, borderRadius: 14, padding: 12, backgroundColor: on ? C.soft : C.card }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 7 : 2, borderColor: on ? C.navy : C.muted }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{nameOf(m.id)}</Text>
                        <Text style={{ fontSize: 12.5, color: joined ? C.muted : (C.dark ? '#FCD34D' : '#B45309') }}>
                          {joined ? `जुड़ा ✓ · लंबित ${pending[m.id] ?? 0}` : `⚠️ अभी app से नहीं जुड़ा · लंबित ${pending[m.id] ?? 0}`}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }) : (
                <Text style={{ fontSize: 14, color: C.muted }}>अभी कोई अधिकारी नहीं — पहले “सदस्य” में अधिकारी जोड़ें।</Text>
              )}
            </Section>
            <Section title="कार्यालय की टिप्पणी">
              <NoteField label="अधिकारी के लिए (वैकल्पिक)" value={form.note} onChange={(v) => set({ note: v })} placeholder="जैसे: SP कार्यालय से आया, जल्दी आख्या दें" />
            </Section>
          </>
        )}
        <ErrorText text={err} />
      </ScrollView>
      {/* sticky actions */}
      <View style={{ flexDirection: 'row', gap: 10, padding: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card }}>
        {step === 2 ? <View style={{ flex: 1 }}><OfficeButton label="← पीछे" kind="outline" onPress={() => setStep(1)} /></View> : null}
        <View style={{ flex: 2 }}>
          {step === 1
            ? <OfficeButton label="आगे — अधिकारी चुनें →" onPress={next} />
            : <OfficeButton label={editing ? '✓ बदलाव सहेजें' : '✓ भेजें'} kind="green" busy={busy} onPress={() => void submit()} disabled={!memberId} />}
        </View>
      </View>

      <BottomSheet visible={pickSheet} onClose={() => setPickSheet(false)} title="कागज़ जोड़ें">
        {[
          { icon: <Camera size={20} color="#15803D" />, bg: '#DCFCE7', title: 'कैमरा से फ़ोटो', sub: 'छोटी करके भेजी जाएगी', on: pickCamera },
          { icon: <ImagePlus size={20} color="#1D4ED8" />, bg: '#DBEAFE', title: 'गैलरी से फ़ोटो', sub: 'एक साथ कई चुन सकते हैं', on: pickGallery },
          { icon: <Scale size={20} color="#B91C1C" />, bg: '#FEE2E2', title: 'PDF / फ़ाइल', sub: 'WhatsApp / फ़ोन में रखी PDF', on: pickDoc },
        ].map((o) => (
          <Pressable key={o.title} onPress={() => void o.on()} accessibilityLabel={o.title}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: o.bg, alignItems: 'center', justifyContent: 'center' }}>{o.icon}</View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{o.title}</Text>
                <Text style={{ fontSize: 12.5, color: C.muted }}>{o.sub}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

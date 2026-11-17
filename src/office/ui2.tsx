/**
 * InvestSuite कार्यालय — more UI pieces for the कागज़ screens (date field, person cards, status pill, segmented
 * control, bottom sheet, section card). Plain style objects; Modal content pads by NAV_BAR_INSET (CLAUDE.md).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Plus, X } from 'lucide-react-native';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { NAV_BAR_INSET } from '@/lib/navBarInset';
import { showDate, STATUS_LABEL, emptyPerson, type TaskPerson, type TaskState } from './taskCore';
import { useOfficeColors, type OfficeColors } from './ui';
import {
  ADOPT_SUBS, ID_TYPES, RELATION_CHIPS, TRANS_SUBS, chipOf, composeAddress, fatherLabel, genderOfRelation, isFeminine, relationWord,
  type RelationChip,
} from '@/lib/personCard';

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const C = useOfficeColors();
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted, letterSpacing: 0.3 }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const C = useOfficeColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.dark ? '#0B1220' : '#E2E8F0', borderRadius: 12, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} style={{ flex: 1 }} onPress={() => onChange(o.value)} accessibilityLabel={o.label} accessibilityState={{ selected: on }}>
            <View style={{ backgroundColor: on ? C.navy : 'transparent', borderRadius: 10, paddingVertical: 9, alignItems: 'center' }}>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: on ? '700' : '500', color: on ? C.onNavy : C.text }}>{o.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function stateColors(C: OfficeColors, s: TaskState): { bg: string; fg: string } {
  const d = C.dark;
  switch (s) {
    case 'done': return { bg: C.greenBg, fg: C.green };
    case 'seen': return { bg: C.amberBg, fg: C.amber };
    case 'received': return { bg: d ? '#1E3A5F' : '#DBEAFE', fg: d ? '#93C5FD' : '#1D4ED8' };
    case 'removed': case 'returned': case 'not_done': return { bg: d ? '#3B1F22' : '#FEE2E2', fg: d ? '#FCA5A5' : '#B91C1C' };
    case 'cancelled': return { bg: d ? '#1E293B' : '#F1F5F9', fg: C.muted };
    default: return { bg: d ? '#334155' : '#E2E8F0', fg: d ? '#E2E8F0' : '#334155' };
  }
}

export function StatusPill({ state }: { state: TaskState }) {
  const C = useOfficeColors();
  const c = stateColors(C, state);
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: c.fg }}>{STATUS_LABEL[state]}</Text>
    </View>
  );
}

export function DateField({ label, value, onChange, hint, error }: { label: string; value: string; onChange: (iso: string) => void; hint?: string; error?: boolean }) {
  const C = useOfficeColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel={label}>
        <View style={{
          borderWidth: error ? 1.5 : 1, borderColor: error ? C.red : C.border, borderRadius: 12, backgroundColor: C.input,
          paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Text style={{ fontSize: 15.5, color: value ? C.text : C.muted }}>{value ? showDate(value) : 'तारीख चुनें'}</Text>
          <CalendarDays size={18} color={C.muted} />
        </View>
      </Pressable>
      {hint ? <Text style={{ fontSize: 11.5, color: C.muted }}>{hint}</Text> : null}
      <DatePickerModal visible={open} value={value} label={label} accentColor="#1E3A5F"
        onConfirm={(d) => { onChange(d); setOpen(false); }} onClose={() => setOpen(false)} />
    </View>
  );
}

function SmallInput({ value, onChange, placeholder, keyboardType, C, flex }: {
  value: string; onChange: (v: string) => void; placeholder: string; keyboardType?: 'phone-pad' | 'number-pad' | 'email-address'; C: OfficeColors; flex?: boolean;
}) {
  // small label above the box once it is filled (the placeholder is gone then)
  return (
    <View style={{ gap: 2, ...(flex ? { flex: 1 } : {}) }}>
      {value ? <Text style={{ fontSize: 11.5, color: C.muted, marginLeft: 2 }}>{placeholder}</Text> : null}
      <TextInput
      value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted} keyboardType={keyboardType}
      style={{ borderWidth: 1, borderColor: C.border, borderRadius: 11, backgroundColor: C.input, color: C.text, paddingHorizontal: 11, paddingVertical: 9, fontSize: 15 }}
      />
    </View>
  );
}

/** New person card (owner): पता in parts, थाना / जनपद from the कार्यालय's थाना. */
export function newOfficePerson(d: { thana?: string; district?: string } = {}): TaskPerson {
  const p: TaskPerson = { ...emptyPerson(), addrMode: 'parts', house: '', village: '', villageKind: 'ग्राम', thana: d.thana ?? '', district: d.district ?? '' };
  return { ...p, address: composeAddress(p) };
}

/** Cards that still hold nothing typed get the थाना / जनपद (form opened before the थाना was known). */
export function fillPersonDefaults(list: TaskPerson[], d: { thana?: string; district?: string }): TaskPerson[] {
  return list.map((p) => {
    if (p.addrMode || p.address.trim()) return p;
    const fresh = newOfficePerson(d);
    return { ...p, addrMode: fresh.addrMode, house: '', village: '', villageKind: 'ग्राम', thana: fresh.thana, district: fresh.district, address: fresh.address };
  });
}

function OChip({ C, label, on, onPress, small }: { C: OfficeColors; label: string; on: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={small ? undefined : { flexGrow: 1 }}>
      <View style={{
        borderWidth: 1, borderColor: on ? C.navy : C.border, backgroundColor: on ? C.navy : C.card, alignItems: 'center',
        borderRadius: small ? 999 : 10, paddingHorizontal: small ? 10 : 11, paddingVertical: small ? 3 : 7,
      }}>
        <Text style={{ fontSize: small ? 12 : 13.5, color: on ? C.onNavy : C.text, fontWeight: on ? '700' : '400' }}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** सम्बन्ध: पुत्र / पुत्री / पत्नी / ट्रांसजेंडर (संतान / अभिभावक-गुरु) / दत्तक (पुत्र / पुत्री) — same as InvestSuite. */
function RelationRow({ C, value, onChange }: { C: OfficeColors; value: string; onChange: (r: string) => void }) {
  const { chip, sub } = chipOf(value);
  const [open, setOpen] = useState<RelationChip | ''>(chip);
  useEffect(() => { if (chip) setOpen(chip); }, [chip]);
  const shown = chip || open;
  const subs = shown === 'ट्रांसजेंडर' ? TRANS_SUBS : shown === 'दत्तक' ? ADOPT_SUBS : null;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {RELATION_CHIPS.map((r) => (
          <OChip key={r} C={C} label={r} on={shown === r} onPress={() => {
            setOpen(r);
            onChange(r === 'ट्रांसजेंडर' || r === 'दत्तक' ? relationWord(r, chip === r ? sub : '') : r);
          }} />
        ))}
      </View>
      {subs ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderStyle: 'dashed',
          borderColor: C.dark ? '#3B5B8A' : '#93C5FD', backgroundColor: C.dark ? '#16243A' : '#EFF6FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 }}>
          <Text style={{ fontSize: 11.5, color: C.navy }}>{shown === 'दत्तक' ? 'दत्तक:' : 'किसके नाम से:'}</Text>
          {subs.map((x) => (
            <OChip key={x} C={C} small label={x === 'गुरु' ? 'अभिभावक / गुरु' : x} on={chip === shown && sub === x}
              onPress={() => onChange(relationWord(shown as RelationChip, x))} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function OfficePersonCard({ C, p, i, cardLabel, set, onRemove, withRelation, avedak }: {
  C: OfficeColors; p: TaskPerson; i: number; cardLabel: string; set: (patch: Partial<TaskPerson>) => void; onRemove?: () => void;
  withRelation: boolean; avedak: boolean;
}) {
  const parts = p.addrMode === 'parts' || (!p.addrMode && !p.address.trim());
  const [more, setMore] = useState(() => !!((p.altMobile ?? '') || (p.idNumber ?? '') || (p.email ?? '') || (p.remarks ?? '')));
  /** a पता part changed → full address rebuilt */
  const setAddr = (patch: Partial<TaskPerson>) => {
    const next = { ...p, ...patch, addrMode: 'parts' as const };
    set({ ...patch, addrMode: 'parts', address: composeAddress(next) });
  };
  const fem = isFeminine({ gender: p.gender, relationType: p.relation });
  const badge = avedak && p.name.trim() ? (fem ? 'आवेदिका' : 'आवेदक') : '';
  const gender = p.gender || genderOfRelation(p.relation);
  return (
    <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9,
        backgroundColor: C.dark ? '#162033' : '#F8FAFC', borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.onNavy }}>{i + 1}</Text>
        </View>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.text }} numberOfLines={1}>
          {p.name.trim() ? `${p.name.trim()}${gender ? ` (${gender})` : ''}` : `${cardLabel} ${i + 1}`}
        </Text>
        {badge ? (
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>{badge}</Text>
          </View>
        ) : null}
        {onRemove ? (
          <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={`${cardLabel} ${i + 1} हटाएँ`}>
            <X size={18} color={C.muted} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        <SmallInput C={C} value={p.name} onChange={(v) => set({ name: v })} placeholder="नाम" />
        {withRelation ? (
          <RelationRow C={C} value={p.relation} onChange={(r) => {
            const g = genderOfRelation(r);
            set(g ? { relation: r, gender: g } : { relation: r });
          }} />
        ) : null}
        <SmallInput C={C} value={p.father} onChange={(v) => set({ father: v })} placeholder={withRelation ? fatherLabel(p.relation) : 'पिता / पति का नाम'} />
        {parts ? (
          <View style={{ gap: 8 }}>
            <SmallInput C={C} value={p.house ?? ''} onChange={(v) => setAddr({ house: v })} placeholder="मकान नं0 / मोहल्ला (वैकल्पिक)" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ flex: 1, fontSize: 12, color: C.muted }}>{p.villageKind === 'कस्बा' ? 'कस्बा' : 'ग्राम / मजरा'}</Text>
              {['ग्राम', 'कस्बा'].map((k) => (
                <OChip key={k} C={C} small label={k} on={(p.villageKind === 'कस्बा' ? 'कस्बा' : 'ग्राम') === k} onPress={() => setAddr({ villageKind: k })} />
              ))}
            </View>
            <SmallInput C={C} value={p.village ?? ''} onChange={(v) => setAddr({ village: v })} placeholder={p.villageKind === 'कस्बा' ? 'कस्बे का नाम' : 'गाँव / मजरे का नाम'} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SmallInput C={C} flex value={p.thana ?? ''} onChange={(v) => setAddr({ thana: v })} placeholder="थाना" />
              <SmallInput C={C} flex value={p.district ?? ''} onChange={(v) => setAddr({ district: v })} placeholder="जनपद" />
            </View>
            {p.address.trim() ? (
              <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.dark ? '#3B5B8A' : '#93C5FD', backgroundColor: C.dark ? '#16243A' : '#EFF6FF',
                borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
                <Text style={{ fontSize: 13, color: C.navy }}>📍 {p.address}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <SmallInput C={C} value={p.address} onChange={(v) => set({ address: v })} placeholder="पता" />
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ width: 90 }}>
            <SmallInput C={C} value={p.age ?? ''} onChange={(v) => set({ age: v.replace(/\D/g, '').slice(0, 3) })} placeholder="उम्र" keyboardType="number-pad" />
          </View>
          <SmallInput C={C} flex value={p.mobile} onChange={(v) => set({ mobile: v })} placeholder="मोबाइल (वैकल्पिक)" keyboardType="phone-pad" />
        </View>
        <Pressable onPress={() => setMore((v) => !v)} accessibilityLabel="और जानकारी">
          <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: more ? C.navy : C.border, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: more ? C.navy : C.muted }}>{more ? '− और जानकारी छिपाएँ' : '＋ और जानकारी'}</Text>
          </View>
        </Pressable>
        {more ? (
          <View style={{ gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10 }}>
            <SmallInput C={C} value={p.altMobile ?? ''} onChange={(v) => set({ altMobile: v.replace(/\D/g, '').slice(0, 10) })} placeholder="दूसरा मोबाइल" keyboardType="phone-pad" />
            <Text style={{ fontSize: 12, color: C.muted }}>पहचान पत्र</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {ID_TYPES.map((t) => (
                <OChip key={t} C={C} small label={t} on={p.idType === t} onPress={() => set({ idType: p.idType === t ? '' : t })} />
              ))}
            </View>
            <SmallInput C={C} value={p.idNumber ?? ''} onChange={(v) => set({ idNumber: v })} placeholder="पहचान पत्र नंबर" />
            <SmallInput C={C} value={p.email ?? ''} onChange={(v) => set({ email: v.trim() })} placeholder="ई-मेल" keyboardType="email-address" />
            <SmallInput C={C} value={p.remarks ?? ''} onChange={(v) => set({ remarks: v })} placeholder="टिप्पणी" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Person cards (owner: the InvestSuite group card — सम्बन्ध, पता के खाने, और जानकारी). */
export function PersonCards({ people, onChange, addLabel, cardLabel, min = 0, withRelation = true, avedak = false, defaults }: {
  people: TaskPerson[]; onChange: (p: TaskPerson[]) => void; addLabel: string; cardLabel: string; min?: number; withRelation?: boolean;
  /** आवेदक / आवेदिका badge */ avedak?: boolean;
  /** थाना / जनपद for new cards */ defaults?: { thana?: string; district?: string };
}) {
  const C = useOfficeColors();
  const set = (i: number, patch: Partial<TaskPerson>) => onChange(people.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <View style={{ gap: 10 }}>
      {people.map((p, i) => (
        <OfficePersonCard key={i} C={C} p={p} i={i} cardLabel={cardLabel} set={(patch) => set(i, patch)} withRelation={withRelation} avedak={avedak}
          onRemove={people.length > min ? () => onChange(people.filter((_, j) => j !== i)) : undefined} />
      ))}
      <Pressable onPress={() => onChange([...people, newOfficePerson(defaults)])} accessibilityLabel={addLabel}>
        <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.navy, borderRadius: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Plus size={16} color={C.navy} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.navy }}>{addLabel}</Text>
        </View>
      </Pressable>
    </View>
  );
}

/**
 * Keyboard height while a sheet is open (owner: the सदस्य जोड़ें sheet hid behind the keyboard). A Modal is its own
 * window — the root KeyboardInsetView does not move it — so the sheet pads itself (same as SentenceFieldInput, which
 * works on the phone). Grow-only while open: the suggestion strip coming and going must not make the sheet jump.
 */
export function useSheetKeyboard(visible: boolean): number {
  const [kb, setKb] = useState(0);
  const kbRef = useRef(0);
  useEffect(() => {
    if (!visible) return;
    const set = (h: number) => { kbRef.current = h; setKb(h); };
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = Math.round(e.endCoordinates?.height ?? 0);
      if (h > kbRef.current) set(h);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => set(0));
    return () => { show.remove(); hide.remove(); set(0); };
  }, [visible]);
  return kb;
}

/**
 * Bottom sheet that stays above the keyboard: the sheet sits on top of it, its height shrinks so the title stays on
 * screen, the box being typed in is scrolled into view, and the footer (main button) stays visible above the keyboard.
 */
export function BottomSheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const C = useOfficeColors();
  const kb = useSheetKeyboard(visible);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const innerRef = useRef<View>(null);

  // bring the focused box into view once the keyboard is up
  useEffect(() => {
    if (!kb) return;
    const t = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput?.() as unknown as { measureLayout?: (rel: unknown, ok: (x: number, y: number) => void, fail?: () => void) => void } | null;
      if (!input?.measureLayout || !innerRef.current) return;
      try {
        input.measureLayout(innerRef.current, (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 60), animated: true }), () => {});
      } catch { /* the box is not inside this sheet */ }
    }, 80);
    return () => clearTimeout(t);
  }, [kb]);

  const bottomPad = Math.max(NAV_BAR_INSET, kb);
  const maxH = Math.max(260, height - kb - insets.top - 24);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={onClose} />
      <View style={{ backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: kb ? maxH : '85%', paddingBottom: bottomPad }}>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginTop: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: C.text }}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="बंद करें"><X size={22} color={C.muted} /></Pressable>
        </View>
        <ScrollView ref={scrollRef} style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View ref={innerRef} collapsable={false} style={{ gap: 14 }}>{children}</View>
        </ScrollView>
        {footer ? <View style={{ padding: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

/** Text area for विषय / टिप्पणी. */
export function NoteField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const C = useOfficeColors();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.muted }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.muted} multiline
        style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: C.input, color: C.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 70, textAlignVertical: 'top' }} />
    </View>
  );
}

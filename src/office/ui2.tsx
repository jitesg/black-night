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
  value: string; onChange: (v: string) => void; placeholder: string; keyboardType?: 'phone-pad'; C: OfficeColors; flex?: boolean;
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

const RELATIONS = ['पुत्र', 'पुत्री', 'पत्नी'];

/** Person cards (owner: like InvestSuite — सम्बन्ध chips decide "पिता / पति का नाम"). */
export function PersonCards({ people, onChange, addLabel, cardLabel, min = 0, withRelation = true }: {
  people: TaskPerson[]; onChange: (p: TaskPerson[]) => void; addLabel: string; cardLabel: string; min?: number; withRelation?: boolean;
}) {
  const C = useOfficeColors();
  const set = (i: number, patch: Partial<TaskPerson>) => onChange(people.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <View style={{ gap: 10 }}>
      {people.map((p, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, gap: 8, backgroundColor: C.dark ? '#162033' : '#FAFBFD' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{cardLabel} {i + 1}</Text>
            {people.length > min ? (
              <Pressable onPress={() => onChange(people.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel={`${cardLabel} ${i + 1} हटाएँ`}>
                <X size={18} color={C.muted} />
              </Pressable>
            ) : null}
          </View>
          <SmallInput C={C} value={p.name} onChange={(v) => set(i, { name: v })} placeholder="नाम" />
          {withRelation ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {RELATIONS.map((r) => {
                const on = p.relation === r;
                return (
                  <Pressable key={r} onPress={() => set(i, { relation: on ? '' : r })} accessibilityLabel={r}>
                    <View style={{ borderWidth: 1, borderColor: on ? C.navy : C.border, backgroundColor: on ? C.navy : C.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 13.5, color: on ? C.onNavy : C.text, fontWeight: on ? '700' : '400' }}>{r}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <SmallInput C={C} value={p.father} onChange={(v) => set(i, { father: v })} placeholder={p.relation === 'पत्नी' ? 'पति का नाम' : p.relation ? 'पिता का नाम' : 'पिता / पति का नाम'} />
          <SmallInput C={C} value={p.address} onChange={(v) => set(i, { address: v })} placeholder="पता / ग्राम" />
          <SmallInput C={C} value={p.mobile} onChange={(v) => set(i, { mobile: v })} placeholder="मोबाइल (वैकल्पिक)" keyboardType="phone-pad" />
        </View>
      ))}
      <Pressable onPress={() => onChange([...people, emptyPerson()])} accessibilityLabel={addLabel}>
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

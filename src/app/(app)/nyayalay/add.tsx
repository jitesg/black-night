import { useEffect, useRef, useState } from 'react';
import {
  BackHandler, KeyboardAvoidingView, Pressable,
  ScrollView, Text, View,
} from 'react-native';
import { DocumentEditor } from '@/components/common/DocumentEditor';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, CheckSquare, ChevronDown, Plus, Square, Trash2, X } from 'lucide-react-native';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  addDaysNyl,
  createNyayalayDocument,
  getNyayalayDocWithDetails,
  todayStr,
  updateNyayalayDocument,
  DOC_TYPES,
  DOC_TYPE_LABELS,
  WRIT_TYPES,
  type DocType,
  type NyayalayPerson,
  type SubType,
  type WritType,
} from '@/lib/db/nyayalayRepo';
import { AppHeader, HeaderIconBtn } from '@/components/ui/ds/AppHeader';
import { Input } from '@/components/ui/input';

// ── Shared form primitives ─────────────────────────────────────────────────

function Section({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mt-6 mb-3">
      {title}
    </Text>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-xs text-muted-foreground font-medium mb-1.5">{label}</Text>
      {children}
      {error ? <Text className="text-xs text-destructive mt-1">{error}</Text> : null}
    </View>
  );
}

// Local Input shim removed — all fields use universal <Input> from @/components/ui/input

/** Compact date picker — tappable field that opens the shared DatePickerModal. */
function DatePickerField({
  label, value, onChange, error, hint,
}: { label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  const today = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

  return (
    <Field label={label} error={error}>
      <Pressable
        onPress={() => setOpen(true)}
        className="border border-border rounded-xl px-3 py-3 flex-row items-center justify-between bg-card active:opacity-70"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className="text-sm text-foreground flex-1">
          {value || today}
        </Text>
        <CalendarDays size={16} color="#9CA3AF" />
      </Pressable>
      {hint ? <Text className="text-xs text-muted-foreground mt-1">{hint}</Text> : null}
      <DatePickerModal
        visible={open}
        value={value || today}
        label={label}
        onConfirm={(v) => { onChange(v); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </Field>
  );
}

// ── Dropdown picker (reusable) ─────────────────────────────────────────────

function Picker<T extends string>({
  label, value, options, optionLabels, onChange, error, placeholder,
}: {
  label: string; value: T | null; options: T[];
  optionLabels?: Partial<Record<T, string>>;
  onChange: (v: T) => void; error?: string; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Field label={label} error={error}>
      <Pressable
        onPress={() => setOpen(true)}
        className="border border-border rounded-xl px-3 py-3 flex-row items-center justify-between bg-card active:opacity-70"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className="text-sm flex-1"
          style={{ color: value ? '#111827' : '#9CA3AF' }}>
          {value ? (optionLabels?.[value] ?? value) : (placeholder ?? 'Select…')}
        </Text>
        <ChevronDown size={16} color="#9CA3AF" />
      </Pressable>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label}</AlertDialogTitle>
          </AlertDialogHeader>
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => { onChange(opt); setOpen(false); }}
              className="py-3 px-4 border-b border-border active:bg-muted flex-row items-center justify-between"
            >
              <Text className="text-sm text-foreground">{optionLabels?.[opt] ?? opt}</Text>
              {value === opt && <Text className="text-primary text-sm">✓</Text>}
            </Pressable>
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setOpen(false)}><Text>Cancel</Text></AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Field>
  );
}

// ── Person form (accused / appellant) ─────────────────────────────────────

interface PersonForm {
  _key: string;
  id?: string;
  name: string;
  father_name: string;
  mobile: string;
  address: string;
  remarks: string;
}

function emptyPerson(type: 'accused' | 'appellant' = 'accused'): PersonForm {
  return { _key: Math.random().toString(36).slice(2), name: '', father_name: '', mobile: '', address: '', remarks: '' };
}

function PersonCard({
  person, index, label, onUpdate, onRemove, canRemove, nameError,
}: {
  person: PersonForm; index: number; label: string;
  onUpdate: (field: keyof PersonForm, val: string) => void;
  onRemove: () => void; canRemove: boolean; nameError?: string;
}) {
  return (
    <View className="border border-border rounded-2xl p-4 mb-3" style={{ borderCurve: 'continuous' }}>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-semibold text-foreground">{label} {index + 1}</Text>
        {canRemove && (
          <Pressable onPress={onRemove} className="active:opacity-70">
            <Trash2 size={16} color="#DC2626" />
          </Pressable>
        )}
      </View>
      <Field label="Name *" error={nameError}>
        <Input value={person.name} onChangeText={(v) => onUpdate('name', v)} placeholder="Full name" />
      </Field>
      <Field label="Father Name">
        <Input value={person.father_name} onChangeText={(v) => onUpdate('father_name', v)} placeholder="Father name" />
      </Field>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Mobile">
            <Input type="mobile" value={person.mobile} onChangeText={(v) => onUpdate('mobile', v)} placeholder="Mobile" />
          </Field>
        </View>
      </View>
      <Field label="Address">
        <Input type="multiline" value={person.address} onChangeText={(v) => onUpdate('address', v)} numberOfLines={2} placeholder="Address" />
      </Field>
      <Field label="Remarks">
        <Input value={person.remarks} onChangeText={(v) => onUpdate('remarks', v)} placeholder="Remarks" />
      </Field>
    </View>
  );
}

// ── FIR Details (shared) ──────────────────────────────────────────────────

interface FirForm { number: string; year: string; ps: string; }
/** Default year = current year so user never sees a blank year field. */
function emptyFir(): FirForm { return { number: '', year: String(new Date().getFullYear()), ps: '' }; }

function FirSection({
  fir, onChange, errors, optional,
}: { fir: FirForm; onChange: (f: FirForm) => void; errors?: Record<string, string>; optional?: boolean }) {
  return (
    <>
      <Section title={`FIR Details${optional ? ' (Optional)' : ''}`} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label={optional ? 'FIR Number' : 'FIR Number *'} error={errors?.fir_number}>
            <Input type="number" value={fir.number} onChangeText={(v) => onChange({ ...fir, number: v })} placeholder="FIR No." />
          </Field>
        </View>
        <View style={{ width: 88 }}>
          <Field label="Year *" error={errors?.fir_year}>
            <Input type="number" value={fir.year} onChangeText={(v) => onChange({ ...fir, year: v })} placeholder={String(new Date().getFullYear())} />
          </Field>
        </View>
      </View>
      <Field label="Police Station *" error={errors?.fir_ps}>
        <Input value={fir.ps} onChangeText={(v) => onChange({ ...fir, ps: v })} placeholder="Police station" />
      </Field>
    </>
  );
}

// ── Checklist (High Court Bail) ────────────────────────────────────────────

interface ChecklistItem { _key: string; id?: string; label: string; is_optional: boolean; is_checked: boolean; }
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { _key: 'bail-report',   label: 'Bail Report',   is_optional: false, is_checked: false },
  { _key: 'vadi-suchna',  label: 'Vadi Suchna',   is_optional: true,  is_checked: false },
  { _key: 'dcrb-report',  label: 'DCRB Report',   is_optional: true,  is_checked: false },
  { _key: 'status-report', label: 'Status Report', is_optional: false, is_checked: false },
];

const MODULE_COLOR_FORM = '#1D4ED8';

function ChecklistSection({
  items, onChange,
}: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const [newLabel, setNewLabel] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const toggle = (_key: string) => {
    onChange(items.map((i) => i._key === _key ? { ...i, is_checked: !i.is_checked } : i));
  };

  const addItem = () => {
    if (!newLabel.trim()) return;
    onChange([...items, { _key: Math.random().toString(36).slice(2), label: newLabel.trim(), is_optional: false, is_checked: false }]);
    setNewLabel('');
    setAddOpen(false);
  };

  const done = items.filter((i) => i.is_checked).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <Section title="Checklist" />

      {/* Progress bar */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs text-muted-foreground">{done}/{total} · {pct}%</Text>
      </View>
      <View className="h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
        <View className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10B981' : MODULE_COLOR_FORM }} />
      </View>

      {items.map((item) => (
        <Pressable
          key={item._key}
          onPress={() => toggle(item._key)}
          className="flex-row items-center gap-3 py-2.5 border-b border-border active:opacity-70"
        >
          {item.is_checked
            ? <CheckSquare size={18} color={MODULE_COLOR_FORM} />
            : <Square size={18} color="#9CA3AF" />}
          <Text
            className="flex-1 text-sm"
            style={{
              color: item.is_checked ? '#6B7280' : '#111827',
              textDecorationLine: item.is_checked ? 'line-through' : 'none',
            }}
          >
            {item.label}
          </Text>
          {item.is_optional && (
            <Text className="text-xs text-muted-foreground">Optional</Text>
          )}
          {/* allow removing only custom items (not in DEFAULT_CHECKLIST) */}
          {!DEFAULT_CHECKLIST.find((d) => d._key === item._key) && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onChange(items.filter((i) => i._key !== item._key));
              }}
              className="active:opacity-70 p-1"
            >
              <Trash2 size={14} color="#DC2626" />
            </Pressable>
          )}
        </Pressable>
      ))}

      <Pressable
        onPress={() => setAddOpen(true)}
        className="border border-dashed border-border rounded-xl p-3 items-center flex-row justify-center gap-2 mt-3 active:opacity-70"
      >
        <Plus size={14} color="#6B7280" />
        <Text className="text-sm text-muted-foreground">Add Checklist Item</Text>
      </Pressable>

      <AlertDialog open={addOpen} onOpenChange={setAddOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Checklist Item</AlertDialogTitle>
          </AlertDialogHeader>
          <View className="px-4 pb-2">
            <Input value={newLabel} onChangeText={setNewLabel} placeholder="Item label…" autoFocus />
          </View>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => { setAddOpen(false); setNewLabel(''); }}><Text>Cancel</Text></AlertDialogCancel>
            <Pressable
              onPress={addItem}
              className="bg-primary rounded-xl px-4 py-2 ml-2 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-primary-foreground">Add</Text>
            </Pressable>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────

export default function AddNyayalayScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;

  // ── Core state
  const [docType, setDocType] = useState<DocType | null>(null);
  const [subType, setSubType] = useState<SubType | null>(null);
  const [writType, setWritType] = useState<WritType | null>(null);

  // NBW / Summons
  const [courtName, setCourtName] = useState('');
  const [vadSankhya, setVadSankhya] = useState('');
  const [apradhSankhya, setApradhSankhya] = useState('');
  const [applicableSections, setApplicableSections] = useState('');
  const [accused, setAccused] = useState<PersonForm[]>([emptyPerson('accused')]);

  // Appellants (Bail, HC Writ, Anya)
  const [appellants, setAppellants] = useState<PersonForm[]>([emptyPerson('appellant')]);

  // FIR
  const [fir, setFir] = useState<FirForm>(emptyFir());

  // Matter (HC Writ)
  const [matter, setMatter] = useState('');

  // Document title (Anya)
  const [documentTitle, setDocumentTitle] = useState('');

  // Checklist (HC Bail)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);

  // Deadline — default to today for new docs
  const [deadlineDate, setDeadlineDate] = useState(todayStr());

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [backDialog, setBackDialog] = useState(false);
  const savedRef = useRef(false);

  // ── Dirty-tracking helpers ─────────────────────────────────────────────
  // isDirty is set ONLY in direct user-interaction handlers, never via a
  // reactive useEffect watching form state. This eliminates the race where
  // async data loads (edit mode) or workspace-default loads (add mode)
  // fire the effect after the initialising phase and falsely mark the form
  // as dirty before the user has touched anything.
  const markDirty = () => { if (!savedRef.current) setIsDirty(true); };

  // ── Doc-type / sub-type change handlers ───────────────────────────────
  const handleDocTypeChange = (t: DocType) => {
    setDocType(t);
    setSubType(null);
    setWritType(null);
    markDirty();
  };
  const handleSubTypeChange = (t: SubType) => {
    setSubType(t);
    // Only auto-set deadline if it is still the empty default
    if (!deadlineDate || deadlineDate === todayStr()) {
      setDeadlineDate(addDaysNyl(todayStr(), 15));
    }
    markDirty();
  };

  // Hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isDirty) { setBackDialog(true); return true; }
      return false;
    });
    return () => sub.remove();
  }, [isDirty]);

  // Load for edit — pure data hydration; no mountedRef needed because
  // isDirty is event-driven and never set from a reactive useEffect.
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const doc = await getNyayalayDocWithDetails(editId);
      if (!doc) return;
      setDocType(doc.doc_type);
      setSubType(doc.sub_type);
      setWritType(doc.writ_type);
      // Null-safe assignments — prevent .trim() crash during validation
      setCourtName(doc.court_name || '');
      setVadSankhya(doc.vad_sankhya || '');
      setApradhSankhya(doc.apradh_sankhya || '');
      setApplicableSections(doc.applicable_sections || '');
      setFir({ number: doc.fir_number || '', year: doc.fir_year || String(new Date().getFullYear()), ps: doc.fir_ps || '' });
      setMatter(doc.matter || '');
      setDocumentTitle(doc.document_title || '');
      setDeadlineDate(doc.deadline_date || todayStr());

      const acc = doc.persons.filter((p) => p.person_type === 'accused');
      const app = doc.persons.filter((p) => p.person_type === 'appellant');
      if (acc.length) setAccused(acc.map((p) => ({ _key: p.id, id: p.id, name: p.name, father_name: p.father_name, mobile: p.mobile, address: p.address, remarks: p.remarks })));
      if (app.length) setAppellants(app.map((p) => ({ _key: p.id, id: p.id, name: p.name, father_name: p.father_name, mobile: p.mobile, address: p.address, remarks: p.remarks })));

      if (doc.checklist.length) {
        setChecklist(doc.checklist.map((c) => ({ _key: c.id, id: c.id, label: c.label, is_optional: c.is_optional, is_checked: c.is_done ?? false })));
      }
    })();
  }, [editId]);

  const handleBack = () => {
    if (isDirty) { setBackDialog(true); } else { router.back(); }
  };

  // ── Validation ────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!docType) { e.docType = 'Please select a document type'; }

    const needsCourtFields = docType === 'NBW' || docType === 'Summons';
    if (needsCourtFields) {
      if (!courtName.trim()) e.courtName = 'Court name is required';
      if (!vadSankhya.trim()) e.vadSankhya = 'Vad Sankhya is required';
      if (!apradhSankhya.trim()) e.apradhSankhya = 'Apradh Sankhya is required';
      if (!applicableSections.trim()) e.applicableSections = 'Applicable sections are required';
      if (!accused[0]?.name.trim()) e.accused0 = 'At least one accused name is required';
    }

    if (docType === 'Bail_Lower_Court') {
      if (!appellants[0]?.name.trim()) e.appellant0 = 'At least one appellant name is required';
      if (!fir.number.trim()) e.fir_number = 'FIR number is required';
      if (!fir.year.trim()) e.fir_year = 'FIR year is required';
      if (!fir.ps.trim()) e.fir_ps = 'Police station is required';
    }

    if (docType === 'High_Court_Documents') {
      if (!subType) e.subType = 'Please select High Court document type (Bail / Writ)';
      if (subType === 'Bail') {
        if (!fir.number.trim()) e.fir_number = 'FIR number is required';
        if (!fir.year.trim()) e.fir_year = 'FIR year is required';
        if (!fir.ps.trim()) e.fir_ps = 'Police station is required';
      }
      if (subType === 'Writ') {
        if (!writType) e.writType = 'Please select Writ type';
        if (!appellants[0]?.name.trim()) e.appellant0 = 'At least one appellant name is required';
        if (!matter.trim()) e.matter = 'Matter is required';
      }
    }

    if (docType === 'Anya') {
      if (!documentTitle.trim()) e.documentTitle = 'Document title is required';
      if (!appellants[0]?.name.trim()) e.appellant0 = 'At least one appellant / person name is required';
    }

    if (!deadlineDate.trim()) e.deadlineDate = 'Deadline date is required';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const personsPayload = [
        ...accused.filter((a) => a.name.trim()).map((a) => ({
          id: a.id, person_type: 'accused' as const,
          name: a.name, father_name: a.father_name,
          mobile: a.mobile, address: a.address, remarks: a.remarks,
        })),
        ...appellants.filter((a) => a.name.trim()).map((a) => ({
          id: a.id, person_type: 'appellant' as const,
          name: a.name, father_name: a.father_name,
          mobile: a.mobile, address: a.address, remarks: a.remarks,
        })),
      ];

      const checklistJson = (docType === 'High_Court_Documents' && subType === 'Bail')
        ? JSON.stringify(checklist.map((c, idx) => ({ id: c.id, label: c.label, is_optional: c.is_optional, is_done: c.is_checked, sort_order: idx })))
        : null;

      const payload = {
        doc_type: docType!,
        sub_type: subType ?? null,
        court_name: courtName,
        vad_sankhya: vadSankhya,
        apradh_sankhya: apradhSankhya,
        applicable_sections: applicableSections,
        fir_number: fir.number,
        fir_year: fir.year,
        fir_ps: fir.ps,
        matter,
        document_title: documentTitle,
        writ_type: writType ?? null,
        deadline_date: deadlineDate,
        checklist_json: checklistJson,
        persons: personsPayload,
      };

      if (isEdit && editId) {
        await updateNyayalayDocument(editId, payload);
      } else {
        await createNyayalayDocument(payload);
      }
      savedRef.current = true;
      setIsDirty(false);
      router.back();
    } catch {
      setErrors({ general: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Accused helpers — each marks dirty (user interaction) ──
  const updateAccused = (idx: number, field: keyof PersonForm, val: string) => {
    setAccused((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
    markDirty();
  };
  const addAccused = () => { setAccused((p) => [...p, emptyPerson('accused')]); markDirty(); };
  const removeAccused = (idx: number) => {
    if (accused.length > 1) { setAccused((p) => p.filter((_, i) => i !== idx)); markDirty(); }
  };

  // ── Appellant helpers — each marks dirty (user interaction) ──
  const updateAppellant = (idx: number, field: keyof PersonForm, val: string) => {
    setAppellants((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
    markDirty();
  };
  const addAppellant = () => { setAppellants((p) => [...p, emptyPerson('appellant')]); markDirty(); };
  const removeAppellant = (idx: number) => {
    if (appellants.length > 1) { setAppellants((p) => p.filter((_, i) => i !== idx)); markDirty(); }
  };

  // ── Render ──────────────────────────────────────────────────────────

  const showCourtFields = docType === 'NBW' || docType === 'Summons';
  const showBailLower = docType === 'Bail_Lower_Court';
  const showHC = docType === 'High_Court_Documents';
  const showHCBail = showHC && subType === 'Bail';
  const showHCWrit = showHC && subType === 'Writ';
  const showAnya = docType === 'Anya';

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={process.env.EXPO_OS === 'ios' ? 56 : 0}
      className="flex-1"
    >
      <View className="flex-1 bg-background">
        <AppHeader
          title="Court Document"
          subtitle={isEdit ? 'Edit' : 'New'}
          onBack={handleBack}
          rightActions={
            <Pressable onPress={handleSave} disabled={saving} className="bg-primary rounded-xl px-4 py-2 active:opacity-70">
              <Text className="text-sm font-semibold text-primary-foreground">{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          }
        />

        <ScrollView
          contentContainerClassName="px-5 pb-12"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {errors.general ? (
            <Text className="text-sm text-destructive mt-3">{errors.general}</Text>
          ) : null}

          {/* ── Document Type ── */}
          <Section title="Document Type" />
          <Picker
            label=""
            value={docType}
            options={DOC_TYPES}
            optionLabels={DOC_TYPE_LABELS as Record<string, string>}
            onChange={handleDocTypeChange}
            error={errors.docType}
            placeholder="Select document type…"
          />

          {/* ── NBW / Summons fields ── */}
          {showCourtFields && (
            <>
              <Section title="Court Details" />
              <Field label="Court Name *" error={errors.courtName}>
                <Input value={courtName} onChangeText={(v) => { setCourtName(v); markDirty(); }} placeholder="Court name" />
              </Field>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Vad Sankhya *" error={errors.vadSankhya}>
                    <Input value={vadSankhya} onChangeText={(v) => { setVadSankhya(v); markDirty(); }} placeholder="Vad no." />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="Apradh Sankhya *" error={errors.apradhSankhya}>
                    <Input value={apradhSankhya} onChangeText={(v) => { setApradhSankhya(v); markDirty(); }} placeholder="Apradh no." />
                  </Field>
                </View>
              </View>
              <Field label="Applicable Sections *" error={errors.applicableSections}>
                <Input type="multiline" value={applicableSections} onChangeText={(v) => { setApplicableSections(v); markDirty(); }} placeholder="e.g. IPC 302, 307" numberOfLines={2} />
              </Field>

              <Section title="Accused Details" />
              {accused.map((a, idx) => (
                <PersonCard
                  key={a._key}
                  person={a}
                  index={idx}
                  label="Accused"
                  onUpdate={(f, v) => updateAccused(idx, f, v)}
                  onRemove={() => removeAccused(idx)}
                  canRemove={accused.length > 1}
                  nameError={idx === 0 ? errors.accused0 : undefined}
                />
              ))}
              <Pressable
                onPress={addAccused}
                className="border border-dashed border-border rounded-xl p-3 items-center flex-row justify-center gap-2 mb-2 active:opacity-70"
              >
                <Plus size={16} color="#6B7280" />
                <Text className="text-sm text-muted-foreground">Add Another Accused</Text>
              </Pressable>
            </>
          )}

          {/* ── Bail Lower Court ── */}
          {showBailLower && (
            <>
              <Section title="Appellant Details" />
              {appellants.map((a, idx) => (
                <PersonCard
                  key={a._key}
                  person={a}
                  index={idx}
                  label="Appellant"
                  onUpdate={(f, v) => updateAppellant(idx, f, v)}
                  onRemove={() => removeAppellant(idx)}
                  canRemove={appellants.length > 1}
                  nameError={idx === 0 ? errors.appellant0 : undefined}
                />
              ))}
              <Pressable
                onPress={addAppellant}
                className="border border-dashed border-border rounded-xl p-3 items-center flex-row justify-center gap-2 mb-2 active:opacity-70"
              >
                <Plus size={16} color="#6B7280" />
                <Text className="text-sm text-muted-foreground">Add Another Appellant</Text>
              </Pressable>
              <FirSection fir={fir} onChange={(f) => { setFir(f); markDirty(); }} errors={errors} />
            </>
          )}

          {/* ── High Court Documents ── */}
          {showHC && (
            <>
              <Section title="High Court Document Type" />
              <Picker
                label=""
                value={subType}
                options={['Bail', 'Writ']}
                onChange={handleSubTypeChange}
                error={errors.subType}
                placeholder="Select Bail or Writ…"
              />

              {/* HC Bail */}
              {showHCBail && (
                <>
                  <ChecklistSection items={checklist} onChange={(items) => { setChecklist(items); markDirty(); }} />
                  <FirSection fir={fir} onChange={(f) => { setFir(f); markDirty(); }} errors={errors} />
                </>
              )}

              {/* HC Writ */}
              {showHCWrit && (
                <>
                  <Section title="Writ Type" />
                  <Picker
                    label=""
                    value={writType}
                    options={WRIT_TYPES}
                    onChange={(v) => { setWritType(v); markDirty(); }}
                    error={errors.writType}
                    placeholder="Select MB / CRLP / Anya…"
                  />

                  <Section title="Appellant Details" />
                  {appellants.map((a, idx) => (
                    <PersonCard
                      key={a._key}
                      person={a}
                      index={idx}
                      label="Appellant"
                      onUpdate={(f, v) => updateAppellant(idx, f, v)}
                      onRemove={() => removeAppellant(idx)}
                      canRemove={appellants.length > 1}
                      nameError={idx === 0 ? errors.appellant0 : undefined}
                    />
                  ))}
                  <Pressable
                    onPress={addAppellant}
                    className="border border-dashed border-border rounded-xl p-3 items-center flex-row justify-center gap-2 mb-2 active:opacity-70"
                  >
                    <Plus size={16} color="#6B7280" />
                    <Text className="text-sm text-muted-foreground">Add Another Appellant</Text>
                  </Pressable>

                  <Section title="Matter" />
                  <Field label="" error={errors.matter}>
                    <DocumentEditor
                      value={matter}
                      onChangeText={(v) => { setMatter(v); markDirty(); }}
                      title="Matter"
                      placeholder="Describe the matter…"
                      minHeight={110}
                      error={!!errors.matter}
                      accessibilityLabel="Matter editor"
                    />
                  </Field>
                </>
              )}
            </>
          )}

          {/* ── Anya ── */}
          {showAnya && (
            <>
              <Section title="Document Details" />
              <Field label="Document Title *" error={errors.documentTitle}>
                <Input value={documentTitle} onChangeText={(v) => { setDocumentTitle(v); markDirty(); }} placeholder="e.g. Pragati Aakhya, Mrityu Aakhya…" />
              </Field>

              <Section title="Appellant / Person Details" />
              {appellants.map((a, idx) => (
                <PersonCard
                  key={a._key}
                  person={a}
                  index={idx}
                  label="Person"
                  onUpdate={(f, v) => updateAppellant(idx, f, v)}
                  onRemove={() => removeAppellant(idx)}
                  canRemove={appellants.length > 1}
                  nameError={idx === 0 ? errors.appellant0 : undefined}
                />
              ))}
              <Pressable
                onPress={addAppellant}
                className="border border-dashed border-border rounded-xl p-3 items-center flex-row justify-center gap-2 mb-2 active:opacity-70"
              >
                <Plus size={16} color="#6B7280" />
                <Text className="text-sm text-muted-foreground">Add Another Person</Text>
              </Pressable>

              <FirSection fir={fir} onChange={(f) => { setFir(f); markDirty(); }} errors={errors} optional />
            </>
          )}

          {/* ── Deadline Date (all types) — DateTimePicker ── */}
          {docType && (
            <>
              <Section title="Deadline" />
              <DatePickerField
                label="Deadline Date *"
                value={deadlineDate}
                onChange={(v) => { setDeadlineDate(v); markDirty(); }}
                error={errors.deadlineDate}
                hint={showHC ? 'Auto-set to today + 15 days for new High Court docs. Edit if needed.' : undefined}
              />
            </>
          )}
        </ScrollView>

        {/* Back dialog */}
        <AlertDialog open={backDialog} onOpenChange={setBackDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            </AlertDialogHeader>
            <Text className="px-4 pb-2 text-sm text-muted-foreground">
              You have unsaved changes. Are you sure you want to discard this document?
            </Text>
            <AlertDialogFooter>
              <AlertDialogCancel onPress={() => setBackDialog(false)}><Text>Cancel</Text></AlertDialogCancel>
              <Pressable
                onPress={() => { setBackDialog(false); router.back(); }}
                className="bg-destructive rounded-xl px-4 py-2 ml-2 active:opacity-70"
              >
                <Text className="text-destructive-foreground text-sm font-semibold">Discard</Text>
              </Pressable>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </View>
    </KeyboardAvoidingView>
  );
}
